const { createClient } = require('../src/index.js');
const { test, expect, beforeAll, afterAll } = require('bun:test');

let client;
let User;

beforeAll(async () => {
  client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1:9042'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_basic'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'drop'
    }
  });
  
  await client.connect();
  
  User = await client.loadSchema('test_users_basic', {
    fields: {
      id: 'uuid',
      name: 'text',
      email: 'text'
    },
    key: ['id']
  });
});

afterAll(async () => {
  await client.disconnect();
});

test('should create a user', async () => {
  const user = await User.create({
    name: 'Test User',
    email: 'test@example.com'
  });
  
  expect(user).toBeDefined();
  expect(user.name).toBe('Test User');
});

test('should find users', async () => {
  const users = await User.find();
  expect(Array.isArray(users)).toBe(true);
  expect(users.length).toBeGreaterThan(0);
});

test('should create batch operations', () => {
  const batch = client.createBatch();
  expect(batch).toBeDefined();
  expect(typeof batch.add).toBe('function');
  expect(typeof batch.execute).toBe('function');
});
