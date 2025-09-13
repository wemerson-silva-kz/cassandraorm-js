const { CassandraORM } = require('../index');
const { test, expect, beforeAll, afterAll } = require('bun:test');

let orm;
let User;

beforeAll(async () => {
  orm = new CassandraORM({
    contactPoints: ['localhost'],
    localDataCenter: 'datacenter1',
    keyspace: 'test_cassandraorm_bun'
  });
  
  await orm.connect();
  
  User = orm.model('test_users_bun', {
    id: 'uuid',
    name: 'text',
    email: 'text'
  }, {
    key: ['id']
  });
  
  await User.createTable();
});

afterAll(async () => {
  await orm.shutdown();
});

test('should create a user', async () => {
  const user = await User.create({
    id: orm.uuid(),
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

test('should generate UUID', () => {
  const id = orm.uuid();
  expect(id).toBeDefined();
  expect(typeof id.toString()).toBe('string');
});

test('should create batch operations', () => {
  const batch = orm.batch();
  expect(batch).toBeDefined();
  expect(typeof batch.insert).toBe('function');
});
