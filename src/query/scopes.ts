import type { QueryBuilder } from "./query-builder.js";
import type { ModelSchema } from "../core/types.js";

export type ScopeFunction = (...args: any[]) => Record<string, any> | ((query: QueryBuilder) => QueryBuilder);
export type FilterFunction = (query: QueryBuilder, ...args: any[]) => QueryBuilder;

export interface ModelScopes {
  [scopeName: string]: ScopeFunction;
}

export interface ModelFilters {
  [filterName: string]: FilterFunction;
}

export interface ScopeContext {
  modelName: string;
  tableName: string;
  schema: ModelSchema;
}

export class ScopesManager {
  private globalScopes = new Map<string, ScopeFunction>();
  private modelScopes = new Map<string, ModelScopes>();
  private globalFilters = new Map<string, FilterFunction>();
  private modelFilters = new Map<string, ModelFilters>();

  // Register global scopes
  registerGlobalScope(name: string, scope: ScopeFunction): void {
    this.globalScopes.set(name, scope);
  }

  // Register model-specific scopes
  registerModelScopes(modelName: string, scopes: ModelScopes): void {
    this.modelScopes.set(modelName, { ...this.modelScopes.get(modelName), ...scopes });
  }

  // Register global filters
  registerGlobalFilter(name: string, filter: FilterFunction): void {
    this.globalFilters.set(name, filter);
  }

  // Register model-specific filters
  registerModelFilters(modelName: string, filters: ModelFilters): void {
    this.modelFilters.set(modelName, { ...this.modelFilters.get(modelName), ...filters });
  }

  // Apply scope to query builder
  applyScope(
    query: QueryBuilder,
    scopeName: string,
    modelName: string,
    args: any[] = []
  ): QueryBuilder {
    // Try model-specific scope first
    const modelScopes = this.modelScopes.get(modelName);
    if (modelScopes && modelScopes[scopeName]) {
      return this.executeScope(query, modelScopes[scopeName], args);
    }

    // Try global scope
    const globalScope = this.globalScopes.get(scopeName);
    if (globalScope) {
      return this.executeScope(query, globalScope, args);
    }

    throw new Error(`Scope '${scopeName}' not found for model '${modelName}'`);
  }

  // Apply filter to query builder
  applyFilter(
    query: QueryBuilder,
    filterName: string,
    modelName: string,
    args: any[] = []
  ): QueryBuilder {
    // Try model-specific filter first
    const modelFilters = this.modelFilters.get(modelName);
    if (modelFilters && modelFilters[filterName]) {
      return modelFilters[filterName](query, ...args);
    }

    // Try global filter
    const globalFilter = this.globalFilters.get(filterName);
    if (globalFilter) {
      return globalFilter(query, ...args);
    }

    throw new Error(`Filter '${filterName}' not found for model '${modelName}'`);
  }

  private executeScope(query: QueryBuilder, scope: ScopeFunction, args: any[]): QueryBuilder {
    const result = scope(...args);

    if (typeof result === 'function') {
      // Scope returns a function that modifies the query
      return result(query);
    } else if (typeof result === 'object') {
      // Scope returns conditions to apply
      for (const [field, value] of Object.entries(result)) {
        if (Array.isArray(value)) {
          query.whereIn(field, value);
        } else if (typeof value === 'object' && value !== null) {
          // Handle operators like { $gt: 10 }
          for (const [operator, operatorValue] of Object.entries(value)) {
            const cassandraOp = this.mapOperator(operator);
            query.where(field, cassandraOp, operatorValue);
          }
        } else {
          query.where(field, value);
        }
      }
      return query;
    }

    return query;
  }

  private mapOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      '$gt': 'gt',
      '$gte': 'gte',
      '$lt': 'lt',
      '$lte': 'lte',
      '$ne': 'ne',
      '$in': 'in',
      '$like': 'like',
      '$contains': 'contains'
    };

    return operatorMap[operator] || 'eq';
  }

  // Get available scopes for a model
  getAvailableScopes(modelName: string): string[] {
    const modelScopes = Object.keys(this.modelScopes.get(modelName) || {});
    const globalScopes = Array.from(this.globalScopes.keys());
    return [...new Set([...modelScopes, ...globalScopes])];
  }

  // Get available filters for a model
  getAvailableFilters(modelName: string): string[] {
    const modelFilters = Object.keys(this.modelFilters.get(modelName) || {});
    const globalFilters = Array.from(this.globalFilters.keys());
    return [...new Set([...modelFilters, ...globalFilters])];
  }

  // Check if scope exists
  hasScope(scopeName: string, modelName: string): boolean {
    const modelScopes = this.modelScopes.get(modelName);
    return !!(modelScopes?.[scopeName] || this.globalScopes.has(scopeName));
  }

  // Check if filter exists
  hasFilter(filterName: string, modelName: string): boolean {
    const modelFilters = this.modelFilters.get(modelName);
    return !!(modelFilters?.[filterName] || this.globalFilters.has(filterName));
  }
}

// Enhanced Query Builder with scopes and filters
export class ScopedQueryBuilder {
  private client: any;
  private tableName: string;
  private keyspace: string;
  private modelName: string;
  private scopesManager: ScopesManager;
  private schema?: ModelSchema;
  protected conditions: any[] = [];
  protected joins: any[] = [];
  protected options: any = {};

  constructor(
    client: any,
    tableName: string,
    keyspace: string,
    modelName: string,
    scopesManager: ScopesManager,
    schema?: ModelSchema
  ) {
    this.client = client;
    this.tableName = tableName;
    this.keyspace = keyspace;
    this.modelName = modelName;
    this.scopesManager = scopesManager;
    this.schema = schema;
  }

  // Apply scope
  scope(scopeName: string, ...args: any[]): this {
    this.scopesManager.applyScope(this as any, scopeName, this.modelName, args);
    return this;
  }

  // Apply filter
  filter(filterName: string, ...args: any[]): this {
    this.scopesManager.applyFilter(this as any, filterName, this.modelName, args);
    return this;
  }

  // Apply multiple scopes
  scopes(scopes: string[] | Record<string, any[]>): this {
    if (Array.isArray(scopes)) {
      scopes.forEach(scope => this.scope(scope));
    } else {
      Object.entries(scopes).forEach(([scope, args]) => this.scope(scope, ...args));
    }
    return this;
  }

  // Apply multiple filters
  filters(filters: string[] | Record<string, any[]>): this {
    if (Array.isArray(filters)) {
      filters.forEach(filter => this.filter(filter));
    } else {
      Object.entries(filters).forEach(([filter, args]) => this.filter(filter, ...args));
    }
    return this;
  }

  // Conditional scope application
  when(condition: boolean | (() => boolean), scopeName: string, ...args: any[]): this {
    const shouldApply = typeof condition === 'function' ? condition() : condition;
    if (shouldApply) {
      this.scope(scopeName, ...args);
    }
    return this;
  }

  // Conditional filter application
  filterWhen(condition: boolean | (() => boolean), filterName: string, ...args: any[]): this {
    const shouldApply = typeof condition === 'function' ? condition() : condition;
    if (shouldApply) {
      this.filter(filterName, ...args);
    }
    return this;
  }

  // Basic query methods
  where(field: string, operator?: any, value?: any): this {
    // Implementation would be similar to QueryBuilder
    return this;
  }

  async get(): Promise<any[]> {
    // Implementation would be similar to QueryBuilder
    return [];
  }

  // Clone with scopes support
  clone(): ScopedQueryBuilder {
    const cloned = new ScopedQueryBuilder(
      this.client,
      this.tableName,
      this.keyspace,
      this.modelName,
      this.scopesManager,
      this.schema
    );
    
    // Copy properties
    cloned.conditions = [...this.conditions];
    cloned.joins = [...this.joins];
    cloned.options = { ...this.options };
    
    return cloned;
  }
}

// Common scopes and filters
export const CommonScopes = {
  // Time-based scopes
  recent: (days: number = 30) => ({
    created_at: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
  }),

  today: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      created_at: { $gte: today, $lt: tomorrow }
    };
  },

  thisWeek: () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    
    return {
      created_at: { $gte: startOfWeek }
    };
  },

  thisMonth: () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return {
      created_at: { $gte: startOfMonth }
    };
  },

  // Status-based scopes
  active: () => ({ status: 'active' }),
  inactive: () => ({ status: 'inactive' }),
  published: () => ({ published: true }),
  draft: () => ({ published: false }),

  // Ordering scopes
  latest: () => (query: QueryBuilder) => query.orderBy('created_at', 'DESC'),
  oldest: () => (query: QueryBuilder) => query.orderBy('created_at', 'ASC'),
  alphabetical: () => (query: QueryBuilder) => query.orderBy('name', 'ASC'),

  // Pagination scopes
  limit: (count: number) => (query: QueryBuilder) => query.limit(count),
  page: (page: number, perPage: number = 15) => (query: QueryBuilder) => 
    query.limit(perPage).offset((page - 1) * perPage),

  // Search scopes
  search: (term: string, fields: string[] = ['name']) => {
    const conditions: Record<string, any> = {};
    fields.forEach(field => {
      conditions[field] = { $like: `%${term}%` };
    });
    return conditions;
  },

  // Range scopes
  between: (field: string, min: any, max: any) => ({
    [field]: { $gte: min, $lte: max }
  }),

  // Null/Not null scopes
  whereNull: (field: string) => ({ [field]: null }),
  whereNotNull: (field: string) => ({ [field]: { $ne: null } })
};

export const CommonFilters = {
  // Search filter
  search: (query: QueryBuilder, term: string, fields: string[] = ['name']) => {
    fields.forEach((field, index) => {
      if (index === 0) {
        query.whereLike(field, `%${term}%`);
      } else {
        query.orWhere(field, 'like', `%${term}%`);
      }
    });
    return query;
  },

  // Date range filter
  dateRange: (query: QueryBuilder, field: string, start: Date, end: Date) => {
    return query.whereBetween(field, start, end);
  },

  // Status filter
  status: (query: QueryBuilder, status: string | string[]) => {
    if (Array.isArray(status)) {
      return query.whereIn('status', status);
    }
    return query.where('status', status);
  },

  // Sorting filter
  sort: (query: QueryBuilder, field: string, direction: 'ASC' | 'DESC' = 'ASC') => {
    return query.orderBy(field, direction);
  },

  // Pagination filter
  paginate: (query: QueryBuilder, page: number, perPage: number = 15) => {
    return query.paginate(page, perPage);
  }
};

// Default scopes manager instance
export const scopesManager = new ScopesManager();

// Register common scopes and filters
Object.entries(CommonScopes).forEach(([name, scope]) => {
  scopesManager.registerGlobalScope(name, scope);
});

Object.entries(CommonFilters).forEach(([name, filter]) => {
  scopesManager.registerGlobalFilter(name, filter);
});
