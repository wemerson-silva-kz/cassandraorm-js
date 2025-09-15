import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RedisDistributedCache, DistributedLockManager } from '../../src/distributed/redis-integration.js';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn(),
  keys: jest.fn(),
  flushAll: jest.fn().mockResolvedValue('OK'),
  info: jest.fn(),
  set: jest.fn(),
  eval: jest.fn(),
  on: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

describe('Redis Integration', () => {
  describe('RedisDistributedCache', () => {
    let cache: RedisDistributedCache;

    beforeEach(() => {
      jest.clearAllMocks();
      cache = new RedisDistributedCache({
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test:'
      });
    });

    afterEach(async () => {
      if (cache) {
        await cache.disconnect();
      }
    });

    it('should create RedisDistributedCache instance', () => {
      expect(cache).toBeDefined();
      expect(typeof cache.connect).toBe('function');
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    it('should connect to Redis', async () => {
      await cache.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should get value from Redis', async () => {
      const testValue = { data: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await cache.get('test-key');
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:test-key');
      expect(result).toEqual(testValue);
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cache.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should set value in Redis', async () => {
      const testValue = { data: 'test' };

      await cache.set('test-key', testValue, 300);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(testValue)
      );
    });

    it('should delete key from Redis', async () => {
      await cache.del('test-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:test-key');
    });

    it('should check if key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const exists = await cache.exists('test-key');
      
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test:test-key');
      expect(exists).toBe(true);
    });

    it('should get keys by pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['test:key1', 'test:key2']);

      const keys = await cache.keys('key*');
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:key*');
      expect(keys).toEqual(['key1', 'key2']);
    });

    it('should get stats', async () => {
      mockRedisClient.info.mockResolvedValue('used_memory:1024');

      const stats = await cache.getStats();
      
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('keyspace');
    });
  });

  describe('DistributedLockManager', () => {
    let cache: RedisDistributedCache;
    let lockManager: DistributedLockManager;

    beforeEach(() => {
      jest.clearAllMocks();
      cache = new RedisDistributedCache();
      lockManager = new DistributedLockManager(cache, 5000);
    });

    afterEach(async () => {
      if (cache) {
        await cache.disconnect();
      }
    });

    it('should create DistributedLockManager instance', () => {
      expect(lockManager).toBeDefined();
      expect(typeof lockManager.acquireLock).toBe('function');
      expect(typeof lockManager.releaseLock).toBe('function');
      expect(typeof lockManager.withLock).toBe('function');
    });

    it('should acquire lock successfully', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const lockValue = await lockManager.acquireLock('test-resource', 10000);
      
      expect(lockValue).toBeTruthy();
      expect(typeof lockValue).toBe('string');
    });

    it('should fail to acquire lock when already locked', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const lockValue = await lockManager.acquireLock('test-resource', 10000);
      
      expect(lockValue).toBeNull();
    });

    it('should release lock successfully', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      const released = await lockManager.releaseLock('test-resource', 'lock-value');
      
      expect(released).toBe(true);
    });

    it('should fail to release lock with wrong value', async () => {
      mockRedisClient.eval.mockResolvedValue(0);

      const released = await lockManager.releaseLock('test-resource', 'wrong-value');
      
      expect(released).toBe(false);
    });

    it('should execute function with lock', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await lockManager.withLock('test-resource', mockFn);
      
      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should throw error when lock acquisition fails', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const mockFn = jest.fn();

      await expect(
        lockManager.withLock('test-resource', mockFn)
      ).rejects.toThrow('Failed to acquire lock');
      
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});
