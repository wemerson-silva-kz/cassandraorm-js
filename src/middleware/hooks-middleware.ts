export type HookFunction = (data: any, context?: HookContext) => Promise<any> | any;
export type MiddlewareFunction = (data: any, next: () => Promise<any>) => Promise<any>;

export interface HookContext {
  operation: 'create' | 'update' | 'delete' | 'find' | 'save';
  tableName: string;
  modelName: string;
  originalData?: any;
  conditions?: any;
  instance?: any;
  isNew?: boolean;
}

export interface ModelHooks {
  // Lifecycle hooks
  beforeSave?: HookFunction;
  afterSave?: HookFunction;
  beforeCreate?: HookFunction;
  afterCreate?: HookFunction;
  beforeUpdate?: HookFunction;
  afterUpdate?: HookFunction;
  beforeDelete?: HookFunction;
  afterDelete?: HookFunction;
  beforeFind?: HookFunction;
  afterFind?: HookFunction;
  
  // Validation hooks
  beforeValidation?: HookFunction;
  afterValidation?: HookFunction;
  
  // Custom hooks
  [key: string]: HookFunction | undefined;
}

export class HooksManager {
  private globalHooks = new Map<string, HookFunction[]>();
  private modelHooks = new Map<string, ModelHooks>();
  private middleware = new Map<string, MiddlewareFunction[]>();

  // Register global hooks
  on(event: string, hook: HookFunction): void {
    if (!this.globalHooks.has(event)) {
      this.globalHooks.set(event, []);
    }
    this.globalHooks.get(event)!.push(hook);
  }

  // Remove global hooks
  off(event: string, hook?: HookFunction): void {
    if (!hook) {
      this.globalHooks.delete(event);
      return;
    }

    const eventHooks = this.globalHooks.get(event);
    if (eventHooks) {
      const index = eventHooks.indexOf(hook);
      if (index > -1) {
        eventHooks.splice(index, 1);
      }
    }
  }

  // Register model-specific hooks
  registerModelHooks(modelName: string, hooks: ModelHooks): void {
    this.modelHooks.set(modelName, { ...this.modelHooks.get(modelName), ...hooks });
  }

  // Register middleware
  use(event: string, middleware: MiddlewareFunction): void {
    if (!this.middleware.has(event)) {
      this.middleware.set(event, []);
    }
    this.middleware.get(event)!.push(middleware);
  }

  // Execute hooks for an event
  async execute(event: string, data: any, context?: HookContext): Promise<any> {
    let result = data;

    // Execute middleware first
    result = await this.executeMiddleware(event, result);

    // Execute global hooks
    result = await this.executeGlobalHooks(event, result, context);

    // Execute model-specific hooks
    if (context?.modelName) {
      result = await this.executeModelHooks(context.modelName, event, result, context);
    }

    return result;
  }

  private async executeMiddleware(event: string, data: any): Promise<any> {
    const middlewares = this.middleware.get(event);
    if (!middlewares || middlewares.length === 0) {
      return data;
    }

    let result = data;
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= middlewares.length) {
        return result;
      }

      const middleware = middlewares[index++];
      return middleware(result, next);
    };

    return next();
  }

  private async executeGlobalHooks(event: string, data: any, context?: HookContext): Promise<any> {
    const eventHooks = this.globalHooks.get(event);
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
        console.error(`Error in global hook for event ${event}:`, error);
        throw error;
      }
    }

    return result;
  }

  private async executeModelHooks(modelName: string, event: string, data: any, context?: HookContext): Promise<any> {
    const modelHooks = this.modelHooks.get(modelName);
    if (!modelHooks) {
      return data;
    }

    const hook = modelHooks[event];
    if (!hook) {
      return data;
    }

    try {
      const hookResult = await hook(data, context);
      return hookResult !== undefined ? hookResult : data;
    } catch (error) {
      console.error(`Error in model hook ${event} for ${modelName}:`, error);
      throw error;
    }
  }

  // Lifecycle hook helpers
  async beforeSave(modelName: string, instance: any, context: HookContext): Promise<any> {
    context.operation = 'save';
    context.instance = instance;
    
    return this.execute('beforeSave', instance, context);
  }

  async afterSave(modelName: string, instance: any, context: HookContext): Promise<any> {
    context.operation = 'save';
    context.instance = instance;
    
    return this.execute('afterSave', instance, context);
  }

  async beforeCreate(modelName: string, data: any, context: HookContext): Promise<any> {
    context.operation = 'create';
    context.isNew = true;
    
    return this.execute('beforeCreate', data, context);
  }

  async afterCreate(modelName: string, instance: any, context: HookContext): Promise<any> {
    context.operation = 'create';
    context.instance = instance;
    
    return this.execute('afterCreate', instance, context);
  }

  async beforeUpdate(modelName: string, data: any, context: HookContext): Promise<any> {
    context.operation = 'update';
    context.isNew = false;
    
    return this.execute('beforeUpdate', data, context);
  }

  async afterUpdate(modelName: string, instance: any, context: HookContext): Promise<any> {
    context.operation = 'update';
    context.instance = instance;
    
    return this.execute('afterUpdate', instance, context);
  }

  async beforeDelete(modelName: string, conditions: any, context: HookContext): Promise<any> {
    context.operation = 'delete';
    context.conditions = conditions;
    
    return this.execute('beforeDelete', conditions, context);
  }

  async afterDelete(modelName: string, result: any, context: HookContext): Promise<any> {
    context.operation = 'delete';
    
    return this.execute('afterDelete', result, context);
  }

  async beforeFind(modelName: string, query: any, context: HookContext): Promise<any> {
    context.operation = 'find';
    
    return this.execute('beforeFind', query, context);
  }

  async afterFind(modelName: string, results: any, context: HookContext): Promise<any> {
    context.operation = 'find';
    
    return this.execute('afterFind', results, context);
  }

  // Validation hooks
  async beforeValidation(modelName: string, data: any, context: HookContext): Promise<any> {
    return this.execute('beforeValidation', data, context);
  }

  async afterValidation(modelName: string, data: any, context: HookContext): Promise<any> {
    return this.execute('afterValidation', data, context);
  }

  // Custom event execution
  async trigger(event: string, data: any, context?: HookContext): Promise<any> {
    return this.execute(event, data, context);
  }

  // Get registered hooks for debugging
  getGlobalHooks(): Map<string, HookFunction[]> {
    return new Map(this.globalHooks);
  }

  getModelHooks(modelName: string): ModelHooks | undefined {
    return this.modelHooks.get(modelName);
  }

  // Clear hooks
  clearGlobalHooks(): void {
    this.globalHooks.clear();
  }

  clearModelHooks(modelName?: string): void {
    if (modelName) {
      this.modelHooks.delete(modelName);
    } else {
      this.modelHooks.clear();
    }
  }

  clearMiddleware(): void {
    this.middleware.clear();
  }

  // Hook composition helpers
  compose(...hooks: HookFunction[]): HookFunction {
    return async (data: any, context?: HookContext) => {
      let result = data;
      for (const hook of hooks) {
        result = await hook(result, context);
      }
      return result;
    };
  }

  // Conditional hooks
  when(condition: (data: any, context?: HookContext) => boolean, hook: HookFunction): HookFunction {
    return async (data: any, context?: HookContext) => {
      if (condition(data, context)) {
        return hook(data, context);
      }
      return data;
    };
  }

  // Async hook helpers
  parallel(...hooks: HookFunction[]): HookFunction {
    return async (data: any, context?: HookContext) => {
      const results = await Promise.all(hooks.map(hook => hook(data, context)));
      return results[results.length - 1] || data;
    };
  }

  sequence(...hooks: HookFunction[]): HookFunction {
    return this.compose(...hooks);
  }
}

// Default hooks manager instance
export const hooksManager = new HooksManager();

// Decorator for adding hooks to models
export function Hook(event: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const context: HookContext = {
        operation: event as any,
        tableName: this.constructor.tableName || this.constructor.name.toLowerCase(),
        modelName: this.constructor.name
      };

      // Execute before hook
      await hooksManager.execute(`before${event.charAt(0).toUpperCase() + event.slice(1)}`, args[0], context);
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Execute after hook
      await hooksManager.execute(`after${event.charAt(0).toUpperCase() + event.slice(1)}`, result, context);
      
      return result;
    };
  };
}

// Common hook utilities
export const HookUtils = {
  // Timestamp hooks
  timestamps: {
    beforeSave: (data: any) => {
      const now = new Date();
      if (!data.created_at) data.created_at = now;
      data.updated_at = now;
      return data;
    }
  },

  // Soft delete hooks
  softDelete: {
    beforeDelete: (data: any) => {
      return { ...data, deleted_at: new Date() };
    },
    
    beforeFind: (query: any) => {
      if (!query.deleted_at) {
        query.deleted_at = null;
      }
      return query;
    }
  },

  // Validation hooks
  validation: {
    beforeSave: (data: any, context?: HookContext) => {
      // Add validation logic here
      return data;
    }
  },

  // Logging hooks
  logging: {
    afterSave: (instance: any, context?: HookContext) => {
      console.log(`${context?.modelName} saved:`, instance.id);
      return instance;
    },
    
    afterDelete: (result: any, context?: HookContext) => {
      console.log(`${context?.modelName} deleted`);
      return result;
    }
  }
};
