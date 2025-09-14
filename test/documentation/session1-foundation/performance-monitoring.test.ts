import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 1: Performance Monitoring', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Query Performance', () => {
    it('should track query execution time', async () => {
      const startTime = Date.now();
      await client.execute('SELECT * FROM system.local');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should handle basic queries', async () => {
      const result = await client.execute('SELECT * FROM system.local');
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Metrics', () => {
    it('should provide connection statistics', async () => {
      const state = client.getConnectionState();
      expect(state).toBeDefined();
      expect(typeof state.connected).toBe('boolean');
      expect(typeof state.hosts).toBe('number');
      expect(typeof state.queryCount).toBe('number');
      expect(typeof state.avgQueryTime).toBe('number');
      expect(typeof state.errorRate).toBe('number');
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeGreaterThan(0);
      expect(memUsage.heapTotal).toBeGreaterThan(memUsage.heapUsed);
    });
  });
});
