import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createClient, BulkWriter, UniqueConstraintManager } from '../src/index.js';

describe('Bulk Writer & Unique Constraints', () => {
  let client: any;
  let uniqueManager: UniqueConstraintManager;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase1_test',
      }
    });

    await client.connect();
    
    await client.execute(`
      CREATE KEYSPACE IF NOT EXISTS phase1_test
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);

    await client.execute('USE phase1_test');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id uuid PRIMARY KEY,
        email text,
        name text,
        age int
      )
    `);

    uniqueManager = new UniqueConstraintManager(client.driver, 'phase1_test');
    await uniqueManager.createUniqueTable('test_users', ['email']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  beforeEach(async () => {
    await client.execute('TRUNCATE test_users');
    await client.execute('TRUNCATE test_users_unique');
  });

  it('should prevent duplicate inserts', async () => {
    const data = { email: 'test@example.com', name: 'Test User' };
    
    await uniqueManager.checkUnique('test_users', data);
    await uniqueManager.insertUnique('test_users', data);
    
    try {
      await uniqueManager.checkUnique('test_users', data);
      throw new Error('Should have thrown duplicate error');
    } catch (error: any) {
      expect(error.message).toContain('Duplicate value');
    }
  });

  it('should insert multiple records', async () => {
    const bulkWriter = new BulkWriter(client.driver, 'phase1_test');
    
    const users = [
      { id: client.uuid(), email: 'user1@test.com', name: 'User 1', age: 25 },
      { id: client.uuid(), email: 'user2@test.com', name: 'User 2', age: 30 },
      { id: client.uuid(), email: 'user3@test.com', name: 'User 3', age: 35 },
    ];

    users.forEach(user => {
      bulkWriter.insert('test_users', user);
    });

    const result = await bulkWriter.execute();
    
    expect(result.inserted).toBe(3);
    expect(result.errors).toHaveLength(0);
  });
});
