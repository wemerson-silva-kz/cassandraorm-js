import { RedisDistributedCache, DistributedLockManager } from './redis-integration.js';
import { ConsulServiceDiscovery, DistributedConfigManager } from './consul-integration.js';

export export interface DistributedConfig {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    ttl?: number;
  };
  consul?: {
    host?: string;
    port?: number;
    secure?: boolean;
    token?: string;
    datacenter?: string;
  };
  service?: {
    name: string;
    id?: string;
    address?: string;
    port?: number;
    tags?: string[];
  };
}

export class DistributedSystemsManager {
  private redis?: RedisDistributedCache;
  private consul?: ConsulServiceDiscovery;
  private lockManager?: DistributedLockManager;
  private configManager?: DistributedConfigManager;
  private config: DistributedConfig;

  constructor(config: DistributedConfig) {
    this.config = config;

    // Initialize Redis if configured
    if (config.redis) {
      this.redis = new RedisDistributedCache(config.redis);
      this.lockManager = new DistributedLockManager(this.redis);
    }

    // Initialize Consul if configured
    if (config.consul) {
      this.consul = new ConsulServiceDiscovery(config.consul);
      this.configManager = new DistributedConfigManager(this.consul);
    }
  }

  async initialize(): Promise<void> {
    // Connect to Redis
    if (this.redis) {
      await this.redis.connect();
      console.log('✅ Redis connected');
    }

    // Register service with Consul
    if (this.consul && this.config.service) {
      await this.consul.registerService({
        ...this.config.service,
        check: {
          http: `http://${this.config.service.address || 'localhost'}:${this.config.service.port || 3000}/health`,
          interval: '10s',
          timeout: '3s'
        }
      });
      console.log('✅ Service registered with Consul');
    }
  }

  async shutdown(): Promise<void> {
    // Disconnect from Redis
    if (this.redis) {
      await this.redis.disconnect();
      console.log('✅ Redis disconnected');
    }

    // Deregister service from Consul
    if (this.consul && this.config.service) {
      const serviceId = this.config.service.id || this.config.service.name;
      await this.consul.deregisterService(serviceId);
      console.log('✅ Service deregistered from Consul');
    }
  }

  // Cache operations
  async cacheGet(key: string): Promise<any | null> {
    if (!this.redis) throw new Error('Redis not configured');
    return await this.redis.get(key);
  }

  async cacheSet(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.redis) throw new Error('Redis not configured');
    await this.redis.set(key, value, ttl);
  }

  async cacheDel(key: string): Promise<void> {
    if (!this.redis) throw new Error('Redis not configured');
    await this.redis.del(key);
  }

  // Distributed locking
  async acquireLock(resource: string, ttl?: number): Promise<string | null> {
    if (!this.lockManager) throw new Error('Lock manager not configured');
    return await this.lockManager.acquireLock(resource, ttl);
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    if (!this.lockManager) throw new Error('Lock manager not configured');
    return await this.lockManager.releaseLock(resource, lockValue);
  }

  async withLock<T>(resource: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    if (!this.lockManager) throw new Error('Lock manager not configured');
    return await this.lockManager.withLock(resource, fn, ttl);
  }

  // Service discovery
  async discoverServices(serviceName: string): Promise<Array<{ address: string, port: number }>> {
    if (!this.consul) throw new Error('Consul not configured');
    return await this.consul.getHealthyServices(serviceName);
  }

  // Configuration management
  async setConfig(key: string, value: any): Promise<void> {
    if (!this.configManager) throw new Error('Config manager not configured');
    await this.configManager.setConfig(key, value);
  }

  async getConfig(key: string): Promise<any | null> {
    if (!this.configManager) throw new Error('Config manager not configured');
    return await this.configManager.getConfig(key);
  }

  async getAllConfigs(): Promise<Record<string, any>> {
    if (!this.configManager) throw new Error('Config manager not configured');
    return await this.configManager.getAllConfigs();
  }

  // Health and monitoring
  async getSystemHealth(): Promise<any> {
    const health: any = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    if (this.redis) {
      try {
        health.services.redis = await this.redis.getStats();
      } catch (error) {
        health.services.redis = { error: (error as Error).message };
      }
    }

    if (this.consul) {
      try {
        health.services.consul = {
          leader: await this.consul.getClusterStatus(),
          connected: true
        };
      } catch (error) {
        health.services.consul = { error: (error as Error).message };
      }
    }

    return health;
  }

  // Distributed query caching
  async getCachedQuery(query: string, params: any[]): Promise<any | null> {
    if (!this.redis) return null;
    
    const cacheKey = `query:${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
    return await this.cacheGet(cacheKey);
  }

  async setCachedQuery(query: string, params: any[], result: any, ttl = 300): Promise<void> {
    if (!this.redis) return;
    
    const cacheKey = `query:${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
    await this.cacheSet(cacheKey, result, ttl);
  }

  // Distributed session management
  async getSession(sessionId: string): Promise<any | null> {
    if (!this.redis) return null;
    return await this.cacheGet(`session:${sessionId}`);
  }

  async setSession(sessionId: string, sessionData: any, ttl = 3600): Promise<void> {
    if (!this.redis) return;
    await this.cacheSet(`session:${sessionId}`, sessionData, ttl);
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.redis) return;
    await this.cacheDel(`session:${sessionId}`);
  }
}
