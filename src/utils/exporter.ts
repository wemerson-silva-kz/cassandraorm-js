import { Client } from 'cassandra-driver';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { CassandraValue, DatabaseRow } from '../core/types.js';

export class DataExporter {
  constructor(private client: Client, private keyspace: string) {}

  async exportTable(tableName: string, outputDir: string): Promise<void> {
    const query = `SELECT * FROM "${this.keyspace}"."${tableName}"`;
    const result = await this.client.execute(query);
    
    const data = result.rows.map(row => {
      const obj: DatabaseRow = {};
      for (const [key, value] of Object.entries(row)) {
        obj[key] = this.serializeValue(value);
      }
      return obj;
    });

    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, `${tableName}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async exportAllTables(outputDir: string): Promise<void> {
    const tablesQuery = 'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?';
    const result = await this.client.execute(tablesQuery, [this.keyspace]);
    
    const tables = result.rows.map(row => row.table_name as string);
    
    for (const table of tables) {
      await this.exportTable(table, outputDir);
    }
  }

  private serializeValue(value: unknown): any {
    if (value === null || value === undefined) return value;
    
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([k, v]) => [k, this.serializeValue(v)]));
    if (value instanceof Set) return Array.from(value).map(v => this.serializeValue(v));
    if (Array.isArray(value)) return value.map(v => this.serializeValue(v));
    if (typeof value === 'object' && value !== null) {
      const obj: Record<string, CassandraValue> = {};
      for (const [k, v] of Object.entries(value)) {
        obj[k] = this.serializeValue(v);
      }
      return obj;
    }
    
    return value as CassandraValue;
  }
}
