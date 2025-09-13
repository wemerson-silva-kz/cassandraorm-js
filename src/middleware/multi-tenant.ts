import type { Client } from "cassandra-driver";

export interface MultiTenantConfig {
  enabled?: boolean;
  strategy: 'keyspace' | 'table_prefix' | 'column';
  tenantResolver: (context: any) => string | Promise<string>;
  isolation?: 'strict' | 'shared';
  defaultTenant?: string;
  tenantValidation?: (tenant: string) => boolean | Promise<boolean>;
}

export interface TenantContext {
  tenantId: string;
  keyspace?: string;
  tablePrefix?: string;
  metadata?: Record<string, any>;
}

export class MultiTenantManager {
  private client: Client;
  private config: Required<MultiTenantConfig>;
  private tenantCache = new Map<string, TenantContext>();
  private currentContext?: TenantContext;

  constructor(client: Client, config: MultiTenantConfig) {
    this.client = client;
    this.config = {
      enabled: true,
      isolation: 'strict',
      defaultTenant: 'default',
      tenantValidation: () => true,
      ...config
    };
  }

  async setTenantContext(context: any): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const tenantId = await this.config.tenantResolver(context);
    
    if (!tenantId) {
      if (this.config.defaultTenant) {
        this.currentContext = await this.getTenantContext(this.config.defaultTenant);
        return;
      }
      throw new Error('No tenant ID found and no default tenant configured');
    }

    // Validate tenant
    const isValid = await this.config.tenantValidation(tenantId);
    if (!isValid) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    this.currentContext = await this.getTenantContext(tenantId);
  }

  getCurrentTenant(): TenantContext | undefined {
    return this.currentContext;
  }

  async getTenantContext(tenantId: string): Promise<TenantContext> {
    // Check cache first
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId)!;
    }

    const context = await this.createTenantContext(tenantId);
    this.tenantCache.set(tenantId, context);
    return context;
  }

  private async createTenantContext(tenantId: string): Promise<TenantContext> {
    const context: TenantContext = { tenantId };

    switch (this.config.strategy) {
      case 'keyspace':
        context.keyspace = this.sanitizeTenantId(tenantId);
        await this.ensureKeyspaceExists(context.keyspace);
        break;
      
      case 'table_prefix':
        context.tablePrefix = this.sanitizeTenantId(tenantId);
        break;
      
      case 'column':
        // Column-based isolation doesn't need special setup
        break;
    }

    return context;
  }

  // Transform table name based on tenant strategy
  transformTableName(tableName: string, tenantContext?: TenantContext): string {
    const context = tenantContext || this.currentContext;
    
    if (!context || !this.config.enabled) {
      return tableName;
    }

    switch (this.config.strategy) {
      case 'keyspace':
        return tableName; // Keyspace isolation, table name unchanged
      
      case 'table_prefix':
        return `${context.tablePrefix}_${tableName}`;
      
      case 'column':
        return tableName; // Column isolation, table name unchanged
      
      default:
        return tableName;
    }
  }

  // Transform query based on tenant strategy
  transformQuery(query: string, params: any[], tenantContext?: TenantContext): {
    query: string;
    params: any[];
  } {
    const context = tenantContext || this.currentContext;
    
    if (!context || !this.config.enabled) {
      return { query, params };
    }

    switch (this.config.strategy) {
      case 'keyspace':
        return this.transformQueryForKeyspace(query, params, context);
      
      case 'table_prefix':
        return this.transformQueryForTablePrefix(query, params, context);
      
      case 'column':
        return this.transformQueryForColumn(query, params, context);
      
      default:
        return { query, params };
    }
  }

  private transformQueryForKeyspace(
    query: string, 
    params: any[], 
    context: TenantContext
  ): { query: string; params: any[] } {
    // Replace keyspace references
    const transformedQuery = query.replace(
      /(\bFROM\s+)(\w+)\.(\w+)/gi,
      `$1${context.keyspace}.$3`
    ).replace(
      /(\bINTO\s+)(\w+)\.(\w+)/gi,
      `$1${context.keyspace}.$3`
    ).replace(
      /(\bUPDATE\s+)(\w+)\.(\w+)/gi,
      `$1${context.keyspace}.$3`
    );

    return { query: transformedQuery, params };
  }

  private transformQueryForTablePrefix(
    query: string, 
    params: any[], 
    context: TenantContext
  ): { query: string; params: any[] } {
    // Replace table names with prefixed versions
    const transformedQuery = query.replace(
      /(\b(?:FROM|INTO|UPDATE|JOIN)\s+)(?:\w+\.)?(\w+)/gi,
      (match, prefix, tableName) => {
        return `${prefix}${context.tablePrefix}_${tableName}`;
      }
    );

    return { query: transformedQuery, params };
  }

  private transformQueryForColumn(
    query: string, 
    params: any[], 
    context: TenantContext
  ): { query: string; params: any[] } {
    // Add tenant_id to WHERE clauses
    const tenantCondition = 'tenant_id = ?';
    const newParams = [context.tenantId, ...params];

    let transformedQuery = query;

    // Add tenant condition to SELECT queries
    if (/\bSELECT\b/i.test(query)) {
      if (/\bWHERE\b/i.test(query)) {
        transformedQuery = query.replace(/\bWHERE\b/i, `WHERE ${tenantCondition} AND`);
      } else {
        transformedQuery = query.replace(/(\bFROM\s+\w+)/i, `$1 WHERE ${tenantCondition}`);
      }
    }

    // Add tenant_id to INSERT queries
    if (/\bINSERT\s+INTO\b/i.test(query)) {
      transformedQuery = this.addTenantToInsert(query, context.tenantId);
      // Don't modify params for INSERT as tenant_id is added directly
      return { query: transformedQuery, params };
    }

    // Add tenant condition to UPDATE queries
    if (/\bUPDATE\b/i.test(query)) {
      if (/\bWHERE\b/i.test(query)) {
        transformedQuery = query.replace(/\bWHERE\b/i, `WHERE ${tenantCondition} AND`);
      } else {
        transformedQuery = query + ` WHERE ${tenantCondition}`;
      }
    }

    // Add tenant condition to DELETE queries
    if (/\bDELETE\b/i.test(query)) {
      if (/\bWHERE\b/i.test(query)) {
        transformedQuery = query.replace(/\bWHERE\b/i, `WHERE ${tenantCondition} AND`);
      } else {
        transformedQuery = query + ` WHERE ${tenantCondition}`;
      }
    }

    return { query: transformedQuery, params: newParams };
  }

  private addTenantToInsert(query: string, tenantId: string): string {
    // Parse INSERT statement to add tenant_id
    const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    
    if (insertMatch) {
      const [, table, columns, values] = insertMatch;
      const newColumns = `tenant_id, ${columns}`;
      const newValues = `'${tenantId}', ${values}`;
      
      return query.replace(
        /INSERT\s+INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*\([^)]+\)/i,
        `INSERT INTO ${table} (${newColumns}) VALUES (${newValues})`
      );
    }

    return query;
  }

  private async ensureKeyspaceExists(keyspace: string): Promise<void> {
    try {
      await this.client.execute(`
        CREATE KEYSPACE IF NOT EXISTS ${keyspace}
        WITH REPLICATION = {
          'class': 'SimpleStrategy',
          'replication_factor': 1
        }
      `);
    } catch (error) {
      console.warn(`Failed to create keyspace ${keyspace}:`, error);
    }
  }

  private sanitizeTenantId(tenantId: string): string {
    // Remove special characters and ensure valid identifier
    return tenantId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  // Tenant management methods
  async createTenant(tenantId: string, metadata?: Record<string, any>): Promise<void> {
    const context = await this.createTenantContext(tenantId);
    context.metadata = metadata;
    
    this.tenantCache.set(tenantId, context);

    // Create tenant-specific resources
    if (this.config.strategy === 'keyspace' && context.keyspace) {
      await this.ensureKeyspaceExists(context.keyspace);
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const context = this.tenantCache.get(tenantId);
    
    if (context && this.config.strategy === 'keyspace' && context.keyspace) {
      // WARNING: This will delete all data for the tenant
      await this.client.execute(`DROP KEYSPACE IF EXISTS ${context.keyspace}`);
    }

    this.tenantCache.delete(tenantId);
  }

  async listTenants(): Promise<string[]> {
    return Array.from(this.tenantCache.keys());
  }

  // Middleware for automatic tenant context setting
  middleware() {
    return async (context: any, next: () => Promise<any>) => {
      await this.setTenantContext(context);
      try {
        return await next();
      } finally {
        this.currentContext = undefined;
      }
    };
  }

  // Execute query with specific tenant context
  async executeWithTenant<T>(
    tenantId: string,
    operation: (context: TenantContext) => Promise<T>
  ): Promise<T> {
    const context = await this.getTenantContext(tenantId);
    const previousContext = this.currentContext;
    
    try {
      this.currentContext = context;
      return await operation(context);
    } finally {
      this.currentContext = previousContext;
    }
  }
}
