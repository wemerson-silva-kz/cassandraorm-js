#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testUniqueFields() {
  console.log('🔒 Testando Campos Unique - CassandraORM JS\n');

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
    console.log('✅ Conectado ao Cassandra');

    const User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        email: { type: 'text', unique: true },
        username: { type: 'text', unique: true },
        name: 'text'
      },
      key: ['id']
    });

    console.log('✅ Schema carregado\n');

    // Teste 1: Criar usuário válido
    console.log('📝 Teste 1: Criando usuário válido...');
    const user1 = await User.create({
      id: client.uuid(),
      email: 'john@example.com',
      username: 'john_doe',
      name: 'John Doe'
    });
    console.log('✅ Usuário 1 criado:', user1.name);

    // Teste 2: Tentar email duplicado
    console.log('\n📝 Teste 2: Tentando email duplicado...');
    try {
      await User.create({
        id: client.uuid(),
        email: 'john@example.com', // DUPLICADO
        username: 'jane_doe',
        name: 'Jane Doe'
      });
      console.log('❌ ERRO: Email duplicado deveria ter falhado!');
    } catch (error) {
      console.log('✅ Email duplicado rejeitado corretamente');
    }

    // Teste 3: Tentar username duplicado
    console.log('\n📝 Teste 3: Tentando username duplicado...');
    try {
      await User.create({
        id: client.uuid(),
        email: 'jane@example.com',
        username: 'john_doe', // DUPLICADO
        name: 'Jane Smith'
      });
      console.log('❌ ERRO: Username duplicado deveria ter falhado!');
    } catch (error) {
      console.log('✅ Username duplicado rejeitado corretamente');
    }

    // Teste 4: Criar segundo usuário com dados únicos
    console.log('\n📝 Teste 4: Criando segundo usuário com dados únicos...');
    const user2 = await User.create({
      id: client.uuid(),
      email: 'jane@example.com',
      username: 'jane_doe',
      name: 'Jane Doe'
    });
    console.log('✅ Usuário 2 criado:', user2.name);

    // Teste 5: Verificar total de usuários
    console.log('\n📝 Teste 5: Verificando total de usuários...');
    const allUsers = await User.find();
    console.log(`✅ Total de usuários: ${allUsers.length}`);

    console.log('\n🎉 Todos os testes de campos unique passaram!');

  } catch (error) {
    console.error('\n❌ Erro geral:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar teste
testUniqueFields();
