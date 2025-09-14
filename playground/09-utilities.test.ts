#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testUtilities() {
  console.log('🔧 Teste 9: Utilities\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_utils_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    // UUID generation
    const uuid1 = client.uuid();
    const uuid2 = client.uuid();
    console.log('✅ UUIDs gerados:', typeof uuid1, typeof uuid2);
    console.log('✅ UUIDs diferentes:', uuid1 !== uuid2);

    // TimeUUID generation
    const timeUuid1 = client.timeuuid();
    const timeUuid2 = client.timeuuid();
    console.log('✅ TimeUUIDs gerados:', typeof timeUuid1, typeof timeUuid2);
    console.log('✅ TimeUUIDs diferentes:', timeUuid1 !== timeUuid2);

    // Connection stats
    const stats = client.getConnectionStats();
    console.log('✅ Connection stats obtidas:', typeof stats);

    // Execute raw query
    const result = await client.execute('SELECT now() FROM system.local');
    console.log('✅ Query raw executada:', result.rows.length, 'rows');

    // Batch queries
    const queries = [
      { query: 'SELECT now() FROM system.local', params: [] },
      { query: 'SELECT release_version FROM system.local', params: [] }
    ];
    const batchResult = await client.batch(queries);
    console.log('✅ Batch queries executadas:', batchResult.length, 'resultados');

    await client.disconnect();
    console.log('\n🎉 Teste utilities: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testUtilities();
