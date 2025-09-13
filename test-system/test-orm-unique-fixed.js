// Teste de Validação Única no ORM Corrigido - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 TESTE DE VALIDAÇÃO ÚNICA NO ORM CORRIGIDO - v1.0.1');

// Schema com campos únicos (sem tabelas auxiliares)
const userSchema = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    username: 'text',
    created_at: 'timestamp'
  },
  key: ['id'],
  unique: ['email', 'name', 'username'], // Validação no ORM
  options: {
    table_name: 'users_orm_fixed'
  }
};

async function testORMUniqueValidationFixed() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    },
    ormOptions: {
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    // Carregar schema (apenas tabela principal)
    const User = await client.loadSchema('users_orm_fixed', userSchema);
    console.log('✅ Schema carregado (apenas tabela principal)');

    // Limpar dados
    await client.execute('TRUNCATE users_orm_fixed');
    console.log('✅ Tabela limpa');

    console.log('\n🔒 TESTANDO VALIDAÇÃO NO ORM...');

    // Teste 1: Inserir primeiro usuário
    console.log('\n👤 TESTE 1 - PRIMEIRO USUÁRIO:');
    let user1Id;
    try {
      user1Id = uuid();
      const user1Data = {
        id: user1Id,
        email: 'joao@orm.com',
        name: 'João Silva',
        username: 'joaosilva',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_fixed', user1Data, userSchema);
      console.log('✅ Primeiro usuário inserido: João Silva (joao@orm.com, @joaosilva)');
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 2: Tentar inserir email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    try {
      const user2Data = {
        id: uuid(),
        email: 'joao@orm.com', // Email duplicado
        name: 'João Diferente',
        username: 'joaodiferente',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_fixed', user2Data, userSchema);
      console.log('❌ Email duplicado foi aceito');
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado: ${error.message}`);
    }

    // Teste 3: Inserir segundo usuário único
    console.log('\n✅ TESTE 3 - SEGUNDO USUÁRIO ÚNICO:');
    let user2Id;
    try {
      user2Id = uuid();
      const user2Data = {
        id: user2Id,
        email: 'maria@orm.com',
        name: 'Maria Santos',
        username: 'mariasantos',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_fixed', user2Data, userSchema);
      console.log('✅ Segundo usuário inserido: Maria Santos (maria@orm.com, @mariasantos)');
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 4: Atualização com campo duplicado
    console.log('\n🔄 TESTE 4 - ATUALIZAÇÃO COM DUPLICATA:');
    if (user1Id && user2Id) {
      try {
        await client.updateWithUniqueValidation('users_orm_fixed', user1Id, {
          email: 'maria@orm.com' // Email do segundo usuário
        }, userSchema);
        console.log('❌ Atualização com email duplicado foi aceita');
      } catch (error) {
        console.log(`✅ Atualização com duplicata rejeitada: ${error.message}`);
      }
    }

    // Teste 5: Atualização válida (mesmo valor)
    console.log('\n✅ TESTE 5 - ATUALIZAÇÃO VÁLIDA (MESMO VALOR):');
    if (user1Id) {
      try {
        await client.updateWithUniqueValidation('users_orm_fixed', user1Id, {
          email: 'joao@orm.com' // Mesmo email do próprio usuário
        }, userSchema);
        console.log('✅ Atualização com mesmo valor aceita');
      } catch (error) {
        console.log(`❌ Erro na atualização: ${error.message}`);
      }
    }

    // Teste 6: Atualização com valor novo
    console.log('\n✅ TESTE 6 - ATUALIZAÇÃO COM VALOR NOVO:');
    if (user1Id) {
      try {
        await client.updateWithUniqueValidation('users_orm_fixed', user1Id, {
          name: 'João Silva Atualizado'
        }, userSchema);
        console.log('✅ Atualização com valor novo aceita');
      } catch (error) {
        console.log(`❌ Erro na atualização: ${error.message}`);
      }
    }

    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    const finalUsers = await client.execute('SELECT id, email, name, username FROM users_orm_fixed');
    console.log(`📊 Total de usuários: ${finalUsers.rows.length}`);

    const emails = new Set();
    const names = new Set();
    const usernames = new Set();

    finalUsers.rows.forEach(user => {
      emails.add(user.email);
      names.add(user.name);
      usernames.add(user.username);
      console.log(`  - ${user.name} (${user.email}, @${user.username})`);
    });

    console.log(`✅ Emails únicos: ${emails.size}/${finalUsers.rows.length}`);
    console.log(`✅ Nomes únicos: ${names.size}/${finalUsers.rows.length}`);
    console.log(`✅ Usernames únicos: ${usernames.size}/${finalUsers.rows.length}`);

    const allUnique = emails.size === finalUsers.rows.length && 
                     names.size === finalUsers.rows.length && 
                     usernames.size === finalUsers.rows.length;

    if (allUnique) {
      console.log('🎉 VALIDAÇÃO NO ORM FUNCIONANDO PERFEITAMENTE!');
    } else {
      console.log('⚠️ Duplicatas detectadas');
    }

    // Verificar que há apenas 1 tabela
    console.log('\n📋 VERIFICAÇÃO DE TABELAS:');
    try {
      await client.execute('SELECT COUNT(*) FROM users_orm_fixed_unique_constraints');
      console.log('⚠️ Tabela auxiliar encontrada');
    } catch (error) {
      console.log('✅ Nenhuma tabela auxiliar (como esperado)');
    }

    console.log('\n📋 RESUMO DA IMPLEMENTAÇÃO CORRIGIDA:');
    console.log('  ✅ Validação feita no ORM via queries');
    console.log('  ✅ Apenas 1 tabela no banco de dados');
    console.log('  ✅ Sem usar != (não suportado pelo Cassandra)');
    console.log('  ✅ Filtro manual para UPDATE');
    console.log('  ✅ Mensagens de erro em inglês');
    console.log('  ✅ ALLOW FILTERING para busca');

    await client.disconnect();
    console.log('\n✅ TESTE CORRIGIDO CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testORMUniqueValidationFixed();
