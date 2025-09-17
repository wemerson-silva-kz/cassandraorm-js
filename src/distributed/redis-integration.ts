import { createClient, RedisClientType } from 'redis';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number;
}

export class RedisDistributedCache {
  private client: RedisClientType;
  private config: Required<RedisConfig>;
  private connected = false;

  constructor(config: RedisConfig = {}) {
    this.config = {
      url: config.url || `redis://${config.host || 'localhost'}:${config.port || 6379}`,
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || '',
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'cassandraorm:',
      ttl: config.ttl || 3600
    };

    this.client = createClient({
      url: this.config.url,
      password: this.config.password || undefined,
      database: this.config.db
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected) await this.connect();
    
    const value = await this.client.get(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.connected) await this.connect();
    
    const serialized = JSON.stringify(value);
    const expiry = ttl || this.config.ttl;
    
    await this.client.setEx(this.getKey(key), expiry, serialized);
  }

  async del(key: string): Promise<void> {
    if (!this.connected) await this.connect();
    await this.client.del(this.getKey(key));
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) await this.connect();
    const result = await this.client.exists(this.getKey(key));
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.connected) await this.connect();
    const keys = await this.client.keys(this.getKey(pattern));
    return keys.map(key => key.replace(this.config.keyPrefix, ''));
  }

  async flushAll(): Promise<void> {
    if (!this.connected) await this.connect();
    await this.client.flushAll();
  }

  async getStats(): Promise<any> {
    if (!this.connected) await this.connect();
    const info = await this.client.info('memory');
    return {
      connected: this.connected,
      memory: info,
      keyspace: await this.client.info('keyspace')
    };
  }
}

export class DistributedLockManager {
  private redis: RedisDistributedCache;
  private lockTimeout: number;

  constructor(redis: RedisDistributedCache, lockTimeout = 30000) {
    this.redis = redis;
    this.lockTimeout = lockTimeout;
  }

  async acquireLock(resource: string, ttl?: number): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const expiry = ttl || this.lockTimeout;

    try {
      await this.redis.connect();
      const result = await (this.redis as any).client.set(
        this.redis['getKey'](lockKey),
        lockValue,
        'PX',
        expiry,
        'NX'
      );
      
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      console.error('Lock acquisition failed:', error);
      return null;
    }
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await (this.redis as any).client.eval(
        script,
        1,
        this.redis['getKey'](lockKey),
        lockValue
      );
      
      return result === 1;
    } catch (error) {
      console.error('Lock release failed:', error);
      return false;
    }
  }

  async isLocked(resource: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    
    try {
      await this.redis.connect();
      return await this.redis.exists(lockKey);
    } catch (error) {
      console.error('Lock check failed:', error);
      return false;
    }
  }

  async withLock<T>(resource: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const lockValue = await this.acquireLock(resource, ttl);
    if (!lockValue) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resource, lockValue);
    }
  }
}
