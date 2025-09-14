#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function debugOurClient() {
  console.log('🔍 DEBUG OUR CLIENT WITH RAW DRIVER\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'debug_our'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Connected');

    // Test raw driver access
    console.log('Raw driver available:', !!client.driver);
    
    if (client.driver) {
      // Test with raw driver
      await client.driver.execute('CREATE TABLE IF NOT EXISTS test_raw (id text PRIMARY KEY, name text)');
      console.log('✅ Table created with raw driver');

      await client.driver.execute('INSERT INTO test_raw (id, name) VALUES (?, ?)', ['test1', 'Raw Test']);
      console.log('✅ Data inserted with raw driver');

      const rawResult = await client.driver.execute('SELECT * FROM test_raw');
      console.log('Raw driver result:', rawResult.rows?.length);
    }

    // Test our execute method
    const ourResult = await client.execute('SELECT * FROM test_raw');
    console.log('Our execute result:', ourResult.rows?.length);

    await client.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugOurClient();
