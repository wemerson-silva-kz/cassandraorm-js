import { createClient, BulkWriter, UniqueConstraintManager } from '../src/index.js';

async function bulkWriterExample() {
  console.log('🚀 Bulk Writer & Unique Constraints Example\n');

  // 1. Create client
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'bulk_demo',
    },
    ormOptions: {
      createKeyspace: true,
      defaultReplicationStrategy: {
        class: 'SimpleStrategy',
        replication_factor: 1,
      },
    },
  });

  await client.connect();
  console.log('✅ Connected to Cassandra');

  // 2. Create table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text,
      name text,
      age int,
      created_at timestamp
    )
  `);
  console.log('✅ Table created');

  // 3. Setup unique constraint for email
  const uniqueManager = new UniqueConstraintManager(client.driver, 'bulk_demo');
  await uniqueManager.createUniqueTable('users', ['email']);
  console.log('✅ Unique constraint created for email');

  // 4. Create bulk writer
  const bulkWriter = new BulkWriter(client.driver, 'bulk_demo', {
    batchSize: 50,
    skipDuplicates: true,
    uniqueManager
  });

  // 5. Add bulk operations
  const users = [
    { id: client.uuid(), email: 'john@example.com', name: 'John Doe', age: 30 },
    { id: client.uuid(), email: 'jane@example.com', name: 'Jane Smith', age: 25 },
    { id: client.uuid(), email: 'bob@example.com', name: 'Bob Johnson', age: 35 },
    { id: client.uuid(), email: 'john@example.com', name: 'John Duplicate', age: 31 }, // Duplicate email
  ];

  users.forEach(user => {
    bulkWriter.insert('users', {
      ...user,
      created_at: new Date()
    }, { skipIfExists: true });
  });

  console.log(`📦 Added ${bulkWriter.count()} operations to bulk writer`);

  // 6. Execute bulk operations
  const result = await bulkWriter.execute();
  
  console.log('\n📊 Bulk Operation Results:');
  console.log(`✅ Inserted: ${result.inserted}`);
  console.log(`⚠️  Skipped: ${result.skipped}`);
  console.log(`❌ Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('\n🔍 Errors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.error}`);
    });
  }

  // 7. Verify data
  const allUsers = await client.execute('SELECT * FROM users');
  console.log(`\n👥 Total users in database: ${allUsers.rows.length}`);
  
  allUsers.rows.forEach(user => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  // 8. Bulk update example
  const updateWriter = new BulkWriter(client.driver, 'bulk_demo', { batchSize: 10 });
  
  // Update ages
  allUsers.rows.forEach(user => {
    updateWriter.update('users', 
      { age: user.age + 1 }, 
      { id: user.id }
    );
  });

  const updateResult = await updateWriter.execute();
  console.log(`\n🔄 Updated ${updateResult.updated} users`);

  await client.disconnect();
  console.log('\n✅ Example completed successfully!');
}

// Run example
if (import.meta.main) {
  bulkWriterExample().catch(console.error);
}

export { bulkWriterExample };
