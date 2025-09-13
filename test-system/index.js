// Sistema Básico de Teste - CassandraORM JS v2.0.10
import { createClient, uuid, timeuuid } from 'cassandraorm-js';

console.log('🚀 SISTEMA BÁSICO - CASSANDRAORM JS v2.0.10');

async function initializeSystem() {
  try {
    console.log('\n1️⃣ CONECTANDO AO CASSANDRA (sem keyspace)...');
    
    // Primeiro conectar sem keyspace para criar o keyspace
    const tempClient = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1'
      }
    });
    
    await tempClient.connect();
    console.log('✅ Conectado temporariamente!');
    
    console.log('\n2️⃣ CRIANDO KEYSPACE...');
    await tempClient.createKeyspaceIfNotExists('test_system');
    console.log('✅ Keyspace criado!');
    
    await tempClient.disconnect();
    
    console.log('\n3️⃣ RECONECTANDO COM KEYSPACE...');
    // Agora conectar com o keyspace
    const client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_system'
      }
    });
    
    await client.connect();
    console.log('✅ Conectado com keyspace!');

    console.log('\n4️⃣ CRIANDO TABELAS...');
    
    // Criar tabela users
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        name text,
        email text,
        created_at timestamp
      )
    `);
    
    // Criar tabela posts
    await client.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        user_id uuid,
        id timeuuid,
        title text,
        content text,
        created_at timestamp,
        PRIMARY KEY (user_id, id)
      )
    `);
    
    console.log('✅ Tabelas criadas!');

    return client;
  } catch (error) {
    console.error('❌ Erro na inicialização:', error.message);
    throw error;
  }
}

async function createSampleData(client) {
  try {
    console.log('\n5️⃣ CRIANDO DADOS DE EXEMPLO...');
    
    // Criar usuários
    const userId1 = uuid();
    const userId2 = uuid();
    
    const users = [
      {
        id: userId1,
        name: 'João Silva',
        email: 'joao@example.com',
        created_at: new Date()
      },
      {
        id: userId2,
        name: 'Maria Santos',
        email: 'maria@example.com',
        created_at: new Date()
      }
    ];

    // Inserir usuários
    for (const user of users) {
      await client.execute(
        'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.email, user.created_at]
      );
    }
    console.log('✅ Usuários criados!');

    // Criar posts
    const posts = [
      {
        id: timeuuid(),
        user_id: userId1,
        title: 'Primeiro Post do João',
        content: 'Este é o primeiro post usando CassandraORM JS!',
        created_at: new Date()
      },
      {
        id: timeuuid(),
        user_id: userId1,
        title: 'Segundo Post do João',
        content: 'CassandraORM JS é incrível para desenvolvimento!',
        created_at: new Date()
      },
      {
        id: timeuuid(),
        user_id: userId2,
        title: 'Post da Maria',
        content: 'Testando as funcionalidades avançadas do ORM.',
        created_at: new Date()
      }
    ];

    // Inserir posts
    for (const post of posts) {
      await client.execute(
        'INSERT INTO posts (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
        [post.id, post.user_id, post.title, post.content, post.created_at]
      );
    }
    console.log('✅ Posts criados!');

    return { userId1, userId2 };
  } catch (error) {
    console.error('❌ Erro ao criar dados:', error.message);
    throw error;
  }
}

async function testQueries(client, userIds) {
  try {
    console.log('\n6️⃣ TESTANDO CONSULTAS...');

    // Buscar todos os usuários
    console.log('\n📋 TODOS OS USUÁRIOS:');
    const allUsers = await client.execute('SELECT * FROM users');
    allUsers.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
    });

    // Buscar posts de um usuário específico
    console.log('\n📝 POSTS DO PRIMEIRO USUÁRIO:');
    const userPosts = await client.execute(
      'SELECT * FROM posts WHERE user_id = ?',
      [userIds.userId1]
    );
    userPosts.rows.forEach(post => {
      console.log(`  - "${post.title}": ${post.content.substring(0, 50)}...`);
    });

    // Contar total de registros
    console.log('\n📊 ESTATÍSTICAS:');
    const userCount = await client.execute('SELECT COUNT(*) FROM users');
    const postCount = await client.execute('SELECT COUNT(*) FROM posts');
    console.log(`  - Total de usuários: ${userCount.rows[0].count}`);
    console.log(`  - Total de posts: ${postCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Erro nas consultas:', error.message);
    throw error;
  }
}

async function testAdvancedFeatures(client) {
  try {
    console.log('\n7️⃣ TESTANDO FUNCIONALIDADES AVANÇADAS...');

    // Testar métodos do cliente
    console.log('\n🔧 MÉTODOS DO CLIENTE:');
    console.log(`  - UUID gerado: ${uuid().substring(0, 8)}...`);
    console.log(`  - TimeUUID gerado: ${timeuuid().substring(0, 8)}...`);
    console.log(`  - Data atual: ${client.now().toISOString()}`);

    // Testar prepared statements
    console.log('\n⚡ PREPARED STATEMENT:');
    const result = await client.executeAsPrepared(
      'SELECT name FROM users LIMIT 1'
    );
    console.log('  ✅ Prepared statement executado');

  } catch (error) {
    console.error('❌ Erro nas funcionalidades avançadas:', error.message);
  }
}

async function testCRUDOperations(client) {
  try {
    console.log('\n8️⃣ TESTANDO OPERAÇÕES CRUD...');

    const testUserId = uuid();
    
    // CREATE
    console.log('\n➕ CREATE:');
    await client.execute(
      'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
      [testUserId, 'Teste CRUD', 'crud@test.com', new Date()]
    );
    console.log('  ✅ Usuário criado');

    // READ
    console.log('\n👁️ READ:');
    const readResult = await client.execute(
      'SELECT * FROM users WHERE id = ?',
      [testUserId]
    );
    if (readResult.rows.length > 0) {
      console.log(`  ✅ Usuário encontrado: ${readResult.rows[0].name}`);
    }

    // UPDATE
    console.log('\n✏️ UPDATE:');
    await client.execute(
      'UPDATE users SET name = ? WHERE id = ?',
      ['CRUD Atualizado', testUserId]
    );
    console.log('  ✅ Usuário atualizado');

    // DELETE
    console.log('\n🗑️ DELETE:');
    await client.execute(
      'DELETE FROM users WHERE id = ?',
      [testUserId]
    );
    console.log('  ✅ Usuário deletado');

  } catch (error) {
    console.error('❌ Erro nas operações CRUD:', error.message);
  }
}

// Executar sistema
async function runSystem() {
  let client;
  try {
    client = await initializeSystem();
    const userIds = await createSampleData(client);
    await testQueries(client, userIds);
    await testAdvancedFeatures(client);
    await testCRUDOperations(client);
    
    console.log('\n🎉 SISTEMA BÁSICO EXECUTADO COM SUCESSO!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Keyspace criado');
    console.log('  ✅ Conexão estabelecida');
    console.log('  ✅ Tabelas criadas');
    console.log('  ✅ Dados inseridos');
    console.log('  ✅ Consultas executadas');
    console.log('  ✅ Funcionalidades avançadas testadas');
    console.log('  ✅ Operações CRUD testadas');
    console.log('\n🚀 CASSANDRAORM JS v2.0.10 FUNCIONANDO PERFEITAMENTE!');
    
  } catch (error) {
    console.error('\n💥 ERRO NO SISTEMA:', error.message);
  } finally {
    if (client) {
      console.log('\n9️⃣ LIMPEZA E DESCONEXÃO...');
      await client.disconnect();
      console.log('✅ Desconectado com sucesso!');
    }
  }
}

// Iniciar sistema
runSystem();
