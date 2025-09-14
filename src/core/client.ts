import { Client, types } from "cassandra-driver";
import { Readable } from "node:stream";
import type {
  BaseModelInstance,
  BatchQuery,
  CassandraClientOptions,
  FindQuery,
  ModelSchema,
  ModelStatic,
  QueryOptions,
  StreamOptions,
  CassandraValue,
  QueryParameters,
  DatabaseRow,
  ResultSet,
  EachRowOptions,
} from "./types.js";
import { DataExporter } from '../utils/exporter.js';
import { DataImporter, type ImportOptions } from '../utils/importer.js';
import { ElassandraClient, type ElasticsearchConfig, type SearchQuery } from '../elassandra/client.js';
import { ModelLoader } from '../utils/model-loader.js';
import { StreamingQuery, createModelStream } from '../utils/streaming.js';
import { UniqueConstraintManager } from '../validation/unique-constraints.js';
import { QueryBuilder } from '../query/query-builder.js';
import { RelationsManager } from '../query/relations.js';
import { HooksManager } from '../middleware/hooks-middleware.js';
import { MigrationManager } from '../utils/migrations.js';
import { ScopesManager, ScopedQueryBuilder } from '../query/scopes.js';
import { SoftDeleteManager, SoftDeleteQueryBuilder } from '../middleware/soft-deletes.js';
import { SerializationManager } from '../utils/serialization.js';
import { EncryptionManager } from '../utils/encryption.js';

export abstract class BaseModel implements BaseModelInstance {
  _modified: Record<string, boolean> = {};
  _validators: Record<string, Function[]> = {};

  abstract save(options?: QueryOptions): Promise<this>;
  abstract saveAsync(options?: QueryOptions): Promise<this>;
  abstract delete(options?: QueryOptions): Promise<void>;
  abstract deleteAsync(options?: QueryOptions): Promise<void>;
  abstract toJSON(): Record<string, any>;
  abstract isModified(propName?: string): boolean;
  abstract validate(propName?: string): { [key: string]: string } | null;
}

export class CassandraClient {
  private client: Client;
  private models: Map<string, any> = new Map();
  private keyspace?: string;
  private exporter?: DataExporter;
  private importer?: DataImporter;
  private elassandraClient?: ElassandraClient;
  private streaming?: StreamingQuery;
  private uniqueManager?: UniqueConstraintManager;

  constructor(private options: CassandraClientOptions) {
    this.client = new Client(options.clientOptions);
    this.keyspace = options.clientOptions.keyspace;
  }

  async connect(): Promise<void> {
    // Connect without keyspace first
    const clientWithoutKeyspace = new Client({
      ...this.options.clientOptions,
      keyspace: undefined
    });
    
    await clientWithoutKeyspace.connect();
    
    // Create keyspace if it doesn't exist and auto-creation is enabled
    if (this.keyspace && this.options.ormOptions?.createKeyspace) {
      await this.createKeyspaceIfNotExists(clientWithoutKeyspace);
    }
    
    await clientWithoutKeyspace.shutdown();
    
    // Now connect with keyspace
    await this.client.connect();
    
    if (this.keyspace) {
      this.exporter = new DataExporter(this.client, this.keyspace);
      this.importer = new DataImporter(this.client, this.keyspace);
      this.uniqueManager = new UniqueConstraintManager(this.client, this.keyspace);
    }
    
    this.streaming = new StreamingQuery(this.client, this.keyspace);
  }

  private async createKeyspaceIfNotExists(client: Client): Promise<void> {
    const replication = this.options.ormOptions?.defaultReplicationStrategy || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };
    
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${this.keyspace}
      WITH REPLICATION = ${JSON.stringify(replication).replace(/"/g, "'")}
    `;
    
    await client.execute(query);
  }

  async disconnect(): Promise<void> {
    await this.client.shutdown();
  }

  async createKeyspaceIfNotExists(keyspaceName: string, options: any = {}): Promise<void> {
    const replicationStrategy = options.replication || this.options.ormOptions?.defaultReplicationStrategy || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };

    const replicationString = Object.entries(replicationStrategy)
      .map(([key, value]) => `'${key}': ${typeof value === 'string' ? `'${value}'` : value}`)
      .join(', ');

    const query = `CREATE KEYSPACE IF NOT EXISTS ${keyspaceName} WITH REPLICATION = { ${replicationString} }`;
    
    await this.execute(query);
  }

  async dropKeyspaceIfExists(keyspaceName: string): Promise<void> {
    const query = `DROP KEYSPACE IF EXISTS ${keyspaceName}`;
    await this.execute(query);
  }

  // Direct execute method for convenience
  async execute(query: string, params?: any[], options?: any): Promise<any> {
    return this.client.execute(query, params, options);
  }

  async executeAsPrepared(query: string, params?: any[], options?: any): Promise<any> {
    const preparedOptions = { ...options, prepare: true };
    return this.client.execute(query, params, preparedOptions);
  }

  async batch(queries: any[], options?: any): Promise<any> {
    return this.client.batch(queries, options);
  }

  async shutdown(): Promise<void> {
    return this.client.shutdown();
  }

  async save(modelInstance: any, options?: any): Promise<any> {
    // Implementation for saving model instances
    if (modelInstance && typeof modelInstance.save === 'function') {
      return modelInstance.save(options);
    }
    throw new Error('Invalid model instance');
  }

  async find(query: any, options?: any): Promise<any[]> {
    // Implementation for finding records
    const cql = this.buildSelectQuery(query, options);
    const result = await this.execute(cql.query, cql.params, options);
    return result.rows || [];
  }

  async findOne(query: any, options?: any): Promise<any> {
    const findOptions = { ...options, limit: 1 };
    const results = await this.find(query, findOptions);
    return results.length > 0 ? results[0] : null;
  }

  async update(query: any, updateValues: any, options?: any): Promise<any> {
    const cql = this.buildUpdateQuery(query, updateValues, options);
    return this.execute(cql.query, cql.params, options);
  }

  async delete(query: any, options?: any): Promise<any> {
    const cql = this.buildDeleteQuery(query, options);
    return this.execute(cql.query, cql.params, options);
  }

  stream(query: any, options?: any): any {
    const cql = this.buildSelectQuery(query, options);
    return this.client.stream(cql.query, cql.params, options);
  }

  now(): Date {
    return new Date();
  }

  uuid(): string {
    return CassandraClient.uuid();
  }

  timeuuid(): string {
    return CassandraClient.timeuuid();
  }

  private buildSelectQuery(query: any, options?: any): { query: string; params: any[] } {
    // Simple query builder implementation
    let cql = 'SELECT ';
    const params: any[] = [];
    
    if (options?.select) {
      cql += options.select.join(', ');
    } else {
      cql += '*';
    }
    
    cql += ' FROM ' + (options?.table || 'table');
    
    if (query && Object.keys(query).length > 0) {
      cql += ' WHERE ';
      const conditions: string[] = [];
      
      Object.entries(query).forEach(([key, value]) => {
        if (!key.startsWith('$')) {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
      });
      
      cql += conditions.join(' AND ');
    }
    
    if (query?.$limit) {
      cql += ` LIMIT ${query.$limit}`;
    }
    
    return { query: cql, params };
  }

  private buildUpdateQuery(query: any, updateValues: any, options?: any): { query: string; params: any[] } {
    let cql = 'UPDATE ' + (options?.table || 'table') + ' SET ';
    const params: any[] = [];
    
    const updates: string[] = [];
    Object.entries(updateValues).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      params.push(value);
    });
    
    cql += updates.join(', ');
    
    if (query && Object.keys(query).length > 0) {
      cql += ' WHERE ';
      const conditions: string[] = [];
      
      Object.entries(query).forEach(([key, value]) => {
        conditions.push(`${key} = ?`);
        params.push(value);
      });
      
      cql += conditions.join(' AND ');
    }
    
    return { query: cql, params };
  }

  private buildDeleteQuery(query: any, options?: any): { query: string; params: any[] } {
    let cql = 'DELETE FROM ' + (options?.table || 'table');
    const params: any[] = [];
    
    if (query && Object.keys(query).length > 0) {
      cql += ' WHERE ';
      const conditions: string[] = [];
      
      Object.entries(query).forEach(([key, value]) => {
        conditions.push(`${key} = ?`);
        params.push(value);
      });
      
      cql += conditions.join(' AND ');
    }
    
    return { query: cql, params };
  }

  // Getter for driver access
  get driver(): Client {
    return this.client;
  }

  // Elassandra support
  enableElassandra(config: ElasticsearchConfig): void {
    this.elassandraClient = new ElassandraClient(config);
  }

  async search(query: SearchQuery): Promise<any> {
    if (!this.elassandraClient) {
      throw new Error('Elassandra not enabled. Call enableElassandra() first.');
    }
    return this.elassandraClient.search(query);
  }

  // Export/Import functionality
  async export(fixtureDirectory: string): Promise<void> {
    if (!this.exporter) {
      throw new Error('Client not connected or keyspace not specified');
    }
    await this.exporter.exportAllTables(fixtureDirectory);
  }

  async import(fixtureDirectory: string, options: ImportOptions = {}): Promise<void> {
    if (!this.importer) {
      throw new Error('Client not connected or keyspace not specified');
    }
    await this.importer.importAllTables(fixtureDirectory, options);
  }

  // File-based model loading
  static setDirectory(directory: string): typeof CassandraClient {
    (CassandraClient as any).directory = directory;
    return CassandraClient;
  }

  static async bind(options: CassandraClientOptions, directory?: string): Promise<Map<string, any>> {
    const client = new CassandraClient(options);
    const dir = directory || (CassandraClient as any).directory;
    
    if (!dir) {
      throw new Error('Directory not specified. Use setDirectory() or pass directory parameter.');
    }

    return ModelLoader.bind(client, dir);
  }

  static async bindAsync(options: CassandraClientOptions, directory?: string): Promise<Map<string, any>> {
    return this.bind(options, directory);
  }

  // Streaming functionality
  eachRow(
    query: string,
    params: QueryParameters,
    options: EachRowOptions,
    onReadable: (n: number, row: DatabaseRow) => void,
    callback?: (err?: Error, result?: ResultSet) => void
  ): void {
    if (!this.streaming) {
      throw new Error('Client not connected');
    }
    this.streaming.eachRow(query, params, options, onReadable, callback);
  }

  streamQuery(query: string, params: QueryParameters = [], options: EachRowOptions = {}): NodeJS.ReadableStream {
    if (!this.streaming) {
      throw new Error('Client not connected');
    }
    return this.streaming.stream(query, params, options);
  }

  // UUID utilities (static methods from original)
  static uuid(): string {
    return types.Uuid.random().toString();
  }

  static uuidFromString(str: string): types.Uuid {
    return types.Uuid.fromString(str);
  }

  static uuidFromBuffer(buf: Buffer): types.Uuid {
    return new types.Uuid(buf);
  }

  static timeuuid(): string {
    return types.TimeUuid.now().toString();
  }

  static timeuuidFromDate(date: Date): types.TimeUuid {
    return types.TimeUuid.fromDate(date, 0);
  }

  static timeuuidFromString(str: string): types.TimeUuid {
    return types.TimeUuid.fromString(str);
  }

  static timeuuidFromBuffer(buf: Buffer): types.TimeUuid {
    return new types.TimeUuid(buf);
  }

  static maxTimeuuid(date: Date): types.TimeUuid {
    return types.TimeUuid.max(date, 0);
  }

  static minTimeuuid(date: Date): types.TimeUuid {
    return types.TimeUuid.min(date, 0);
  }

  // Instance methods for UUID utilities
  uuid = CassandraClient.uuid;
  uuidFromString = CassandraClient.uuidFromString;
  uuidFromBuffer = CassandraClient.uuidFromBuffer;
  timeuuid = CassandraClient.timeuuid;
  timeuuidFromDate = CassandraClient.timeuuidFromDate;
  timeuuidFromString = CassandraClient.timeuuidFromString;
  timeuuidFromBuffer = CassandraClient.timeuuidFromBuffer;
  maxTimeuuid = CassandraClient.maxTimeuuid;
  minTimeuuid = CassandraClient.minTimeuuid;

  // Getters for compatibility
  get consistencies() {
    return types.consistencies;
  }

  get datatypes() {
    return types;
  }

  get driver() {
    return this.client;
  }

  get instance() {
    return Object.fromEntries(this.models);
  }

  async close(): Promise<void> {
    await this.client.shutdown();
  }

  // Batch operations
  async doBatch(
    queries: BatchQuery[],
    options: QueryOptions = {},
  ): Promise<any> {
    const defaults = { prepare: true };
    const finalOptions = { ...defaults, ...options };

    // Execute before hooks
    for (const query of queries) {
      if (query.after_hook) {
        // Store for later execution
      }
    }

    let result;
    if (queries.length > 1) {
      result = await this.client.batch(
        queries.map((q) => ({ query: q.query, params: q.params })),
        finalOptions,
      );
    } else if (queries.length === 1) {
      result = await this.client.execute(
        queries[0].query,
        queries[0].params,
        finalOptions,
      );
    } else {
      // Empty batch - return empty result
      result = { rows: [] };
    }

    // Execute after hooks
    for (const query of queries) {
      if (query.after_hook) {
        const hookResult = query.after_hook();
        if (hookResult !== true) {
          throw hookResult instanceof Error
            ? hookResult
            : new Error("After hook failed");
        }
      }
    }

    return result;
  }

  // Table operations
  async getTableList(): Promise<string[]> {
    if (!this.keyspace) {
      throw new Error("Keyspace not specified");
    }

    const query =
      "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?";
    const result = await this.client.execute(query, [this.keyspace]);
    return result.rows.map((row) => row.table_name);
  }

  async loadSchema<T extends Record<string, any>>(
    name: string,
    schema: ModelSchema,
  ): Promise<ModelStatic<T>> {
    // Create table automatically if enabled
    if (this.options.ormOptions?.migration === 'safe' || this.options.ormOptions?.migration === 'alter') {
      await this.createTableFromSchema(name, schema);
    }
    
    // Process unique fields
    await this.processUniqueFields(name, schema);
    
    const ModelClass = this.createModelClass<T>(name, schema);
    this.models.set(name, ModelClass);
    return ModelClass;
  }

  private async createTableFromSchema(tableName: string, schema: ModelSchema): Promise<void> {
    const fields: string[] = [];
    
    // Process fields
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
      fields.push(`${fieldName} ${fieldType}`);
    }
    
    // Process primary key
    const primaryKey = Array.isArray(schema.key[0]) 
      ? `(${schema.key[0].join(', ')})${schema.key.slice(1).length > 0 ? ', ' + schema.key.slice(1).join(', ') : ''}`
      : schema.key.join(', ');
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${tableName} (
        ${fields.join(',\n        ')},
        PRIMARY KEY (${primaryKey})
      )
    `;
    
    try {
      await this.client.execute(query);
    } catch (error) {
      console.warn(`Warning: Could not create table ${tableName}:`, error);
    }
  }

  private async processUniqueFields(tableName: string, schema: ModelSchema): Promise<void> {
    // Não criar tabelas auxiliares - validação será feita no ORM
    if (schema.unique && schema.unique.length > 0) {
      console.log(`✅ Schema ${tableName} configurado com campos únicos: ${schema.unique.join(', ')}`);
    }
  }

  // Import all new managers
  private queryBuilder?: QueryBuilder;
  private relationsManager?: RelationsManager;
  private hooksManager?: HooksManager;
  private migrationManager?: MigrationManager;
  private scopesManager?: ScopesManager;
  private softDeleteManager?: SoftDeleteManager;
  private serializationManager?: SerializationManager;
  private encryptionManager?: EncryptionManager;

  // Initialize all managers
  private initializeManagers(): void {
    this.relationsManager = new RelationsManager(this.client, this.keyspace || '');
    this.hooksManager = new HooksManager();
    this.migrationManager = new MigrationManager(this.client, this.keyspace || '');
    this.scopesManager = new ScopesManager();
    this.softDeleteManager = new SoftDeleteManager();
    this.serializationManager = new SerializationManager();
    this.encryptionManager = new EncryptionManager();
  }

  async validateUniqueFields(tableName: string, data: Record<string, any>, schema: ModelSchema, excludeId?: string): Promise<void> {
    if (!schema.unique || schema.unique.length === 0) {
      return;
    }

    const violations: string[] = [];

    for (const field of schema.unique) {
      if (data[field] !== undefined && data[field] !== null) {
        try {
          // Buscar todos os registros com esse valor
          const query = `SELECT id FROM ${tableName} WHERE ${field} = ? ALLOW FILTERING`;
          const params = [data[field]];

          const result = await this.client.execute(query, params);
          
          // Se encontrou registros, verificar se não é o próprio registro (para UPDATE)
          if (result.rows.length > 0) {
            if (excludeId) {
              // Para UPDATE - verificar se algum dos IDs encontrados é diferente do excludeId
              const otherRecords = result.rows.filter(row => row.id.toString() !== excludeId);
              if (otherRecords.length > 0) {
                violations.push(`Field '${field}' with value '${data[field]}' already exists`);
              }
            } else {
              // Para INSERT - qualquer registro encontrado é violação
              violations.push(`Field '${field}' with value '${data[field]}' already exists`);
            }
          }
        } catch (error) {
          // Se der erro na query, continuar (pode ser que a tabela não exista ainda)
          console.warn(`Warning: Could not validate unique field ${field}:`, error);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(`Unique constraint violation: ${violations.join(', ')}`);
    }
  }

  async insertWithUniqueValidation(tableName: string, data: Record<string, any>, schema: ModelSchema): Promise<void> {
    // Validar campos únicos antes de inserir
    await this.validateUniqueFields(tableName, data, schema);

    // Construir query de inserção
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    
    await this.client.execute(query, values);
  }

  async updateWithUniqueValidation(tableName: string, id: string, data: Record<string, any>, schema: ModelSchema): Promise<void> {
    // Validar campos únicos antes de atualizar (excluindo o próprio registro)
    await this.validateUniqueFields(tableName, data, schema, id);

    // Construir query de atualização
    const updates = Object.keys(data).map(field => `${field} = ?`);
    const values = [...Object.values(data), id];

    const query = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = ?`;
    
    await this.client.execute(query, values);
  }

  private createModelClass<T extends Record<string, any>>(
    name: string,
    schema: ModelSchema,
  ): ModelStatic<T> {
    const client = this.client;
    const keyspace = this.keyspace;
    const clientInstance = this; // Referência para a instância do CassandraClient

    class Model extends BaseModel {
      constructor(data: Partial<T> = {}) {
        super();

        // Initialize field values and validators
        const fields = schema.fields;

        // First pass: set up property descriptors
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          if (typeof fieldDef === "object" && fieldDef.virtual) {
            // Handle virtual fields
            const descriptor: PropertyDescriptor = {
              enumerable: true,
              get: fieldDef.virtual.get?.bind(this),
              set: fieldDef.virtual.set?.bind(this),
            };
            Object.defineProperty(this, fieldName, descriptor);
          } else {
            // Regular fields with modification tracking
            Object.defineProperty(this, fieldName, {
              enumerable: true,
              get: () => (this as any)["_" + fieldName],
              set: (value) => {
                const oldValue = (this as any)["_" + fieldName];
                if (oldValue !== value) {
                  this._modified[fieldName] = true;
                }
                (this as any)["_" + fieldName] = value;
              },
            });
          }
        }

        // Second pass: set default values
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          if (typeof fieldDef === "object" && fieldDef.default !== undefined) {
            if (data[fieldName as keyof T] === undefined) {
              if (typeof fieldDef.default === "function") {
                (this as any)["_" + fieldName] = fieldDef.default.call(this);
              } else if (
                typeof fieldDef.default === "object" &&
                fieldDef.default !== null &&
                '$db_function' in fieldDef.default
              ) {
                // Database function defaults would be handled during save
                (this as any)["_" + fieldName] = undefined;
              } else {
                (this as any)["_" + fieldName] = fieldDef.default;
              }
            }
          }
        }

        // Third pass: set provided values (this will trigger modification tracking)
        const initialModified = { ...this._modified };
        Object.assign(this, data);
        // Reset modification tracking for initial values
        this._modified = initialModified;

        // Add methods from schema
        if (schema.methods) {
          for (const [methodName, method] of Object.entries(schema.methods)) {
            (this as any)[methodName] = method.bind(this);
          }
        }
      }

      toObject(): Record<string, any> {
        const obj: Record<string, any> = {};
        for (const field of Object.keys(schema.fields)) {
          obj[field] = (this as any)[field];
        }
        return obj;
      }

      isNew(): boolean {
        return this._isNew !== false;
      }

      getModifiedFields(): Record<string, any> {
        const modified: Record<string, any> = {};
        for (const [field, isModified] of Object.entries(this._modified)) {
          if (isModified) {
            modified[field] = (this as any)[field];
          }
        }
        return modified;
      }

      async save(options: QueryOptions = {}): Promise<this> {
        return this.saveAsync(options);
      }

      async saveAsync(options: QueryOptions = {}): Promise<this> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before save hook
        if (schema.before_save && !schema.before_save(this as any, finalOptions)) {
          throw new Error("before_save hook returned false");
        }

        // Validação automática de campos únicos
        if (schema.unique && schema.unique.length > 0) {
          const tableName = schema.options?.table_name || name;
          const data = this.toObject();
          
          // Para novos registros ou registros modificados
          if (this.isNew() || Object.keys(this._modified).length > 0) {
            if (this.isNew()) {
              await clientInstance.validateUniqueFields(tableName, data, schema);
            } else {
              // Para updates, validar apenas campos modificados que são únicos
              const modifiedUniqueData: any = {};
              for (const field of schema.unique) {
                if (this._modified[field] && data[field] !== undefined) {
                  modifiedUniqueData[field] = data[field];
                }
              }
              if (Object.keys(modifiedUniqueData).length > 0) {
                await clientInstance.validateUniqueFields(tableName, modifiedUniqueData, schema, data.id);
              }
            }
          }
        }

        const fields = Object.keys(schema.fields);
        const values = fields.map((field) => (this as any)[field]);
        const placeholders = fields.map(() => "?").join(", ");

        let query = `INSERT INTO ${keyspace ? `"${keyspace}".` : ""}"${name}" (${fields.map((f) => `"${f}"`).join(", ")}) VALUES (${placeholders})`;

        // Handle TTL
        if (finalOptions.ttl) {
          query = query.replace(
            "VALUES",
            `USING TTL ${finalOptions.ttl} VALUES`,
          );
        }

        // Handle IF NOT EXISTS
        if (finalOptions.if_not_exist) {
          query += " IF NOT EXISTS";
        }

        await client.execute(query, values, finalOptions);

        // After save hook
        if (schema.after_save && !schema.after_save(this as any, finalOptions)) {
          throw new Error("after_save hook returned false");
        }

        // Reset modified flags
        this._modified = {};

        return this;
      }

      async delete(options: QueryOptions = {}): Promise<void> {
        return this.deleteAsync(options);
      }

      async deleteAsync(options: QueryOptions = {}): Promise<void> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before delete hook
        if (schema.before_delete && !schema.before_delete(this as any, finalOptions)) {
          throw new Error("before_delete hook returned false");
        }

        const keyFields = schema.key.flat();
        const whereClause = keyFields
          .map((field) => `"${field}" = ?`)
          .join(" AND ");
        const values = keyFields.map((field) => (this as any)[field]);

        const query = `DELETE FROM ${keyspace ? `"${keyspace}".` : ""}"${name}" WHERE ${whereClause}`;
        await client.execute(query, values, finalOptions);

        // After delete hook
        if (schema.after_delete && !schema.after_delete(this as any, finalOptions)) {
          throw new Error("after_delete hook returned false");
        }
      }

      toJSON(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const field of Object.keys(schema.fields)) {
          result[field] = (this as any)[field];
        }
        return result;
      }

      isModified(propName?: string): boolean {
        if (propName) {
          return !!this._modified[propName];
        }
        return Object.keys(this._modified).length > 0;
      }

      validate(propName?: string): { [key: string]: string } | null {
        // Simplified validation - would need full implementation
        return null;
      }

      // Static methods
      static async find(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model[]> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        let cqlQuery = `SELECT * FROM ${keyspace ? `"${keyspace}".` : ""}"${name}"`;
        const values: QueryParameters = [];

        // Build WHERE clause
        const whereConditions: string[] = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue; // Skip special operators
          whereConditions.push(`"${key}" = ?`);
          values.push(value);
        }

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        // Handle special operators
        if (query.$orderby) {
          const orderClauses = Object.entries(query.$orderby).map(
            ([field, direction]) => {
              const dir = Array.isArray(direction) ? direction[0] : direction;
              return `"${field}" ${String(dir).toUpperCase()}`;
            }
          );
          cqlQuery += ` ORDER BY ${orderClauses.join(", ")}`;
        }

        if (query.$limit) {
          cqlQuery += ` LIMIT ${query.$limit}`;
        }

        if (finalOptions.allow_filtering) {
          cqlQuery += " ALLOW FILTERING";
        }

        const result = await client.execute(cqlQuery, values, finalOptions);
        return result.rows.map(
          (row: any) => new Model(row as Partial<T>),
        );
      }

      static async create(data: Partial<T>): Promise<T> {
        const tableName = schema.options?.table_name || name;
        
        // Validação automática de campos únicos
        if (schema.unique && schema.unique.length > 0) {
          await clientInstance.validateUniqueFields(tableName, data, schema);
        }
        
        const fields = Object.keys(data);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO ${keyspace ? `"${keyspace}".` : ""}"${name}" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders})`;
        await client.execute(query, values);
        
        const instance = new this(data);
        instance._isNew = false;
        instance._modified = {};
        return instance as unknown as T;
      }

      static async findOne(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model | null> {
        const results = await this.find({ ...query, $limit: 1 }, options);
        return results.length > 0 ? results[0] : null;
      }

      static async findOneAsync(
        query: FindQuery = {},
        options: QueryOptions = {},
      ): Promise<Model | null> {
        return this.findOne(query, options);
      }

      static async update(
        query: FindQuery,
        updateValues: Partial<T>,
        options: QueryOptions = {},
      ): Promise<any> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before update hook
        if (
          schema.before_update &&
          !schema.before_update(query, updateValues, finalOptions)
        ) {
          throw new Error("before_update hook returned false");
        }

        const setClauses = Object.keys(updateValues).map(
          (key) => `"${key}" = ?`,
        );
        const setValues = Object.values(updateValues) as CassandraValue[];

        const whereConditions: string[] = [];
        const whereValues: QueryParameters = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue;
          whereConditions.push(`"${key}" = ?`);
          whereValues.push(value as CassandraValue);
        }

        let cqlQuery = `UPDATE ${keyspace ? `"${keyspace}".` : ""}"${name}"`;

        if (finalOptions.ttl) {
          cqlQuery += ` USING TTL ${finalOptions.ttl}`;
        }

        cqlQuery += ` SET ${setClauses.join(", ")}`;

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        const allValues = (setValues as CassandraValue[]).concat(whereValues);
        const result = await client.execute(
          cqlQuery,
          allValues,
          finalOptions,
        );

        // After update hook
        if (
          schema.after_update &&
          !schema.after_update(query, updateValues, finalOptions)
        ) {
          throw new Error("after_update hook returned false");
        }

        return result;
      }

      static async updateAsync(
        query: FindQuery,
        updateValues: Partial<T>,
        options: QueryOptions = {},
      ): Promise<any> {
        return this.update(query, updateValues, options);
      }

      static async delete(
        query: FindQuery,
        options: QueryOptions = {},
      ): Promise<any> {
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };

        // Before delete hook
        if (
          schema.before_delete &&
          !schema.before_delete(query, finalOptions)
        ) {
          throw new Error("before_delete hook returned false");
        }

        const whereConditions: string[] = [];
        const whereValues: QueryParameters = [];
        for (const [key, value] of Object.entries(query)) {
          if (key.startsWith("$")) continue;
          whereConditions.push(`"${key}" = ?`);
          whereValues.push(value as CassandraValue);
        }

        let cqlQuery = `DELETE FROM ${keyspace ? `"${keyspace}".` : ""}"${name}"`;

        if (whereConditions.length > 0) {
          cqlQuery += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        const result = await client.execute(
          cqlQuery,
          whereValues,
          finalOptions,
        );

        // After delete hook
        if (schema.after_delete && !schema.after_delete(query, finalOptions)) {
          throw new Error("after_delete hook returned false");
        }

        return result;
      }

      static async deleteAsync(
        query: FindQuery,
        options: QueryOptions = {},
      ): Promise<any> {
        return this.delete(query, options);
      }

      static stream(
        query: FindQuery = {},
        options: StreamOptions = {},
      ): NodeJS.ReadableStream {
        return createModelStream(this as any, query, options);
      }

      static eachRow(
        query: FindQuery = {},
        options: EachRowOptions,
        onReadable: (n: number, row: Model) => void,
        callback?: (err?: Error, result?: ResultSet) => void
      ): void {
        const stream = this.stream(query, options);
        let rowCount = 0;

        stream.on('data', (row) => {
          rowCount++;
          onReadable(rowCount, row);
        });

        stream.on('end', () => {
          if (callback) callback(undefined, { rows: [], rowLength: rowCount } as any);
        });

        stream.on('error', (err) => {
          if (callback) callback(err);
        });
      }

      static get_cql_client(): Client {
        return client;
      }

      static async execute_query(
        query: string,
        params: QueryParameters = [],
        options: QueryOptions = {},
      ): Promise<ResultSet> {
        const client = this.get_cql_client();
        return client.execute(query, params, options);
      }

      static async execute_batch(
        queries: BatchQuery[],
        options: QueryOptions = {},
      ): Promise<ResultSet> {
        const client = this.get_cql_client();
        const defaults = { prepare: true };
        const finalOptions = { ...defaults, ...options };
        return client.batch(
          queries.map((q) => ({ query: q.query, params: q.params })),
          finalOptions,
        );
      }

      static syncDB(callback?: (err?: Error, result?: boolean) => void): void {
        // Schema synchronization would be implemented here
        if (callback) callback(undefined, true);
      }

      static async syncDBAsync(): Promise<void> {
        return new Promise((resolve, reject) => {
          this.syncDB((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      static truncate(callback?: (err?: Error) => void): void {
        const query = `TRUNCATE ${keyspace ? `"${keyspace}".` : ""}"${name}"`;
        client
          .execute(query)
          .then(() => {
            if (callback) callback();
          })
          .catch((err) => {
            if (callback) callback(err);
          });
      }

      static async truncateAsync(): Promise<void> {
        return new Promise((resolve, reject) => {
          this.truncate((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Properties
      static _properties = {
        name,
        schema,
      };
    }

    return Model as any;
  }
}
