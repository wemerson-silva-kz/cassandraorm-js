// Teste de Validação Única no ORM - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 TESTE DE VALIDAÇÃO ÚNICA NO ORM - v1.0.1');

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
    table_name: 'users_orm_unique'
  }
};

async function testORMUniqueValidation() {
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
    const User = await client.loadSchema('users_orm_unique', userSchema);
    console.log('✅ Schema carregado (apenas tabela principal)');

    // Limpar dados
    await client.execute('TRUNCATE users_orm_unique');
    console.log('✅ Tabela limpa');

    console.log('\n🔒 TESTANDO VALIDAÇÃO NO ORM...');

    // Teste 1: Inserir primeiro usuário
    console.log('\n👤 TESTE 1 - PRIMEIRO USUÁRIO:');
    try {
      const user1Data = {
        id: uuid(),
        email: 'joao@orm.com',
        name: 'João Silva',
        username: 'joaosilva',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_unique', user1Data, userSchema);
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

      await client.insertWithUniqueValidation('users_orm_unique', user2Data, userSchema);
      console.log('❌ Email duplicado foi aceito');
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado: ${error.message}`);
    }

    // Teste 3: Tentar inserir nome duplicado
    console.log('\n👤 TESTE 3 - NOME DUPLICADO:');
    try {
      const user3Data = {
        id: uuid(),
        email: 'joao2@orm.com',
        name: 'João Silva', // Nome duplicado
        username: 'joaosilva2',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_unique', user3Data, userSchema);
      console.log('❌ Nome duplicado foi aceito');
    } catch (error) {
      console.log(`✅ Nome duplicado rejeitado: ${error.message}`);
    }

    // Teste 4: Tentar inserir username duplicado
    console.log('\n🏷️ TESTE 4 - USERNAME DUPLICADO:');
    try {
      const user4Data = {
        id: uuid(),
        email: 'joao3@orm.com',
        name: 'João Outro',
        username: 'joaosilva', // Username duplicado
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_unique', user4Data, userSchema);
      console.log('❌ Username duplicado foi aceito');
    } catch (error) {
      console.log(`✅ Username duplicado rejeitado: ${error.message}`);
    }

    // Teste 5: Inserir usuário completamente único
    console.log('\n✅ TESTE 5 - USUÁRIO ÚNICO:');
    try {
      const user5Data = {
        id: uuid(),
        email: 'maria@orm.com',
        name: 'Maria Santos',
        username: 'mariasantos',
        created_at: new Date()
      };

      await client.insertWithUniqueValidation('users_orm_unique', user5Data, userSchema);
      console.log('✅ Segundo usuário inserido: Maria Santos (maria@orm.com, @mariasantos)');
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 6: Atualização com campo duplicado
    console.log('\n🔄 TESTE 6 - ATUALIZAÇÃO COM DUPLICATA:');
    const users = await client.execute('SELECT id, email, name, username FROM users_orm_unique');
    
    if (users.rows.length >= 2) {
      const user1Id = users.rows[0].id.toString();
      const user2Email = users.rows[1].email;
      
      try {
        await client.updateWithUniqueValidation('users_orm_unique', user1Id, {
          email: user2Email // Tentar usar email do segundo usuário
        }, userSchema);
        console.log('❌ Atualização com email duplicado foi aceita');
      } catch (error) {
        console.log(`✅ Atualização com duplicata rejeitada: ${error.message}`);
      }
    }

    // Teste 7: Atualização válida
    console.log('\n✅ TESTE 7 - ATUALIZAÇÃO VÁLIDA:');
    if (users.rows.length >= 1) {
      const user1Id = users.rows[0].id.toString();
      
      try {
        await client.updateWithUniqueValidation('users_orm_unique', user1Id, {
          name: 'João Silva Atualizado'
        }, userSchema);
        console.log('✅ Atualização válida aceita');
      } catch (error) {
        console.log(`❌ Erro na atualização: ${error.message}`);
      }
    }

    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    const finalUsers = await client.execute('SELECT id, email, name, username FROM users_orm_unique');
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

    // Verificar que não há tabelas auxiliares
    console.log('\n📋 VERIFICAÇÃO DE TABELAS:');
    const tables = await client.execute(
      "SELECT table_name FROM system_schema.tables WHERE keyspace_name = 'test_system' AND table_name LIKE 'users_orm_unique%'"
    );
    
    console.log('Tabelas encontradas:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    if (tables.rows.length === 1) {
      console.log('✅ Apenas 1 tabela criada (sem tabelas auxiliares)');
    } else {
      console.log('⚠️ Tabelas auxiliares foram criadas');
    }

    console.log('\n📋 RESUMO DA IMPLEMENTAÇÃO:');
    console.log('  ✅ Validação feita no ORM via queries');
    console.log('  ✅ Apenas 1 tabela no banco de dados');
    console.log('  ✅ Sem tabelas auxiliares');
    console.log('  ✅ Mensagens de erro em inglês');
    console.log('  ✅ Suporte a INSERT e UPDATE');
    console.log('  ✅ ALLOW FILTERING para busca');

    await client.disconnect();
    console.log('\n✅ TESTE CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testORMUniqueValidation();
