import { Client, types } from 'cassandra-driver';
import { ConnectionPool } from '../connection/pool.js';
import { QueryBuilder } from '../query/query-builder.js';
import { SemanticCache } from '../cache/semantic-cache.js';
import { AIMLManager } from '../integrations/ai-ml.js';
import { EventStore } from '../integrations/event-sourcing.js';
import { SubscriptionManager } from '../integrations/subscriptions.js';
import { DistributedTransactionManager } from '../integrations/distributed-transactions.js';
import type { CassandraClientOptions, ModelSchema, QueryOptions } from './types.js';

export class BatchBuilder {
  private queries: Array<{ query: string; params?: any[] }> = [];
  
  constructor(private client: CassandraClient) {}
  
  add(query: string, params?: any[]): this {
    (this as any).queries.push({ query, params });
    return this;
  }
  
  async execute(): Promise<any> {
    const batch = (this as any).queries.map(q => ({ query: q.query, params: q.params }));
    return await ((this as any).client as any).cassandraDriver.batch(batch, { prepare: true });
  }
}

export class BaseModel {
  constructor(
    private client: CassandraClient,
    private tableName: string,
    private schema: ModelSchema
  ) {}

  private getFullTableName(): string {
    const keyspace = ((this as any).client as any).clientOptions.keyspace;
    return keyspace ? `${keyspace}.${(this as any).tableName}` : (this as any).tableName;
  }

  async save(data: any): Promise<any> {
    const fields = Object.keys(data);
    const schema = (this as any).schema;
    
    // Convert values according to schema types
    const values = Object.values(data).map((value, index) => {
      const fieldName = fields[index];
      const fieldType = schema.fields[fieldName];
      
      if (value instanceof Set) {
        return Array.from(value);
      }
      
      // Convert decimal values to strings for Cassandra
      if (fieldType === 'decimal' && typeof value === 'number') {
        return value.toString();
      }
      
      return value;
    });
    
    const placeholders = fields.map(() => '?').join(', ');
    
    const query = `INSERT INTO ${(this as any).getFullTableName()} (${fields.join(', ')}) VALUES (${placeholders})`;
    await ((this as any).client as any).execute(query, values, { prepare: true });
    return data;
  }

  async find(where: any = {}, options: QueryOptions = {}): Promise<any[]> {
    let query = `SELECT * FROM ${(this as any).getFullTableName()}`;
    const params: any[] = [];
    
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const result = await ((this as any).client as any).execute(query, params, { prepare: true });
    return result.rows;
  }

  async findOne(where: any = {}, options: QueryOptions = {}): Promise<any | null> {
    const results = await (this as any).find(where, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async update(where: any, data: any): Promise<void> {
    const setFields = Object.keys(data);
    const setValues = Object.values(data);
    const whereFields = Object.keys(where);
    const whereValues = Object.values(where);
    
    const setClause = setFields.map(field => `${field} = ?`).join(', ');
    const whereClause = whereFields.map(field => `${field} = ?`).join(' AND ');
    
    const query = `UPDATE ${(this as any).getFullTableName()} SET ${setClause} WHERE ${whereClause}`;
    await ((this as any).client as any).execute(query, [...setValues, ...whereValues], { prepare: true });
  }

  async count(where: any = {}): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${(this as any).getFullTableName()}`;
    const params: any[] = [];
    
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const result = await ((this as any).client as any).execute(query, params, { prepare: true });
    const countValue = result.rows[0]?.count || 0;
    
    // Handle Cassandra Long objects
    if (typeof countValue === 'object' && countValue !== null) {
      return parseInt(countValue.toString(), 10);
    }
    
    return typeof countValue === 'number' ? countValue : parseInt(countValue?.toString() || '0', 10);
  }

  async create(data: any): Promise<any> {
    // Generate UUID for id if not provided
    if (!data.id && (this as any).schema.fields.id) {
      data.id = CassandraClient.uuid();
    }
    return await (this as any).save(data);
  }

  async delete(where: any): Promise<void> {
    const whereFields = Object.keys(where);
    const whereValues = Object.values(where);
    const whereClause = whereFields.map(field => `${field} = ?`).join(' AND ');
    
    const query = `DELETE FROM ${(this as any).getFullTableName()} WHERE ${whereClause}`;
    await ((this as any).client as any).execute(query, whereValues, { prepare: true });
  }

  async delete(where: any): Promise<void> {
    const fields = Object.keys(where);
    const values = Object.values(where);
    const conditions = fields.map(field => `${field} = ?`).join(' AND ');
    
    const query = `DELETE FROM ${(this as any).tableName} WHERE ${conditions}`;
    await ((this as any).client as any).execute(query, values);
  }
}

export class CassandraClient {
  private cassandraDriver!: Client;
  private connectionPool?: ConnectionPool;
  private semanticCache?: SemanticCache;
  private queryMetrics: any[] = [];
  private aiml?: AIMLManager;
  private eventStore?: EventStore;
  private subscriptions?: SubscriptionManager;
  private transactions?: DistributedTransactionManager;
  private clientOptions: any;
  private ormOptions: any;

  constructor(options: CassandraClientOptions) {
    this.clientOptions = options.clientOptions || {};
    this.ormOptions = options.ormOptions || {};
    
    // Create connection options without keyspace initially
    const connectionOptions = { ...this.clientOptions };
    delete connectionOptions.keyspace; // Remove keyspace from initial connection
    
    (this as any).cassandraDriver = new Client(connectionOptions);
  }

  // Add missing properties as getters
  get driver(): Client {
    return this.cassandraDriver;
  }

  get consistencies() {
    return types.consistencies;
  }

  get datatypes() {
    return types;
  }

  // Static UUID methods
  static uuid(): string {
    return types.Uuid.random().toString();
  }

  static timeuuid(): string {
    return types.TimeUuid.now().toString();
  }

  static uuidFromString(str: string): string {
    return types.Uuid.fromString(str).toString();
  }

  // Instance UUID methods for backward compatibility
  uuid(): string {
    return CassandraClient.uuid();
  }

  timeuuid(): string {
    return CassandraClient.timeuuid();
  }

  uuidFromString(str: string): string {
    return CassandraClient.uuidFromString(str);
  }

  getConnectionState(): any {
    const driver = (this as any).cassandraDriver;
    const state = driver ? driver.getState() : null;
    
    return {
      connected: state && state.getConnectedHosts().length > 0,
      hosts: state ? state.getConnectedHosts().map((h: any) => h.address) : [],
      keyspace: (this as any).clientOptions.keyspace,
      errorRate: 0,
      avgLatency: 0
    };
  }

  isConnected(): boolean {
    const driver = (this as any).cassandraDriver;
    const state = driver ? driver.getState() : null;
    return state && state.getConnectedHosts().length > 0;
  }

  createBatch(): any {
    const driver = (this as any).cassandraDriver;
    const queries: any[] = [];
    
    return {
      add: (query: string, params?: any[]) => {
        queries.push({ query, params });
      },
      execute: async () => {
        return await driver.batch(queries, { prepare: true });
      }
    };
  }

  async connect(): Promise<void> {
    try {
      await (this as any).cassandraDriver.connect();
      
      if ((this as any).ormOptions.createKeyspace && (this as any).clientOptions.keyspace) {
        await (this as any).createKeyspace();
      }
      
      await (this as any).initializeEssentialFeatures();
    } catch (error: any) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if ((this as any).cassandraDriver) {
      await (this as any).cassandraDriver.shutdown();
    }
  }

  private async createKeyspace(): Promise<void> {
    const keyspace = (this as any).clientOptions.keyspace;
    const query = `CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`;
    await (this as any).cassandraDriver.execute(query);
    // Don't use the keyspace here - let individual queries specify it
  }

  private async initializeEssentialFeatures(): Promise<void> {
    const keyspace = (this as any).clientOptions.keyspace;
    if (!keyspace || !(this as any).cassandraDriver) return;

    (this as any).semanticCache = new SemanticCache({ similarityThreshold: 0.85 });
    
    if ((this as any).ormOptions.migration) {
      try {
        (this as any).aiml = new AIMLManager((this as any).cassandraDriver, keyspace);
        (this as any).eventStore = new EventStore((this as any).cassandraDriver, { keyspace });
        (this as any).subscriptions = new SubscriptionManager((this as any).cassandraDriver, keyspace);
        (this as any).transactions = new DistributedTransactionManager((this as any).cassandraDriver, keyspace);
      } catch (error: any) {
        throw new Error(`Feature initialization failed: ${error.message}`);
      }
    }
  }

  query(table?: string): QueryBuilder {
    const builder = new QueryBuilder(this);
    return table ? builder.from(table) : builder;
  }

  createBatch(): BatchBuilder {
    return new BatchBuilder(this);
  }

  async execute(query: string, params?: any[], options?: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await (this as any).cassandraDriver.execute(query, params, options);
      
      const duration = Date.now() - startTime;
      (this as any).queryMetrics.push({
        query,
        duration,
        timestamp: new Date()
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      (this as any).queryMetrics.push({
        query,
        duration,
        timestamp: new Date(),
        error: error.message
      });
      throw error;
    }
  }

  async executeBatch(queries: Array<{ query: string; params?: any[] }>): Promise<any> {
    const startTime = Date.now();
    
    try {
      const batch = queries.map(q => ({ query: q.query, params: q.params }));
      const result = await (this as any).cassandraDriver.batch(batch, { prepare: true });
      
      const duration = Date.now() - startTime;
      (this as any).queryMetrics.push({
        query: `BATCH (${queries.length} queries)`,
        duration,
        timestamp: new Date()
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      (this as any).queryMetrics.push({
        query: `BATCH (${queries.length} queries)`,
        duration,
        timestamp: new Date(),
        error: error.message
      });
      throw error;
    }
  }

  async loadSchema(tableName: string, schema: ModelSchema): Promise<BaseModel> {
    if ((this as any).ormOptions.migration === 'drop') {
      await (this as any).dropTable(tableName);
    }
    
    await (this as any).createTable(tableName, schema);
    return new BaseModel(this, tableName, schema);
  }

  private async dropTable(tableName: string): Promise<void> {
    const keyspace = (this as any).clientOptions.keyspace;
    const fullTableName = keyspace ? `${keyspace}.${tableName}` : tableName;
    
    try {
      await (this as any).execute(`DROP TABLE IF EXISTS ${fullTableName}`);
    } catch (error) {
      // Ignore errors if table doesn't exist
    }
  }

  private async createTable(tableName: string, schema: ModelSchema): Promise<void> {
    const keyspace = (this as any).clientOptions.keyspace;
    const columns = [];
    const primaryKey = Array.isArray(schema.key) ? schema.key : [schema.key];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
      const cqlType = (this as any).mapToCQLType(fieldType);
      columns.push(`${fieldName} ${cqlType}`);
    }
    
    const fullTableName = keyspace ? `${keyspace}.${tableName}` : tableName;
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')}, PRIMARY KEY (${primaryKey.join(', ')}))`;
    
    await (this as any).execute(createTableQuery);
  }

  private mapToCQLType(type: string): string {
    const typeMap: Record<string, string> = {
      'uuid': 'uuid',
      'text': 'text',
      'varchar': 'varchar',
      'int': 'int',
      'bigint': 'bigint',
      'float': 'float',
      'double': 'double',
      'boolean': 'boolean',
      'timestamp': 'timestamp',
      'date': 'date',
      'time': 'time',
      'blob': 'blob',
      'inet': 'inet',
      'counter': 'counter',
      'set<text>': 'set<text>',
      'list<text>': 'list<text>',
      'map<text,text>': 'map<text,text>'
    };
    
    return typeMap[type] || 'text';
  }

  getQueryMetrics(): any[] {
    return (this as any).queryMetrics;
  }

  clearQueryMetrics(): void {
    (this as any).queryMetrics = [];
  }

  async shutdown(): Promise<void> {
    if ((this as any).connectionPool) {
      await ((this as any).connectionPool as any).shutdown();
    }
    
    if ((this as any).cassandraDriver) {
      await (this as any).cassandraDriver.shutdown();
    }
  }

  static timeuuidFromString(str: string): string {
    return types.TimeUuid.fromString(str).toString();
  }

  static timeuuidFromBuffer(buffer: Buffer): string {
    // Convert buffer to UUID string format
    const hex = buffer.toString('hex');
    const formatted = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
    return types.TimeUuid.fromString(formatted).toString();
  }

  static maxTimeuuid(date: Date): string {
    return types.TimeUuid.max(date, 0).toString();
  }

  static minTimeuuid(date: Date): string {
    return types.TimeUuid.min(date, 0).toString();
  }

  static uuidFromBuffer(buffer: Buffer): string {
    // Convert buffer to UUID string format
    const hex = buffer.toString('hex');
    const formatted = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
    return types.Uuid.fromString(formatted).toString();
  }

  static timeuuidFromDate(date: Date): string {
    return types.TimeUuid.fromDate(date).toString();
  }

  static timeuuidFromString(str: string): string {
    return types.TimeUuid.fromString(str).toString();
  }
}
