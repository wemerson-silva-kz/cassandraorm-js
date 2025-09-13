class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.middleware = [];
  }

  register(name, plugin) {
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is already registered`);
    }

    // Validate plugin structure
    if (typeof plugin.install !== 'function') {
      throw new Error(`Plugin ${name} must have an install method`);
    }

    this.plugins.set(name, plugin);
    
    // Install the plugin
    plugin.install(this);
    
    console.log(`✅ Plugin registered: ${name}`);
  }

  unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    // Call uninstall if available
    if (typeof plugin.uninstall === 'function') {
      plugin.uninstall(this);
    }

    this.plugins.delete(name);
    console.log(`✅ Plugin unregistered: ${name}`);
    return true;
  }

  addHook(event, callback) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push(callback);
  }

  async executeHook(event, data = {}) {
    const callbacks = this.hooks.get(event) || [];
    let result = data;

    for (const callback of callbacks) {
      try {
        const hookResult = await callback(result);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (error) {
        console.error(`Hook error in ${event}:`, error);
      }
    }

    return result;
  }

  addMiddleware(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.middleware.push(middleware);
  }

  async executeMiddleware(context) {
    let result = context;

    for (const middleware of this.middleware) {
      try {
        const middlewareResult = await middleware(result);
        if (middlewareResult !== undefined) {
          result = middlewareResult;
        }
      } catch (error) {
        console.error('Middleware error:', error);
        throw error;
      }
    }

    return result;
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  listPlugins() {
    return Array.from(this.plugins.keys());
  }
}

// Built-in plugins
class CachePlugin {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
  }

  install(pluginManager) {
    pluginManager.addHook('beforeQuery', this.beforeQuery.bind(this));
    pluginManager.addHook('afterQuery', this.afterQuery.bind(this));
  }

  async beforeQuery(context) {
    const cacheKey = this.getCacheKey(context.query, context.params);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      context.cached = true;
      context.result = cached.data;
      return context;
    }

    context.cacheKey = cacheKey;
    return context;
  }

  async afterQuery(context) {
    if (!context.cached && context.cacheKey && context.result) {
      // Clean cache if too large
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(context.cacheKey, {
        data: context.result,
        timestamp: Date.now()
      });
    }

    return context;
  }

  getCacheKey(query, params) {
    return `${query}:${JSON.stringify(params)}`;
  }

  clear() {
    this.cache.clear();
  }
}

class ValidationPlugin {
  install(pluginManager) {
    pluginManager.addHook('beforeInsert', this.validateData.bind(this));
    pluginManager.addHook('beforeUpdate', this.validateData.bind(this));
  }

  async validateData(context) {
    if (context.schema && context.data) {
      for (const [field, type] of Object.entries(context.schema)) {
        if (context.data[field] !== undefined) {
          if (!this.validateType(context.data[field], type)) {
            throw new Error(`Invalid type for field ${field}: expected ${type}`);
          }
        }
      }
    }
    return context;
  }

  validateType(value, type) {
    switch (type) {
      case 'text':
        return typeof value === 'string';
      case 'int':
        return Number.isInteger(value);
      case 'uuid':
        return typeof value === 'string' || typeof value === 'object';
      case 'timestamp':
        return value instanceof Date || typeof value === 'string';
      default:
        return true;
    }
  }
}

module.exports = { PluginManager, CachePlugin, ValidationPlugin };
