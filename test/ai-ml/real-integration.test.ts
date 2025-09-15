import { describe, it, expect, beforeEach } from '@jest/globals';
import { RealAIMLManager, ProductionSemanticCache } from '../../src/ai-ml/real-integration.js';

describe('Real AI/ML Integration', () => {
  let aimlManager: RealAIMLManager;

  describe('RealAIMLManager', () => {
    beforeEach(() => {
      aimlManager = new RealAIMLManager({
        openai: {
          apiKey: 'test-key',
          model: 'text-embedding-3-small'
        }
      });
    });

    it('should create RealAIMLManager instance', () => {
      expect(aimlManager).toBeDefined();
      expect(typeof aimlManager.generateEmbedding).toBe('function');
      expect(typeof aimlManager.generateQueryOptimization).toBe('function');
      expect(typeof aimlManager.calculateSimilarity).toBe('function');
    });

    it('should throw error when OpenAI not configured', async () => {
      const manager = new RealAIMLManager({});
      
      await expect(manager.generateEmbedding('test')).rejects.toThrow('OpenAI not configured');
      await expect(manager.generateQueryOptimization('SELECT * FROM test')).rejects.toThrow('OpenAI not configured');
    });

    it('should calculate similarity correctly', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [0, 1, 0];
      const embedding3 = [1, 0, 0];

      const similarity1 = aimlManager.calculateSimilarity(embedding1, embedding2);
      const similarity2 = aimlManager.calculateSimilarity(embedding1, embedding3);

      expect(similarity1).toBe(0); // Orthogonal vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    it('should throw error for different embedding dimensions', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0];

      expect(() => {
        aimlManager.calculateSimilarity(embedding1, embedding2);
      }).toThrow('Embeddings must have same dimensions');
    });
  });

  describe('ProductionSemanticCache', () => {
    let cache: ProductionSemanticCache;
    let mockAIML: RealAIMLManager;

    beforeEach(() => {
      mockAIML = {
        generateEmbedding: jest.fn().mockResolvedValue([1, 0, 0]),
        calculateSimilarity: jest.fn().mockReturnValue(0.9),
        generateQueryOptimization: jest.fn()
      } as any;

      cache = new ProductionSemanticCache(mockAIML, 0.85);
    });

    it('should create ProductionSemanticCache instance', () => {
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.getStats).toBe('function');
    });

    it('should return null for cache miss', async () => {
      const result = await cache.get('SELECT * FROM users', []);
      expect(result).toBeNull();
    });

    it('should cache and retrieve results', async () => {
      const query = 'SELECT * FROM users';
      const params: any[] = [];
      const result = { rows: [{ id: 1, name: 'test' }] };

      await cache.set(query, params, result);
      
      // Mock high similarity for cache hit
      (mockAIML.calculateSimilarity as jest.Mock).mockReturnValue(0.9);
      
      const cached = await cache.get(query, params);
      expect(cached).toEqual(result);
    });

    it('should return cache stats', () => {
      const stats = cache.getStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('threshold');
      expect(stats.threshold).toBe(0.85);
    });
  });
});
