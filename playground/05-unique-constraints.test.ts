#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testUniqueConstraints() {
  console.log('🔒 Teste 5: Unique Constraints\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_unique_${Date.now()}`
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
        username: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT
      },
      key: ['id']
    });

    console.log('✅ Schema com unique constraints carregado');

    // Criar usuário válido
    const user1 = await User.create({
      id: client.uuid(),
      email: 'john@example.com',
      username: 'johndoe',
      name: 'John Doe'
    });
    console.log('✅ Usuário 1 criado');

    // Tentar email duplicado
    try {
      await User.create({
        id: client.uuid(),
        email: 'john@example.com', // Duplicado
        username: 'johndoe2',
        name: 'John Two'
      });
      console.log('❌ Email duplicado deveria ter falhado');
      process.exit(1);
    } catch (error) {
      console.log('✅ Email duplicado rejeitado corretamente');
    }

    // Tentar username duplicado
    try {
      await User.create({
        id: client.uuid(),
        email: 'jane@example.com',
        username: 'johndoe', // Duplicado
        name: 'Jane Doe'
      });
      console.log('❌ Username duplicado deveria ter falhado');
      process.exit(1);
    } catch (error) {
      console.log('✅ Username duplicado rejeitado corretamente');
    }

    // Criar usuário com dados únicos
    const user2 = await User.create({
      id: client.uuid(),
      email: 'jane@example.com',
      username: 'janedoe',
      name: 'Jane Doe'
    });
    console.log('✅ Usuário 2 criado com dados únicos');

    const totalUsers = await User.find();
    console.log('✅ Total de usuários:', totalUsers.length);

    await client.disconnect();
    console.log('\n🎉 Teste unique constraints: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testUniqueConstraints();
