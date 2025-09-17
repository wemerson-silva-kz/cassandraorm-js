// Enhanced client with AI/ML, Performance, and Distributed Systems
export { EnhancedCassandraClient, createEnhancedClient } from './core/enhanced-client';
export { RealAIMLManager, ProductionSemanticCache } from './ai-ml/real-integration';
export { AdvancedPerformanceOptimizer, ConnectionPoolOptimizer } from './performance/advanced-optimization';
export { DistributedSystemsManager } from './distributed/distributed-manager';
export { RedisDistributedCache, DistributedLockManager } from './distributed/redis-integration';
export { ConsulServiceDiscovery, DistributedConfigManager } from './distributed/consul-integration';

// Core exports
import { CassandraClient } from "./core/client";
import type { CassandraClientOptions } from "./core/types";

// Core exports
export { BaseModel, CassandraClient, BatchBuilder } from "./core/client";
export { ModelLoader } from "./core/model-loader";
export { CassandraORM } from "./core/orm";

// Cassandra Types
export { CassandraTypes } from './core/cassandra-types';
export type { 
  CassandraDataType, 
  CassandraFieldDefinition, 
  CassandraModelSchema 
} from './core/cassandra-types';

// Connection management
export { ConnectionPool } from "./connection/pool";
export { AdvancedConnectionPool } from './connection/advanced-pool';

// Query system
export { QueryBuilder } from "./query/query-builder";
export { AdvancedQueryBuilder, WhereClause } from './query/advanced-query-builder';
export { RelationsManager } from './query/relations';
export { AggregationsManager, AggregationBuilder } from './query/aggregations';
export { ScopesManager } from './query/scopes';

// Cache system
export { IntelligentCache, QueryCache } from './cache/intelligent-cache';
export { SemanticCache } from './cache/semantic-cache';

// Data manipulation
export { BulkWriter } from './data/bulk-writer';
export { DataStream, StreamingManager } from './data/streaming';
export { TimeSeriesManager } from './data/time-series';

// Validation and constraints
export { SchemaValidator } from './validation/schema-validator';
export { UniqueConstraintManager } from './validation/unique-constraints';

// Observability
export { Monitor } from "./observability/monitoring";
export { MetricsCollector, CassandraMetrics } from './observability/metrics';
export { Tracer, Span } from './observability/tracing';

// Middleware and hooks
export { HooksManager } from './middleware/hooks-middleware';
export { MultiTenantManager } from './middleware/multi-tenant';

// Integrations - AI/ML
export { AIMLManager, SemanticCache as AISemanticCache } from './integrations/ai-ml';

// Integrations - Event Sourcing
export { EventStore, BaseAggregateRoot, AggregateRepository } from './integrations/event-sourcing';

// Integrations - Distributed Transactions
export { DistributedTransactionManager, SagaOrchestrator } from './integrations/distributed-transactions';

// Integrations - Real-time Subscriptions
export { SubscriptionManager, WebSocketSubscriptionServer } from './integrations/subscriptions';

// Integrations - GraphQL
export { GraphQLSchemaGenerator, CassandraDataSource } from './integrations/graphql';

// Performance and monitoring
export { PerformanceProfiler } from './observability/performance-profiler';
export { PerformanceOptimizer } from './observability/performance-optimizer';

// Utils
export { MigrationManager } from "./utils/migrations";
export { PluginManager, CachePlugin, ValidationPlugin } from "./utils/plugin-system";
export { DataExporter } from './utils/exporter';
export { DataImporter } from './utils/importer';
export { StreamingQuery, createModelStream } from './utils/streaming';
export { OptimizedPagination, PaginatedQueryBuilder } from './utils/optimized-pagination';
export { BackupManager } from './utils/backup';

// Elassandra integration
export { ElassandraClient } from './elassandra/client';

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
  
  // Distributed transactions
  TransactionConfig,
  
  // Subscriptions
  SubscriptionConfig,
  
  // AI/ML
  VectorSearchOptions,
  AIConfig,
  
  // Performance
  MetricsConfig,
  TracingConfig,
  
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
} from "./core/types";

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
