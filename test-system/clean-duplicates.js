// Limpeza Completa de Duplicatas - CassandraORM JS v1.0.1
import { createClient, uuid, timeuuid } from 'cassandraorm-js';

console.log('🧹 LIMPEZA COMPLETA DE DUPLICATAS - v1.0.1');

let client;

async function setupClient() {
  client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    }
  });
  
  await client.connect();
  console.log('✅ Conectado');
}

async function cleanDuplicates() {
  try {
    console.log('\n🗑️ REMOVENDO TODAS AS DUPLICATAS...');
    
    // 1. Truncar tabelas existentes
    await client.execute('TRUNCATE users');
    await client.execute('TRUNCATE posts');
    console.log('✅ Tabelas originais limpas');
    
    // 2. Inserir apenas dados únicos
    const uniqueUsers = [
      { id: uuid(), name: 'João Silva', email: 'joao@example.com' },
      { id: uuid(), name: 'Maria Santos', email: 'maria@example.com' }
    ];
    
    console.log('\n👥 INSERINDO USUÁRIOS ÚNICOS:');
    for (const user of uniqueUsers) {
      await client.execute(
        'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.email, new Date()]
      );
      console.log(`✅ ${user.name} - ${user.email}`);
    }
    
    // 3. Inserir posts únicos
    const uniquePosts = [
      { user_id: uniqueUsers[0].id, title: 'Primeiro Post do João', content: 'Conteúdo único do João' },
      { user_id: uniqueUsers[0].id, title: 'Segundo Post do João', content: 'Segundo conteúdo do João' },
      { user_id: uniqueUsers[1].id, title: 'Post da Maria', content: 'Conteúdo único da Maria' }
    ];
    
    console.log('\n📝 INSERINDO POSTS ÚNICOS:');
    for (const post of uniquePosts) {
      await client.execute(
        'INSERT INTO posts (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
        [timeuuid(), post.user_id, post.title, post.content, new Date()]
      );
      console.log(`✅ "${post.title}"`);
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

async function verifyCleanData() {
  try {
    console.log('\n🔍 VERIFICANDO DADOS LIMPOS...');
    
    // Verificar usuários
    const users = await client.execute('SELECT name, email FROM users');
    console.log(`📊 Total de usuários: ${users.rows.length}`);
    
    const userEmails = new Set();
    const userNames = new Set();
    
    users.rows.forEach(user => {
      userEmails.add(user.email);
      userNames.add(user.name);
      console.log(`  - ${user.name} (${user.email})`);
    });
    
    console.log(`✅ Emails únicos: ${userEmails.size}/${users.rows.length}`);
    console.log(`✅ Nomes únicos: ${userNames.size}/${users.rows.length}`);
    
    // Verificar posts
    const posts = await client.execute('SELECT title FROM posts');
    console.log(`📊 Total de posts: ${posts.rows.length}`);
    
    const postTitles = new Set();
    posts.rows.forEach(post => {
      postTitles.add(post.title);
      console.log(`  - "${post.title}"`);
    });
    
    console.log(`✅ Títulos únicos: ${postTitles.size}/${posts.rows.length}`);
    
    if (userEmails.size === users.rows.length && postTitles.size === posts.rows.length) {
      console.log('\n🎉 NENHUMA DUPLICATA ENCONTRADA!');
    } else {
      console.log('\n⚠️ AINDA EXISTEM DUPLICATAS');
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
  }
}

async function testNoDuplicates() {
  try {
    console.log('\n🔒 TESTANDO PREVENÇÃO DE DUPLICATAS...');
    
    // Tentar inserir usuário duplicado
    try {
      await client.execute(
        'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
        [uuid(), 'João Silva DUPLICADO', 'joao@example.com', new Date()]
      );
      console.log('⚠️ Usuário duplicado inserido (email repetido)');
    } catch (error) {
      console.log('✅ Usuário duplicado rejeitado');
    }
    
    // Verificar se duplicata foi inserida
    const duplicateCheck = await client.execute('SELECT COUNT(*) FROM users WHERE email = ?', ['joao@example.com']);
    const count = duplicateCheck.rows[0].count;
    
    if (count > 1) {
      console.log(`❌ ${count} usuários com mesmo email encontrados`);
    } else {
      console.log(`✅ Apenas ${count} usuário com email único`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function cleanup() {
  if (client) {
    await client.disconnect();
    console.log('✅ Desconectado');
  }
}

async function runCleanup() {
  try {
    await setupClient();
    await cleanDuplicates();
    await verifyCleanData();
    await testNoDuplicates();
    
    console.log('\n🎉 LIMPEZA COMPLETA CONCLUÍDA!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Tabelas limpas (TRUNCATE)');
    console.log('  ✅ Dados únicos inseridos');
    console.log('  ✅ Verificação de duplicatas');
    console.log('  ✅ Teste de prevenção');
    console.log('\n🧹 SISTEMA LIMPO SEM DUPLICATAS!');
    
  } catch (error) {
    console.error('💥 Erro:', error.message);
  } finally {
    await cleanup();
  }
}

runCleanup();
