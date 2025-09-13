const { CassandraORM } = require('../index');
const assert = require('assert');

describe('CassandraORM Basic Tests', () => {
  let orm;
  let User;

  before(async () => {
    orm = new CassandraORM({
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_cassandraorm'
    });
    
    await orm.connect();
    
    User = orm.model('test_users', {
      id: 'uuid',
      name: 'text',
      email: 'text'
    }, {
      key: ['id']
    });
    
    await User.createTable();
  });

  after(async () => {
    await orm.shutdown();
  });

  it('should create a user', async () => {
    const user = await User.create({
      id: orm.uuid(),
      name: 'Test User',
      email: 'test@example.com'
    });
    
    assert.ok(user);
    assert.equal(user.name, 'Test User');
  });

  it('should find users', async () => {
    const users = await User.find();
    assert.ok(Array.isArray(users));
    assert.ok(users.length > 0);
  });
});
