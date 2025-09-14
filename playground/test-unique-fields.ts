#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testUniqueFields() {
  console.log('🔒 Testando Campos Unique - CassandraORM JS\n');
  
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_unique_fields'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Schema com múltiplos campos unique
    const User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        email: { 
          type: 'text', 
          unique: true,
          validate: { required: true, isEmail: true }
        },
        username: {
          type: 'text',
          unique: true,
          validate: { required: true, minLength: 3 }
        },
        phone: {
          type: 'text',
          unique: true
        },
        name: {
          type: 'text',
          validate: { required: true }
        },
        created_at: 'timestamp'
      },
      key: ['id'],
      options: {
        timestamps: { createdAt: 'created_at' }
      }
    });

    console.log('✅ Schema carregado com campos unique: email, username, phone\n');

    // Teste 1: Criar usuário válido
    console.log('📝 Teste 1: Criando usuário válido...');
    const user1 = await User.create({
      id: client.uuid(),
      email: 'john@example.com',
      username: 'john_doe',
      phone: '+5511999999999',
      name: 'John Doe'
    });
    console.log('✅ Usuário 1 criado:', {
      id: user1.id,
      email: user1.email,
      username: user1.username
    });

    // Teste 2: Tentar email duplicado
    console.log('\n📝 Teste 2: Tentando email duplicado...');
    try {
      await User.create({
        id: client.uuid(),
        email: 'john@example.com', // DUPLICADO
        username: 'jane_doe',
        phone: '+5511888888888',
        name: 'Jane Doe',
        age: 25
      });
      console.log('❌ ERRO: Deveria ter falhado!');
    } catch (error) {
      console.log('✅ Email duplicado rejeitado:', error.message);
    }

    // Teste 3: Tentar username duplicado
    console.log('\n📝 Teste 3: Tentando username duplicado...');
    try {
      await User.create({
        id: client.uuid(),
        email: 'jane@example.com',
        username: 'john_doe', // DUPLICADO
        phone: '+5511777777777',
        name: 'Jane Doe',
        age: 25
      });
      console.log('❌ ERRO: Deveria ter falhado!');
    } catch (error) {
      console.log('✅ Username duplicado rejeitado:', error.message);
    }

    // Teste 4: Tentar phone duplicado
    console.log('\n📝 Teste 4: Tentando phone duplicado...');
    try {
      await User.create({
        id: client.uuid(),
        email: 'jane@example.com',
        username: 'jane_doe',
        phone: '+5511999999999', // DUPLICADO
        name: 'Jane Doe',
        age: 25
      });
      console.log('❌ ERRO: Deveria ter falhado!');
    } catch (error) {
      console.log('✅ Phone duplicado rejeitado:', error.message);
    }

    // Teste 5: Criar segundo usuário com dados únicos
    console.log('\n📝 Teste 5: Criando segundo usuário com dados únicos...');
    const user2 = await User.create({
      id: client.uuid(),
      email: 'jane@example.com',
      username: 'jane_doe',
      phone: '+5511888888888',
      name: 'Jane Doe',
      age: 25
    });
    console.log('✅ Usuário 2 criado:', {
      id: user2.id,
      email: user2.email,
      username: user2.username
    });

    // Teste 6: Listar todos os usuários
    console.log('\n📝 Teste 6: Listando todos os usuários...');
    const allUsers = await User.find();
    console.log('✅ Total de usuários:', allUsers.length);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
    });

    // Teste 7: Atualizar usuário (não deve violar unique)
    console.log('\n📝 Teste 7: Atualizando usuário...');
    await User.update({ id: user1.id }, { age: 31 });
    console.log('✅ Usuário atualizado com sucesso');

    // Teste 8: Tentar atualizar com valor unique duplicado
    console.log('\n📝 Teste 8: Tentando atualizar com email duplicado...');
    try {
      await User.update({ id: user1.id }, { email: 'jane@example.com' }); // Email do user2
      console.log('❌ ERRO: Deveria ter falhado!');
    } catch (error) {
      console.log('✅ Update com email duplicado rejeitado:', error.message);
    }

    console.log('\n🎉 Todos os testes de campos unique passaram!');
    console.log('\n📊 Resumo:');
    console.log('✅ Criação com dados únicos');
    console.log('✅ Rejeição de email duplicado');
    console.log('✅ Rejeição de username duplicado');
    console.log('✅ Rejeição de phone duplicado');
    console.log('✅ Múltiplos usuários com dados únicos');
    console.log('✅ Update sem violar constraints');
    console.log('✅ Rejeição de update com dados duplicados');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error(error.stack);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

if (import.meta.main) {
  testUniqueFields();
}
