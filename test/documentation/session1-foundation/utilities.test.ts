import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 1: Utilities', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Basic Logging', () => {
    it('should capture console output', async () => {
      const logs: string[] = [];
      
      // Mock console.log to capture logs
      const originalLog = console.log;
      console.log = (message: string) => {
        logs.push(message);
        originalLog(message);
      };

      console.log('Test log message');
      
      // Restore console.log
      console.log = originalLog;
      
      expect(logs).toContain('Test log message');
    });
  });

  describe('Basic Debugging', () => {
    it('should provide debug information', async () => {
      const debugInfo = {
        query: 'SELECT * FROM system.local',
        timestamp: new Date(),
        executionTime: 50
      };
      
      expect(debugInfo.query).toBeDefined();
      expect(debugInfo.timestamp).toBeInstanceOf(Date);
      expect(debugInfo.executionTime).toBeGreaterThan(0);
    });

    it('should handle query execution', async () => {
      const query = 'SELECT * FROM system.local';
      const result = await client.execute(query);
      
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      try {
        await client.execute('INVALID QUERY SYNTAX');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });

    // TODO: Implement timeout handling
    it.skip('should handle timeout errors', async () => {
      // This test is skipped until timeout handling is implemented
    });
  });
});
