#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function debugTypes() {
  console.log('🔍 DEBUG TYPES CONVERSION\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'debug_types'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Connected');

    // Test direct insert and select
    await client.execute('CREATE TABLE IF NOT EXISTS debug_types.simple_test (id uuid PRIMARY KEY, name text)');
    console.log('✅ Table created');

    const testId = client.constructor.uuid();
    console.log('UUID type:', typeof testId, testId.constructor.name);
    console.log('UUID string:', testId.toString());

    // Insert with string UUID
    await client.execute('INSERT INTO debug_types.simple_test (id, name) VALUES (?, ?)', [testId.toString(), 'Test Name']);
    console.log('✅ Inserted with string UUID');

    // Select back
    const result1 = await client.execute('SELECT * FROM debug_types.simple_test');
    console.log('Direct select result:', result1.rows?.length);

    // Now test with model
    const TestModel = await client.loadSchema('model_test', {
      fields: {
        id: 'uuid',
        name: 'text'
      },
      key: ['id']
    });

    const modelId = client.constructor.uuid();
    console.log('Model UUID:', modelId.toString());

    await TestModel.create({
      id: modelId.toString(), // Use string instead of UUID object
      name: 'Model Test'
    });
    console.log('✅ Model created');

    const modelResults = await TestModel.find({});
    console.log('Model results:', modelResults.length);

    if (modelResults.length > 0) {
      console.log('First result:', modelResults[0]);
    }

    await client.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugTypes();
