#!/usr/bin/env bun

import { createClient } from '../src/index.js';

async function testBasicFunctionality() {
  console.log('🚀 Testando funcionalidades básicas que funcionam...\n');

  try {
    // 1. Conexão básica
    console.log('1️⃣ Testando conexão...');
    const client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_playground'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    await client.connect();
    console.log('✅ Conectado com sucesso!');

    // 2. Schema loading
    console.log('\n2️⃣ Testando schema loading...');
    const User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text',
        created_at: 'timestamp'
      },
      key: ['id']
    });
    console.log('✅ Schema carregado com sucesso!');

    // 3. Inserção básica
    console.log('\n3️⃣ Testando inserção...');
    const userData = {
      id: client.constructor.uuid(),
      name: 'João Silva',
      email: 'joao@example.com',
      created_at: new Date()
    };
    
    await User.create(userData);
    console.log('✅ Usuário criado com sucesso!');

    // 4. Busca básica
    console.log('\n4️⃣ Testando busca...');
    const users = await User.find({});
    console.log(`✅ Encontrados ${users.length} usuários`);

    // 5. Estado da conexão
    console.log('\n5️⃣ Testando estado da conexão...');
    const state = client.getConnectionState();
    console.log('✅ Estado da conexão:', state);

    // 6. Query builder básico
    console.log('\n6️⃣ Testando query builder...');
    const queryBuilder = client.query('users');
    console.log('✅ Query builder criado');

    // 7. Batch builder
    console.log('\n7️⃣ Testando batch builder...');
    const batch = client.createBatch();
    console.log('✅ Batch builder criado');

    await client.disconnect();
    console.log('\n✅ Desconectado com sucesso!');

    console.log('\n🎉 TODOS OS TESTES BÁSICOS PASSARAM!');
    console.log('\n📊 Funcionalidades testadas:');
    console.log('   ✅ Conexão e desconexão');
    console.log('   ✅ Schema loading');
    console.log('   ✅ Inserção de dados');
    console.log('   ✅ Busca de dados');
    console.log('   ✅ Estado da conexão');
    console.log('   ✅ Query builder');
    console.log('   ✅ Batch builder');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

testBasicFunctionality();
