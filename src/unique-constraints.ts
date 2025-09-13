import type { Client } from "cassandra-driver";

export interface UniqueConstraintOptions {
  tableName: string;
  uniqueFields: string[];
}

export class UniqueConstraintManager {
  private uniqueTables = new Map<string, UniqueConstraintOptions>();

  constructor(
    private client: Client,
    private keyspace: string
  ) {}

  async createUniqueTable(tableName: string, uniqueFields: string[]): Promise<void> {
    const uniqueTableName = `${tableName}_unique`;
    
    const fields = uniqueFields.map(field => `${field} text`).join(', ');
    const primaryKey = uniqueFields.join(', ');
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${uniqueTableName} (
        ${fields},
        created_at timestamp,
        PRIMARY KEY (${primaryKey})
      )
    `;
    
    await this.client.execute(query);
    this.uniqueTables.set(tableName, { tableName: uniqueTableName, uniqueFields });
  }

  async checkUnique(tableName: string, data: Record<string, any>): Promise<boolean> {
    const uniqueInfo = this.uniqueTables.get(tableName);
    if (!uniqueInfo) return true;

    const { tableName: uniqueTableName, uniqueFields } = uniqueInfo;
    
    for (const field of uniqueFields) {
      if (data[field] !== undefined) {
        const query = `SELECT ${field} FROM ${this.keyspace}.${uniqueTableName} WHERE ${field} = ?`;
        const result = await this.client.execute(query, [data[field]], { prepare: true });
        
        if (result.rows.length > 0) {
          throw new Error(`Duplicate value for unique field '${field}': ${data[field]}`);
        }
      }
    }
    return true;
  }

  async insertUnique(tableName: string, data: Record<string, any>): Promise<void> {
    const uniqueInfo = this.uniqueTables.get(tableName);
    if (!uniqueInfo) return;

    const { tableName: uniqueTableName, uniqueFields } = uniqueInfo;
    
    for (const field of uniqueFields) {
      if (data[field] !== undefined) {
        const query = `INSERT INTO ${this.keyspace}.${uniqueTableName} (${field}, created_at) VALUES (?, ?)`;
        await this.client.execute(query, [data[field], new Date()], { prepare: true });
      }
    }
  }

  async removeUnique(tableName: string, data: Record<string, any>): Promise<void> {
    const uniqueInfo = this.uniqueTables.get(tableName);
    if (!uniqueInfo) return;

    const { tableName: uniqueTableName, uniqueFields } = uniqueInfo;
    
    for (const field of uniqueFields) {
      if (data[field] !== undefined) {
        const query = `DELETE FROM ${this.keyspace}.${uniqueTableName} WHERE ${field} = ?`;
        await this.client.execute(query, [data[field]], { prepare: true });
      }
    }
  }
}
