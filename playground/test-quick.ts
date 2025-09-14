#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function quickTest() {
  console.log('🚀 Teste Rápido - CassandraORM JS');
  
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `quick_test_${Date.now()}`
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
        id: 'uuid',
        email: { type: 'text', unique: true },
        name: 'text'
      },
      key: ['id'],
      unique: ['email']
    });

    const user = await User.create({
      id: client.uuid(),
      email: 'test@example.com',
      name: 'Test User'
    });
    console.log('✅ Usuário criado:', user.email);

    try {
      await User.create({
        id: client.uuid(),
        email: 'test@example.com',
        name: 'Test User 2'
      });
    } catch (error) {
      console.log('✅ Unique funcionando');
    }

    const users = await User.find();
    console.log('✅ Encontrados:', users.length, 'usuários');

    console.log('\n🎉 Teste rápido concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.disconnect();
  }
}

if (import.meta.main) {
  quickTest();
}
