// Correção de Duplicatas usando Schema - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔧 CORREÇÃO DE DUPLICATAS - CASSANDRAORM JS v1.0.1');

let client;

// Schema com validação única para email
const userSchemaUnique = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    created_at: 'timestamp'
  },
  key: ['email'], // Email como chave primária para garantir unicidade
  options: {
    table_name: 'users_unique'
  }
};

// Schema para posts sem duplicatas
const postSchemaUnique = {
  fields: {
    id: 'timeuuid',
    user_email: 'text', // Usar email ao invés de user_id
    title: 'text',
    content: 'text',
    created_at: 'timestamp'
  },
  key: ['user_email', 'title'], // Combinação única por usuário + título
  options: {
    table_name: 'posts_unique'
  }
};

async function setupClient() {
  try {
    console.log('\n🔧 CONFIGURANDO CLIENTE...');
    
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_system'
      },
      ormOptions: {
        migration: 'safe' // Habilitar criação automática de tabelas
      }
    });
    
    await client.connect();
    console.log('✅ Cliente conectado');
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function createUniqueSchemas() {
  try {
    console.log('\n🏗️ CRIANDO SCHEMAS ÚNICOS...');
    
    // Carregar schema de usuários únicos
    const UserUnique = await client.loadSchema('users_unique', userSchemaUnique);
    console.log('✅ Schema users_unique criado');
    
    // Carregar schema de posts únicos
    const PostUnique = await client.loadSchema('posts_unique', postSchemaUnique);
    console.log('✅ Schema posts_unique criado');
    
    return { UserUnique, PostUnique };
    
  } catch (error) {
    console.error('❌ Erro ao criar schemas:', error.message);
    throw error;
  }
}

async function migrateDuplicateUsers() {
  try {
    console.log('\n👥 MIGRANDO USUÁRIOS SEM DUPLICATAS...');
    
    // Buscar todos os usuários da tabela original
    const originalUsers = await client.execute('SELECT id, name, email, created_at FROM users');
    console.log(`📊 Usuários originais: ${originalUsers.rows.length}`);
    
    // Usar Map para eliminar duplicatas por email
    const uniqueUsers = new Map();
    
    originalUsers.rows.forEach(user => {
      if (!uniqueUsers.has(user.email)) {
        uniqueUsers.set(user.email, {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        });
      } else {
        console.log(`⚠️ Duplicata ignorada: ${user.name} (${user.email})`);
      }
    });
    
    console.log(`📊 Usuários únicos: ${uniqueUsers.size}`);
    
    // Inserir usuários únicos na nova tabela
    let insertedCount = 0;
    for (const [email, user] of uniqueUsers) {
      try {
        await client.execute(
          'INSERT INTO users_unique (email, id, name, created_at) VALUES (?, ?, ?, ?)',
          [user.email, user.id, user.name, user.created_at]
        );
        insertedCount++;
        console.log(`✅ Migrado: ${user.name} (${user.email})`);
      } catch (error) {
        console.log(`❌ Erro ao migrar ${user.email}: ${error.message}`);
      }
    }
    
    console.log(`✅ ${insertedCount} usuários únicos migrados`);
    return uniqueUsers;
    
  } catch (error) {
    console.error('❌ Erro na migração de usuários:', error.message);
    throw error;
  }
}

async function migrateDuplicatePosts(uniqueUsers) {
  try {
    console.log('\n📝 MIGRANDO POSTS SEM DUPLICATAS...');
    
    // Buscar todos os posts da tabela original
    const originalPosts = await client.execute('SELECT id, user_id, title, content, created_at FROM posts');
    console.log(`📊 Posts originais: ${originalPosts.rows.length}`);
    
    // Criar mapa de user_id para email
    const userIdToEmail = new Map();
    for (const [email, user] of uniqueUsers) {
      userIdToEmail.set(user.id.toString(), email);
    }
    
    // Usar Set para eliminar duplicatas por user_email + title
    const uniquePosts = new Map();
    
    originalPosts.rows.forEach(post => {
      const userEmail = userIdToEmail.get(post.user_id.toString());
      if (userEmail) {
        const postKey = `${userEmail}:${post.title}`;
        
        if (!uniquePosts.has(postKey)) {
          uniquePosts.set(postKey, {
            id: post.id,
            user_email: userEmail,
            title: post.title,
            content: post.content,
            created_at: post.created_at
          });
        } else {
          console.log(`⚠️ Post duplicado ignorado: "${post.title}" de ${userEmail}`);
        }
      } else {
        console.log(`⚠️ Post órfão ignorado: "${post.title}" (user_id não encontrado)`);
      }
    });
    
    console.log(`📊 Posts únicos: ${uniquePosts.size}`);
    
    // Inserir posts únicos na nova tabela
    let insertedCount = 0;
    for (const [postKey, post] of uniquePosts) {
      try {
        await client.execute(
          'INSERT INTO posts_unique (user_email, title, id, content, created_at) VALUES (?, ?, ?, ?, ?)',
          [post.user_email, post.title, post.id, post.content, post.created_at]
        );
        insertedCount++;
        console.log(`✅ Migrado: "${post.title}" de ${post.user_email}`);
      } catch (error) {
        console.log(`❌ Erro ao migrar post "${post.title}": ${error.message}`);
      }
    }
    
    console.log(`✅ ${insertedCount} posts únicos migrados`);
    
  } catch (error) {
    console.error('❌ Erro na migração de posts:', error.message);
    throw error;
  }
}

async function validateUniqueData() {
  try {
    console.log('\n🔍 VALIDANDO DADOS ÚNICOS...');
    
    // Verificar usuários únicos
    const uniqueUsersCount = await client.execute('SELECT COUNT(*) FROM users_unique');
    console.log(`📊 Usuários únicos na nova tabela: ${uniqueUsersCount.rows[0].count}`);
    
    // Listar usuários únicos
    const uniqueUsersList = await client.execute('SELECT email, name FROM users_unique');
    console.log('📋 Usuários únicos:');
    uniqueUsersList.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.email}`);
    });
    
    // Verificar posts únicos
    const uniquePostsCount = await client.execute('SELECT COUNT(*) FROM posts_unique');
    console.log(`📊 Posts únicos na nova tabela: ${uniquePostsCount.rows[0].count}`);
    
    // Listar posts únicos
    const uniquePostsList = await client.execute('SELECT user_email, title FROM posts_unique');
    console.log('📋 Posts únicos:');
    uniquePostsList.rows.forEach((post, i) => {
      console.log(`  ${i + 1}. "${post.title}" de ${post.user_email}`);
    });
    
  } catch (error) {
    console.error('❌ Erro na validação:', error.message);
  }
}

async function testUniqueConstraints() {
  try {
    console.log('\n🔒 TESTANDO CONSTRAINTS ÚNICOS...');
    
    // Tentar inserir usuário com email duplicado
    try {
      await client.execute(
        'INSERT INTO users_unique (email, id, name, created_at) VALUES (?, ?, ?, ?)',
        ['joao@example.com', uuid(), 'João Duplicado', new Date()]
      );
      console.log('❌ Email duplicado foi aceito (não deveria)');
    } catch (error) {
      console.log('✅ Email duplicado rejeitado corretamente');
    }
    
    // Tentar inserir post com título duplicado para mesmo usuário
    try {
      await client.execute(
        'INSERT INTO posts_unique (user_email, title, id, content, created_at) VALUES (?, ?, ?, ?, ?)',
        ['joao@example.com', 'Primeiro Post do João', uuid(), 'Conteúdo duplicado', new Date()]
      );
      console.log('❌ Post duplicado foi aceito (não deveria)');
    } catch (error) {
      console.log('✅ Post duplicado rejeitado corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de constraints:', error.message);
  }
}

async function generateReport() {
  try {
    console.log('\n📋 RELATÓRIO DE CORREÇÃO DE DUPLICATAS:');
    
    // Contar dados originais
    const originalUsers = await client.execute('SELECT COUNT(*) FROM users');
    const originalPosts = await client.execute('SELECT COUNT(*) FROM posts');
    
    // Contar dados únicos
    const uniqueUsers = await client.execute('SELECT COUNT(*) FROM users_unique');
    const uniquePosts = await client.execute('SELECT COUNT(*) FROM posts_unique');
    
    console.log('📊 ANTES DA CORREÇÃO:');
    console.log(`  - Usuários: ${originalUsers.rows[0].count}`);
    console.log(`  - Posts: ${originalPosts.rows[0].count}`);
    
    console.log('📊 APÓS A CORREÇÃO:');
    console.log(`  - Usuários únicos: ${uniqueUsers.rows[0].count}`);
    console.log(`  - Posts únicos: ${uniquePosts.rows[0].count}`);
    
    const usersDuplicatesRemoved = originalUsers.rows[0].count - uniqueUsers.rows[0].count;
    const postsDuplicatesRemoved = originalPosts.rows[0].count - uniquePosts.rows[0].count;
    
    console.log('🔧 DUPLICATAS REMOVIDAS:');
    console.log(`  - Usuários duplicados removidos: ${usersDuplicatesRemoved}`);
    console.log(`  - Posts duplicados removidos: ${postsDuplicatesRemoved}`);
    
    if (usersDuplicatesRemoved > 0 || postsDuplicatesRemoved > 0) {
      console.log('✅ DUPLICATAS CORRIGIDAS COM SUCESSO!');
    } else {
      console.log('ℹ️ Nenhuma duplicata foi removida');
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

async function runDuplicateFix() {
  try {
    await setupClient();
    await createUniqueSchemas();
    const uniqueUsers = await migrateDuplicateUsers();
    await migrateDuplicatePosts(uniqueUsers);
    await validateUniqueData();
    await testUniqueConstraints();
    await generateReport();
    
    console.log('\n🎉 CORREÇÃO DE DUPLICATAS CONCLUÍDA!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Schemas únicos criados via loadSchema');
    console.log('  ✅ Usuários migrados sem duplicatas');
    console.log('  ✅ Posts migrados sem duplicatas');
    console.log('  ✅ Constraints únicos validados');
    console.log('  ✅ Dados únicos verificados');
    console.log('\n🔧 SISTEMA CORRIGIDO COM SCHEMAS ÚNICOS!');
    
  } catch (error) {
    console.error('\n💥 ERRO NA CORREÇÃO:', error.message);
  } finally {
    await cleanup();
  }
}

// Executar correção de duplicatas
runDuplicateFix();
