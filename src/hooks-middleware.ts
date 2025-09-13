export type HookFunction = (data: any, context?: any) => Promise<any> | any;
export type MiddlewareFunction = (data: any, next: () => Promise<any>) => Promise<any>;

export interface HookContext {
  operation: 'create' | 'update' | 'delete' | 'find';
  tableName: string;
  originalData?: any;
  conditions?: any;
}

export class HooksManager {
  private hooks = new Map<string, HookFunction[]>();

  // Register a hook
  on(event: string, hook: HookFunction): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(hook);
  }

  // Remove a hook
  off(event: string, hook?: HookFunction): void {
    if (!hook) {
      this.hooks.delete(event);
      return;
    }

    const eventHooks = this.hooks.get(event);
    if (eventHooks) {
      const index = eventHooks.indexOf(hook);
      if (index > -1) {
        eventHooks.splice(index, 1);
      }
    }
  }

  // Execute hooks for an event
  async execute(event: string, data: any, context?: HookContext): Promise<any> {
    const eventHooks = this.hooks.get(event);
    if (!eventHooks || eventHooks.length === 0) {
      return data;
    }

    let result = data;
    for (const hook of eventHooks) {
      try {
        const hookResult = await hook(result, context);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (error) {
        console.error(`Hook error for event ${event}:`, error);
        throw error;
      }
    }

    return result;
  }

  // Check if event has hooks
  hasHooks(event: string): boolean {
    const eventHooks = this.hooks.get(event);
    return !!(eventHooks && eventHooks.length > 0);
  }

  // Get all registered events
  getEvents(): string[] {
    return Array.from(this.hooks.keys());
  }
}

export class MiddlewareManager {
  private middlewares: MiddlewareFunction[] = [];

  // Add middleware
  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  // Execute all middlewares
  async execute(data: any): Promise<any> {
    let index = 0;
    let result = data;

    const next = async (): Promise<any> => {
      if (index >= this.middlewares.length) {
        return result;
      }

      const middleware = this.middlewares[index++];
      return middleware(result, next);
    };

    return next();
  }
}

// Combined hooks and middleware system
export class HooksMiddlewareSystem {
  private hooksManager = new HooksManager();
  private middlewareManager = new MiddlewareManager();

  // Hook registration methods
  beforeCreate(hook: HookFunction): void {
    this.hooksManager.on('beforeCreate', hook);
  }

  afterCreate(hook: HookFunction): void {
    this.hooksManager.on('afterCreate', hook);
  }

  beforeUpdate(hook: HookFunction): void {
    this.hooksManager.on('beforeUpdate', hook);
  }

  afterUpdate(hook: HookFunction): void {
    this.hooksManager.on('afterUpdate', hook);
  }

  beforeDelete(hook: HookFunction): void {
    this.hooksManager.on('beforeDelete', hook);
  }

  afterDelete(hook: HookFunction): void {
    this.hooksManager.on('afterDelete', hook);
  }

  beforeFind(hook: HookFunction): void {
    this.hooksManager.on('beforeFind', hook);
  }

  afterFind(hook: HookFunction): void {
    this.hooksManager.on('afterFind', hook);
  }

  // Middleware registration
  use(middleware: MiddlewareFunction): void {
    this.middlewareManager.use(middleware);
  }

  // Execute hooks
  async executeHook(event: string, data: any, context?: HookContext): Promise<any> {
    return this.hooksManager.execute(event, data, context);
  }

  // Execute middlewares
  async executeMiddleware(data: any): Promise<any> {
    return this.middlewareManager.execute(data);
  }

  // Combined execution for operations
  async executeOperation(
    operation: 'create' | 'update' | 'delete' | 'find',
    data: any,
    context: HookContext,
    operationFn: () => Promise<any>
  ): Promise<any> {
    // Execute before hooks
    const beforeEvent = `before${operation.charAt(0).toUpperCase() + operation.slice(1)}`;
    let processedData = await this.executeHook(beforeEvent, data, context);

    // Execute middlewares
    processedData = await this.executeMiddleware(processedData);

    // Execute the actual operation
    const result = await operationFn();

    // Execute after hooks
    const afterEvent = `after${operation.charAt(0).toUpperCase() + operation.slice(1)}`;
    const finalResult = await this.executeHook(afterEvent, result, {
      ...context,
      originalData: data
    });

    return finalResult;
  }
}

// Built-in common hooks
export class CommonHooks {
  // Timestamp hooks
  static addTimestamps(data: any): any {
    const now = new Date();
    return {
      ...data,
      created_at: data.created_at || now,
      updated_at: now
    };
  }

  static updateTimestamp(data: any): any {
    return {
      ...data,
      updated_at: new Date()
    };
  }

  // Validation hook
  static validate(schema: any) {
    return async (data: any): Promise<any> => {
      // Import validation logic here
      const { SchemaValidator } = await import('./schema-validator.js');
      const errors = SchemaValidator.validate(data, schema);
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
      
      return data;
    };
  }

  // Soft delete hook
  static softDelete(data: any): any {
    return {
      ...data,
      deleted_at: new Date(),
      is_deleted: true
    };
  }

  // Audit log hook
  static auditLog(tableName: string) {
    return async (data: any, context?: HookContext): Promise<any> => {
      // Log the operation
      console.log(`[AUDIT] ${context?.operation} on ${tableName}:`, {
        data,
        timestamp: new Date(),
        operation: context?.operation
      });
      
      return data;
    };
  }

  // Data sanitization hook
  static sanitize(data: any): any {
    const sanitized = { ...data };
    
    // Remove sensitive fields from logs/responses
    delete sanitized.password;
    delete sanitized.secret;
    delete sanitized.token;
    
    return sanitized;
  }

  // Cache invalidation hook
  static invalidateCache(cacheKey: string) {
    return async (data: any): Promise<any> => {
      // Invalidate cache after data changes
      // Implementation would depend on cache system
      console.log(`[CACHE] Invalidating cache for key: ${cacheKey}`);
      return data;
    };
  }
}

// Middleware examples
export class CommonMiddleware {
  // Logging middleware
  static logging(): MiddlewareFunction {
    return async (data: any, next: () => Promise<any>): Promise<any> => {
      console.log('[MIDDLEWARE] Processing data:', data);
      const result = await next();
      console.log('[MIDDLEWARE] Operation completed');
      return result;
    };
  }

  // Rate limiting middleware
  static rateLimit(maxRequests: number, windowMs: number): MiddlewareFunction {
    const requests = new Map<string, { count: number; resetTime: number }>();
    
    return async (data: any, next: () => Promise<any>): Promise<any> => {
      const key = 'global'; // Could be based on user ID, IP, etc.
      const now = Date.now();
      const window = requests.get(key);
      
      if (!window || now > window.resetTime) {
        requests.set(key, { count: 1, resetTime: now + windowMs });
      } else {
        window.count++;
        if (window.count > maxRequests) {
          throw new Error('Rate limit exceeded');
        }
      }
      
      return next();
    };
  }

  // Performance monitoring middleware
  static performanceMonitor(): MiddlewareFunction {
    return async (data: any, next: () => Promise<any>): Promise<any> => {
      const startTime = Date.now();
      const result = await next();
      const duration = Date.now() - startTime;
      
      console.log(`[PERFORMANCE] Operation took ${duration}ms`);
      
      if (duration > 1000) {
        console.warn(`[PERFORMANCE] Slow operation detected: ${duration}ms`);
      }
      
      return result;
    };
  }
}
