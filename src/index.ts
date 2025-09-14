// Core exports
import { CassandraClient } from "./core/client.js";
import type { CassandraClientOptions } from "./core/types.js";

// Core exports
export { BaseModel, CassandraClient } from "./core/client.js";
export { CassandraORM } from "./core/orm.js";

// Connection management
export { ConnectionPool } from "./connection/pool.js";
export { AdvancedConnectionPool } from './connection/advanced-pool.js';

// Query system
export { QueryBuilder } from "./query/query-builder.js";
export { AdvancedQueryBuilder, WhereClause } from './query/advanced-query-builder.js';
export { RelationsManager } from './query/relations.js';
export { AggregationsManager, AggregationBuilder } from './query/aggregations.js';
export { ScopesManager } from './query/scopes.js';

// Cache system
export { IntelligentCache, QueryCache } from './cache/intelligent-cache.js';
export { SemanticCache } from './cache/semantic-cache.js';

// Data manipulation
export { BulkWriter } from './data/bulk-writer.js';
export { DataStream, StreamingManager } from './data/streaming.js';
export { TimeSeriesManager } from './data/time-series.js';

// Validation and constraints
export { SchemaValidator } from './validation/schema-validator.js';
export { UniqueConstraintManager } from './validation/unique-constraints.js';

// Observability
export { Monitor } from "./observability/monitoring.js";
export { MetricsCollector, CassandraMetrics } from './observability/metrics.js';
export { Tracer, Span } from './observability/tracing.js';

// Middleware and hooks
export { HooksManager } from './middleware/hooks-middleware.js';
export { MultiTenantManager } from './middleware/multi-tenant.js';

// Integrations
export { GraphQLSchemaGenerator, CassandraDataSource } from './integrations/graphql.js';
export { EventStore, BaseAggregateRoot, AggregateRepository } from './integrations/event-sourcing.js';
export { DistributedTransactionManager, CassandraParticipant } from './integrations/distributed-transactions.js';
export { SubscriptionManager } from './integrations/subscriptions.js';
export { AIMLManager } from './integrations/ai-ml.js';

// Utils
export { MigrationManager } from "./utils/migrations.js";
export { PluginManager, CachePlugin, ValidationPlugin } from "./utils/plugin-system.js";
export { DataExporter } from './utils/exporter.js';
export { DataImporter } from './utils/importer.js';
export { ModelLoader } from './utils/model-loader.js';
export { StreamingQuery, createModelStream } from './utils/streaming.js';
export { OptimizedPagination, PaginatedQueryBuilder } from './utils/optimized-pagination.js';
export { BackupManager } from './utils/backup.js';

// Elassandra integration
export { ElassandraClient } from './elassandra/client.js';

// All Types Export
export type {
  // Core types
  BaseModelInstance,
  BatchQuery,
  CassandraClientOptions,
  CassandraDataTypes,
  FieldDefinition,
  FindQuery,
  GraphMapping,
  InetAddress,
  Integer,
  LocalDate,
  LocalTime,
  MaterializedView,
  ModelSchema,
  ModelStatic,
  QueryOptions,
  StreamOptions,
  TimeUUID,
  Tuple,
  UDADefinition,
  UDFDefinition,
  UDTDefinition,
  UUID,
  Model,
  
  // Cache types
  CacheOptions,
  CacheEntry,
  SemanticCacheConfig,
  
  // Bulk operations
  BulkWriterOptions,
  BulkOperation,
  BulkResult,
  
  // Streaming
  StreamingOptions,
  StreamingStats,
  
  // Time series
  TimeSeriesOptions,
  
  // Validation
  ValidationRule,
  ValidationError,
  UniqueConstraintOptions,
  
  // Migration
  MigrationOptions,
  
  // Metrics and monitoring
  MetricOptions,
  HistogramBucket,
  TracingOptions,
  
  // Hooks and middleware
  HookFunction,
  HookContext,
  MultiTenantConfig,
  
  // GraphQL
  GraphQLResolverConfig,
  GraphQLType,
  
  // Event sourcing
  EventStoreConfig,
  AggregateRoot,
  DomainEvent,
  SagaStep,
  
  // Transactions
  TransactionConfig,
  TransactionOperation,
  
  // Subscriptions
  SubscriptionConfig,
  Subscription,
  
  // AI/ML
  AIConfig,
  VectorSearchOptions,
  
  // Import/Export
  ImportOptions,
  
  // Pagination
  PaginationOptions,
  CursorPaginationResult,
  
  // Backup/Restore
  BackupConfig,
  RestoreOptions,
  
  // Optimization
  OptimizationConfig,
  OptimizationSuggestion,
  
  // Elassandra
  ElasticsearchConfig,
  SearchQuery,
  
  // Advanced Query Builder
  WhereCondition,
  QueryBuilderOptions,
  PopulateOptions,
  
  // Aggregations
  AggregationPipeline,
  AggregationResult,
  
  // Connection Pool
  AdvancedPoolOptions,
  LoadBalancingOptions,
  ConnectionStats,
  
  // Soft Delete
  SoftDeleteOptions,
  
  // Serialization
  SerializationOptions,
  
  // Encryption
  EncryptionOptions
} from "./core/types.js";

// Convenience function
export function createClient(options: CassandraClientOptions): CassandraClient {
  return new CassandraClient(options);
}

// Static utility functions
export const uuid = CassandraClient.uuid;
export const uuidFromString = CassandraClient.uuidFromString;
export const uuidFromBuffer = CassandraClient.uuidFromBuffer;
export const timeuuid = CassandraClient.timeuuid;
export const timeuuidFromDate = CassandraClient.timeuuidFromDate;
export const timeuuidFromString = CassandraClient.timeuuidFromString;
export const timeuuidFromBuffer = CassandraClient.timeuuidFromBuffer;
export const maxTimeuuid = CassandraClient.maxTimeuuid;
export const minTimeuuid = CassandraClient.minTimeuuid;

// Default export for compatibility
export default CassandraClient;
