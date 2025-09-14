import { Client, types } from "cassandra-driver";
import type { 
  CassandraDataType, 
  CassandraFieldDefinition, 
  CassandraModelSchema 
} from './cassandra-types.js';

// Transaction types
export enum TransactionStatus {
  PENDING = 'pending',
  COMMITTED = 'committed',
  ABORTED = 'aborted',
  FAILED = 'failed'
}

export interface TransactionConfig {
  timeout?: number;
  consistency?: string;
  retries?: number;
}

// Subscription types
export interface SubscriptionConfig {
  table: string;
  operations?: ('insert' | 'update' | 'delete')[];
  filter?: SubscriptionFilter;
}

export interface SubscriptionFilter {
  where?: Record<string, any>;
  columns?: string[];
}

export interface SubscriptionEvent {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
}

export interface Subscription {
  id: string;
  config: SubscriptionConfig;
  callback: (event: SubscriptionEvent) => void;
}

// AI/ML types
export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  includeDistance?: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'huggingface' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

// Performance monitoring types
export interface MetricsConfig {
  enabled: boolean;
  interval?: number;
  retention?: number;
}

export interface TracingConfig {
  enabled: boolean;
  sampleRate?: number;
  endpoint?: string;
}

export interface CassandraClientOptions {
  clientOptions: {
    contactPoints: string[];
    localDataCenter: string;
    keyspace?: string;
    credentials?: {
      username: string;
      password: string;
    };
  };
  ormOptions?: {
    createKeyspace?: boolean;
    migration?: 'safe' | 'alter' | 'drop';
  };
}

export interface FieldDefinition {
  type: string;
  unique?: boolean;
  required?: boolean;
  default?: any;
  virtual?: boolean;
  validate?: {
    required?: boolean;
    isEmail?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
  };
}

export interface ModelSchema {
  fields: Record<string, string | FieldDefinition>;
  key: string | string[];
  unique?: string[];
  clustering_order?: Record<string, 'ASC' | 'DESC'>;
  relations?: Record<string, RelationDefinition>;
  indexes?: Record<string, IndexDefinition>;
  materialized_views?: Record<string, MaterializedViewDefinition>;
  options?: ModelOptions;
  table_name?: string;
  methods?: Record<string, Function>;
  before_save?: (instance: any, options: any) => boolean;
  after_save?: (instance: any, result: any) => void;
  before_update?: (query: any, updateValues: any, options: any) => boolean;
  after_update?: (query: any, updateValues: any, result: any) => void;
  before_delete?: (query: any, options: any) => boolean;
  after_delete?: (query: any, result: any) => void;
}

// Re-export Cassandra types for convenience
export type { 
  CassandraDataType, 
  CassandraFieldDefinition, 
  CassandraModelSchema 
};

export interface RelationDefinition {
  model: string;
  foreignKey: string;
  type: 'hasOne' | 'hasMany' | 'belongsTo';
}

export interface IndexDefinition {
  target: string | string[];
  options?: Record<string, any>;
}

export interface MaterializedViewDefinition {
  select: string[];
  key: string[];
  clustering_order?: Record<string, 'ASC' | 'DESC'>;
}

export interface ModelOptions {
  timestamps?: {
    createdAt?: string;
    updatedAt?: string;
  } | boolean;
  versions?: {
    key?: string;
  } | boolean;
  compaction?: Record<string, CassandraValue>;
  compression?: Record<string, CassandraValue>;
  gc_grace_seconds?: number;
  bloom_filter_fp_chance?: number;
  caching?: Record<string, CassandraValue>;
  comment?: string;
  table_name?: string;
}

export interface QueryOptions {
  prepare?: boolean;
  consistency?: number;
  fetchSize?: number;
  autoPage?: boolean;
  pageState?: string;
  hints?: string[];
  traceQuery?: boolean;
  customPayload?: Record<string, Buffer>;
  executionProfile?: string;
  isIdempotent?: boolean;
  keyspace?: string;
  logged?: boolean;
  readTimeout?: number;
  retry?: any;
  routingIndexes?: number[];
  routingKey?: Buffer | Buffer[];
  routingNames?: string[];
  serialConsistency?: number;
  timestamp?: number;
  counter?: boolean;
  ttl?: number;
  if_not_exist?: boolean;
  allow_filtering?: boolean;
  limit?: number;
}

export interface FindQuery {
  [key: string]: any;
  where?: Record<string, any>;
  select?: string[];
  limit?: number;
  $limit?: number;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  $orderby?: Record<string, 'ASC' | 'DESC'>;
  allowFiltering?: boolean;
  raw?: boolean;
}

export interface BatchQuery {
  query: string;
  params?: any[];
}

export interface StreamOptions {
  prepare?: boolean;
  fetchSize?: number;
  autoPage?: boolean;
}

export interface EachRowOptions extends StreamOptions {
  rowCallback: (n: number, row: any) => void;
  endCallback?: (error?: Error, totalCount?: number) => void;
}

export type CassandraValue = string | number | boolean | Date | Buffer | types.Uuid | types.TimeUuid | types.BigDecimal | types.InetAddress | types.Tuple | types.LocalDate | types.LocalTime;

export type QueryParameters = CassandraValue[];

export interface DatabaseRow {
  [key: string]: CassandraValue;
}

export interface ResultSet {
  rows: DatabaseRow[];
  info: {
    queriedHost: string;
    triedHosts: Record<string, string>;
    achievedConsistency: number;
    traceId: types.Uuid;
    warnings: string[];
    customPayload: Record<string, Buffer>;
  };
  pageState?: string;
  nextPage?: () => Promise<ResultSet>;
}

export interface BaseModelInstance {
  save(options?: QueryOptions): Promise<this>;
  saveAsync(options?: QueryOptions): Promise<this>;
  delete(options?: QueryOptions): Promise<void>;
  deleteAsync(options?: QueryOptions): Promise<void>;
  toJSON(): Record<string, any>;
  isModified(propName?: string): boolean;
  validate(propName?: string): { [key: string]: string } | null;
  isNew?: boolean;
  _modified: Record<string, boolean>;
  _validators: Record<string, Function[]>;
}

export interface ModelStatic<T = BaseModelInstance> {
  new (...args: any[]): T;
  find(query?: FindQuery, options?: QueryOptions): Promise<T[]>;
  findOne(query?: FindQuery, options?: QueryOptions): Promise<T | null>;
  findOneAsync(query?: FindQuery, options?: QueryOptions): Promise<T | null>;
  create(data: Partial<T>, options?: { upsert?: boolean }): Promise<T>;
  createMany(dataArray: Partial<T>[], options?: { ignoreDuplicates?: boolean }): Promise<T[]>;
  update(query: FindQuery, updateValues: Partial<T>, options?: QueryOptions): Promise<any>;
  updateAsync(query: FindQuery, updateValues: Partial<T>, options?: QueryOptions): Promise<any>;
  delete(query: FindQuery, options?: QueryOptions): Promise<any>;
  deleteAsync(query: FindQuery, options?: QueryOptions): Promise<any>;
  stream(query?: FindQuery, options?: StreamOptions): NodeJS.ReadableStream;
  eachRow(query: FindQuery, options: any, rowCallback: Function, callback?: Function): void;
  truncate(callback?: (err?: Error) => void): void;
  get_table_name(): string;
  get_keyspace_name(): string;
  is_table_ready(): boolean;
  init(options?: QueryOptions): Promise<void>;
  syncDB(options?: QueryOptions): Promise<void>;
  drop_table(options?: QueryOptions): Promise<void>;
  tableName?: string;
}

// Batch Query Interface
export interface BatchQuery {
  query: string;
  params?: any[];
  after_hook?: Function;
}

// Model Interface
export interface Model extends BaseModelInstance {
  [key: string]: any;
  id?: any;
}

// Export types from cassandra-driver
export type CassandraDataTypes = types.dataTypes;
export type GraphMapping = any;
export type InetAddress = types.InetAddress;
export type Integer = types.Integer;
export type LocalDate = types.LocalDate;
export type LocalTime = types.LocalTime;
export type MaterializedView = any;
export type TimeUUID = types.TimeUuid;
export type Tuple = types.Tuple;
export type UDADefinition = any;
export type UDFDefinition = any;
export type UDTDefinition = any;
export type UUID = types.Uuid;

// Additional types for all ORM features
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  strategy?: 'LRU' | 'LFU' | 'FIFO';
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  hits: number;
}

export interface SemanticCacheConfig {
  similarityThreshold: number;
  maxEntries?: number;
  ttl?: number;
}

export interface BulkWriterOptions {
  batchSize?: number;
  concurrency?: number;
  retries?: number;
}

export interface BulkOperation {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
}

export interface BulkResult {
  success: number;
  failed: number;
  errors: Error[];
}

export interface StreamingOptions {
  batchSize?: number;
  highWaterMark?: number;
}

export interface StreamingStats {
  processed: number;
  errors: number;
  rate: number;
}

export interface TimeSeriesOptions {
  retention?: string;
  compression?: boolean;
  aggregation?: string[];
}

export interface ValidationRule {
  field: string;
  type: string;
  required?: boolean;
  validator?: Function;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export interface UniqueConstraintOptions {
  fields: string[];
  caseSensitive?: boolean;
}

export interface MigrationOptions {
  direction: 'up' | 'down';
  version?: string;
}

export interface MetricOptions {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: Record<string, string>;
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface TracingOptions {
  enabled: boolean;
  sampleRate?: number;
  tags?: Record<string, string>;
}

export interface HookFunction {
  (context: HookContext): Promise<void> | void;
}

export interface HookContext {
  operation: string;
  model: string;
  data?: any;
  query?: any;
  result?: any;
}

export interface MultiTenantConfig {
  strategy: 'keyspace' | 'table' | 'row';
  tenantField?: string;
}

export interface GraphQLResolverConfig {
  model: string;
  operations: string[];
  middleware?: Function[];
}

export interface GraphQLType {
  name: string;
  fields: Record<string, any>;
}

export interface EventStoreConfig {
  snapshotFrequency?: number;
  eventBatchSize?: number;
}

export interface AggregateRoot {
  id: string;
  version: number;
  events: DomainEvent[];
}

export interface DomainEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  version: number;
}

export interface SagaStep {
  name: string;
  action: Function;
  compensation: Function;
}

export interface TransactionConfig {
  timeout?: number;
  retries?: number;
  isolation?: 'read_committed' | 'serializable';
}

export interface TransactionOperation {
  type: 'prepare' | 'commit' | 'rollback';
  transactionId: string;
  data?: any;
}

export interface SubscriptionConfig {
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'all';
  filter?: Record<string, any>;
}

export interface Subscription {
  id: string;
  config: SubscriptionConfig;
  callback: Function;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
}

export interface VectorSearchOptions {
  k?: number;
  threshold?: number;
  metric?: 'cosine' | 'euclidean' | 'dot_product';
}

export interface ImportOptions {
  truncate?: boolean;
  batchSize?: number;
  skipErrors?: boolean;
}

export interface PaginationOptions {
  pageSize?: number;
  pageState?: string;
  autoPage?: boolean;
}

export interface CursorPaginationResult<T> {
  data: T[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface BackupConfig {
  destination: string;
  compression?: boolean;
  encryption?: boolean;
}

export interface RestoreOptions {
  source: string;
  overwrite?: boolean;
  skipValidation?: boolean;
}

export interface OptimizationConfig {
  enableQueryOptimization?: boolean;
  enableIndexSuggestions?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'schema';
  description: string;
  impact: 'low' | 'medium' | 'high';
  query?: string;
}

export interface ElasticsearchConfig {
  host: string;
  port?: number;
  auth?: {
    username: string;
    password: string;
  };
}

export interface SearchQuery {
  index: string;
  body: any;
  size?: number;
  from?: number;
}

// Advanced Query Builder Types
export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'CONTAINS';
  value: any;
}

export interface QueryBuilderOptions {
  allowFiltering?: boolean;
  limit?: number;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
}

export interface PopulateOptions {
  path: string;
  select?: string[];
  match?: Record<string, any>;
}

export interface AggregationPipeline {
  $match?: Record<string, any>;
  $group?: Record<string, any>;
  $sort?: Record<string, any>;
  $limit?: number;
  $skip?: number;
}

export interface AggregationResult {
  _id: any;
  count?: number;
  sum?: number;
  avg?: number;
  min?: any;
  max?: any;
}

// Connection Pool Types
export interface AdvancedPoolOptions {
  coreConnections?: number;
  maxConnections?: number;
  maxRequestsPerConnection?: number;
  heartBeatInterval?: number;
  poolTimeout?: number;
  idleTimeout?: number;
}

export interface LoadBalancingOptions {
  policy: 'RoundRobin' | 'DCAwareRoundRobin' | 'TokenAware';
  localDataCenter?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  requestsInFlight: number;
}

// Soft Delete Types
export interface SoftDeleteOptions {
  deletedField?: string;
  deletedValue?: any;
  includeDeleted?: boolean;
}

// Serialization Types
export interface SerializationOptions {
  format: 'json' | 'avro' | 'protobuf';
  compression?: boolean;
}

// Encryption Types
export interface EncryptionOptions {
  algorithm: 'AES-256-GCM' | 'AES-128-GCM';
  key: string;
  fields?: string[];
}
