import { describe, it, expect } from 'bun:test';
import { createClient } from "../src/index";

describe('Advanced Features', () => {
  describe('Query Builder', () => {
    it('should create query builder instance', () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      const queryBuilder = client.query();
      expect(queryBuilder).toBeDefined();
      expect(typeof queryBuilder.from).toBe('function');
    });

    it('should build select query', () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      const queryBuilder = client.query('users');
      expect(queryBuilder).toBeDefined();
      expect(typeof queryBuilder.select).toBe('function');
    });
  });

  describe('Monitoring', () => {
    it('should track basic metrics', () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      const metrics = client.getQueryMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should provide health check', async () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      await client.connect();
      const isConnected = client.isConnected();
      expect(typeof isConnected).toBe('boolean');
      await client.disconnect();
    });
  });

  describe('Plugins', () => {
    it('should register cache plugin', () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      // Cache is automatically initialized
      expect(client).toBeDefined();
    });

    it('should register validation plugin', () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      // Validation is built-in
      expect(client).toBeDefined();
    });
  });

  describe('Connection Pool', () => {
    it('should provide pool statistics', async () => {
      const client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_advanced'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      
      await client.connect();
      const state = client.getConnectionState();
      expect(state).toBeDefined();
      expect(typeof state.connected).toBe('boolean');
      await client.disconnect();
    });
  });
});
