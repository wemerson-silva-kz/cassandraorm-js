import { CassandraClient } from "./core/client.js";
import type { CassandraClientOptions } from "./core/types.js";

// Core exports
export { BaseModel, CassandraClient } from "./core/client.js";
export { CassandraORM, Model } from "./core/orm.js";

// Connection management
export { ConnectionPool } from "./connection/pool.js";
export { 
  AdvancedConnectionPool,
  type AdvancedPoolOptions,
  type ConnectionStats,
  type ConnectionInfo
} from './connection/advanced-pool.js';

// Query system
export { QueryBuilder } from "./query/query-builder.js";
export { AdvancedQueryBuilder, WhereClause, type WhereCondition, type QueryBuilderOptions } from './query/advanced-query-builder.js';
export { 
  RelationsManager,
  type RelationDefinition,
  type RelationsConfig,
  type PopulateOptions
} from './query/relations.js';
export { 
  AggregationsManager,
  AggregationBuilder,
  HavingClause,
  type AggregationPipeline,
  type AggregationOperation,
  type AggregationResult,
  type AggregationsConfig
} from './query/aggregations.js';

// Cache system
export { IntelligentCache, QueryCache, type CacheOptions, type CacheEntry } from './cache/intelligent-cache.js';
export { 
  SemanticCache,
  type SemanticCacheConfig,
  type CacheEntry as SemanticCacheEntry,
  type CacheStats as SemanticCacheStats
} from './cache/semantic-cache.js';

// Data manipulation
export { BulkWriter, type BulkWriterOptions, type BulkOperation, type BulkResult } from './data/bulk-writer.js';
export { 
  DataStream,
  StreamingManager,
  type StreamingOptions,
  type StreamingStats
} from './data/streaming.js';
export { 
  TimeSeriesManager,
  type TimeSeriesOptions,
  type TimeSeriesPoint,
  type TimeSeriesQuery,
  type TimeSeriesResult
} from './data/time-series.js';

// Validation and constraints
export { SchemaValidator, type ValidationRule, type ValidationError } from './validation/schema-validator.js';
export { UniqueConstraintManager, type UniqueConstraintOptions } from './validation/unique-constraints.js';
export { 
  SchemaEvolution,
  MigrationBuilder,
  MigrationHelpers,
  type MigrationStep,
  type SchemaEvolutionConfig,
  type MigrationRecord
} from './validation/evolution.js';

// Observability
export { Monitor } from "./observability/monitoring.js";
export { 
  MetricsCollector,
  CassandraMetrics,
  type MetricValue,
  type MetricsConfig,
  type HistogramBucket
} from './observability/metrics.js';
export { 
  Tracer,
  Span,
  CassandraTracing,
  type TracingConfig,
  type SpanContext,
  type SpanData,
  type LogEntry
} from './observability/tracing.js';

// Middleware and hooks
export { 
  HooksManager,
  MiddlewareManager, 
  HooksMiddlewareSystem,
  CommonHooks,
  CommonMiddleware,
  type HookFunction,
  type MiddlewareFunction,
  type HookContext
} from './middleware/hooks-middleware.js';
export { 
  MultiTenantManager,
  type MultiTenantConfig,
  type TenantContext
} from './middleware/multi-tenant.js';

// Integrations
export { 
  GraphQLSchemaGenerator,
  CassandraDataSource,
  type GraphQLConfig,
  type GraphQLField,
  type GraphQLType
} from './integrations/graphql.js';
export { 
  EventStore,
  BaseAggregateRoot,
  AggregateRepository,
  Saga,
  UserAggregate,
  type EventSourcingConfig,
  type DomainEvent,
  type Snapshot,
  type AggregateRoot,
  type SagaStep
} from './integrations/event-sourcing.js';
export { 
  DistributedTransactionManager,
  CassandraParticipant,
  TwoPhaseCommitCoordinator,
  SagaCoordinator,
  TransactionStatus,
  type TransactionConfig,
  type TransactionContext,
  type TransactionParticipant,
  type TransactionOperation
} from './integrations/distributed-transactions.js';
export { 
  SubscriptionManager,
  type SubscriptionConfig,
  type SubscriptionFilter,
  type SubscriptionEvent,
  type Subscription
} from './integrations/subscriptions.js';
export { 
  AIMLManager,
  type AIConfig,
  type EmbeddingVector,
  type SimilarityResult,
  type QuerySuggestion
} from './integrations/ai-ml.js';

// Utils
export { MigrationManager } from "./utils/migrations.js";
export { PluginManager, CachePlugin, ValidationPlugin } from "./utils/plugin-system.js";
export { DataExporter } from './utils/exporter.js';
export { DataImporter, type ImportOptions } from './utils/importer.js';
export { ModelLoader } from './utils/model-loader.js';
export { StreamingQuery, createModelStream } from './utils/streaming.js';
export { 
  OptimizedPagination, 
  PaginatedQueryBuilder,
  type PaginationOptions, 
  type PaginationResult,
  type CursorPaginationOptions,
  type CursorPaginationResult 
} from './utils/optimized-pagination.js';
export { 
  BackupManager,
  type BackupConfig,
  type BackupMetadata,
  type RestoreOptions
} from './utils/backup.js';
export { 
  PerformanceOptimizer,
  type OptimizationConfig,
  type QueryAnalysis,
  type OptimizationSuggestion,
  type PerformanceMetrics
} from './utils/optimization.js';

// Elassandra integration
export { ElassandraClient, type ElasticsearchConfig, type SearchQuery } from './elassandra/client.js';

// Types
export type {
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
