import type { QueryBuilder } from "../query/query-builder.js";
import type { ModelSchema } from "../core/types.js";
import type { HookContext } from "./hooks-middleware.js";

export interface SoftDeleteOptions {
  deletedAtField?: string;
  defaultScope?: boolean;
  cascadeDeletes?: string[]; // Relations to cascade soft delete
}

export interface SoftDeleteConfig {
  enabled: boolean;
  deletedAtField: string;
  defaultScope: boolean;
  cascadeDeletes: string[];
}

export class SoftDeleteManager {
  private modelConfigs = new Map<string, SoftDeleteConfig>();

  // Register model for soft deletes
  registerModel(modelName: string, options: SoftDeleteOptions = {}): void {
    const config: SoftDeleteConfig = {
      enabled: true,
      deletedAtField: options.deletedAtField || 'deleted_at',
      defaultScope: options.defaultScope !== false,
      cascadeDeletes: options.cascadeDeletes || []
    };

    this.modelConfigs.set(modelName, config);
  }

  // Check if model has soft deletes enabled
  isEnabled(modelName: string): boolean {
    return this.modelConfigs.get(modelName)?.enabled || false;
  }

  // Get soft delete config for model
  getConfig(modelName: string): SoftDeleteConfig | undefined {
    return this.modelConfigs.get(modelName);
  }

  // Apply default scope to exclude soft deleted records
  applyDefaultScope(query: QueryBuilder, modelName: string): QueryBuilder {
    const config = this.modelConfigs.get(modelName);
    
    if (config && config.defaultScope) {
      query.whereNull(config.deletedAtField);
    }
    
    return query;
  }

  // Soft delete a record
  async softDelete(
    query: QueryBuilder,
    modelName: string,
    context?: HookContext
  ): Promise<any> {
    const config = this.modelConfigs.get(modelName);
    
    if (!config) {
      throw new Error(`Soft deletes not enabled for model ${modelName}`);
    }

    const updateData = {
      [config.deletedAtField]: new Date()
    };

    // Execute before delete hooks
    if (context) {
      // Hooks would be executed here
    }

    const result = await query.update(updateData);

    // Handle cascade deletes
    if (config.cascadeDeletes.length > 0) {
      await this.handleCascadeDeletes(query, modelName, config);
    }

    // Execute after delete hooks
    if (context) {
      // Hooks would be executed here
    }

    return result;
  }

  // Restore a soft deleted record
  async restore(
    query: QueryBuilder,
    modelName: string,
    context?: HookContext
  ): Promise<any> {
    const config = this.modelConfigs.get(modelName);
    
    if (!config) {
      throw new Error(`Soft deletes not enabled for model ${modelName}`);
    }

    const updateData = {
      [config.deletedAtField]: null
    };

    return query.update(updateData);
  }

  // Force delete (permanent delete)
  async forceDelete(
    query: QueryBuilder,
    modelName: string,
    context?: HookContext
  ): Promise<any> {
    // This performs actual DELETE operation
    return query.delete();
  }

  private async handleCascadeDeletes(
    query: QueryBuilder,
    modelName: string,
    config: SoftDeleteConfig
  ): Promise<void> {
    // Implementation would depend on relations system
    // This is a placeholder for cascade delete logic
    console.log(`Handling cascade deletes for ${modelName}:`, config.cascadeDeletes);
  }
}

// Enhanced Query Builder with soft delete support
export class SoftDeleteQueryBuilder {
  private client: any;
  private tableName: string;
  private keyspace: string;
  private modelName: string;
  private softDeleteManager: SoftDeleteManager;
  private schema?: ModelSchema;
  private includeTrashed = false;
  private onlyTrashedFlag = false;
  protected conditions: any[] = [];
  protected joins: any[] = [];
  protected options: any = {};

  constructor(
    client: any,
    tableName: string,
    keyspace: string,
    modelName: string,
    softDeleteManager: SoftDeleteManager,
    schema?: ModelSchema
  ) {
    this.client = client;
    this.tableName = tableName;
    this.keyspace = keyspace;
    this.modelName = modelName;
    this.softDeleteManager = softDeleteManager;
    this.schema = schema;
  }

  // Include soft deleted records
  withTrashed(): this {
    this.includeTrashed = true;
    return this;
  }

  // Only soft deleted records
  onlyTrashed(): this {
    this.onlyTrashedFlag = true;
    return this;
  }

  // Restore soft deleted records
  async restore(): Promise<any> {
    return this.softDeleteManager.restore(this as any, this.modelName);
  }

  // Soft delete records
  async softDelete(): Promise<any> {
    return this.softDeleteManager.softDelete(this as any, this.modelName);
  }

  // Force delete (permanent)
  async forceDelete(): Promise<any> {
    return this.softDeleteManager.forceDelete(this as any, this.modelName);
  }

  // Override delete to use soft delete by default
  async delete(): Promise<any> {
    if (this.softDeleteManager.isEnabled(this.modelName)) {
      return this.softDelete();
    }
    // Would call super.delete() if extending QueryBuilder
    return this.forceDelete();
  }

  // Basic query methods
  where(field: string, operator?: any, value?: any): this {
    // Implementation would be similar to QueryBuilder
    return this;
  }

  whereNull(field: string): this {
    return this.where(field, null);
  }

  whereNotNull(field: string): this {
    return this.where(field, 'ne', null);
  }

  async get(): Promise<any[]> {
    this.applyDefaultScope();
    // Implementation would be similar to QueryBuilder
    return [];
  }

  async first(): Promise<any | null> {
    this.applyDefaultScope();
    // Implementation would be similar to QueryBuilder
    return null;
  }

  async count(): Promise<number> {
    this.applyDefaultScope();
    // Implementation would be similar to QueryBuilder
    return 0;
  }

  private applyDefaultScope(): void {
    if (!this.includeTrashed && !this.onlyTrashed) {
      this.softDeleteManager.applyDefaultScope(this as any, this.modelName);
    } else if (this.onlyTrashed) {
      const config = this.softDeleteManager.getConfig(this.modelName);
      if (config) {
        this.whereNotNull(config.deletedAtField);
      }
    }
  }

  // Clone with soft delete support
  clone(): SoftDeleteQueryBuilder {
    const cloned = new SoftDeleteQueryBuilder(
      this.client,
      this.tableName,
      this.keyspace,
      this.modelName,
      this.softDeleteManager,
      this.schema
    );
    
    // Copy properties
    cloned.conditions = [...this.conditions];
    cloned.joins = [...this.joins];
    cloned.options = { ...this.options };
    
    // Copy soft delete properties
    cloned.includeTrashed = this.includeTrashed;
    cloned.onlyTrashed = this.onlyTrashed;
    
    return cloned;
  }
}

// Soft delete model mixin
export const SoftDeleteMixin = {
  // Instance methods
  async softDelete(this: any): Promise<any> {
    const config = softDeleteManager.getConfig(this.constructor.name);
    if (!config) {
      throw new Error(`Soft deletes not enabled for ${this.constructor.name}`);
    }

    this[config.deletedAtField] = new Date();
    return this.save();
  },

  async restore(this: any): Promise<any> {
    const config = softDeleteManager.getConfig(this.constructor.name);
    if (!config) {
      throw new Error(`Soft deletes not enabled for ${this.constructor.name}`);
    }

    this[config.deletedAtField] = null;
    return this.save();
  },

  async forceDelete(this: any): Promise<any> {
    // Perform actual delete
    return this.constructor.where('id', this.id).forceDelete();
  },

  isTrashed(this: any): boolean {
    const config = softDeleteManager.getConfig(this.constructor.name);
    if (!config) return false;

    return this[config.deletedAtField] !== null && this[config.deletedAtField] !== undefined;
  },

  // Static methods
  withTrashed(this: any): SoftDeleteQueryBuilder {
    return this.query().withTrashed();
  },

  onlyTrashed(this: any): SoftDeleteQueryBuilder {
    return this.query().onlyTrashed();
  },

  async restoreAll(this: any, conditions: Record<string, any> = {}): Promise<any> {
    return this.onlyTrashed().where(conditions).restore();
  }
};

// Hooks for soft delete functionality
export const SoftDeleteHooks = {
  beforeDelete: async (data: any, context?: HookContext) => {
    if (!context) return data;

    const config = softDeleteManager.getConfig(context.modelName);
    if (config && config.enabled) {
      // Convert delete to soft delete
      const updateData = {
        [config.deletedAtField]: new Date()
      };
      
      // Change operation to update
      context.operation = 'update';
      return updateData;
    }

    return data;
  },

  beforeFind: async (query: any, context?: HookContext) => {
    if (!context) return query;

    const config = softDeleteManager.getConfig(context.modelName);
    if (config && config.defaultScope) {
      // Add condition to exclude soft deleted records
      if (!query[config.deletedAtField]) {
        query[config.deletedAtField] = null;
      }
    }

    return query;
  }
};

// Default soft delete manager instance
export const softDeleteManager = new SoftDeleteManager();

// Utility functions
export const SoftDeleteUtils = {
  // Add soft delete field to schema
  addSoftDeleteField: (schema: ModelSchema, fieldName = 'deleted_at'): ModelSchema => {
    return {
      ...schema,
      fields: {
        ...schema.fields,
        [fieldName]: 'timestamp'
      }
    };
  },

  // Check if record is soft deleted
  isSoftDeleted: (record: any, fieldName = 'deleted_at'): boolean => {
    return record[fieldName] !== null && record[fieldName] !== undefined;
  },

  // Get soft deleted records from array
  getTrashed: (records: any[], fieldName = 'deleted_at'): any[] => {
    return records.filter(record => SoftDeleteUtils.isSoftDeleted(record, fieldName));
  },

  // Get non-soft deleted records from array
  getActive: (records: any[], fieldName = 'deleted_at'): any[] => {
    return records.filter(record => !SoftDeleteUtils.isSoftDeleted(record, fieldName));
  },

  // Restore multiple records
  restoreRecords: async (
    records: any[],
    updateMethod: (id: any, data: any) => Promise<any>,
    fieldName = 'deleted_at'
  ): Promise<any[]> => {
    const restorePromises = records.map(record => 
      updateMethod(record.id, { [fieldName]: null })
    );
    
    return Promise.all(restorePromises);
  }
};
