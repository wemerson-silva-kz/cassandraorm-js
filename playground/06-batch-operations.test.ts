#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testBatchOperations() {
  console.log('📦 Teste 6: Batch Operations\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_batch_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const User = await client.loadSchema('users', {
      fields: {
        id: CassandraTypes.UUID,
        email: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT,
        active: { type: CassandraTypes.BOOLEAN, default: true }
      },
      key: ['id']
    });

    console.log('✅ Schema carregado');

    // Create with upsert option
    const user1 = await User.create({
      id: client.uuid(),
      email: 'test@example.com',
      name: 'Test User',
      active: true
    }, { upsert: true });
    console.log('✅ UPSERT: Usuário criado');

    // Update with upsert option
    await User.create({
      id: user1.id,
      email: 'test@example.com',
      name: 'Test User Updated',
      active: false
    }, { upsert: true });
    console.log('✅ UPSERT: Usuário atualizado');

    // CreateMany
    const users = await User.createMany([
      {
        id: client.uuid(),
        email: 'user1@example.com',
        name: 'User 1',
        active: true
      },
      {
        id: client.uuid(),
        email: 'user2@example.com',
        name: 'User 2',
        active: true
      },
      {
        id: client.uuid(),
        email: 'user3@example.com',
        name: 'User 3',
        active: false
      }
    ]);
    console.log('✅ CREATE MANY:', users.length, 'usuários criados');

    // CreateMany com duplicatas (deve ignorar)
    const moreUsers = await User.createMany([
      {
        id: client.uuid(),
        email: 'user1@example.com', // Duplicado
        name: 'User 1 Duplicate',
        active: true
      },
      {
        id: client.uuid(),
        email: 'user4@example.com', // Novo
        name: 'User 4',
        active: true
      }
    ], { ignoreDuplicates: true });
    console.log('✅ CREATE MANY com ignoreDuplicates:', moreUsers.length, 'usuários criados');

    const totalUsers = await User.find();
    console.log('✅ Total de usuários:', totalUsers.length);

    await client.disconnect();
    console.log('\n🎉 Teste batch operations: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testBatchOperations();
