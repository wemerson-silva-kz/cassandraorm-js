#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function debugExecute() {
  console.log('🔍 DEBUG EXECUTE METHOD\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'debug_execute'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Connected');

    // Create table
    await client.execute('CREATE TABLE IF NOT EXISTS debug_execute.test (id text PRIMARY KEY, name text)');
    console.log('✅ Table created');

    // Insert
    const insertResult = await client.execute('INSERT INTO debug_execute.test (id, name) VALUES (?, ?)', ['test1', 'Test Name']);
    console.log('Insert result structure:', Object.keys(insertResult));
    console.log('Insert result rows:', insertResult.rows);
    console.log('Insert result info:', insertResult.info);

    // Select
    const selectResult = await client.execute('SELECT * FROM debug_execute.test');
    console.log('Select result structure:', Object.keys(selectResult));
    console.log('Select result rows:', selectResult.rows);
    console.log('Select result rowLength:', selectResult.rowLength);

    if (selectResult.rows) {
      console.log('Rows length:', selectResult.rows.length);
      if (selectResult.rows.length > 0) {
        console.log('First row:', selectResult.rows[0]);
      }
    }

    await client.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugExecute();
