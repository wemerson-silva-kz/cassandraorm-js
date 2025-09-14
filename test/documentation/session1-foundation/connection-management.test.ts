import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '../../../src';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 1: Connection Management', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Basic Connection', () => {
    it('should connect to Cassandra', async () => {
      expect(client).toBeDefined();
      // Test basic connection by executing a simple query
      const result = await client.execute('SELECT now() FROM system.local');
      expect(result.rows).toHaveLength(1);
    });

    it('should execute basic query', async () => {
      const result = await client.execute('SELECT now() FROM system.local');
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Connection Pool', () => {
    it('should configure connection pool', async () => {
      const state = client.getConnectionState();
      expect(state.connected).toBe(true);
      expect(state.hosts).toBeGreaterThanOrEqual(1);
      expect(typeof state.queryCount).toBe('number');
    });
  });

  // TODO: Implement health monitoring features  
  describe('Health Monitoring', () => {
    it('should check connection health', async () => {
      const isConnected = client.isConnected();
      expect(isConnected).toBe(true);
      
      const state = client.getConnectionState();
      expect(state.connected).toBe(true);
      expect(state.errorRate).toBeGreaterThanOrEqual(0);
    });
  });
});
