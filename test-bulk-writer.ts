import { createClient, BulkWriter, UniqueConstraintManager } from './src/index.js';

async function testBulkWriter() {
  console.log('🔄 Testing Bulk Writer and Unique Constraints...');
  
  try {
    const client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1'
      }
    });

    await client.connect();
    console.log('✅ Connected to Cassandra');

    await client.execute(`
      CREATE KEYSPACE IF NOT EXISTS test_bulk_demo
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);

    await client.execute('USE test_bulk_demo');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id uuid PRIMARY KEY,
        email text,
        name text,
        age int,
        created_at timestamp
      )
    `);
    console.log('✅ Table created');

    const uniqueManager = new UniqueConstraintManager(client.driver, 'test_bulk_demo');
    await uniqueManager.createUniqueTable('test_users', ['email']);
    console.log('✅ Unique constraint created');

    const bulkWriter = new BulkWriter(client.driver, 'test_bulk_demo', {
      batchSize: 10,
      skipDuplicates: true,
      uniqueManager
    });

    const testUsers = [
      { id: client.uuid(), email: 'test1@example.com', name: 'Test User 1', age: 25 },
      { id: client.uuid(), email: 'test2@example.com', name: 'Test User 2', age: 30 },
      { id: client.uuid(), email: 'test3@example.com', name: 'Test User 3', age: 35 },
      { id: client.uuid(), email: 'test1@example.com', name: 'Duplicate Email', age: 40 },
    ];

    testUsers.forEach(user => {
      bulkWriter.insert('test_users', {
        ...user,
        created_at: new Date()
      }, { skipIfExists: true });
    });

    console.log(`📦 Added ${bulkWriter.count()} operations`);

    const result = await bulkWriter.execute();
    
    console.log('📊 Results:');
    console.log(`  Inserted: ${result.inserted}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('  Error details:');
      result.errors.forEach(error => {
        console.log(`    - ${error.error}`);
      });
    }

    const users = await client.execute('SELECT * FROM test_users');
    console.log(`✅ Found ${users.rows.length} users in database`);

    await client.disconnect();
    console.log('✅ Bulk Writer test completed successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testBulkWriter();
