import { Client, types } from "cassandra-driver";
import { Readable } from "node:stream";
import type {
  BaseModelInstance,
  BatchQuery,
  CassandraClientOptions,
  FindQuery,
  ModelSchema,
  ModelStatic,
  QueryOptions,
  StreamOptions,
  CassandraValue,
  QueryParameters,
  DatabaseRow,
  ResultSet,
  EachRowOptions,
} from "./types.js";
import { DataExporter } from '../utils/exporter.js';
import { DataImporter, type ImportOptions } from '../utils/importer.js';
import { ElassandraClient, type ElasticsearchConfig, type SearchQuery } from '../elassandra/client.js';
import { ModelLoader } from '../utils/model-loader.js';
import { StreamingQuery, createModelStream } from '../utils/streaming.js';
import { UniqueConstraintManager } from '../validation/unique-constraints.js';

export abstract class BaseModel implements BaseModelInstance {
  _modified: Record<string, boolean> = {};
  _validators: Record<string, Function[]> = {};

  abstract save(options?: QueryOptions): Promise<this>;
  abstract saveAsync(options?: QueryOptions): Promise<this>;
  abstract delete(options?: QueryOptions): Promise<void>;
  abstract deleteAsync(options?: QueryOptions): Promise<void>;
  abstract toJSON(): Record<string, any>;
  abstract isModified(propName?: string): boolean;
  abstract validate(propName?: string): { [key: string]: string } | null;
}

export class CassandraClient {
  private client: Client;
  private models: Map<string, any> = new Map();
  private keyspace?: string;
  private exporter?: DataExporter;
  private importer?: DataImporter;
  private elassandraClient?: ElassandraClient;
  private streaming?: StreamingQuery;
  private uniqueManager?: UniqueConstraintManager;

  constructor(private options: CassandraClientOptions) {
    this.client = new Client(options.clientOptions);
    this.keyspace = options.clientOptions.keyspace;
  }

  async connect(): Promise<void> {
    // Connect without keyspace first
    const clientWithoutKeyspace = new Client({
      ...this.options.clientOptions,
      keyspace: undefined
    });
    
    await clientWithoutKeyspace.connect();
    
    // Create keyspace if it doesn't exist and auto-creation is enabled
    if (this.keyspace && this.options.ormOptions?.createKeyspace) {
      await this.createKeyspaceIfNotExists(clientWithoutKeyspace);
    }
    
    await clientWithoutKeyspace.shutdown();
    
    // Now connect with keyspace
    await this.client.connect();
    
    if (this.keyspace) {
      this.exporter = new DataExporter(this.client, this.keyspace);
      this.importer = new DataImporter(this.client, this.keyspace);
      this.uniqueManager = new UniqueConstraintManager(this.client, this.keyspace);
    }
    
    this.streaming = new StreamingQuery(this.client, this.keyspace);
  }

  private async createKeyspaceIfNotExists(client: Client): Promise<void> {
    const replication = this.options.ormOptions?.defaultReplicationStrategy || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };
    
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${this.keyspace}
      WITH REPLICATION = ${JSON.stringify(replication).replace(/"/g, "'")}
    `;
    
    await client.execute(query);
  }

  async disconnect(): Promise<void> {
    await this.client.shutdown();
  }

  // Direct execute method for convenience
  async execute(query: string, params?: any[], options?: any): Promise<any> {
    return this.client.execute(query, params, options);
  }

  // Getter for driver access
  get driver(): Client {
    return this.client;
  }

  // Elassandra support
  enableElassandra(config: ElasticsearchConfig): void {
    this.elassandraClient = new ElassandraClient(config);
  }

  async search(query: SearchQuery): Promise<any> {
    if (!this.elassandraClient) {
      throw new Error('Elassandra not enabled. Call enableElassandra() first.');
    }
    return this.elassandraClient.search(query);
  }

  // Export/Import functionality
  async export(fixtureDirectory: string): Promise<void> {
    if (!this.exporter) {
      throw new Error('Client not connected or keyspace not specified');
    }
    await this.exporter.exportAllTables(fixtureDirectory);
  }

  async import(fixtureDirectory: string, options: ImportOptions = {}): Promise<void> {
    if (!this.importer) {
      throw new Error('Client not connected or keyspace not specified');
    }
    await this.importer.importAllTables(fixtureDirectory, options);
  }

  // File-based model loading
  static setDirectory(directory: string): typeof CassandraClient {
    (CassandraClient as any).directory = directory;
    return CassandraClient;
  }

  static async bind(options: CassandraClientOptions, directory?: string): Promise<Map<string, any>> {
    const client = new CassandraClient(options);
    const dir = directory || (CassandraClient as any).directory;
    
    if (!dir) {
      throw new Error('Directory not specified. Use setDirectory() or pass directory parameter.');
    }

    return ModelLoader.bind(client, dir);
  }

  static async bindAsync(options: CassandraClientOptions, directory?: string): Promise<Map<string, any>> {
    return this.bind(options, directory);
  }

  // Streaming functionality
  eachRow(
    query: string,
    params: QueryParameters,
    options: EachRowOptions,
    onReadable: (n: number, row: DatabaseRow) => void,
    callback?: (err?: Error, result?: ResultSet) => void
  ): void {
    if (!this.streaming) {
      throw new Error('Client not connected');
    }
    this.streaming.eachRow(query, params, options, onReadable, callback);
  }

  streamQuery(query: string, params: QueryParameters = [], options: EachRowOptions = {}): NodeJS.ReadableStream {
    if (!this.streaming) {
      throw new Error('Client not connected');
    }
    return this.streaming.stream(query, params, options);
  }

  // UUID utilities (static methods from original)
  static uuid(): types.Uuid {
    return types.Uuid.random();
  }

  static uuidFromString(str: string): types.Uuid {
    return types.Uuid.fromString(str);
  }

  static uuidFromBuffer(buf: Buffer): types.Uuid {
    return new types.Uuid(buf);
  }

  static timeuuid(): types.TimeUuid {
    return types.TimeUuid.now();
  }

  static timeuuidFromDate(date: Date): types.TimeUuid {
    return types.TimeUuid.fromDate(date, 0);
  }

  static timeuuidFromString(str: string): types.TimeUuid {
    return types.TimeUuid.fromString(str);
  }

  static timeuuidFromBuffer(buf: Buffer): types.TimeUuid {
    return new types.TimeUuid(buf);
  }

  static maxTimeuuid(date: Date): types.TimeUuid {
    return types.TimeUuid.max(date, 0);
  }

  static minTimeuuid(date: Date): types.TimeUuid {
    return types.TimeUuid.min(date, 0);
  }

  // Instance methods for UUID utilities
  uuid = CassandraClient.uuid;
  uuidFromString = CassandraClient.uuidFromString;
  uuidFromBuffer = CassandraClient.uuidFromBuffer;
  timeuuid = CassandraClient.timeuuid;
  timeuuidFromDate = CassandraClient.timeuuidFromDate;
  timeuuidFromString = CassandraClient.timeuuidFromString;
  timeuuidFromBuffer = CassandraClient.timeuuidFromBuffer;
  maxTimeuuid = CassandraClient.maxTimeuuid;
  minTimeuuid = CassandraClient.minTimeuuid;

  // Getters for compatibility
  get consistencies() {
    return types.consistencies;
  }

  get datatypes() {
    return types;
  }

  get driver() {
    return this.client;
  }

  get instance() {
    return Object.fromEntries(this.models);
  }

  async close(): Promise<void> {
    await this.client.shutdown();
  }

  // Batch operations
  async doBatch(
    queries: BatchQuery[],
    options: QueryOptions = {},
  ): Promise<any> {
    const defaults = { prepare: true };
    const finalOptions = { ...defaults, ...options };

    // Execute before hooks
    for (const query of queries) {
      if (query.after_hook) {
        // Store for later execution
      }
    }

    let result;
    if (queries.length > 1) {
      result = await this.client.batch(
        queries.map((q) => ({ query: q.query, params: q.params })),
        finalOptions,
      );
    } else if (queries.length === 1) {
      result = await this.client.execute(
        queries[0].query,
        queries[0].params,
        finalOptions,
      );
    } else {
      // Empty batch - return empty result
      result = { rows: [] };
    }

    // Execute after hooks
    for (const query of queries) {
      if (query.after_hook) {
        const hookResult = query.after_hook();
        if (hookResult !== true) {
          throw hookResult instanceof Error
            ? hookResult
            : new Error("After hook failed");
        }
      }
    }

    return result;
  }

  // Table operations
  async getTableList(): Promise<string[]> {
    if (!this.keyspace) {
      throw new Error("Keyspace not specified");
    }

    const query =
      "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?";
    const result = await this.client.execute(query, [this.keyspace]);
    return result.rows.map((row) => row.table_name);
  }

  async loadSchema<T extends Record<string, any>>(
    name: string,
    schema: ModelSchema,
  ): Promise<ModelStatic<T>> {
    // Create table automatically if enabled
    if (this.options.ormOptions?.migration === 'safe' || this.options.ormOptions?.migration === 'alter') {
      await this.createTableFromSchema(name, schema);
    }
    
    // Process unique fields
    await this.processUniqueFields(name, schema);
    
    const ModelClass = this.createModelClass<T>(name, schema);
    this.models.set(name, ModelClass);
    return ModelClass;
  }

  private async createTableFromSchema(tableName: string, schema: ModelSchema): Promise<void> {
    const fields: string[] = [];
    
    // Process fields
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
      fields.push(`${fieldName} ${fieldType}`);
    }
    
    // Process primary key
    const primaryKey = Array.isArray(schema.key[0]) 
      ? `(${schema.key[0].join(', ')})${schema.key.slice(1).length > 0 ? ', ' + schema.key.slice(1).join(', ') : ''}`
      : schema.key.join(', ');
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${tableName} (
        ${fields.join(',\n        ')},
        PRIMARY KEY (${primaryKey})
      )
    `;
    
    try {
      await this.client.execute(query);
    } catch (error) {
      console.warn(`Warning: Could not create table ${tableName}:`, error);
    }
  }

  private async processUniqueFields(tableName: string, schema: ModelSchema): Promise<void> {
    const uniqueFields: string[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (typeof fieldDef === 'object' && fieldDef.unique) {
        uniqueFields.push(fieldName);
      }
    }
    
    if (uniqueFields.length > 0 && this.uniqueManager) {
      await this.uniqueManager.createUniqueTable(tableName, uniqueFields);
    }
  }

  private createModelClass<T extends Record<string, any>>(
    name: string,
    schema: ModelSchema,
  ): ModelStatic<T> {
    const client = this.client;
    const keyspace = this.keyspace;

    class Model extends BaseModel {
      constructor(data: Partial<T> = {}) {
        super();

        // Initialize field values and validators
        const fields = schema.fields;

        // First pass: set up property descriptors
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          if (typeof fieldDef === "object" && fieldDef.virtual) {
            // Handle virtual fields
            const descriptor: PropertyDescriptor = {
              enumerable: true,
              get: fieldDef.virtual.get?.bind(this),
              set: fieldDef.virtual.set?.bind(this),
            };
            Object.defineProperty(this, fieldName, descriptor);
          } else {
            // Regular fields with modification tracking
            Object.defineProperty(this, fieldName, {
              enumerable: true,
              get: () => (this as any)["_" + fieldName],
              set: (value) => {
                const oldValue = (this as any)["_" + fieldName];
                if (oldValue !== value) {
                  this._modified[fieldName] = true;
                }
                (this as any)["_" + fieldName] = value;
              },
            });
          }
        }

        // Second pass: set default values
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          if (typeof fieldDef === "object" && fieldDef.default !== undefined) {
            if (data[fieldName as keyof T] === undefined) {
              if (typeof fieldDef.default === "function") {
                (this as any)["_" + fieldName] = fieldDef.default.call(this);
              } else if (
                typeof fieldDef.default === "object" &&
                fieldDef.default !== null &&
                '$db_function' in fieldDef.default
              ) {
                // Database function defaults would be handled during save
                (this as any)["_" + fieldName] = undefined;
              } else {
                (this as any)["_" + fieldName] = fieldDef.default;
              }
            }
          }
        }

        // Third pass: set provided values (this will trigger modification tracking)
        const initialModified = { ...this._modified };
        Object.assign(this, data);
        // Reset modification tracking for initial values
        this._modified = initialModified;

        // Add methods from schema
        if (schema.methods) {
          for (const [methodName, method] of Object.entries(schema.methods)) {
            (this as any)[methodName] = method.bind(this);
          }
        }
      }

      async save(options: QueryOptions = {}): Promise<this> {
        return this.saveAsync(options);
      }

      async saveAsync(options: QueryOptions = {}): Promise<this> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before save hook
        if (schema.before_save && !schema.before_save(this as any, finalOptions)) {
          throw new Error("before_save hook returned false");
        }

        const fields = Object.keys(schema.fields);
        const values = fields.map((field) => (this as any)[field]);
        const placeholders = fields.map(() => "?").join(", ");

        let query = `INSERT INTO ${keyspace ? `"${keyspace}".` : ""}"${name}" (${fields.map((f) => `"${f}"`).join(", ")}) VALUES (${placeholders})`;

        // Handle TTL
        if (finalOptions.ttl) {
          query = query.replace(
            "VALUES",
            `USING TTL ${finalOptions.ttl} VALUES`,
          );
        }

        // Handle IF NOT EXISTS
        if (finalOptions.if_not_exist) {
          query += " IF NOT EXISTS";
        }

        await client.execute(query, values, finalOptions);

        // After save hook
        if (schema.after_save && !schema.after_save(this as any, finalOptions)) {
          throw new Error("after_save hook returned false");
        }

        // Reset modified flags
        this._modified = {};

        return this;
      }

      async delete(options: QueryOptions = {}): Promise<void> {
        return this.deleteAsync(options);
      }

      async deleteAsync(options: QueryOptions = {}): Promise<void> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before delete hook
        if (schema.before_delete && !schema.before_delete(this as any, finalOptions)) {
          throw new Error("before_delete hook returned false");
        }

        const keyFields = schema.key.flat();
        const whereClause = keyFields
          .map((field) => `"${field}" = ?`)
          .join(" AND ");
        const values = keyFields.map((field) => (this as any)[field]);

        const query = `DELETE FROM ${keyspace ? `"${keyspace}".` : ""}"${name}" WHERE ${whereClause}`;
        await client.execute(query, values, finalOptions);

        // After delete hook
        if (schema.after_delete && !schema.after_delete(this as any, finalOptions)) {
          throw new Error("after_delete hook returned false");
        }
      }

      toJSON(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const field of Object.keys(schema.fields)) {
          result[field] = (this as any)[field];
        }
        return result;
      }

      isModified(propName?: string): boolean {
        if (propName) {
          return !!this._modified[propName];
        }
        return Object.keys(this._modified).length > 0;
      }

      validate(propName?: string): { [key: string]: string } | null {
        // Simplified validation - would need full implementation
        return null;
      }

      // Static methods
      static async find(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model[]> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        let cqlQuery = `SELECT * FROM ${keyspace ? `"${keyspace}".` : ""}"${name}"`;
        const values: QueryParameters = [];

        // Build WHERE clause
        const whereConditions: string[] = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue; // Skip special operators
          whereConditions.push(`"${key}" = ?`);
          values.push(value);
        }

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        // Handle special operators
        if (query.$orderby) {
          const orderClauses = Object.entries(query.$orderby).map(
            ([field, direction]) => {
              const dir = Array.isArray(direction) ? direction[0] : direction;
              return `"${field}" ${String(dir).toUpperCase()}`;
            }
          );
          cqlQuery += ` ORDER BY ${orderClauses.join(", ")}`;
        }

        if (query.$limit) {
          cqlQuery += ` LIMIT ${query.$limit}`;
        }

        if (finalOptions.allow_filtering) {
          cqlQuery += " ALLOW FILTERING";
        }

        const result = await client.execute(cqlQuery, values, finalOptions);
        return result.rows.map(
          (row: any) => new Model(row as Partial<T>),
        );
      }

      static async findOne(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model | null> {
        const results = await this.find({ ...query, $limit: 1 }, options);
        return results.length > 0 ? results[0] : null;
      }

      static async findOneAsync(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model | null> {
        return this.findOne(query, options);
      }

      static async update(
        query: FindQuery,
        updateValues: Partial<T>,
        options: QueryOptions = {},
      ): Promise<any> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before update hook
        if (
          schema.before_update &&
          !schema.before_update(query, updateValues, finalOptions)
        ) {
          throw new Error("before_update hook returned false");
        }

        const setClauses = Object.keys(updateValues).map(
          (key) => `"${key}" = ?`,
        );
        const setValues = Object.values(updateValues) as CassandraValue[];

        const whereConditions: string[] = [];
        const whereValues: QueryParameters = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue;
          whereConditions.push(`"${key}" = ?`);
          whereValues.push(value as CassandraValue);
        }

        let cqlQuery = `UPDATE ${keyspace ? `"${keyspace}".` : ""}"${name}"`;

        if (finalOptions.ttl) {
          cqlQuery += ` USING TTL ${finalOptions.ttl}`;
        }

        cqlQuery += ` SET ${setClauses.join(", ")}`;

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        const allValues = (setValues as CassandraValue[]).concat(whereValues);
        const result = await client.execute(
          cqlQuery,
          allValues,
          finalOptions,
        );

        // After update hook
        if (
          schema.after_update &&
          !schema.after_update(query, updateValues, finalOptions)
        ) {
          throw new Error("after_update hook returned false");
        }

        return result;
      }

      static async updateAsync(
        query: FindQuery,
        updateValues: Partial<T>,
        options: QueryOptions = {},
      ): Promise<any> {
        return this.update(query, updateValues, options);
      }

      static async delete(
        query: FindQuery,
        options: QueryOptions = {},
      ): Promise<any> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before delete hook
        if (
          schema.before_delete &&
          !schema.before_delete(query, finalOptions)
        ) {
          throw new Error("before_delete hook returned false");
        }

        const whereConditions: string[] = [];
        const whereValues: QueryParameters = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue;
          whereConditions.push(`"${key}" = ?`);
          whereValues.push(value as CassandraValue);
        }

        let cqlQuery = `DELETE FROM ${keyspace ? `"${keyspace}".` : ""}"${name}"`;

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        const result = await client.execute(
          cqlQuery,
          whereValues,
          finalOptions,
        );

        // After delete hook
        if (schema.after_delete && !schema.after_delete(query, finalOptions)) {
          throw new Error("after_delete hook returned false");
        }

        return result;
      }

      static async deleteAsync(
        query: FindQuery,
        options: QueryOptions = {},
      ): Promise<any> {
        return this.delete(query, options);
      }

      static stream(
        query: FindQuery = {},
        options: StreamOptions = {},
      ): NodeJS.ReadableStream {
        return createModelStream(this as any, query, options);
      }

      static eachRow(
        query: FindQuery = {},
        options: EachRowOptions,
        onReadable: (n: number, row: Model) => void,
        callback?: (err?: Error, result?: ResultSet) => void
      ): void {
        const stream = this.stream(query, options);
        let rowCount = 0;

        stream.on('data', (row) => {
          rowCount++;
          onReadable(rowCount, row);
        });

        stream.on('end', () => {
          if (callback) callback(undefined, { rows: [], rowLength: rowCount } as any);
        });

        stream.on('error', (err) => {
          if (callback) callback(err);
        });
      }

      static get_cql_client(): Client {
        return client;
      }

      static async execute_query(
        query: string,
        params: QueryParameters = [],
        options: QueryOptions = {},
      ): Promise<ResultSet> {
        const client = this.get_cql_client();
        return client.execute(query, params, options);
      }

      static async execute_batch(
        queries: BatchQuery[],
        options: QueryOptions = {},
      ): Promise<ResultSet> {
        const client = this.get_cql_client();
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };
        return client.batch(
          queries.map((q) => ({ query: q.query, params: q.params })),
          finalOptions,
        );
      }

      static syncDB(callback?: (err?: Error, result?: boolean) => void): void {
        // Schema synchronization would be implemented here
        if (callback) callback(undefined, true);
      }

      static async syncDBAsync(): Promise<void> {
        return new Promise((resolve, reject) => {
          this.syncDB((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      static truncate(callback?: (err?: Error) => void): void {
        const query = `TRUNCATE ${keyspace ? `"${keyspace}".` : ""}"${name}"`;
        client
          .execute(query)
          .then(() => {
            if (callback) callback();
          })
          .catch((err) => {
            if (callback) callback(err);
          });
      }

      static async truncateAsync(): Promise<void> {
        return new Promise((resolve, reject) => {
          this.truncate((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Properties
      static _properties = {
        name,
        schema,
      };
    }

    return Model as any;
  }
}
