const { CassandraORM } = require('../src/index.js');
const { test, expect, beforeAll, afterAll } = require('bun:test');

let orm;
let User;

beforeAll(async () => {
  // First connect without keyspace to create it
  orm = new CassandraORM({
    contactPoints: ['localhost'],
    localDataCenter: 'datacenter1',
    monitoring: { enabled: true, logLevel: 'info' }
  });
  
  await orm.connect();
  
  // Create keyspace
  await orm.client.execute(`
    CREATE KEYSPACE IF NOT EXISTS test_advanced_features
    WITH REPLICATION = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    }
  `);
  
  await orm.shutdown();
  
  // Now connect with keyspace
  orm = new CassandraORM({
    contactPoints: ['localhost'],
    localDataCenter: 'datacenter1',
    keyspace: 'test_advanced_features',
    monitoring: { enabled: true, logLevel: 'info' }
  });
  
  await orm.connect();
  
  User = orm.model('advanced_users', {
    id: 'uuid',
    name: 'text',
    email: 'text',
    age: 'int'
  }, {
    key: ['id']
  });
  
  await User.createTable();
});

afterAll(async () => {
  await orm.shutdown();
});

test('Query Builder - should create query builder instance', () => {
  const qb = orm.query('advanced_users');
  expect(qb).toBeDefined();
  expect(typeof qb.select).toBe('function');
  expect(typeof qb.where).toBe('function');
});

test('Query Builder - should build select query', () => {
  const qb = orm.query('advanced_users')
    .select(['name', 'email'])
    .where('age', '>', 18)
    .limit(10);
  
  const { query, params } = qb.build();
  expect(query).toContain('SELECT name, email FROM advanced_users');
  expect(query).toContain('WHERE age > ?');
  expect(query).toContain('LIMIT 10');
  expect(params).toEqual([18]);
});

test('Monitoring - should track basic metrics', () => {
  const metrics = orm.getMetrics();
  
  expect(metrics.queries).toBeDefined();
  expect(metrics.performance).toBeDefined();
  expect(metrics.connections).toBeDefined();
});

test('Monitoring - should provide health check', () => {
  const health = orm.getHealthCheck();
  
  expect(health.status).toBeDefined();
  expect(health.errorRate).toBeDefined();
  expect(health.avgResponseTime).toBeDefined();
});

test('Plugins - should register cache plugin', () => {
  orm.use('cache', { ttl: 60000 });
  
  const plugins = orm.pluginManager.listPlugins();
  expect(plugins).toContain('cache');
});

test('Plugins - should register validation plugin', () => {
  orm.use('validation');
  
  const plugins = orm.pluginManager.listPlugins();
  expect(plugins).toContain('validation');
});

test('Connection Pool - should provide pool statistics', () => {
  const metrics = orm.getMetrics();
  
  expect(metrics.connectionPool).toBeDefined();
});

test('Model operations - should create and find users', async () => {
  const userId = orm.uuid();
  
  await User.create({
    id: userId,
    name: 'Advanced Test User',
    email: 'advanced@test.com',
    age: 25
  });
  
  const user = await User.findOne({ id: userId });
  expect(user.name).toBe('Advanced Test User');
});

test('Batch Operations - should create batch instance', () => {
  const batch = orm.batch();
  expect(batch).toBeDefined();
  expect(typeof batch.insert).toBe('function');
  expect(typeof batch.execute).toBe('function');
});
