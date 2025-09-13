// Limpeza Final Rigorosa - CassandraORM JS v1.0.1
import { createClient, uuid, timeuuid } from 'cassandraorm-js';

console.log('🧹 LIMPEZA FINAL RIGOROSA - v1.0.1');

async function finalClean() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado');
    
    // Limpar completamente
    console.log('\n🗑️ LIMPEZA TOTAL...');
    await client.execute('TRUNCATE users');
    await client.execute('TRUNCATE posts');
    console.log('✅ Todas as tabelas limpas');
    
    // Inserir dados únicos finais
    const user1Id = uuid();
    const user2Id = uuid();
    
    await client.execute(
      'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
      [user1Id, 'João Silva', 'joao@example.com', new Date()]
    );
    
    await client.execute(
      'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
      [user2Id, 'Maria Santos', 'maria@example.com', new Date()]
    );
    
    console.log('✅ 2 usuários únicos inseridos');
    
    // Posts únicos
    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [timeuuid(), user1Id, 'Primeiro Post do João', 'Conteúdo 1', new Date()]
    );
    
    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [timeuuid(), user1Id, 'Segundo Post do João', 'Conteúdo 2', new Date()]
    );
    
    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [timeuuid(), user2Id, 'Post da Maria', 'Conteúdo da Maria', new Date()]
    );
    
    console.log('✅ 3 posts únicos inseridos');
    
    // Verificação final
    const userCount = await client.execute('SELECT COUNT(*) FROM users');
    const postCount = await client.execute('SELECT COUNT(*) FROM posts');
    
    console.log('\n📊 VERIFICAÇÃO FINAL:');
    console.log(`  - Usuários: ${userCount.rows[0].count}`);
    console.log(`  - Posts: ${postCount.rows[0].count}`);
    
    const users = await client.execute('SELECT name, email FROM users');
    console.log('\n👥 USUÁRIOS FINAIS:');
    users.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.email}`);
    });
    
    const posts = await client.execute('SELECT title FROM posts');
    console.log('\n📝 POSTS FINAIS:');
    posts.rows.forEach((post, i) => {
      console.log(`  ${i + 1}. "${post.title}"`);
    });
    
    console.log('\n🎉 LIMPEZA FINAL CONCLUÍDA!');
    console.log('✅ SISTEMA 100% LIMPO SEM DUPLICATAS!');
    
    await client.disconnect();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

finalClean();
