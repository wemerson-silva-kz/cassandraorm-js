#!/usr/bin/env bun

import { Client } from 'cassandra-driver';

async function debugRawDriver() {
  console.log('🔍 DEBUG RAW CASSANDRA DRIVER\n');

  // First connect without keyspace
  const client = new Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1'
  });

  try {
    await client.connect();
    console.log('✅ Connected to Cassandra');

    // Create keyspace
    await client.execute("CREATE KEYSPACE IF NOT EXISTS debug_raw WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}");
    console.log('✅ Keyspace created');

    // Use keyspace
    await client.execute('USE debug_raw');
    console.log('✅ Using keyspace');

    // Create table
    await client.execute('CREATE TABLE IF NOT EXISTS test (id text PRIMARY KEY, name text)');
    console.log('✅ Table created');

    // Insert
    const insertResult = await client.execute('INSERT INTO test (id, name) VALUES (?, ?)', ['test1', 'Test Name']);
    console.log('Insert result rows:', insertResult.rows);

    // Select
    const selectResult = await client.execute('SELECT * FROM test');
    console.log('Select result rows:', selectResult.rows);
    console.log('Row count:', selectResult.rows?.length);

    if (selectResult.rows && selectResult.rows.length > 0) {
      console.log('First row:', selectResult.rows[0]);
    }

    await client.shutdown();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugRawDriver();
