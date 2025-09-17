import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedCassandraClient, createEnhancedClient } from "../../src/core/enhanced-client";

// Mock distributed systems
jest.mock('../../src/distributed/distributed-manager.js', () => ({
  DistributedSystemsManager: (jest.fn() as any).mockImplementation(() => ({
    initialize: (jest.fn() as any).mockResolvedValue(undefined),
    shutdown: (jest.fn() as any).mockResolvedValue(undefined),
    getCachedQuery: (jest.fn() as any).mockResolvedValue(null),
    setCachedQuery: (jest.fn() as any).mockResolvedValue(undefined),
    acquireLock: (jest.fn() as any).mockResolvedValue('lock-value'),
    releaseLock: (jest.fn() as any).mockResolvedValue(true),
    withLock: (jest.fn() as any).mockImplementation(async (resource, fn) => await fn()),
    discoverServices: (jest.fn() as any).mockResolvedValue([]),
    setConfig: (jest.fn() as any).mockResolvedValue(undefined),
    getConfig: (jest.fn() as any).mockResolvedValue(null),
    getSystemHealth: (jest.fn() as any).mockResolvedValue({ status: 'healthy' })
  }))
}));

describe('Enhanced Cassandra Client', () => {
  const mockConfig = {
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test'
    },
    aiml: {
      semanticCache: {
        enabled: true,
        threshold: 0.85
      }
    },
    performance: {
      queryCache: {
        enabled: true,
        maxSize: 100,
        ttl: 60000
      },
      connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        acquireTimeout: 5000
      },
      queryOptimization: {
        enabled: true,
        analyzeSlowQueries: true,
        slowQueryThreshold: 100
      }
    },
    distributed: {
      redis: {
        host: 'localhost',
        port: 6379
      },
      consul: {
        host: 'localhost',
        port: 8500
      },
      service: {
        name: 'test-service',
        port: 3000
      }
    }
  };

  describe('EnhancedCassandraClient', () => {
    let client: EnhancedCassandraClient;

    beforeEach(() => {
      client = new EnhancedCassandraClient(mockConfig);
    });

    it('should create EnhancedCassandraClient instance', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(EnhancedCassandraClient);
    });

    it('should have AI/ML methods when configured', () => {
      const clientWithAI = new EnhancedCassandraClient({
        ...mockConfig,
        aiml: {
          openai: { apiKey: 'test-key' },
          semanticCache: { enabled: true, threshold: 0.85 }
        }
      });

      expect(typeof clientWithAI.generateEmbedding).toBe('function');
      expect(typeof clientWithAI.optimizeQueryWithAI).toBe('function');
      expect(typeof clientWithAI.vectorSimilaritySearch).toBe('function');
    });

    it('should have performance methods when configured', () => {
      expect(typeof client.getPerformanceReport).toBe('function');
      expect(typeof client.getConnectionPoolStats).toBe('function');
      expect(typeof client.getSemanticCacheStats).toBe('function');
    });

    it('should have distributed systems methods when configured', () => {
      expect(typeof client.initializeDistributedSystems).toBe('function');
      expect(typeof client.shutdownDistributedSystems).toBe('function');
      expect(typeof client.acquireDistributedLock).toBe('function');
      expect(typeof client.releaseDistributedLock).toBe('function');
      expect(typeof client.withDistributedLock).toBe('function');
      expect(typeof client.discoverServices).toBe('function');
      expect(typeof client.setDistributedConfig).toBe('function');
      expect(typeof client.getDistributedConfig).toBe('function');
      expect(typeof client.getSystemHealth).toBe('function');
    });

    it('should throw error for AI methods when not configured', async () => {
      const clientWithoutAI = new EnhancedCassandraClient({
        clientOptions: mockConfig.clientOptions
      });

      await expect(clientWithoutAI.generateEmbedding('test')).rejects.toThrow('AI/ML not configured');
      await expect(clientWithoutAI.optimizeQueryWithAI('SELECT * FROM test')).rejects.toThrow('AI/ML not configured');
    });

    it('should return error for performance methods when not configured', () => {
      const clientWithoutPerf = new EnhancedCassandraClient({
        clientOptions: mockConfig.clientOptions
      });

      const perfReport = clientWithoutPerf.getPerformanceReport();
      const poolStats = clientWithoutPerf.getConnectionPoolStats();
      const cacheStats = clientWithoutPerf.getSemanticCacheStats();

      expect(perfReport).toHaveProperty('error');
      expect(poolStats).toHaveProperty('error');
      expect(cacheStats).toHaveProperty('error');
    });

    it('should throw error for distributed methods when not configured', async () => {
      const clientWithoutDistributed = new EnhancedCassandraClient({
        clientOptions: mockConfig.clientOptions
      });

      await expect(clientWithoutDistributed.initializeDistributedSystems()).rejects.toThrow('Distributed systems not configured');
      await expect(clientWithoutDistributed.acquireDistributedLock('resource')).rejects.toThrow('Distributed systems not configured');
      await expect(clientWithoutDistributed.discoverServices('service')).rejects.toThrow('Distributed systems not configured');
      await expect(clientWithoutDistributed.setDistributedConfig('key', 'value')).rejects.toThrow('Distributed systems not configured');
    });

    it('should return error for system health when distributed not configured', async () => {
      const clientWithoutDistributed = new EnhancedCassandraClient({
        clientOptions: mockConfig.clientOptions
      });

      const health = await clientWithoutDistributed.getSystemHealth();
      expect(health).toHaveProperty('error');
    });

    it('should initialize and shutdown distributed systems', async () => {
      await client.initializeDistributedSystems();
      await client.shutdownDistributedSystems();
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle distributed locking', async () => {
      const lockValue = await client.acquireDistributedLock('test-resource', 5000);
      expect(lockValue).toBe('lock-value');

      const released = await client.releaseDistributedLock('test-resource', lockValue!);
      expect(released).toBe(true);

      const mockFn = (jest.fn() as any).mockResolvedValue('result');
      const result = await client.withDistributedLock('test-resource', mockFn);
      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle service discovery', async () => {
      const services = await client.discoverServices('test-service');
      expect(Array.isArray(services)).toBe(true);
    });

    it('should handle distributed configuration', async () => {
      await client.setDistributedConfig('test-key', 'test-value');
      const value = await client.getDistributedConfig('test-key');
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should get system health', async () => {
      const health = await client.getSystemHealth();
      expect(health).toHaveProperty('status');
    });

    it('should return vector similarity search results', async () => {
      const embedding = [1, 0, 0];
      const results = await client.vectorSimilaritySearch(embedding, 0.8);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0]).toHaveProperty('data');
    });
  });

  describe('createEnhancedClient factory', () => {
    it('should create EnhancedCassandraClient instance', () => {
      const client = createEnhancedClient(mockConfig);

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(EnhancedCassandraClient);
    });

    it('should create client with minimal config', () => {
      const minimalConfig = {
        clientOptions: {
          contactPoints: ['127.0.0.1'],
          localDataCenter: 'datacenter1',
          keyspace: 'test'
        }
      };

      const client = createEnhancedClient(minimalConfig);
      expect(client).toBeDefined();
    });

    it('should create client with distributed systems', () => {
      const client = createEnhancedClient(mockConfig);
      expect(typeof client.initializeDistributedSystems).toBe('function');
    });
  });
});
