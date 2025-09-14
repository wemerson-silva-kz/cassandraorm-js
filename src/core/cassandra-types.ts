// Cassandra Data Types based on https://cassandra.apache.org/doc/4.1/cassandra/cql/types.html

// Basic types first
type BasicCassandraType = 
  // Numeric types
  | 'tinyint'    // 8-bit signed int
  | 'smallint'   // 16-bit signed int  
  | 'int'        // 32-bit signed int
  | 'bigint'     // 64-bit signed long
  | 'varint'     // arbitrary precision integer
  | 'float'      // 32-bit IEEE-754 floating point
  | 'double'     // 64-bit IEEE-754 floating point
  | 'decimal'    // variable-precision decimal
  
  // String types
  | 'ascii'      // ASCII character string
  | 'text'       // UTF8 encoded string
  | 'varchar'    // UTF8 encoded string (alias for text)
  
  // Binary types
  | 'blob'       // arbitrary bytes
  
  // Boolean type
  | 'boolean'    // true or false
  
  // Date/Time types
  | 'timestamp'  // date and time with millisecond precision
  | 'date'       // date without time
  | 'time'       // time without date
  | 'duration'   // duration with nanosecond precision
  
  // UUID types
  | 'uuid'       // type 1 or type 4 UUID
  | 'timeuuid'   // type 1 UUID (time-based)
  
  // Network types
  | 'inet'       // IPv4 or IPv6 address
  
  // Counter type
  | 'counter'    // distributed counter
  
  // JSON (Cassandra 4.0+)
  | 'json';

// Collection and complex types
export type CassandraDataType = BasicCassandraType
  | `list<${BasicCassandraType}>`     // ordered collection
  | `set<${BasicCassandraType}>`      // unordered unique collection
  | `map<${BasicCassandraType},${BasicCassandraType}>` // key-value pairs
  | `tuple<${string}>`               // fixed-length sequence
  | `frozen<${string}>`;             // frozen user-defined type

// Field definition with Cassandra types
export interface CassandraFieldDefinition {
  type: CassandraDataType;
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

// Enhanced ModelSchema with Cassandra types
export interface CassandraModelSchema {
  fields: Record<string, CassandraDataType | CassandraFieldDefinition>;
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

// Import existing types
import type { 
  RelationDefinition, 
  IndexDefinition, 
  MaterializedViewDefinition, 
  ModelOptions 
} from './types.js';

// Type helpers for developers
export const CassandraTypes = {
  // Numeric
  TINYINT: 'tinyint' as const,
  SMALLINT: 'smallint' as const,
  INT: 'int' as const,
  BIGINT: 'bigint' as const,
  VARINT: 'varint' as const,
  FLOAT: 'float' as const,
  DOUBLE: 'double' as const,
  DECIMAL: 'decimal' as const,
  
  // String
  ASCII: 'ascii' as const,
  TEXT: 'text' as const,
  VARCHAR: 'varchar' as const,
  
  // Binary
  BLOB: 'blob' as const,
  
  // Boolean
  BOOLEAN: 'boolean' as const,
  
  // Date/Time
  TIMESTAMP: 'timestamp' as const,
  DATE: 'date' as const,
  TIME: 'time' as const,
  DURATION: 'duration' as const,
  
  // UUID
  UUID: 'uuid' as const,
  TIMEUUID: 'timeuuid' as const,
  
  // Network
  INET: 'inet' as const,
  
  // Counter
  COUNTER: 'counter' as const,
  
  // JSON
  JSON: 'json' as const,
  
  // Collection helpers
  list: (type: BasicCassandraType) => `list<${type}>` as const,
  set: (type: BasicCassandraType) => `set<${type}>` as const,
  map: (keyType: BasicCassandraType, valueType: BasicCassandraType) => 
    `map<${keyType},${valueType}>` as const,
  tuple: (types: string) => `tuple<${types}>` as const,
  frozen: (type: string) => `frozen<${type}>` as const,
} as const;

// Examples for documentation
export const CassandraTypeExamples = {
  // Basic types
  id: 'uuid',
  name: 'text',
  age: 'int',
  salary: 'decimal',
  active: 'boolean',
  created_at: 'timestamp',
  
  // With validation
  email: { 
    type: 'text' as CassandraDataType, 
    unique: true, 
    validate: { required: true, isEmail: true } 
  },
  
  // Collections
  tags: 'set<text>',
  scores: 'list<int>',
  metadata: 'map<text,text>',
  
  // Advanced types
  ip_address: 'inet',
  view_count: 'counter',
  birth_date: 'date',
  login_time: 'time',
  profile_data: 'json',
  
  // Frozen types
  address: 'frozen<address_type>',
  coordinates: 'tuple<double,double>',
} as const;
