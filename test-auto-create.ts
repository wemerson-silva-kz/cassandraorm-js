import { createClient } from './src/index.js';

async function testAutoCreate() {
  console.log('🔄 Testing Auto-Create Keyspace & Table...');
  
  try {
    const client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_auto_create'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe',
        defaultReplicationStrategy: {
          class: 'SimpleStrategy',
          replication_factor: 1
        }
      }
    });

    await client.connect();
    console.log('✅ Connected and keyspace auto-created');

    const userSchema = {
      fields: {
        id: 'uuid',
        email: 'text',
        name: 'text'
      },
      key: ['id']
    };

    const User = await client.loadSchema('test_users', userSchema);
    console.log('✅ Schema loaded and table auto-created');

    // Test insert
    await client.execute(
      'INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)',
      [client.uuid(), 'test@auto.com', 'Auto Test User']
    );
    console.log('✅ Data inserted successfully');

    const users = await client.execute('SELECT * FROM test_users');
    console.log(`✅ Found ${users.rows.length} users in auto-created table`);

    await client.disconnect();
    console.log('✅ Auto-create test completed successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAutoCreate();
