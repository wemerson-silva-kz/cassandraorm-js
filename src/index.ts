import { CassandraClient } from "./client.js";
import type { CassandraClientOptions } from "./types.js";

export { BaseModel, CassandraClient } from "./client.js";
export { CassandraORM, Model } from "./orm.js";
export { ConnectionPool } from "./connection-pool.js";
export { QueryBuilder } from "./query-builder.js";
export { MigrationManager } from "./migrations.js";
export { Monitor } from "./monitoring.js";
export { PluginManager, CachePlugin, ValidationPlugin } from "./plugin-system.js";
export { DataExporter } from './utils/exporter.js';
export { DataImporter, type ImportOptions } from './utils/importer.js';
export { ElassandraClient, type ElasticsearchConfig, type SearchQuery } from './elassandra/client.js';
export { ModelLoader } from './utils/model-loader.js';
export { StreamingQuery, createModelStream } from './utils/streaming.js';
export { UniqueConstraintManager, type UniqueConstraintOptions } from './unique-constraints.js';
export { BulkWriter, type BulkWriterOptions, type BulkOperation, type BulkResult } from './bulk-writer.js';

// Advanced Features - High Priority
export { AdvancedQueryBuilder, WhereClause, type WhereCondition, type QueryBuilderOptions } from './advanced-query-builder.js';
export { SchemaValidator, type ValidationRule, type ValidationError } from './schema-validator.js';
export { IntelligentCache, QueryCache, type CacheOptions, type CacheEntry } from './intelligent-cache.js';
export { 
  OptimizedPagination, 
  PaginatedQueryBuilder,
  type PaginationOptions, 
  type PaginationResult,
  type CursorPaginationOptions,
  type CursorPaginationResult 
} from './optimized-pagination.js';
export { 
  HooksManager,
  MiddlewareManager, 
  HooksMiddlewareSystem,
  CommonHooks,
  CommonMiddleware,
  type HookFunction,
  type MiddlewareFunction,
  type HookContext
} from './hooks-middleware.js';

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
} from "./types.js";

// Função de conveniência para criar cliente
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
