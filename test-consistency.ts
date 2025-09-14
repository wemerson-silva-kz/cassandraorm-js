#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function testConsistency() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_consistency'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const TestModel = await client.loadSchema('test_table', {
      fields: {
        id: 'uuid',
        name: 'text'
      },
      key: ['id']
    });

    // Inserir com query direta
    const testId = client.constructor.uuid();
    console.log('🔄 Inserindo com query direta...');
    const insertResult = await client.execute(
      'INSERT INTO test_table (id, name) VALUES (?, ?)',
      [testId, 'Direct Insert'],
      { prepare: true }
    );
    console.log('✅ Insert result:', insertResult ? 'OK' : 'NULL');

    // Buscar com query direta
    console.log('🔄 Buscando com query direta...');
    const directResult = await client.execute(
      'SELECT * FROM test_table WHERE id = ?',
      [testId],
      { prepare: true }
    );
    
    const rows = directResult?.rows || [];
    console.log(`✅ Query direta: ${rows.length} registros`);
    if (rows.length > 0) {
      console.log('   Dados:', rows[0]);
    }

    // Buscar todos
    const allDirect = await client.execute('SELECT * FROM test_table');
    const allRows = allDirect?.rows || [];
    console.log(`✅ Todos registros: ${allRows.length}`);

    await client.disconnect();
    console.log('✅ Teste concluído');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Execute with timeout to prevent hanging
Promise.race([
  testConsistency(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 10000)
  )
]).catch(error => {
  console.error('❌ Timeout ou erro:', error.message);
  process.exit(1);
});
