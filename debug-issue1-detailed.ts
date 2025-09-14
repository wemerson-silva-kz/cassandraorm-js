#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function debugDetailed() {
  console.log('🔍 DETAILED DEBUG ISSUE #1\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'debug_detailed'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Connected');

    // Check keyspace
    const keyspaceCheck = await client.execute("SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = 'debug_detailed'");
    console.log('Keyspace exists:', keyspaceCheck.rows?.length > 0);

    // Create schema
    const TestModel = await client.loadSchema('test_table', {
      fields: {
        id: 'uuid',
        category: 'text',
        value: 'int'
      },
      key: ['id']
    });

    // Check table exists
    const tableCheck = await client.execute("SELECT table_name FROM system_schema.tables WHERE keyspace_name = 'debug_detailed' AND table_name = 'test_table'");
    console.log('Table exists:', tableCheck.rows?.length > 0);

    // Show table structure
    const tableDesc = await client.execute("SELECT column_name, type FROM system_schema.columns WHERE keyspace_name = 'debug_detailed' AND table_name = 'test_table'");
    console.log('Table columns:', tableDesc.rows?.map(r => `${r.column_name}: ${r.type}`));

    // Insert with explicit keyspace
    const testId = client.constructor.uuid();
    console.log('Generated UUID:', testId);

    const insertQuery = 'INSERT INTO debug_detailed.test_table (id, category, value) VALUES (?, ?, ?)';
    const insertParams = [testId, 'A', 10];
    
    console.log('Insert query:', insertQuery);
    console.log('Insert params:', insertParams);

    const insertResult = await client.execute(insertQuery, insertParams);
    console.log('Insert result:', insertResult);

    // Query back immediately
    const selectQuery = 'SELECT * FROM debug_detailed.test_table WHERE category = ?';
    const selectResult = await client.execute(selectQuery, ['A']);
    console.log('Select result:', selectResult.rows?.length, 'rows');
    
    if (selectResult.rows?.length > 0) {
      console.log('First row:', selectResult.rows[0]);
    }

    // Try with model methods
    console.log('\n🔄 Testing model methods...');
    const modelData = {
      id: client.constructor.uuid(),
      category: 'B',
      value: 20
    };

    await TestModel.create(modelData);
    console.log('Model create done');

    const modelResults = await TestModel.find({ category: 'B' });
    console.log('Model find results:', modelResults.length);

    await client.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugDetailed();
