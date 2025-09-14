import type { Client } from "cassandra-driver";
import type { ModelSchema } from "../core/types.js";

export interface RelationDefinition {
  model: string;
  foreignKey: string;
  localKey?: string;
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  through?: string; // For many-to-many
  pivotKeys?: { local: string; foreign: string }; // For many-to-many
  as?: string; // Alias for the relation
}

export interface PopulateOptions {
  select?: string[];
  where?: Record<string, any>;
  limit?: number;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  nested?: Record<string, PopulateOptions>; // Nested population
}

export interface RelationsConfig {
  enabled?: boolean;
  cacheResults?: boolean;
  maxDepth?: number;
  lazyLoading?: boolean;
}

export class RelationsManager {
  private client: Client;
  private keyspace: string;
  private config: RelationsConfig;
  private modelRegistry = new Map<string, { schema: ModelSchema; relations: Record<string, RelationDefinition> }>();
  private cache = new Map<string, any>();

  constructor(client: Client, keyspace: string, config: RelationsConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      cacheResults: false,
      maxDepth: 3,
      lazyLoading: true,
      ...config
    };
  }

  registerModel(name: string, schema: ModelSchema, relations: Record<string, RelationDefinition> = {}): void {
    this.modelRegistry.set(name, { schema, relations });
  }

  // Populate relations for records
  async populate<T>(
    modelName: string,
    records: T[],
    relations: string | string[],
    options: Record<string, PopulateOptions> = {}
  ): Promise<T[]> {
    if (!this.config.enabled || !records.length) return records;

    const relationNames = Array.isArray(relations) ? relations : [relations];
    const modelInfo = this.modelRegistry.get(modelName);
    
    if (!modelInfo) {
      throw new Error(`Model ${modelName} not registered`);
    }

    for (const relationName of relationNames) {
      const relation = modelInfo.relations[relationName];
      if (!relation) {
        console.warn(`Relation ${relationName} not found for model ${modelName}`);
        continue;
      }

      const populateOptions = options[relationName] || {};
      await this.populateRelation(records, relation, relationName, populateOptions);
    }

    return records;
  }

  private async populateRelation<T>(
    records: T[],
    relation: RelationDefinition,
    relationName: string,
    options: PopulateOptions
  ): Promise<void> {
    const cacheKey = this.getCacheKey(relation, records, options);
    
    if (this.config.cacheResults && this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey);
      this.attachRelationData(records, cachedData, relationName, relation.type);
      return;
    }

    let relatedData: any[];

    switch (relation.type) {
      case 'hasOne':
        relatedData = await this.loadHasOneRelation(records, relation, options);
        break;
      case 'hasMany':
        relatedData = await this.loadHasManyRelation(records, relation, options);
        break;
      case 'belongsTo':
        relatedData = await this.loadBelongsToRelation(records, relation, options);
        break;
      case 'belongsToMany':
        relatedData = await this.loadBelongsToManyRelation(records, relation, options);
        break;
      default:
        throw new Error(`Unknown relation type: ${relation.type}`);
    }

    if (this.config.cacheResults) {
      this.cache.set(cacheKey, relatedData);
    }

    this.attachRelationData(records, relatedData, relationName, relation.type);

    // Handle nested population
    if (options.nested) {
      for (const [nestedRelation, nestedOptions] of Object.entries(options.nested)) {
        await this.populate(relation.model, relatedData, nestedRelation, { [nestedRelation]: nestedOptions });
      }
    }
  }

  private async loadHasOneRelation<T>(
    records: T[],
    relation: RelationDefinition,
    options: PopulateOptions
  ): Promise<any[]> {
    const localKey = relation.localKey || 'id';
    const foreignKey = relation.foreignKey;
    const localValues = records.map(record => (record as any)[localKey]).filter(Boolean);

    if (!localValues.length) return [];

    const query = this.buildRelationQuery(relation.model, foreignKey, localValues, options);
    const result = await this.client.execute(query.cql, query.params);
    
    return result.rows;
  }

  private async loadHasManyRelation<T>(
    records: T[],
    relation: RelationDefinition,
    options: PopulateOptions
  ): Promise<any[]> {
    const localKey = relation.localKey || 'id';
    const foreignKey = relation.foreignKey;
    const localValues = records.map(record => (record as any)[localKey]).filter(Boolean);

    if (!localValues.length) return [];

    const query = this.buildRelationQuery(relation.model, foreignKey, localValues, options);
    const result = await this.client.execute(query.cql, query.params);
    
    return result.rows;
  }

  private async loadBelongsToRelation<T>(
    records: T[],
    relation: RelationDefinition,
    options: PopulateOptions
  ): Promise<any[]> {
    const foreignKey = relation.foreignKey;
    const localKey = relation.localKey || 'id';
    const foreignValues = records.map(record => (record as any)[foreignKey]).filter(Boolean);

    if (!foreignValues.length) return [];

    const query = this.buildRelationQuery(relation.model, localKey, foreignValues, options);
    const result = await this.client.execute(query.cql, query.params);
    
    return result.rows;
  }

  private async loadBelongsToManyRelation<T>(
    records: T[],
    relation: RelationDefinition,
    options: PopulateOptions
  ): Promise<any[]> {
    if (!relation.through || !relation.pivotKeys) {
      throw new Error('belongsToMany relation requires through table and pivotKeys');
    }

    const localKey = relation.localKey || 'id';
    const localValues = records.map(record => (record as any)[localKey]).filter(Boolean);

    if (!localValues.length) return [];

    // First, get pivot data
    const pivotQuery = `
      SELECT ${relation.pivotKeys.local}, ${relation.pivotKeys.foreign}
      FROM ${this.getTableName(relation.through)}
      WHERE ${relation.pivotKeys.local} IN (${localValues.map(() => '?').join(', ')})
    `;
    
    const pivotResult = await this.client.execute(pivotQuery, localValues);
    const foreignValues = pivotResult.rows.map(row => row[relation.pivotKeys!.foreign]);

    if (!foreignValues.length) return [];

    // Then get related records
    const query = this.buildRelationQuery(relation.model, 'id', foreignValues, options);
    const result = await this.client.execute(query.cql, query.params);
    
    // Attach pivot data to results
    const pivotMap = new Map();
    pivotResult.rows.forEach(pivot => {
      const localId = pivot[relation.pivotKeys!.local];
      const foreignId = pivot[relation.pivotKeys!.foreign];
      
      if (!pivotMap.has(localId)) {
        pivotMap.set(localId, []);
      }
      pivotMap.get(localId).push(foreignId);
    });

    result.rows.forEach(row => {
      row._pivot = pivotMap;
    });

    return result.rows;
  }

  private buildRelationQuery(
    modelName: string,
    keyField: string,
    values: any[],
    options: PopulateOptions
  ): { cql: string; params: any[] } {
    const select = options.select ? options.select.join(', ') : '*';
    const tableName = this.getTableName(modelName.toLowerCase());
    
    let cql = `SELECT ${select} FROM ${tableName} WHERE ${keyField} IN (${values.map(() => '?').join(', ')})`;
    let params = [...values];

    // Add WHERE conditions
    if (options.where) {
      const whereConditions = Object.entries(options.where).map(([field, value]) => `${field} = ?`);
      cql += ` AND ${whereConditions.join(' AND ')}`;
      params.push(...Object.values(options.where));
    }

    // Add ORDER BY
    if (options.orderBy) {
      cql += ` ORDER BY ${options.orderBy.field} ${options.orderBy.direction}`;
    }

    // Add LIMIT
    if (options.limit) {
      cql += ` LIMIT ${options.limit}`;
    }

    cql += ' ALLOW FILTERING';

    return { cql, params };
  }

  private attachRelationData<T>(
    records: T[],
    relatedData: any[],
    relationName: string,
    relationType: RelationDefinition['type']
  ): void {
    const relatedMap = new Map();

    // Group related data by foreign key
    relatedData.forEach(related => {
      const key = this.getRelationKey(related, relationType);
      
      if (relationType === 'hasMany' || relationType === 'belongsToMany') {
        if (!relatedMap.has(key)) {
          relatedMap.set(key, []);
        }
        relatedMap.get(key).push(related);
      } else {
        relatedMap.set(key, related);
      }
    });

    // Attach to records
    records.forEach(record => {
      const localKey = this.getLocalKey(record as any, relationType);
      const relatedValue = relatedMap.get(localKey);
      
      (record as any)[relationName] = relatedValue || (relationType === 'hasMany' || relationType === 'belongsToMany' ? [] : null);
    });
  }

  private getRelationKey(related: any, relationType: RelationDefinition['type']): any {
    // This is simplified - in practice, you'd need to track the foreign key field
    return related.id || related.user_id || Object.values(related)[0];
  }

  private getLocalKey(record: any, relationType: RelationDefinition['type']): any {
    return record.id;
  }

  private getTableName(tableName: string): string {
    return this.keyspace ? `"${this.keyspace}"."${tableName}"` : `"${tableName}"`;
  }

  private getCacheKey(relation: RelationDefinition, records: any[], options: PopulateOptions): string {
    const recordIds = records.map(r => r.id).sort().join(',');
    const optionsStr = JSON.stringify(options);
    return `${relation.model}:${relation.type}:${recordIds}:${optionsStr}`;
  }

  // Lazy loading methods
  createLazyLoader<T>(
    record: T,
    relationName: string,
    relation: RelationDefinition
  ): () => Promise<any> {
    return async () => {
      if ((record as any)[`_${relationName}_loaded`]) {
        return (record as any)[relationName];
      }

      const result = await this.populate(
        (record.constructor as any).name,
        [record],
        relationName
      );

      (record as any)[`_${relationName}_loaded`] = true;
      return (record as any)[relationName];
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get relation definition
  getRelation(modelName: string, relationName: string): RelationDefinition | undefined {
    const modelInfo = this.modelRegistry.get(modelName);
    return modelInfo?.relations[relationName];
  }

  // Check if relation exists
  hasRelation(modelName: string, relationName: string): boolean {
    return !!this.getRelation(modelName, relationName);
  }
}
