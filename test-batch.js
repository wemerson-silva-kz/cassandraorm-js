#!/usr/bin/env node

import { createClient } from './src/index.ts';

async function testBatchOperations() {
  console.log('🔧 TESTANDO BATCH OPERATIONS - Issue #10\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_batch'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Create test table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS batch_test (
        id uuid PRIMARY KEY,
        name text,
        value int,
        created_at timestamp
      )
    `);
    console.log('✅ Tabela criada');

    // Test 1: BatchBuilder approach
    console.log('\n🧪 Teste 1: BatchBuilder');
    try {
      const batch = client.createBatch();
      
      batch.add('INSERT INTO batch_test (id, name, value, created_at) VALUES (?, ?, ?, ?)', 
        [client.constructor.uuid().toString(), 'test1', 100, new Date()]);
      batch.add('INSERT INTO batch_test (id, name, value, created_at) VALUES (?, ?, ?, ?)', 
        [client.constructor.uuid().toString(), 'test2', 200, new Date()]);
      
      await batch.execute();
      console.log('✅ BatchBuilder funcionou!');
    } catch (error) {
      console.log('❌ BatchBuilder falhou:', error.message);
    }

    // Test 2: Direct batch method
    console.log('\n🧪 Teste 2: Direct batch method');
    try {
      const queries = [
        {
          query: 'INSERT INTO batch_test (id, name, value, created_at) VALUES (?, ?, ?, ?)',
          params: [client.constructor.uuid().toString(), 'direct1', 300, new Date()]
        },
        {
          query: 'INSERT INTO batch_test (id, name, value, created_at) VALUES (?, ?, ?, ?)',
          params: [client.constructor.uuid().toString(), 'direct2', 400, new Date()]
        }
      ];
      
      await client.batch(queries);
      console.log('✅ Direct batch funcionou!');
    } catch (error) {
      console.log('❌ Direct batch falhou:', error.message);
    }

    // Test 3: Verify data
    console.log('\n🧪 Teste 3: Verificar dados inseridos');
    const result = await client.execute('SELECT COUNT(*) as count FROM batch_test');
    const count = result.rows[0].count.toNumber();
    console.log(`✅ Total de registros: ${count}`);

    if (count >= 4) {
      console.log('\n🎉 BATCH OPERATIONS FUNCIONANDO!');
      console.log('✅ Issue #10 RESOLVIDA!');
    } else {
      console.log('\n❌ Alguns batches falharam');
    }

    await client.disconnect();

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testBatchOperations();
