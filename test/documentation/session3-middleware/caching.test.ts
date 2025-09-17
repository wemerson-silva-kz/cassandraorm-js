import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 3: Caching System', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    if (client) {
      await TestHelpers.cleanup();
    }
  });

  describe('Basic Caching', () => {
    it('should implement basic cache functionality', () => {
      class SimpleCache {
        private cache = new Map();
        private stats = { hits: 0, misses: 0 };

        set(key: string, value: any) {
          this.cache.set(key, value);
        }

        get(key: string) {
          if (this.cache.has(key)) {
            this.stats.hits++;
            return this.cache.get(key);
          }
          this.stats.misses++;
          return null;
        }

        getStats() {
          const total = this.stats.hits + this.stats.misses;
          return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: total > 0 ? this.stats.hits / total : 0
          };
        }
      }

      const cache = new SimpleCache();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe(null);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });
});
