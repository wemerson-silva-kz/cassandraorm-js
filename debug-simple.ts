#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function debugSimple() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'debug_test'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    // Verificar keyspace
    const keyspaceResult = await client.execute("SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = 'debug_test'");
    console.log('Keyspace exists:', keyspaceResult?.rows?.length > 0);

    // Criar tabela manualmente
    await client.execute(`
      CREATE TABLE IF NOT EXISTS debug_test.simple_table (
        id uuid PRIMARY KEY,
        name text
      )
    `);
    console.log('✅ Tabela criada');

    // Inserir dados
    const testId = client.constructor.uuid();
    await client.execute(
      'INSERT INTO debug_test.simple_table (id, name) VALUES (?, ?)',
      [testId, 'Test Name']
    );
    console.log('✅ Dados inseridos');

    // Buscar imediatamente
    const result1 = await client.execute('SELECT * FROM debug_test.simple_table');
    console.log('Busca 1:', result1?.rows?.length || 0, 'registros');

    // Buscar por ID
    const result2 = await client.execute(
      'SELECT * FROM debug_test.simple_table WHERE id = ?',
      [testId]
    );
    console.log('Busca 2:', result2?.rows?.length || 0, 'registros');

    await client.disconnect();
    console.log('✅ Concluído');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

Promise.race([
  debugSimple(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
]).catch(error => {
  console.error('❌ Timeout:', error.message);
  process.exit(1);
});
