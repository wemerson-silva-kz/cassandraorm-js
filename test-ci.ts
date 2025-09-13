import { CassandraORM } from './src/orm.js';

async function testCI() {
  console.log('🔄 Running CI tests...');
  
  try {
    // Test 1: Create ORM instance
    const orm = new CassandraORM({
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1'
    });
    console.log('✅ ORM instance created');

    // Test 2: Connect
    await orm.connect();
    console.log('✅ Connected to Cassandra');

    // Test 3: Create keyspace
    await orm.client!.execute(`
      CREATE KEYSPACE IF NOT EXISTS test_ci
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);
    console.log('✅ Keyspace created');

    // Test 4: Use keyspace
    await orm.client!.execute('USE test_ci');
    console.log('✅ Using keyspace');

    // Test 5: Create table
    await orm.client!.execute(`
      CREATE TABLE IF NOT EXISTS test_table (
        id uuid PRIMARY KEY,
        name text
      )
    `);
    console.log('✅ Table created');

    // Test 6: Insert data
    const uuid = orm.uuid();
    await orm.client!.execute(
      'INSERT INTO test_table (id, name) VALUES (?, ?)',
      [uuid, 'CI Test'],
      { prepare: true }
    );
    console.log('✅ Data inserted');

    // Test 7: Query data
    const result = await orm.client!.execute('SELECT * FROM test_table');
    console.log(`✅ Found ${result.rows.length} rows`);

    // Cleanup
    await orm.shutdown();
    console.log('✅ Connection closed');

    console.log('\n🎉 CI tests passed!');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ CI test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCI();
