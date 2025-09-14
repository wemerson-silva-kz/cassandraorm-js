import { createClient } from '../dist/index.js';

console.log('🔄 Running CI tests...');

async function runTests() {
  let client;
  
  try {
    // Test createClient without keyspace first
    const tempClient = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1'
      }
    });
    
    console.log('✅ Client created');
    
    // Connect
    await tempClient.connect();
    console.log('✅ Connected to Cassandra');
    
    // Create keyspace manually
    await tempClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS test_ci 
      WITH REPLICATION = { 'class': 'SimpleStrategy', 'replication_factor': 1 }
    `);
    console.log('✅ Keyspace created');
    
    await tempClient.disconnect();
    
    // Now connect with keyspace
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_ci'
      }
    });
    
    await client.connect();
    console.log('✅ Using keyspace');
    
    // Create table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_table (
        id uuid PRIMARY KEY,
        name text
      )
    `);
    console.log('✅ Table created');
    
    // Insert data
    const testId = client.uuid();
    await client.execute(
      'INSERT INTO test_table (id, name) VALUES (?, ?)',
      [testId, 'Test User']
    );
    console.log('✅ Data inserted');
    
    // Query data
    const result = await client.execute('SELECT COUNT(*) FROM test_table');
    const count = result.rows[0].count;
    console.log(`✅ Found ${count} rows`);
    
    // Disconnect
    await client.disconnect();
    console.log('✅ Connection closed');
    
    console.log('\n🎉 CI tests passed!');
    
  } catch (error) {
    console.error('❌ CI test failed:', error.message);
    process.exit(1);
  }
}

runTests();
