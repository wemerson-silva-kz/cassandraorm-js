import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedCassandraClient, createEnhancedClient } from '../../src/core/enhanced-client.js';

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
  });
});
