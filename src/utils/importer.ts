import { Client } from 'cassandra-driver';
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import type { CassandraValue, DatabaseRow, QueryParameters } from '../types.js';

export interface ImportOptions {
  batchSize?: number;
  truncate?: boolean;
}

export class DataImporter {
  constructor(private client: Client, private keyspace: string) {}

  async importTable(tableName: string, inputDir: string, options: ImportOptions = {}): Promise<void> {
    const { batchSize = 100, truncate = false } = options;
    
    if (truncate) {
      await this.client.execute(`TRUNCATE "${this.keyspace}"."${tableName}"`);
    }

    const filePath = join(inputDir, `${tableName}.json`);
    const fileContent = await readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent) as DatabaseRow[];

    if (!Array.isArray(data) || data.length === 0) return;

    // Get table schema to build insert query
    const schemaQuery = 'SELECT column_name FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?';
    const schemaResult = await this.client.execute(schemaQuery, [this.keyspace, tableName]);
    const columns = schemaResult.rows.map(row => row.column_name as string);

    const placeholders = columns.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO "${this.keyspace}"."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;

    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const queries = batch.map(row => ({
        query: insertQuery,
        params: columns.map(col => this.deserializeValue(row[col]))
      }));

      await this.client.batch(queries, { prepare: true });
    }
  }

  async importAllTables(inputDir: string, options: ImportOptions = {}): Promise<void> {
    const files = await readdir(inputDir);
    const jsonFiles = files.filter(file => extname(file) === '.json');
    
    for (const file of jsonFiles) {
      const tableName = file.replace('.json', '');
      await this.importTable(tableName, inputDir, options);
    }
  }

  private deserializeValue(value: unknown): CassandraValue {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return new Date(value);
    }
    
    if (Array.isArray(value)) return value.map(v => this.deserializeValue(v));
    
    if (typeof value === 'object' && value !== null) {
      const obj: Record<string, CassandraValue> = {};
      for (const [k, v] of Object.entries(value)) {
        obj[k] = this.deserializeValue(v);
      }
      return obj;
    }
    
    return value as CassandraValue;
  }
}
