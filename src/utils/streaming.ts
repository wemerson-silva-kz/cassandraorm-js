import { Client } from 'cassandra-driver';
import { Readable, Transform } from 'stream';
import type { QueryOptions, FindQuery, QueryParameters, DatabaseRow, CassandraValue, any, ResultSet } from '../core/types.js';

export interface StreamResult {
  rowCount: number;
  pageState?: string;
  nextPage?: () => void;
}

export class StreamingQuery {
  constructor(private client: Client, private keyspace?: string) {}

  eachRow(
    query: string, 
    params: QueryParameters, 
    options: any,
    onReadable: (n: number, row: DatabaseRow) => void,
    callback?: (err?: Error, result?: ResultSet) => void
  ): void {
    const finalOptions = {
      prepare: true,
      autoPage: true,
      fetchSize: 1000,
      ...options
    };

    this.client.eachRow(query, params, finalOptions, onReadable, callback);
  }

  stream(query: string, params: QueryParameters = [], options: any = {}): NodeJS.ReadableStream {
    const readable = new Readable({ objectMode: true });
    let rowCount = 0;

    this.eachRow(
      query,
      params,
      options,
      (n, row) => {
        rowCount++;
        readable.push(row);
      },
      (err, result) => {
        if (err) {
          readable.emit('error', err);
        } else {
          readable.push(null); // End stream
          readable.emit('result', { rowCount, ...result });
        }
      }
    );

    return readable;
  }

  createTransformStream<T extends DatabaseRow, R>(
    transformer: (row: T) => R | Promise<R>
  ): Transform {
    return new Transform({
      objectMode: true,
      async transform(chunk: T, encoding, callback) {
        try {
          const result = await transformer(chunk);
          callback(null, result);
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  createFilterStream<T extends DatabaseRow>(
    predicate: (row: T) => boolean | Promise<boolean>
  ): Transform {
    return new Transform({
      objectMode: true,
      async transform(chunk: T, encoding, callback) {
        try {
          const shouldInclude = await predicate(chunk);
          if (shouldInclude) {
            callback(null, chunk);
          } else {
            callback(); // Skip this chunk
          }
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  createBatchStream<T>(batchSize: number): Transform {
    let batch: T[] = [];

    return new Transform({
      objectMode: true,
      transform(chunk: T, encoding, callback) {
        batch.push(chunk);
        
        if (batch.length >= batchSize) {
          callback(null, [...batch]);
          batch = [];
        } else {
          callback();
        }
      },
      flush(callback) {
        if (batch.length > 0) {
          callback(null, batch);
        } else {
          callback();
        }
      }
    });
  }
}

export function createModelStream<T extends DatabaseRow>(
  ModelClass: {
    new(data: Partial<T>): T;
    get_cql_client(): Client;
    _properties: { name: string };
  },
  query: FindQuery = {},
  options: any = {}
): NodeJS.ReadableStream {
  const client = ModelClass.get_cql_client();
  const streaming = new StreamingQuery(client);
  
  // Build CQL query from FindQuery
  const tableName = ModelClass._properties.name;
  let cqlQuery = `SELECT * FROM "${tableName}"`;
  const values: QueryParameters = [];
  
  // Build WHERE clause
  const whereConditions: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('$')) continue; // Skip special operators
    whereConditions.push(`"${key}" = ?`);
    values.push(value as CassandraValue);
  }
  
  if (whereConditions.length > 0) {
    cqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;
  }

  // Handle special operators
  if (query.$orderby) {
    const orderClauses = Object.entries(query.$orderby)
      .map(([field, direction]) => {
        const dir = Array.isArray(direction) ? direction[0] : direction;
        return `"${field}" ${String(dir).toUpperCase()}`;
      });
    cqlQuery += ` ORDER BY ${orderClauses.join(', ')}`;
  }

  if (query.$limit) {
    cqlQuery += ` LIMIT ${query.$limit}`;
  }

  if (options.allow_filtering) {
    cqlQuery += ' ALLOW FILTERING';
  }

  return streaming.stream(cqlQuery, values, options)
    .pipe(streaming.createTransformStream((row: any) => new ModelClass(row)));
}
