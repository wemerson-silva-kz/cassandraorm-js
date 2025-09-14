import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 2: Advanced Queries', () => {
  let client: any;
  let TestModel: any;

  beforeEach(async () => {
    // Clean up data before each test
    try {
      await client.execute('TRUNCATE test_queries');
    } catch (error) {
      // Ignore if table doesn't exist
    }
  });

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
    
    TestModel = await client.loadSchema('test_queries', {
      fields: {
        id: 'uuid',
        category: 'text',
        value: 'int',
        tags: 'set<text>',
        metadata: 'map<text, text>',
        created_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['category']
    });

    // Insert test data
    const testData = [
      {
        id: client.constructor.uuid(),
        category: 'A',
        value: 10,
        tags: new Set(['tag1', 'tag2']),
        metadata: new Map([['key1', 'value1']]),
        created_at: new Date('2024-01-01')
      },
      {
        id: client.constructor.uuid(),
        category: 'B',
        value: 20,
        tags: new Set(['tag2', 'tag3']),
        metadata: new Map([['key2', 'value2']]),
        created_at: new Date('2024-01-02')
      }
    ];

    for (const data of testData) {
      await TestModel.create(data);
    }
    
    // Wait for consistency
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Complex Filtering', () => {
    it('should support basic filtering', async () => {
      const results = await TestModel.find({ category: 'A' });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('A');
    });

    it('should support collection queries', async () => {
      // Note: Cassandra returns arrays for sets
      const results = await TestModel.find({});
      const filtered = results.filter(r => Array.isArray(r.tags) && r.tags.includes('tag2'));
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Aggregations', () => {
    it('should perform count operations', async () => {
      const count = await TestModel.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should handle batch operations', async () => {
      const batch = client.createBatch();
      
      batch.add('INSERT INTO test_queries (id, category, value, created_at) VALUES (?, ?, ?, ?)', 
        [client.constructor.uuid().toString(), 'C', 30, new Date()]);
      batch.add('INSERT INTO test_queries (id, category, value, created_at) VALUES (?, ?, ?, ?)', 
        [client.constructor.uuid().toString(), 'D', 40, new Date()]);
      
      await batch.execute();
      
      const newRecords = await TestModel.find({ category: 'C' });
      expect(newRecords).toHaveLength(1);
    });
  });

  describe('Time Series Queries', () => {
    it('should handle time-based queries', async () => {
      const TimeSeriesModel = await client.loadSchema('time_series_test', {
        fields: {
          metric_name: 'text',
          timestamp: 'timestamp',
          value: 'double'
        },
        key: [['metric_name'], 'timestamp'],
        clustering_order: { timestamp: 'desc' }
      });

      // Insert time series data
      const now = new Date();
      await TimeSeriesModel.create({
        metric_name: 'cpu',
        timestamp: now,
        value: 75.5
      });

      const results = await TimeSeriesModel.find({ metric_name: 'cpu' });
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe(75.5);
    });
  });

  describe('Full-text Search Simulation', () => {
    it('should simulate text search with LIKE', async () => {
      const SearchModel = await client.loadSchema('search_test', {
        fields: {
          id: 'uuid',
          title: 'text',
          content: 'text'
        },
        key: ['id']
      });

      await SearchModel.create({
        id: client.constructor.uuid().toString(),
        title: 'Machine Learning Basics',
        content: 'Introduction to ML algorithms'
      });

      // Note: Cassandra doesn't support LIKE natively, this is a simulation
      const allResults = await SearchModel.find({});
      const filtered = allResults.filter(r => 
        r.title.toLowerCase().includes('machine') ||
        r.content.toLowerCase().includes('ml')
      );

      expect(filtered.length).toBeGreaterThan(0);
    });
  });
});
