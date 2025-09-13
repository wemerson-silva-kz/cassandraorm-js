// Teste de Duplicidade - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔍 TESTE DE DUPLICIDADE - CASSANDRAORM JS v1.0.1');

let client;

async function setupDuplicateTest() {
  try {
    console.log('\n🔧 CONFIGURANDO TESTE DE DUPLICIDADE...');
    
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_system'
      }
    });
    
    await client.connect();
    console.log('✅ Conectado ao keyspace test_system');
    
    // Verificar dados atuais
    const userCount = await client.execute('SELECT COUNT(*) FROM users');
    console.log(`📊 Usuários atuais na tabela: ${userCount.rows[0].count}`);
    
    const postCount = await client.execute('SELECT COUNT(*) FROM posts');
    console.log(`📊 Posts atuais na tabela: ${postCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function testDuplicateUsers() {
  try {
    console.log('\n👥 TESTE 1 - DUPLICIDADE DE USUÁRIOS:');
    
    // Listar usuários existentes
    const existingUsers = await client.execute('SELECT name, email FROM users');
    console.log('📋 Usuários existentes:');
    existingUsers.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.email}`);
    });
    
    // Verificar duplicatas por nome
    const duplicateNames = {};
    existingUsers.rows.forEach(user => {
      if (duplicateNames[user.name]) {
        duplicateNames[user.name]++;
      } else {
        duplicateNames[user.name] = 1;
      }
    });
    
    console.log('\n🔍 Análise de duplicatas por nome:');
    Object.entries(duplicateNames).forEach(([name, count]) => {
      if (count > 1) {
        console.log(`  ❌ DUPLICATA: "${name}" aparece ${count} vezes`);
      } else {
        console.log(`  ✅ ÚNICO: "${name}" aparece 1 vez`);
      }
    });
    
    // Verificar duplicatas por email
    const duplicateEmails = {};
    existingUsers.rows.forEach(user => {
      if (duplicateEmails[user.email]) {
        duplicateEmails[user.email]++;
      } else {
        duplicateEmails[user.email] = 1;
      }
    });
    
    console.log('\n📧 Análise de duplicatas por email:');
    Object.entries(duplicateEmails).forEach(([email, count]) => {
      if (count > 1) {
        console.log(`  ❌ DUPLICATA: "${email}" aparece ${count} vezes`);
      } else {
        console.log(`  ✅ ÚNICO: "${email}" aparece 1 vez`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no teste de usuários:', error.message);
  }
}

async function testDuplicatePosts() {
  try {
    console.log('\n📝 TESTE 2 - DUPLICIDADE DE POSTS:');
    
    // Listar posts existentes
    const existingPosts = await client.execute('SELECT user_id, title, content FROM posts');
    console.log(`📊 Total de posts: ${existingPosts.rows.length}`);
    
    // Verificar duplicatas por título
    const duplicateTitles = {};
    existingPosts.rows.forEach(post => {
      if (duplicateTitles[post.title]) {
        duplicateTitles[post.title]++;
      } else {
        duplicateTitles[post.title] = 1;
      }
    });
    
    console.log('\n🔍 Análise de duplicatas por título:');
    Object.entries(duplicateTitles).forEach(([title, count]) => {
      if (count > 1) {
        console.log(`  ❌ DUPLICATA: "${title}" aparece ${count} vezes`);
      } else {
        console.log(`  ✅ ÚNICO: "${title}" aparece 1 vez`);
      }
    });
    
    // Verificar posts por usuário
    const postsByUser = {};
    existingPosts.rows.forEach(post => {
      const userId = post.user_id.toString();
      if (postsByUser[userId]) {
        postsByUser[userId]++;
      } else {
        postsByUser[userId] = 1;
      }
    });
    
    console.log('\n👤 Posts por usuário:');
    Object.entries(postsByUser).forEach(([userId, count]) => {
      console.log(`  📊 Usuário ${userId.substring(0, 8)}...: ${count} posts`);
    });
    
  } catch (error) {
    console.error('❌ Erro no teste de posts:', error.message);
  }
}

async function testInsertDuplicates() {
  try {
    console.log('\n➕ TESTE 3 - INSERINDO DUPLICATAS INTENCIONAIS:');
    
    // Tentar inserir usuário com mesmo email (deve funcionar pois não há constraint)
    const duplicateUserId = uuid();
    await client.execute(
      'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
      [duplicateUserId, 'João Silva DUPLICATA', 'joao@example.com', new Date()]
    );
    console.log('✅ Usuário duplicata inserido (mesmo email)');
    
    // Verificar se foi inserido
    const duplicateCheck = await client.execute(
      'SELECT name, email FROM users WHERE email = ?',
      ['joao@example.com']
    );
    
    console.log(`📊 Usuários com email 'joao@example.com': ${duplicateCheck.rows.length}`);
    duplicateCheck.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.email}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao inserir duplicatas:', error.message);
  }
}

async function testUniqueConstraints() {
  try {
    console.log('\n🔒 TESTE 4 - TESTANDO CONSTRAINTS ÚNICOS:');
    
    // Tentar inserir com mesmo ID (deve falhar)
    const existingUsers = await client.execute('SELECT id FROM users LIMIT 1');
    if (existingUsers.rows.length > 0) {
      const existingId = existingUsers.rows[0].id;
      
      try {
        await client.execute(
          'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)',
          [existingId, 'Teste ID Duplicado', 'teste@duplicate.com', new Date()]
        );
        console.log('⚠️ ID duplicado foi aceito (não deveria)');
      } catch (error) {
        console.log('✅ ID duplicado rejeitado corretamente:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de constraints:', error.message);
  }
}

async function testDataIntegrity() {
  try {
    console.log('\n🔍 TESTE 5 - INTEGRIDADE DOS DADOS:');
    
    // Verificar integridade referencial entre users e posts
    const allUsers = await client.execute('SELECT id FROM users');
    const allPosts = await client.execute('SELECT user_id FROM posts');
    
    const userIds = new Set(allUsers.rows.map(u => u.id.toString()));
    const postUserIds = allPosts.rows.map(p => p.user_id.toString());
    
    console.log(`📊 Total de usuários únicos: ${userIds.size}`);
    console.log(`📊 Total de posts: ${postUserIds.length}`);
    
    // Verificar posts órfãos
    let orphanPosts = 0;
    postUserIds.forEach(postUserId => {
      if (!userIds.has(postUserId)) {
        orphanPosts++;
        console.log(`⚠️ Post órfão encontrado: user_id ${postUserId.substring(0, 8)}...`);
      }
    });
    
    if (orphanPosts === 0) {
      console.log('✅ Nenhum post órfão encontrado - integridade OK');
    } else {
      console.log(`❌ ${orphanPosts} posts órfãos encontrados`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de integridade:', error.message);
  }
}

async function generateDuplicateReport() {
  try {
    console.log('\n📋 RELATÓRIO FINAL DE DUPLICIDADE:');
    
    // Contar totais
    const userCount = await client.execute('SELECT COUNT(*) FROM users');
    const postCount = await client.execute('SELECT COUNT(*) FROM posts');
    
    // Contar usuários únicos por email
    const uniqueEmails = await client.execute('SELECT DISTINCT email FROM users');
    
    // Contar usuários únicos por nome
    const uniqueNames = await client.execute('SELECT DISTINCT name FROM users');
    
    console.log('📊 ESTATÍSTICAS:');
    console.log(`  - Total de usuários: ${userCount.rows[0].count}`);
    console.log(`  - Emails únicos: ${uniqueEmails.rows.length}`);
    console.log(`  - Nomes únicos: ${uniqueNames.rows.length}`);
    console.log(`  - Total de posts: ${postCount.rows[0].count}`);
    
    const emailDuplicates = userCount.rows[0].count - uniqueEmails.rows.length;
    const nameDuplicates = userCount.rows[0].count - uniqueNames.rows.length;
    
    console.log('\n🔍 DUPLICATAS DETECTADAS:');
    console.log(`  - Duplicatas de email: ${emailDuplicates}`);
    console.log(`  - Duplicatas de nome: ${nameDuplicates}`);
    
    if (emailDuplicates > 0 || nameDuplicates > 0) {
      console.log('⚠️ DUPLICATAS ENCONTRADAS NO SISTEMA');
    } else {
      console.log('✅ NENHUMA DUPLICATA ENCONTRADA');
    }
    
  } catch (error) {
    console.error('❌ Erro no relatório:', error.message);
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 LIMPEZA...');
    if (client) {
      await client.disconnect();
      console.log('✅ Desconectado');
    }
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

async function runDuplicateTests() {
  try {
    await setupDuplicateTest();
    await testDuplicateUsers();
    await testDuplicatePosts();
    await testInsertDuplicates();
    await testUniqueConstraints();
    await testDataIntegrity();
    await generateDuplicateReport();
    
    console.log('\n🎉 TESTE DE DUPLICIDADE CONCLUÍDO!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Duplicatas de usuários analisadas');
    console.log('  ✅ Duplicatas de posts verificadas');
    console.log('  ✅ Inserção de duplicatas testada');
    console.log('  ✅ Constraints únicos verificados');
    console.log('  ✅ Integridade dos dados checada');
    console.log('  ✅ Relatório final gerado');
    console.log('\n🔍 ANÁLISE DE DUPLICIDADE COMPLETA!');
    
  } catch (error) {
    console.error('\n💥 ERRO NO TESTE DE DUPLICIDADE:', error.message);
  } finally {
    await cleanup();
  }
}

// Executar testes de duplicidade
runDuplicateTests();
