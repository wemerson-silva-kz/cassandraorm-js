interface Plugin {
  name: string;
  hooks?: Record<string, Function>;
  [key: string]: any;
}

export class PluginManager {
  private plugins = new Map<string, Plugin>();

  register(name: string, plugin: Plugin): void {
    this.plugins.set(name, { ...plugin, name });
  }

  async executeHook(hookName: string, context: any): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.[hookName]) {
        await plugin.hooks[hookName](context);
      }
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }
}

export class CachePlugin implements Plugin {
  name = 'cache';
  private cache = new Map<string, any>();
  private ttl: number;

  constructor(options: { ttl?: number } = {}) {
    this.ttl = options.ttl || 300000; // 5 minutes
  }

  hooks = {
    beforeQuery: async (context: any) => {
      const key = this.getCacheKey(context.query, context.params);
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.ttl) {
        context.result = cached.data;
        context.fromCache = true;
      }
    },
    
    afterQuery: async (context: any) => {
      if (!context.fromCache && context.result) {
        const key = this.getCacheKey(context.query, context.params);
        this.cache.set(key, {
          data: context.result,
          timestamp: Date.now()
        });
      }
    }
  };

  private getCacheKey(query: string, params?: any[]): string {
    return `${query}:${JSON.stringify(params || [])}`;
  }
}

export class ValidationPlugin implements Plugin {
  name = 'validation';
  private validators = new Map<string, Function[]>();

  constructor(options: any = {}) {}

  addValidator(field: string, validator: Function): void {
    if (!this.validators.has(field)) {
      this.validators.set(field, []);
    }
    this.validators.get(field)!.push(validator);
  }

  hooks = {
    beforeInsert: async (context: any) => {
      await this.validateData(context.data);
    },
    
    beforeUpdate: async (context: any) => {
      await this.validateData(context.data);
    }
  };

  private async validateData(data: any): Promise<void> {
    for (const [field, value] of Object.entries(data)) {
      const fieldValidators = this.validators.get(field);
      if (fieldValidators) {
        for (const validator of fieldValidators) {
          const isValid = await validator(value);
          if (!isValid) {
            throw new Error(`Validation failed for field: ${field}`);
          }
        }
      }
    }
  }
}
