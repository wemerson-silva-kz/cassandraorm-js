const { CassandraORM } = require('./index');

async function runBasicTests() {
  console.log('🔄 Starting basic Node.js compatibility tests...');
  
  try {
    // Test 1: Create ORM instance without keyspace
    let orm = new CassandraORM({
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1'
    });
    console.log('✅ ORM instance created');

    // Test 2: Connect and create keyspace
    await orm.connect();
    await orm.client.execute(`
      CREATE KEYSPACE IF NOT EXISTS test_node_compat
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);
    await orm.shutdown();
    console.log('✅ Keyspace created');

    // Test 3: Connect with keyspace
    orm = new CassandraORM({
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_node_compat'
    });
    await orm.connect();
    console.log('✅ Connected to Cassandra with keyspace');

    // Test 4: Create model
    const User = orm.model('test_users_node', {
      id: 'uuid',
      name: 'text',
      email: 'text'
    }, {
      key: ['id']
    });
    console.log('✅ Model created');

    // Test 5: Create table
    await User.createTable();
    console.log('✅ Table created');

    // Test 6: Insert data
    const userId = orm.uuid();
    await User.create({
      id: userId,
      name: 'Node Test User',
      email: 'node@test.com'
    });
    console.log('✅ Data inserted');

    // Test 7: Query data
    const users = await User.find();
    console.log(`✅ Found ${users.length} users`);

    // Test 8: Get metrics
    const metrics = orm.getMetrics();
    console.log(`✅ Metrics: ${metrics.queries.total} queries executed`);

    // Test 9: Health check
    const health = orm.getHealthCheck();
    console.log(`✅ Health: ${health.status}`);

    // Cleanup
    await orm.shutdown();
    console.log('✅ Connection closed');

    console.log('\n🎉 All basic tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runBasicTests();
