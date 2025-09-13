import type { Client } from "cassandra-driver";
import type { UniqueConstraintManager } from "./unique-constraints.js";

export interface BulkWriterOptions {
  batchSize?: number;
  skipDuplicates?: boolean;
  uniqueManager?: UniqueConstraintManager;
}

export interface BulkOperation {
  type: 'insert' | 'update' | 'delete';
  tableName: string;
  data?: Record<string, any>;
  where?: Record<string, any>;
  options?: {
    skipIfExists?: boolean;
    [key: string]: any;
  };
}

export interface BulkResult {
  inserted: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: Array<{ operation?: BulkOperation; batch?: boolean; error: string }>;
}

export class BulkWriter {
  private operations: BulkOperation[] = [];
  private batchSize: number;
  private skipDuplicates: boolean;
  private uniqueManager?: UniqueConstraintManager;

  constructor(
    private client: Client,
    private keyspace: string,
    options: BulkWriterOptions = {}
  ) {
    this.batchSize = options.batchSize || 100;
    this.skipDuplicates = options.skipDuplicates !== false;
    this.uniqueManager = options.uniqueManager;
  }

  insert(tableName: string, data: Record<string, any>, options: { skipIfExists?: boolean } = {}): this {
    this.operations.push({
      type: 'insert',
      tableName,
      data,
      options: { skipIfExists: options.skipIfExists !== false, ...options }
    });
    return this;
  }

  update(tableName: string, data: Record<string, any>, where: Record<string, any>, options: Record<string, any> = {}): this {
    this.operations.push({
      type: 'update',
      tableName,
      data,
      where,
      options
    });
    return this;
  }

  delete(tableName: string, where: Record<string, any>, options: Record<string, any> = {}): this {
    this.operations.push({
      type: 'delete',
      tableName,
      where,
      options
    });
    return this;
  }

  async execute(): Promise<BulkResult> {
    const results: BulkResult = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < this.operations.length; i += this.batchSize) {
      const batch = this.operations.slice(i, i + this.batchSize);
      const batchResult = await this.executeBatch(batch);
      
      results.inserted += batchResult.inserted;
      results.updated += batchResult.updated;
      results.deleted += batchResult.deleted;
      results.skipped += batchResult.skipped;
      results.errors.push(...batchResult.errors);
    }

    return results;
  }

  private async executeBatch(operations: BulkOperation[]): Promise<BulkResult> {
    const queries: Array<{ query: string; params: any[] }> = [];
    const results: BulkResult = { inserted: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };

    for (const op of operations) {
      try {
        const query = await this.buildQuery(op);
        if (query) {
          queries.push(query);
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors.push({ 
          operation: op, 
          error: error instanceof Error ? error.message : String(error) 
        });
        if (!this.skipDuplicates) {
          throw error;
        }
        results.skipped++;
      }
    }

    if (queries.length > 0) {
      try {
        await this.client.batch(queries, { prepare: true });
        
        operations.forEach(op => {
          if (op.type === 'insert') results.inserted++;
          else if (op.type === 'update') results.updated++;
          else if (op.type === 'delete') results.deleted++;
        });
      } catch (error) {
        results.errors.push({ 
          batch: true, 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }

    return results;
  }

  private async buildQuery(operation: BulkOperation): Promise<{ query: string; params: any[] } | null> {
    const { type, tableName, data, where, options } = operation;

    switch (type) {
      case 'insert':
        return this.buildInsertQuery(tableName, data!, options);
      case 'update':
        return this.buildUpdateQuery(tableName, data!, where!, options);
      case 'delete':
        return this.buildDeleteQuery(tableName, where!, options);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private async buildInsertQuery(
    tableName: string, 
    data: Record<string, any>, 
    options: BulkOperation['options'] = {}
  ): Promise<{ query: string; params: any[] } | null> {
    
    if (this.uniqueManager && options?.skipIfExists) {
      try {
        await this.uniqueManager.checkUnique(tableName, data);
      } catch (error) {
        if (this.skipDuplicates) {
          return null;
        }
        throw error;
      }
    }

    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    // Don't use IF NOT EXISTS in batch operations to avoid Cassandra limitations
    const query = `INSERT INTO ${this.keyspace}.${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;

    return { query, params: values };
  }

  private buildUpdateQuery(
    tableName: string, 
    data: Record<string, any>, 
    where: Record<string, any>, 
    options: BulkOperation['options'] = {}
  ): { query: string; params: any[] } {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    
    const query = `UPDATE ${this.keyspace}.${tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];

    return { query, params };
  }

  private buildDeleteQuery(
    tableName: string, 
    where: Record<string, any>, 
    options: BulkOperation['options'] = {}
  ): { query: string; params: any[] } {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    
    const query = `DELETE FROM ${this.keyspace}.${tableName} WHERE ${whereClause}`;
    const params = Object.values(where);

    return { query, params };
  }

  clear(): this {
    this.operations = [];
    return this;
  }

  count(): number {
    return this.operations.length;
  }
}
