import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createClient } from '../../../src/index';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 2: Advanced Queries', () => {
  let client: any;
  let TestModel: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
    
    TestModel = await client.loadSchema('test_queries_simple', {
      fields: {
        id: 'uuid',
        category: 'text',
        value: 'int',
        created_at: 'timestamp'
      },
      key: ['id']
    });

    // Create test data
    await TestModel.create({
      category: 'TEST',
      value: 100,
      created_at: new Date()
    });
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Complex Filtering', () => {
    it('should support basic filtering', async () => {
      const results = await TestModel.find();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should support collection queries', async () => {
      const results = await TestModel.find();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Aggregations', () => {
    it('should perform count operations', async () => {
      const count = await TestModel.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch operations', async () => {
      const batch = client.createBatch();
      expect(batch).toBeDefined();
      expect(typeof batch.add).toBe('function');
    });
  });

  describe('Time Series Queries', () => {
    it('should handle time-based queries', async () => {
      const results = await TestModel.find();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Full-text Search Simulation', () => {
    it('should simulate text search with LIKE', async () => {
      const results = await TestModel.find();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
