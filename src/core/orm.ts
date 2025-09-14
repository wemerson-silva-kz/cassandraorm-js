import { Client } from 'cassandra-driver';
import { ConnectionPool } from '../connection/pool.js';
import { QueryBuilder } from '../query/query-builder.js';
import { MigrationManager } from '../utils/migrations.js';
import { Monitor } from '../observability/monitoring.js';
import { PluginManager, CachePlugin, ValidationPlugin } from '../utils/plugin-system.js';
import { UniqueConstraintManager } from '../validation/unique-constraints.js';
import { BulkWriter } from '../data/bulk-writer.js';

interface CassandraORMOptions {
  contactPoints?: string[];
  localDataCenter?: string;
  keyspace?: string;
  migrationsPath?: string;
  monitoring?: any;
  replication?: {
    class: string;
    replication_factor: number;
  };
}

export class CassandraORM {
  private options: CassandraORMOptions;
  private keyspace?: string;
  private models = new Map<string, any>();
  private connectionPool: ConnectionPool;
  private monitor: Monitor;
  private pluginManager: PluginManager;
  private migrationManager?: MigrationManager;
  private uniqueManager?: UniqueConstraintManager;
  public client?: Client;

  constructor(options: CassandraORMOptions = {}) {
    this.options = options;
    this.keyspace = options.keyspace;
    
    this.connectionPool = new ConnectionPool(options);
    this.monitor = new Monitor(options.monitoring);
    this.pluginManager = new PluginManager();
  }

  async connect(): Promise<void> {
    this.client = await this.connectionPool.getConnection(this.keyspace);
    this.monitor.recordConnection('connect');
    
    this.migrationManager = new MigrationManager(this.client, { keyspace: this.keyspace });
    this.uniqueManager = new UniqueConstraintManager(this.client, this.keyspace || '');
    
    await this.pluginManager.executeHook('afterConnect', { client: this.client });
    this.monitor.log('info', 'Connected to Cassandra', { keyspace: this.keyspace });
  }

  async createKeyspace(): Promise<void> {
    if (!this.client || !this.keyspace) throw new Error('Not connected or keyspace not specified');
    
    const replication = this.options.replication || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };
    
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${this.keyspace}
      WITH REPLICATION = ${JSON.stringify(replication).replace(/"/g, "'")}
    `;
    
    await this.client.execute(query);
  }

  model(name: string, schema: any, options: any = {}): any {
    if (!this.client) throw new Error('Not connected. Call connect() first.');
    
    const model = new Model(name, schema, this.client, this, options);
    this.models.set(name, model);
    return model;
  }

  uuid() {
    return require('cassandra-driver').types.Uuid.random();
  }

  addUniqueConstraint(tableName: string, uniqueFields: string[]): Promise<void> {
    if (!this.uniqueManager) throw new Error('Not connected. Call connect() first.');
    return this.uniqueManager.createUniqueTable(tableName, uniqueFields);
  }

  bulkWriter(options: any = {}): BulkWriter {
    if (!this.client) throw new Error('Not connected. Call connect() first.');
    return new BulkWriter(this.client, this.keyspace || '', {
      uniqueManager: this.uniqueManager,
      ...options
    });
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.connectionPool.closeAll();
      this.monitor.log('info', 'Connection closed');
    }
  }
}

class Model {
  constructor(
    public name: string,
    private schema: any,
    private client: Client,
    private orm: CassandraORM,
    private options: any = {}
  ) {}

  async create(data: any): Promise<any> {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${this.name} (${fields}) VALUES (${placeholders})`;
    await this.client.execute(query, values, { prepare: true });
    return data;
  }

  async find(where: any = {}, options: any = {}): Promise<any[]> {
    let query = `SELECT * FROM ${this.name}`;
    const values: any[] = [];

    if (Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .map(([key, value]) => {
          values.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      
      query += ` WHERE ${conditions}`;
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.client.execute(query, values, { prepare: true });
    return result.rows;
  }
}

export { Model };
