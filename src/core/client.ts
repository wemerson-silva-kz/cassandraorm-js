import { Client, types } from "cassandra-driver";
import type { CassandraClientOptions, QueryOptions, ModelSchema } from "./types.js";
import { ConnectionPool } from "../connection/pool.js";
import { ResilientConnection } from "../connection/resilient-connection.js";
import { QueryBuilder } from "../query/query-builder.js";
import { SchemaValidator } from "../validation/schema-validator.js";
import { AIMLManager, SemanticCache } from "../integrations/ai-ml.js";
import { EventStore, BaseAggregateRoot, AggregateRepository } from "../integrations/event-sourcing.js";
import { SubscriptionManager } from "../integrations/subscriptions.js";
import { DistributedTransactionManager, SagaOrchestrator } from "../integrations/distributed-transactions.js";

export class CassandraClient {
  private client: Client | null = null;
  private connected = false;
  private connectionPool?: ConnectionPool;
  
  // Feature managers
  public aiml?: AIMLManager;
  public eventStore?: EventStore;
  public subscriptions?: SubscriptionManager;
  public transactions?: DistributedTransactionManager;
  public sagas?: SagaOrchestrator;
  public semanticCache?: SemanticCache;
  
  // Monitoring
  public queryMetrics: any[] = [];
  public connectionMetrics = {
    totalQueries: 0,
    avgResponseTime: 0,
    errorRate: 0
  };

  constructor(private options: CassandraClientOptions) {}

  get driver() {
    return this.client;
  }

  async connect(): Promise<void> {
    const clientOptions = { ...this.options.clientOptions };
    const keyspace = clientOptions.keyspace;
    delete clientOptions.keyspace;
    
    // Add basic connection pool settings
    const poolOptions = {
      ...clientOptions,
      pooling: {
        coreConnectionsPerHost: { '0': 2, '1': 1 }
      }
    };
    
    this.client = new Client(poolOptions);
    await this.client.connect();
    
    // Create keyspace if requested
    if (keyspace && this.options.ormOptions?.createKeyspace) {
      const createKeyspaceQuery = `
        CREATE KEYSPACE IF NOT EXISTS ${keyspace}
        WITH REPLICATION = {
          'class': 'SimpleStrategy',
          'replication_factor': 1
        }
      `;
      await this.client.execute(createKeyspaceQuery);
    }
    
    // Use keyspace
    if (keyspace) {
      await this.client.execute(`USE ${keyspace}`);
    }
    
    this.connected = true;
    
    // Initialize essential features
    if (keyspace) {
      await this.initializeEssentialFeatures();
    }
  }

  private async initializeEssentialFeatures(): Promise<void> {
    const keyspace = this.options.clientOptions.keyspace;
    if (!keyspace || !this.client) return;

    // Initialize only semantic cache for tests to avoid table creation issues
    this.semanticCache = new SemanticCache({ similarityThreshold: 0.85 });
    
    // Initialize other features only if explicitly requested
    if (this.options.ormOptions?.enableAdvancedFeatures) {
      try {
        this.aiml = new AIMLManager(this.client, keyspace);
        this.eventStore = new EventStore(this.client, { keyspace });
        this.subscriptions = new SubscriptionManager(this.client, keyspace);
        this.transactions = new DistributedTransactionManager(this.client, keyspace);
        this.sagas = new SagaOrchestrator(this.client, keyspace);
      } catch (error) {
        console.warn('Advanced features initialization failed:', error.message);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  getQueryMetrics(): any[] {
    return this.queryMetrics;
  }

  getConnectionState(): any {
    return {
      connected: this.isConnected(),
      hosts: this.client?.hosts?.length || 0,
      keyspace: this.options.clientOptions.keyspace,
      queryCount: this.queryMetrics.length,
      avgQueryTime: this.getAverageQueryTime(),
      errorRate: this.calculateErrorRate()
    };
  }

  private getAverageQueryTime(): number {
    if (this.queryMetrics.length === 0) return 0;
    const total = this.queryMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    return total / this.queryMetrics.length;
  }

  private calculateErrorRate(): number {
    if (this.queryMetrics.length === 0) return 0;
    const errors = this.queryMetrics.filter(m => m.error).length;
    return errors / this.queryMetrics.length;
  }

  // Query builder
  query(table?: string): QueryBuilder {
    const builder = new QueryBuilder(this);
    return table ? builder.from(table) : builder;
  }

  // Batch builder
  createBatch(): BatchBuilder {
    return new BatchBuilder(this);
  }

  async execute(query: string, params: any[] = [], options: QueryOptions = {}): Promise<any> {
    if (!this.client) throw new Error('Client not connected');
    
    const startTime = Date.now();
    try {
      // Convert JavaScript collections to Cassandra types
      const processedParams = params.map(param => {
        if (param instanceof Set) {
          return Array.from(param);
        }
        if (param instanceof Map) {
          return Object.fromEntries(param);
        }
        if (param && typeof param === 'object' && param.constructor === Object) {
          // Convert plain objects to JSON string for text fields
          return JSON.stringify(param);
        }
        return param;
      });

      // Execute directly with driver
      const result = await this.client.execute(query, processedParams, options as any);
      
      // Performance monitoring
      const duration = Date.now() - startTime;
      this.queryMetrics.push({
        query: query.substring(0, 100),
        duration,
        timestamp: new Date(),
        success: true
      });
      this.connectionMetrics.totalQueries++;
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.queryMetrics.push({
        query: query.substring(0, 100),
        duration,
        timestamp: new Date(),
        success: false,
        error: (error as Error).message
      });
      throw error;
    }
  }

  createBatch(): BatchBuilder {
    return new BatchBuilder(this);
  }

  async batch(queries: Array<{ query: string; params: any[] }>, options: QueryOptions = {}): Promise<any> {
    if (!this.client) throw new Error('Client not connected');
    
    const startTime = Date.now();
    
    try {
      // Process parameters for each query
      const processedQueries = queries.map(({ query, params }) => ({
        query,
        params: params.map(param => {
          if (param instanceof Set) {
            return Array.from(param);
          }
          if (param instanceof Map) {
            return Object.fromEntries(param);
          }
          // Handle UUID strings properly
          if (typeof param === 'string' && param.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return types.Uuid.fromString(param);
          }
          return param;
        })
      }));
      
      const result = await this.client.batch(processedQueries, { 
        prepare: true,
        ...options 
      });
      
      // Track metrics
      const duration = Date.now() - startTime;
      this.queryMetrics.push({
        query: `BATCH (${queries.length} queries)`,
        duration,
        timestamp: new Date()
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.queryMetrics.push({
        query: `BATCH (${queries.length} queries)`,
        duration,
        timestamp: new Date(),
        error: error.message
      });
      throw error;
    }
  }

  async loadSchema(tableName: string, schema: ModelSchema): Promise<any> {
    // Create table if it doesn't exist
    await this.createTableFromSchema(tableName, schema);
    
    const model = new BaseModel(this, tableName, schema);
    
    // Create a constructor function that acts like a class
    const ModelConstructor = function(data?: any) {
      if (data) {
        Object.assign(this, data);
      }
    };
    
    // Add static methods
    ModelConstructor.create = async (data: any, options: any = {}) => {
      return model.create(data, options);
    };
    
    ModelConstructor.findOne = async (query: any = {}, options: any = {}) => {
      return model.findOne(query, options);
    };
    
    ModelConstructor.find = async (query: any = {}, options: any = {}) => {
      return model.find(query, options);
    };
    
    ModelConstructor.count = async (query: any = {}) => {
      return model.count(query);
    };
    
    ModelConstructor.update = async (query: any, updateData: any, options: any = {}) => {
      return model.update(query, updateData, options);
    };
    
    ModelConstructor.delete = async (query: any, options: any = {}) => {
      return model.delete(query, options);
    };
    
    // Add instance methods to prototype
    ModelConstructor.prototype.save = function(options: any = {}) {
      return model.save(this, options);
    };
    
    return ModelConstructor;
  }

  private async createTableFromSchema(tableName: string, schema: ModelSchema): Promise<void> {
    const columns = [];
    const primaryKey = Array.isArray(schema.key) ? schema.key : [schema.key];
    
    // Process fields
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
      const cqlType = this.mapToCQLType(fieldType);
      columns.push(`${fieldName} ${cqlType}`);
    }
    
    // Since we use "USE keyspace", just use table name
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(', ')},
        PRIMARY KEY (${primaryKey.join(', ')})
      )
    `;
    
    await this.execute(createTableQuery);
  }

  private mapToCQLType(type: string): string {
    const typeMap: Record<string, string> = {
      'text': 'text',
      'varchar': 'text',
      'uuid': 'uuid',
      'timeuuid': 'timeuuid',
      'int': 'int',
      'bigint': 'bigint',
      'float': 'float',
      'double': 'double',
      'boolean': 'boolean',
      'timestamp': 'timestamp',
      'date': 'date',
      'time': 'time',
      'set<text>': 'set<text>',
      'list<text>': 'list<text>',
      'map<text,text>': 'map<text,text>',
      'frozen<set<text>>': 'frozen<set<text>>'
    };
    
    return typeMap[type] || 'text';
  }

  // Instance UUID methods for convenience
  uuid(): string {
    return CassandraClient.uuid().toString();
  }

  generateUuid(): string {
    return this.uuid();
  }

  timeuuid(): string {
    return CassandraClient.timeuuid().toString();
  }

  // Static utility methods
  static uuid = types.Uuid.random;
  static uuidFromString = types.Uuid.fromString;
  static uuidFromBuffer = (buffer: Buffer) => types.Uuid.fromString(buffer.toString());
  static timeuuid = types.TimeUuid.now;
  static timeuuidFromDate = types.TimeUuid.fromDate;
  static timeuuidFromString = types.TimeUuid.fromString;
  static timeuuidFromBuffer = (buffer: Buffer) => types.TimeUuid.fromString(buffer.toString());
  static maxTimeuuid = (date: Date) => types.TimeUuid.max(date, 0);
  static minTimeuuid = (date: Date) => types.TimeUuid.min(date, 0);
}

export class BatchBuilder {
  private queries: Array<{ query: string; params: any[] }> = [];

  constructor(private client: CassandraClient) {}

  add(query: string, params: any[] = []): this {
    this.queries.push({ query, params });
    return this;
  }

  async execute(): Promise<any> {
    return this.client.batch(this.queries);
  }
}

export class BaseModel {
  private validator?: SchemaValidator;

  constructor(
    private client: CassandraClient,
    private tableName: string,
    private schema: ModelSchema
  ) {
    // Initialize validator if validation rules exist
    const validationRules: Record<string, any> = {};
    for (const [field, def] of Object.entries(schema.fields)) {
      if (typeof def === 'object' && def.validate) {
        validationRules[field] = def.validate;
      }
    }
    
    if (Object.keys(validationRules).length > 0) {
      this.validator = new SchemaValidator(validationRules);
    }
  }

  // Static method for creating instances
  static create(data: any): Promise<any> {
    throw new Error('create method should be called on model instance, not BaseModel');
  }

  private getFullTableName(): string {
    // Since we use "USE keyspace", just return table name
    return this.tableName;
  }

  async save(data: any, options: any = {}): Promise<any> {
    // Validate data
    if (this.validator) {
      const errors = this.validator.validate(data);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
    }
    
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const query = `INSERT INTO ${this.getFullTableName()} (${fields}) VALUES (${placeholders})`;
    
    // Process values for Cassandra
    const params = Object.values(data).map(value => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    });
    
    const result = await this.client.execute(query, params, { ...options, prepare: true });
    
    // Log change for subscriptions
    if (this.client.subscriptions) {
      await this.client.subscriptions.logChange(this.tableName, 'insert', data);
    }
    
    return data;
  }

  async create(data: any, options: any = {}): Promise<any> {
    return this.save(data, options);
  }

  async findOne(query: any = {}, options: any = {}): Promise<any> {
    const whereClause = Object.keys(query).length > 0 
      ? 'WHERE ' + Object.keys(query).map(key => `${key} = ?`).join(' AND ')
      : '';
    
    // Add ALLOW FILTERING for non-key queries
    const allowFiltering = Object.keys(query).length > 0 ? ' ALLOW FILTERING' : '';
    const cqlQuery = `SELECT * FROM ${this.getFullTableName()} ${whereClause}${allowFiltering} LIMIT 1`;
    const params = Object.values(query);
    
    const result = await this.client.execute(cqlQuery, params, options);
    return result.rows[0] || null;
  }

  async find(query: any = {}, options: any = {}): Promise<any[]> {
    const whereClause = Object.keys(query).length > 0 
      ? 'WHERE ' + Object.keys(query).map(key => `${key} = ?`).join(' AND ')
      : '';
    
    // Add ALLOW FILTERING for non-key queries
    const allowFiltering = Object.keys(query).length > 0 ? ' ALLOW FILTERING' : '';
    const cqlQuery = `SELECT * FROM ${this.getFullTableName()} ${whereClause}${allowFiltering}`;
    const params = Object.values(query);
    
    const result = await this.client.execute(cqlQuery, params, { ...options, prepare: true });
    return result.rows || [];
  }

  async update(query: any, updateData: any, options: any = {}): Promise<any> {
    // Validate update data
    if (this.validator) {
      const errors = this.validator.validate(updateData);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
    }
    
    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
    const cqlQuery = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(updateData), ...Object.values(query)];
    
    await this.client.execute(cqlQuery, params, options);
    
    // Log change for subscriptions
    if (this.client.subscriptions) {
      await this.client.subscriptions.logChange(this.tableName, 'update', { ...query, ...updateData });
    }
    
    return updateData;
  }

  async count(query: any = {}): Promise<number> {
    const whereClause = Object.keys(query).length > 0 
      ? 'WHERE ' + Object.keys(query).map(key => `${key} = ?`).join(' AND ')
      : '';
    
    // Add ALLOW FILTERING for non-key queries
    const allowFiltering = Object.keys(query).length > 0 ? ' ALLOW FILTERING' : '';
    const cqlQuery = `SELECT COUNT(*) FROM ${this.getFullTableName()} ${whereClause}${allowFiltering}`;
    const params = Object.values(query);
    
    const result = await this.client.execute(cqlQuery, params, { prepare: true });
    return parseInt(result.rows?.[0]?.count) || 0;
  }

  async delete(query: any, options: any = {}): Promise<void> {
    const whereClause = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
    const cqlQuery = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
    const params = Object.values(query);
    
    await this.client.execute(cqlQuery, params, options);
    
    // Log change for subscriptions
    if (this.client.subscriptions) {
      await this.client.subscriptions.logChange(this.tableName, 'delete', query);
    }
  }
}
