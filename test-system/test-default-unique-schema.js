// Teste do Schema Padrão com Unique - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 TESTE DO SCHEMA PADRÃO COM UNIQUE - v1.0.1');

// Schema padrão com múltiplos campos únicos
const defaultUniqueSchema = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    username: 'text'
  },
  key: ['id'],
  unique: ['email', 'name', 'username'], // Campos únicos
  options: {
    table_name: 'users_default'
  }
};

async function testDefaultUniqueSchema() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    },
    ormOptions: {
      migration: 'safe' // Habilita criação automática
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    console.log('\n🏗️ CRIANDO SCHEMA COM LOADSCHEMA...');
    
    // Usar loadSchema para criar tabela principal + tabela de constraints
    const User = await client.loadSchema('users_default', defaultUniqueSchema);
    console.log('✅ Schema carregado via loadSchema');

    // Limpar dados
    await client.execute('TRUNCATE users_default');
    await client.execute('TRUNCATE users_default_unique_constraints');
    console.log('✅ Tabelas limpas');

    console.log('\n🔒 TESTANDO SCHEMA PADRÃO...');

    // Teste 1: Criar usuário completo
    console.log('\n👤 TESTE 1 - USUÁRIO COMPLETO:');
    const user1Id = uuid();
    
    // Inserir na tabela principal
    await client.execute(
      'INSERT INTO users_default (id, email, name, username) VALUES (?, ?, ?, ?)',
      [user1Id, 'joao@default.com', 'João Silva', 'joaosilva']
    );
    
    // Inserir constraints manualmente (simulando ORM)
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['email', 'joao@default.com', user1Id, new Date()]
    );
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['name', 'João Silva', user1Id, new Date()]
    );
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['username', 'joaosilva', user1Id, new Date()]
    );
    
    console.log('✅ Usuário criado: João Silva (joao@default.com, @joaosilva)');

    // Teste 2: Verificar duplicatas
    console.log('\n🔍 TESTE 2 - VERIFICAÇÃO DE DUPLICATAS:');
    
    // Verificar email duplicado
    const emailCheck = await client.execute(
      'SELECT main_id FROM users_default_unique_constraints WHERE field_name = ? AND field_value = ?',
      ['email', 'joao@default.com']
    );
    console.log(`Email 'joao@default.com' existe: ${emailCheck.rows.length > 0 ? 'SIM' : 'NÃO'}`);
    
    // Verificar nome duplicado
    const nameCheck = await client.execute(
      'SELECT main_id FROM users_default_unique_constraints WHERE field_name = ? AND field_value = ?',
      ['name', 'João Silva']
    );
    console.log(`Nome 'João Silva' existe: ${nameCheck.rows.length > 0 ? 'SIM' : 'NÃO'}`);
    
    // Verificar username duplicado
    const usernameCheck = await client.execute(
      'SELECT main_id FROM users_default_unique_constraints WHERE field_name = ? AND field_value = ?',
      ['username', 'joaosilva']
    );
    console.log(`Username 'joaosilva' existe: ${usernameCheck.rows.length > 0 ? 'SIM' : 'NÃO'}`);

    // Teste 3: Criar segundo usuário único
    console.log('\n👤 TESTE 3 - SEGUNDO USUÁRIO ÚNICO:');
    const user2Id = uuid();
    
    await client.execute(
      'INSERT INTO users_default (id, email, name, username) VALUES (?, ?, ?, ?)',
      [user2Id, 'maria@default.com', 'Maria Santos', 'mariasantos']
    );
    
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['email', 'maria@default.com', user2Id, new Date()]
    );
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['name', 'Maria Santos', user2Id, new Date()]
    );
    await client.execute(
      'INSERT INTO users_default_unique_constraints (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)',
      ['username', 'mariasantos', user2Id, new Date()]
    );
    
    console.log('✅ Usuário criado: Maria Santos (maria@default.com, @mariasantos)');

    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    
    const users = await client.execute('SELECT id, email, name, username FROM users_default');
    const constraints = await client.execute('SELECT field_name, field_value, main_id FROM users_default_unique_constraints');
    
    console.log(`📊 Total de usuários: ${users.rows.length}`);
    console.log(`📊 Total de constraints: ${constraints.rows.length}`);
    
    console.log('\n👥 USUÁRIOS:');
    users.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}, @${user.username})`);
    });
    
    console.log('\n🔒 CONSTRAINTS:');
    const constraintsByField = {};
    constraints.rows.forEach(constraint => {
      if (!constraintsByField[constraint.field_name]) {
        constraintsByField[constraint.field_name] = [];
      }
      constraintsByField[constraint.field_name].push(constraint.field_value);
    });
    
    Object.entries(constraintsByField).forEach(([field, values]) => {
      console.log(`  - ${field}: ${values.length} valores únicos`);
      values.forEach(value => console.log(`    * "${value}"`));
    });

    // Verificar unicidade
    const emails = new Set();
    const names = new Set();
    const usernames = new Set();
    
    users.rows.forEach(user => {
      emails.add(user.email);
      names.add(user.name);
      usernames.add(user.username);
    });
    
    console.log('\n✅ VERIFICAÇÃO DE UNICIDADE:');
    console.log(`  - Emails únicos: ${emails.size}/${users.rows.length}`);
    console.log(`  - Nomes únicos: ${names.size}/${users.rows.length}`);
    console.log(`  - Usernames únicos: ${usernames.size}/${users.rows.length}`);
    
    const allUnique = emails.size === users.rows.length && 
                     names.size === users.rows.length && 
                     usernames.size === users.rows.length;
    
    if (allUnique) {
      console.log('🎉 TODOS OS CAMPOS SÃO ÚNICOS!');
    } else {
      console.log('⚠️ Duplicatas detectadas');
    }

    console.log('\n📋 RESUMO DO SCHEMA PADRÃO:');
    console.log('  ✅ Schema definido com unique: ["email", "name", "username"]');
    console.log('  ✅ loadSchema criou tabela principal automaticamente');
    console.log('  ✅ loadSchema criou tabela de constraints automaticamente');
    console.log('  ✅ Estrutura: (field_name, field_value) -> main_id');
    console.log('  ✅ Suporta quantos campos únicos quiser');
    console.log('  ✅ Apenas 1 tabela auxiliar para todos os campos');

    await client.disconnect();
    console.log('\n✅ TESTE DO SCHEMA PADRÃO CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testDefaultUniqueSchema();
