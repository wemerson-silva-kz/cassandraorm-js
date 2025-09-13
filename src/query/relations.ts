import type { Client } from "cassandra-driver";

export interface RelationDefinition {
  model: string;
  foreignKey: string;
  type: 'hasOne' | 'hasMany' | 'belongsTo';
  localKey?: string;
  through?: string; // For many-to-many
}

export interface RelationsConfig {
  enabled?: boolean;
  cacheResults?: boolean;
  maxDepth?: number;
}

export interface PopulateOptions {
  select?: string[];
  where?: Record<string, any>;
  limit?: number;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
}

export class RelationsManager {
  private client: Client;
  private keyspace: string;
  private config: RelationsConfig;
  private modelRegistry = new Map<string, any>();

  constructor(client: Client, keyspace: string, config: RelationsConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      cacheResults: false,
      maxDepth: 3,
      ...config
    };
  }

  registerModel(name: string, schema: any): void {
    this.modelRegistry.set(name, schema);
  }

  async populate<T>(
    modelName: string,
    records: T[],
    relations: string | string[],
    options: Record<string, PopulateOptions> = {}
  ): Promise<T[]> {
    if (!this.config.enabled || !records.length) {
      return records;
    }

    const relationNames = Array.isArray(relations) ? relations : [relations];
    const schema = this.modelRegistry.get(modelName);
    
    if (!schema?.relations) {
      return records;
    }

    const populatedRecords = [...records];

    for (const relationName of relationNames) {
      const relation = schema.relations[relationName];
      if (!relation) continue;

      await this.populateRelation(
        populatedRecords,
        relationName,
        relation,
        options[relationName] || {}
      );
    }

    return populatedRecords;
  }

  private async populateRelation<T>(
    records: T[],
    relationName: string,
    relation: RelationDefinition,
    options: PopulateOptions
  ): Promise<void> {
    const localKey = relation.localKey || 'id';
    const foreignKey = relation.foreignKey;
    
    // Extract foreign key values
    const foreignKeyValues = records
      .map(record => (record as any)[localKey])
      .filter(Boolean);

    if (!foreignKeyValues.length) return;

    // Build query for related records
    let query = `SELECT ${options.select?.join(', ') || '*'} FROM ${this.keyspace}.${relation.model}`;
    const params: any[] = [];

    // Add WHERE clause
    const whereConditions = [`${foreignKey} IN ?`];
    params.push(foreignKeyValues);

    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        whereConditions.push(`${key} = ?`);
        params.push(value);
      });
    }

    query += ` WHERE ${whereConditions.join(' AND ')}`;

    // Add ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy.field} ${options.orderBy.direction}`;
    }

    // Add LIMIT
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    query += ' ALLOW FILTERING';

    // Execute query
    const result = await this.client.execute(query, params, { prepare: true });
    const relatedRecords = result.rows;

    // Group related records by foreign key
    const relatedByKey = new Map<any, any[]>();
    relatedRecords.forEach(record => {
      const key = record[foreignKey];
      if (!relatedByKey.has(key)) {
        relatedByKey.set(key, []);
      }
      relatedByKey.get(key)!.push(record);
    });

    // Attach related records to main records
    records.forEach(record => {
      const key = (record as any)[localKey];
      const related = relatedByKey.get(key) || [];

      if (relation.type === 'hasOne') {
        (record as any)[relationName] = related[0] || null;
      } else {
        (record as any)[relationName] = related;
      }
    });
  }

  async createRelation(
    fromModel: string,
    fromId: any,
    toModel: string,
    toId: any,
    relationName: string
  ): Promise<void> {
    const fromSchema = this.modelRegistry.get(fromModel);
    const relation = fromSchema?.relations?.[relationName];
    
    if (!relation) {
      throw new Error(`Relation ${relationName} not found in ${fromModel}`);
    }

    if (relation.through) {
      // Many-to-many relationship
      await this.client.execute(
        `INSERT INTO ${this.keyspace}.${relation.through} (${relation.foreignKey}, ${relation.localKey || 'id'}) VALUES (?, ?)`,
        [fromId, toId],
        { prepare: true }
      );
    } else {
      // Update foreign key in related model
      await this.client.execute(
        `UPDATE ${this.keyspace}.${toModel} SET ${relation.foreignKey} = ? WHERE id = ?`,
        [fromId, toId],
        { prepare: true }
      );
    }
  }

  async removeRelation(
    fromModel: string,
    fromId: any,
    toModel: string,
    toId: any,
    relationName: string
  ): Promise<void> {
    const fromSchema = this.modelRegistry.get(fromModel);
    const relation = fromSchema?.relations?.[relationName];
    
    if (!relation) {
      throw new Error(`Relation ${relationName} not found in ${fromModel}`);
    }

    if (relation.through) {
      // Many-to-many relationship
      await this.client.execute(
        `DELETE FROM ${this.keyspace}.${relation.through} WHERE ${relation.foreignKey} = ? AND ${relation.localKey || 'id'} = ?`,
        [fromId, toId],
        { prepare: true }
      );
    } else {
      // Remove foreign key from related model
      await this.client.execute(
        `UPDATE ${this.keyspace}.${toModel} SET ${relation.foreignKey} = null WHERE id = ?`,
        [toId],
        { prepare: true }
      );
    }
  }

  // Helper method to create denormalized data
  async denormalize<T>(
    record: T,
    relations: string[],
    targetTable: string
  ): Promise<void> {
    const denormalizedData = { ...record };

    // Populate relations
    const populated = await this.populate(
      targetTable,
      [record],
      relations
    );

    if (populated.length > 0) {
      Object.assign(denormalizedData, populated[0]);
    }

    // Store denormalized data
    const fields = Object.keys(denormalizedData);
    const values = Object.values(denormalizedData);
    const placeholders = fields.map(() => '?').join(', ');

    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${targetTable}_denormalized (${fields.join(', ')}) VALUES (${placeholders})`,
      values,
      { prepare: true }
    );
  }
}
