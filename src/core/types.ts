import type { 
  Client, 
  types, 
  QueryOptions as DriverQueryOptions,
  ClientOptions as DriverClientOptions,
  DseClientOptions as DriverDseClientOptions,
  ArrayOrObject
} from 'cassandra-driver';

// Re-export driver types for convenience
export type UUID = types.Uuid;
export type TimeUUID = types.TimeUuid;
export type Integer = types.Integer;
export type InetAddress = types.InetAddress;
export type Tuple = types.Tuple;
export type LocalDate = types.LocalDate;
export type LocalTime = types.LocalTime;
export type Long = types.Long;
export type BigDecimal = types.BigDecimal;
export type ResultSet = types.ResultSet;
export type Row = types.Row;

// Cassandra data types mapping
export type CassandraDataTypes = {
  uuid: UUID;
  timeuuid: TimeUUID;
  text: string;
  varchar: string;
  ascii: string;
  int: number;
  bigint: Long;
  varint: Integer;
  smallint: number;
  tinyint: number;
  float: number;
  double: number;
  decimal: BigDecimal;
  boolean: boolean;
  inet: InetAddress;
  date: LocalDate;
  time: LocalTime;
  timestamp: Date;
  blob: Buffer;
  counter: Long;
  list: unknown[];
  set: unknown[];
  map: Record<string, unknown>;
  tuple: Tuple;
  frozen: unknown;
};

// Basic types
export type CassandraValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | Buffer 
  | null 
  | undefined
  | UUID
  | TimeUUID
  | Integer
  | InetAddress
  | Tuple
  | LocalDate
  | LocalTime
  | Long
  | BigDecimal
  | Map<unknown, unknown>
  | Set<unknown>
  | unknown[]
  | Record<string, unknown>;

export type QueryParameters = ArrayOrObject;
export type DatabaseRow = Record<string, unknown>;

// Extended QueryOptions with ORM-specific options
export interface QueryOptions extends DriverQueryOptions {
  // ORM-specific options
  return_query?: boolean;
  debug?: boolean;
  raw?: boolean;
  allow_filtering?: boolean;
  distinct?: boolean;
  count?: boolean;
  limit?: number;
  token?: CassandraValue;
  filters?: Record<string, CassandraValue>;
  order_by?: Record<string, 'asc' | 'desc'>;
  group_by?: string[];
  ttl?: number;
  if_not_exist?: boolean;
  if_exist?: boolean;
  conditions?: Record<string, CassandraValue>;
  materialized_view?: string;
  select?: string[];
}

// Client options extending driver options
export interface CassandraClientOptions {
  clientOptions: DriverDseClientOptions;
  ormOptions?: {
    defaultReplicationStrategy?: Record<string, unknown>;
    migration?: 'safe' | 'alter' | 'drop';
    createKeyspace?: boolean;
    createTable?: boolean;
    disableTTYColors?: boolean;
    disableTTYConfirmation?: boolean;
    manageESIndex?: boolean;
    udts?: Record<string, UDTDefinition>;
    udfs?: Record<string, UDFDefinition>;
    udas?: Record<string, UDADefinition>;
  };
}

// Field definition for schema
export interface FieldDefinition {
  type: keyof CassandraDataTypes | string;
  typeDef?: string;
  default?: CassandraValue | { $db_function: string } | (() => CassandraValue);
  unique?: boolean;
  rule?: 
    | ((value: CassandraValue) => boolean) 
    | { 
        required?: boolean; 
        validators?: Array<{ 
          validator: (value: CassandraValue) => boolean; 
          message: string | ((value: CassandraValue) => string) 
        }> 
      };
  virtual?: {
    get?: (this: any) => CassandraValue;
    set?: (this: any, value: CassandraValue) => void;
  };
}

// Materialized view definition
export interface MaterializedView {
  select: string[] | ['*'];
  key: Array<string | string[]>;
  clustering_order?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, {
    $gte?: CassandraValue;
    $lte?: CassandraValue;
    $gt?: CassandraValue;
    $lt?: CassandraValue;
    $eq?: CassandraValue;
    $in?: CassandraValue[];
    $isnt?: CassandraValue;
  }>;
}

// Graph mapping for JanusGraph
export interface GraphMapping {
  relations?: Record<string, {
    relation: string;
    direction: 'in' | 'out' | 'both';
    properties?: string[];
  }>;
  indexes?: Array<{
    name: string;
    type: 'Composite' | 'Mixed';
    keys: string[];
    unique?: boolean;
  }>;
}

// User Defined Types
export interface UDTDefinition {
  fields: Record<string, string | FieldDefinition>;
}

// User Defined Functions
export interface UDFDefinition {
  language: 'java' | 'javascript';
  code: string;
  inputs: Record<string, string>;
  returns: string;
  deterministic?: boolean;
  monotonic?: boolean;
}

// User Defined Aggregates
export interface UDADefinition {
  inputs: Record<string, string>;
  sfunc: string;
  stype: string;
  finalfunc?: string;
  initcond?: CassandraValue;
  deterministic?: boolean;
}

// Model schema definition
export interface ModelSchema {
  fields: Record<string, FieldDefinition | string>;
  key: Array<string | string[]>;
  unique?: string[]; // Campos únicos adicionais
  clustering_order?: Record<string, 'asc' | 'desc'>;
  indexes?: string[];
  custom_indexes?: Array<{
    on: string;
    using: string;
    options?: Record<string, CassandraValue>;
  }>;
  materialized_views?: Record<string, MaterializedView>;
  graph_mapping?: GraphMapping;
  table_name?: string;
  options?: {
    timestamps?: {
      createdAt?: string;
      updatedAt?: string;
    };
    versions?: {
      key?: string;
    };
    compaction?: Record<string, CassandraValue>;
    compression?: Record<string, CassandraValue>;
    gc_grace_seconds?: number;
    default_time_to_live?: number;
    speculative_retry?: string;
    caching?: Record<string, CassandraValue>;
    comment?: string;
  };
  before_save?: <T = any>(instance: T, options?: QueryOptions) => boolean;
  after_save?: <T = any>(instance: T, options?: QueryOptions) => boolean;
  before_update?: (query: FindQuery, updateValues: Record<string, CassandraValue>, options?: QueryOptions) => boolean;
  after_update?: (query: FindQuery, updateValues: Record<string, CassandraValue>, options?: QueryOptions) => boolean;
  before_delete?: (query: FindQuery, options?: QueryOptions) => boolean;
  after_delete?: (query: FindQuery, options?: QueryOptions) => boolean;
  methods?: Record<string, Function>;
}

// Query interfaces
export interface FindQuery {
  // Standard field queries
  [key: string]: CassandraValue | {
    $eq?: CassandraValue;
    $ne?: CassandraValue;
    $isnt?: CassandraValue;
    $gt?: CassandraValue;
    $gte?: CassandraValue;
    $lt?: CassandraValue;
    $lte?: CassandraValue;
    $in?: CassandraValue[];
    $like?: string;
    $token?: { $gt?: CassandraValue; $gte?: CassandraValue; $lt?: CassandraValue; $lte?: CassandraValue };
    $contains?: CassandraValue;
    $contains_key?: CassandraValue;
  };
  
  // Special operators
  $limit?: number;
  $per_partition_limit?: number;
  $orderby?: Record<string, 'asc' | 'desc'> | { $asc: string | string[] } | { $desc: string | string[] };
  $groupby?: string[];
  $distinct?: string[];
  $count?: boolean;
  $filters?: Record<string, CassandraValue>;
  $expr?: {
    index: string;
    query: string;
  };
  $solr_query?: string;
}

export interface BatchQuery {
  query: string;
  params?: QueryParameters;
  after_hook?: () => boolean | Error;
}

// Streaming options
export interface StreamOptions extends QueryOptions {
  objectMode?: boolean;
  highWaterMark?: number;
}

export interface EachRowOptions extends QueryOptions {
  autoPage?: boolean;
  fetchSize?: number;
}

// Model interfaces
export interface BaseModelInstance {
  // Instance methods
  save(options?: QueryOptions): Promise<this>;
  saveAsync(options?: QueryOptions): Promise<this>;
  delete(options?: QueryOptions): Promise<void>;
  deleteAsync(options?: QueryOptions): Promise<void>;
  toJSON(): DatabaseRow;
  isModified(propName?: string): boolean;
  
  // Validation
  validate(propName?: string): Record<string, string> | null;
  
  // Internal properties
  _modified: Record<string, boolean>;
  _validators: Record<string, Function[]>;
}

export interface ModelStatic<T = DatabaseRow> {
  new(data?: Partial<T>): T & BaseModelInstance;
  
  // Static query methods
  find(query?: FindQuery, options?: QueryOptions): Promise<(T & BaseModelInstance)[]>;
  findOne(query?: FindQuery, options?: QueryOptions): Promise<(T & BaseModelInstance) | null>;
  findOneAsync(query?: FindQuery, options?: QueryOptions): Promise<(T & BaseModelInstance) | null>;
  
  // Update methods
  update(query: FindQuery, updateValues: Partial<T>, options?: QueryOptions): Promise<ResultSet>;
  updateAsync(query: FindQuery, updateValues: Partial<T>, options?: QueryOptions): Promise<ResultSet>;
  
  // Delete methods
  delete(query: FindQuery, options?: QueryOptions): Promise<ResultSet>;
  deleteAsync(query: FindQuery, options?: QueryOptions): Promise<ResultSet>;
  
  // Streaming
  stream(query?: FindQuery, options?: StreamOptions): NodeJS.ReadableStream;
  eachRow(
    query: FindQuery, 
    options: EachRowOptions, 
    onReadable: (n: number, row: T & BaseModelInstance) => void, 
    callback?: (err?: Error, result?: ResultSet) => void
  ): void;
  
  // Batch operations
  get_cql_client(): Client;
  execute_query(query: string, params?: QueryParameters, options?: QueryOptions): Promise<ResultSet>;
  execute_batch(queries: BatchQuery[], options?: QueryOptions): Promise<ResultSet>;
  
  // Schema operations
  syncDB(callback?: (err?: Error, result?: boolean) => void): void;
  syncDBAsync(): Promise<boolean>;
  
  // Truncate
  truncate(callback?: (err?: Error) => void): void;
  truncateAsync(): Promise<void>;
  
  // Graph operations (JanusGraph)
  createVertex?(vertexProperties: Record<string, CassandraValue>): Promise<unknown>;
  getVertex?(vertexId: CassandraValue): Promise<Record<string, CassandraValue> | null>;
  updateVertex?(vertexId: CassandraValue, vertexProperties: Record<string, CassandraValue>): Promise<void>;
  deleteVertex?(vertexId: CassandraValue): Promise<void>;
  createEdge?(
    edgeLabel: string, 
    fromVertex: CassandraValue, 
    toVertex: CassandraValue, 
    edgeProperties?: Record<string, CassandraValue>
  ): Promise<unknown>;
  getEdge?(edgeId: CassandraValue): Promise<Record<string, CassandraValue> | null>;
  updateEdge?(edgeId: CassandraValue, edgeProperties: Record<string, CassandraValue>): Promise<void>;
  deleteEdge?(edgeId: CassandraValue): Promise<void>;
  graphQuery?(query: string): Promise<unknown[]>;
  
  // Search operations (Elassandra)
  search?(query: unknown, options?: unknown): Promise<unknown>;
  
  // Properties
  _properties: {
    name: string;
    schema: ModelSchema;
  };
}
