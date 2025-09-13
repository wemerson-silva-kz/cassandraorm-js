// CassandraORM JS Complete Type Definitions

export interface CassandraClientOptions {
  clientOptions: {
    contactPoints: string[];
    localDataCenter: string;
    keyspace?: string;
    credentials?: {
      username: string;
      password: string;
    };
    socketOptions?: {
      connectTimeout?: number;
      readTimeout?: number;
    };
    pooling?: {
      maxRequestsPerConnection?: number;
      coreConnectionsPerHost?: number;
    };
  };
  ormOptions?: {
    createKeyspace?: boolean;
    migration?: 'safe' | 'alter' | 'drop';
    defaultReplicationStrategy?: {
      class: string;
      replication_factor: number;
    };
  };
}

export interface ModelSchema {
  fields: Record<string, any>;
  key: string[];
  clustering_order?: Record<string, 'ASC' | 'DESC'>;
  relations?: Record<string, any>;
  indexes?: Record<string, any>;
  materialized_views?: Record<string, any>;
  options?: {
    timestamps?: boolean;
    versions?: boolean;
    table_name?: string;
  };
}

export interface QueryOptions {
  prepare?: boolean;
  consistency?: number;
  fetchSize?: number;
  autoPage?: boolean;
  pageState?: string;
  retry?: any;
  serialConsistency?: number;
  timestamp?: number;
  traceQuery?: boolean;
}

export interface FindQuery {
  [key: string]: any;
  $limit?: number;
  $orderby?: Record<string, number>;
  $groupby?: string[];
  $select?: string[];
  $token?: any;
}

// Main CassandraClient class
export declare class CassandraClient {
  constructor(options: CassandraClientOptions);
  
  // Connection methods
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Query execution
  execute(query: string, params?: any[], options?: QueryOptions): Promise<any>;
  executeAsPrepared(query: string, params?: any[], options?: QueryOptions): Promise<any>;
  batch(queries: any[], options?: QueryOptions): Promise<any>;
  
  // Schema management
  loadSchema<T = any>(tableName: string, schema: ModelSchema): Promise<T>;
  createKeyspaceIfNotExists(keyspaceName: string, options?: any): Promise<void>;
  dropKeyspaceIfExists(keyspaceName: string): Promise<void>;
  
  // Model operations
  save(modelInstance: any, options?: QueryOptions): Promise<any>;
  find(query: FindQuery, options?: QueryOptions): Promise<any[]>;
  findOne(query: FindQuery, options?: QueryOptions): Promise<any>;
  update(query: FindQuery, updateValues: any, options?: QueryOptions): Promise<any>;
  delete(query: FindQuery, options?: QueryOptions): Promise<any>;
  
  // Streaming
  stream(query: FindQuery, options?: any): any;
  eachRow(query: string, params: any[], options: any, rowCallback: Function): Promise<void>;
  
  // Utility methods
  uuid(): string;
  timeuuid(): string;
  now(): Date;
  
  // Static methods
  static uuid(): string;
  static uuidFromString(str: string): string;
  static uuidFromBuffer(buffer: Buffer): string;
  static timeuuid(): string;
  static timeuuidFromDate(date: Date): string;
  static timeuuidFromString(str: string): string;
  static timeuuidFromBuffer(buffer: Buffer): string;
  static maxTimeuuid(date?: Date): string;
  static minTimeuuid(date?: Date): string;
}

// Model base class
export declare class BaseModel {
  save(options?: QueryOptions): Promise<this>;
  delete(options?: QueryOptions): Promise<void>;
  toJSON(): any;
  isModified(): boolean;
  get(propertyName: string): any;
  set(propertyName: string, value: any): void;
}

// Core classes
export declare class CassandraORM {
  constructor(options: CassandraClientOptions);
  connect(): Promise<void>;
  loadSchema(tableName: string, schema: ModelSchema): Promise<any>;
}

export declare class Model extends BaseModel {
  static find(query?: FindQuery, options?: QueryOptions): Promise<Model[]>;
  static findOne(query?: FindQuery, options?: QueryOptions): Promise<Model | null>;
  static update(query: FindQuery, updateValues: any, options?: QueryOptions): Promise<any>;
  static delete(query: FindQuery, options?: QueryOptions): Promise<any>;
  static stream(query?: FindQuery, options?: any): any;
  static truncate(): Promise<void>;
}

// Connection management
export declare class ConnectionPool {
  constructor(options: any);
  getConnection(): Promise<any>;
  releaseConnection(connection: any): void;
  shutdown(): Promise<void>;
}

export declare class AdvancedConnectionPool extends ConnectionPool {
  getStats(): any;
  getHealthStatus(): any;
}

// Query builders
export declare class QueryBuilder {
  select(...fields: string[]): this;
  from(table: string): this;
  where(field: string, operator: string, value: any): this;
  limit(count: number): this;
  orderBy(field: string, direction?: 'ASC' | 'DESC'): this;
  build(): string;
  execute(): Promise<any>;
}

export declare class AdvancedQueryBuilder extends QueryBuilder {
  join(table: string, condition: string): this;
  groupBy(...fields: string[]): this;
  having(condition: string): this;
  union(query: QueryBuilder): this;
}

// Cache system
export declare class IntelligentCache {
  constructor(options?: any);
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): any;
}

export declare class SemanticCache extends IntelligentCache {
  semanticGet(query: string, threshold?: number): Promise<any>;
  semanticSet(query: string, result: any, ttl?: number): Promise<void>;
}

// Data manipulation
export declare class BulkWriter {
  constructor(options?: any);
  insert(data: any[]): Promise<any>;
  update(data: any[]): Promise<any>;
  delete(data: any[]): Promise<any>;
  execute(): Promise<any>;
}

export declare class TimeSeriesManager {
  constructor(client: CassandraClient, keyspace: string);
  insert(table: string, data: any[]): Promise<void>;
  query(table: string, options: any): Promise<any[]>;
  aggregate(table: string, options: any): Promise<any>;
}

// AI/ML Integration
export declare class AIMLManager {
  constructor(client: any, keyspace: string);
  createVectorTable(tableName: string, dimensions?: number): Promise<void>;
  generateEmbedding(text: string): Promise<number[]>;
  similaritySearch(tableName: string, vector: number[], limit?: number): Promise<any[]>;
  optimizeQuery(query: string): Promise<string>;
}

// Event Sourcing
export declare class EventStore {
  constructor(client: any, keyspace: string);
  saveEvents(aggregateId: string, events: any[], expectedVersion?: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<any[]>;
  getSnapshot(aggregateId: string): Promise<any>;
  saveSnapshot(aggregateId: string, snapshot: any): Promise<void>;
}

export declare class BaseAggregateRoot {
  constructor(id: string);
  addEvent(eventType: string, data: any): void;
  getUncommittedEvents(): any[];
  markEventsAsCommitted(): void;
  loadFromHistory(events: any[]): void;
}

// GraphQL Integration
export declare class GraphQLSchemaGenerator {
  constructor();
  addModel(name: string, schema: ModelSchema): void;
  generateSchema(): string;
  getResolvers(): any;
}

// Real-time Subscriptions
export declare class SubscriptionManager {
  constructor(client: any, keyspace: string);
  subscribe(filter: any, callback: Function): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  publish(event: any): Promise<void>;
}

// Distributed Transactions
export declare class DistributedTransactionManager {
  constructor(client: any);
  beginTransaction(): Promise<string>;
  addOperation(transactionId: string, operation: any): Promise<void>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}

// Utility classes
export declare class BackupManager {
  constructor(client: CassandraClient);
  backup(keyspace: string, options?: any): Promise<string>;
  restore(backupPath: string, options?: any): Promise<void>;
}

export declare class PerformanceOptimizer {
  constructor(client: CassandraClient);
  analyzeQuery(query: string): Promise<any>;
  getSuggestions(): Promise<any[]>;
  optimizeSchema(schema: ModelSchema): ModelSchema;
}

// Main factory function
export declare function createClient(options: CassandraClientOptions): CassandraClient;

// Utility functions
export declare const uuid: () => string;
export declare const uuidFromString: (str: string) => string;
export declare const uuidFromBuffer: (buffer: Buffer) => string;
export declare const timeuuid: () => string;
export declare const timeuuidFromDate: (date: Date) => string;
export declare const timeuuidFromString: (str: string) => string;
export declare const timeuuidFromBuffer: (buffer: Buffer) => string;
export declare const maxTimeuuid: (date?: Date) => string;
export declare const minTimeuuid: (date?: Date) => string;
export declare const createModelStream: (...args: any[]) => any;

// Type exports
export type {
  CassandraClientOptions,
  ModelSchema,
  QueryOptions,
  FindQuery
};

// Default export
export default CassandraClient;
