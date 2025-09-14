#!/usr/bin/env bun

import { createClient } from './src/index.js';

async function testInsertAndFind() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_insert'
    },
    ormOptions: { createKeyspace: true }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const TestModel = await client.loadSchema('test_table', {
      fields: {
        id: 'uuid',
        name: 'text',
        value: 'int'
      },
      key: ['id']
    });
    console.log('✅ Schema carregado');

    // Inserir dados
    const testId = client.constructor.uuid();
    await TestModel.create({
      id: testId,
      name: 'Test User',
      value: 42
    });
    console.log('✅ Dados inseridos');

    // Buscar todos
    const allResults = await TestModel.find({});
    console.log(`✅ Busca geral: ${allResults.length} registros`);

    // Buscar por ID
    const specificResult = await TestModel.find({ id: testId });
    console.log(`✅ Busca específica: ${specificResult.length} registros`);

    // Count
    const count = await TestModel.count();
    console.log(`✅ Count: ${count} registros`);

    await client.disconnect();
    console.log('✅ Teste concluído');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

testInsertAndFind();
