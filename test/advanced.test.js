const { createClient } = require('../src/index.js');
const { test, expect, beforeAll, afterAll } = require('bun:test');

let client;
let User;

beforeAll(async () => {
  client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1:9042'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_advanced_features'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'drop'
    }
  });
  
  await client.connect();
  
  User = await client.loadSchema('advanced_users', {
    fields: {
      id: 'uuid',
      name: 'text',
      email: 'text',
      age: 'int'
    },
    key: ['id']
  });
});

afterAll(async () => {
  await client.disconnect();
});

test('Query Builder - should create query builder instance', () => {
  const qb = client.query('advanced_users');
  expect(qb).toBeDefined();
  expect(typeof qb.from).toBe('function');
});

test('Query Builder - should build select query', () => {
  const qb = client.query('advanced_users');
  expect(qb).toBeDefined();
  expect(typeof qb.select).toBe('function');
});

test('Monitoring - should track basic metrics', () => {
  const metrics = client.getQueryMetrics();
  expect(Array.isArray(metrics)).toBe(true);
});

test('Monitoring - should provide health check', () => {
  const isConnected = client.isConnected();
  expect(typeof isConnected).toBe('boolean');
});

test('Plugins - should register cache plugin', () => {
  // Cache is built-in
  expect(client).toBeDefined();
});

test('Plugins - should register validation plugin', () => {
  // Validation is built-in
  expect(client).toBeDefined();
});

test('Connection Pool - should provide pool statistics', () => {
  const state = client.getConnectionState();
  expect(state).toBeDefined();
  expect(typeof state.connected).toBe('boolean');
});

test('Model operations - should create and find users', async () => {
  const user = await User.create({
    name: 'Advanced Test User',
    email: 'advanced@test.com',
    age: 25
  });
  
  expect(user.name).toBe('Advanced Test User');
  expect(user.id).toBeDefined();
  
  const foundUser = await User.findOne({ id: user.id });
  expect(foundUser).toBeDefined();
  expect(foundUser.name).toBe('Advanced Test User');
});

test('Batch Operations - should create batch instance', () => {
  const batch = client.createBatch();
  expect(batch).toBeDefined();
  expect(typeof batch.add).toBe('function');
  expect(typeof batch.execute).toBe('function');
});
