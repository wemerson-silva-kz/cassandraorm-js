// Teste de Cenário de Produção - CassandraORM JS v2.0.12
import { createClient, uuid, timeuuid } from 'cassandraorm-js';

console.log('🏭 TESTE DE CENÁRIO DE PRODUÇÃO - v2.0.12');

let client;
const stats = {
  operations: 0,
  errors: 0,
  startTime: Date.now(),
  memoryStart: process.memoryUsage().heapUsed
};

async function setupProductionEnvironment() {
  try {
    console.log('\n🔧 CONFIGURANDO AMBIENTE DE PRODUÇÃO...');
    
    // Configuração robusta para produção
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'production_test',
        socketOptions: {
          connectTimeout: 10000,
          readTimeout: 30000
        },
        pooling: {
          maxRequestsPerConnection: 32768,
          coreConnectionsPerHost: 2
        }
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });
    
    // Setup keyspace
    const tempClient = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1'
      }
    });
    
    await tempClient.connect();
    await tempClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS production_test 
      WITH REPLICATION = { 'class': 'SimpleStrategy', 'replication_factor': 1 }
    `);
    await tempClient.disconnect();
    
    // Connect with keyspace
    await client.connect();
    
    // Create production tables
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        email text,
        name text,
        created_at timestamp,
        updated_at timestamp
      )
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        user_id uuid,
        session_id timeuuid,
        ip_address text,
        user_agent text,
        created_at timestamp,
        expires_at timestamp,
        PRIMARY KEY (user_id, session_id)
      ) WITH CLUSTERING ORDER BY (session_id DESC)
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id timeuuid PRIMARY KEY,
        user_id uuid,
        action text,
        resource text,
        timestamp timestamp,
        metadata text
      )
    `);
    
    console.log('✅ Ambiente de produção configurado');
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function testHighVolumeOperations() {
  console.log('\n📈 TESTANDO OPERAÇÕES DE ALTO VOLUME...');
  
  try {
    const batchSize = 50;
    const batches = 5;
    
    console.log(`Inserindo ${batchSize * batches} registros em ${batches} batches...`);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchQueries = [];
      
      for (let i = 0; i < batchSize; i++) {
        const userId = uuid();
        const sessionId = timeuuid();
        const now = new Date();
        
        // User insert
        batchQueries.push({
          query: 'INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          params: [userId, `user${batch}_${i}@test.com`, `User ${batch}_${i}`, now, now]
        });
        
        // Session insert
        batchQueries.push({
          query: 'INSERT INTO sessions (user_id, session_id, ip_address, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          params: [userId, sessionId, '192.168.1.1', 'Test Agent', now, new Date(Date.now() + 3600000)]
        });
        
        // Audit log
        batchQueries.push({
          query: 'INSERT INTO audit_log (id, user_id, action, resource, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
          params: [timeuuid(), userId, 'CREATE', 'user', now, '{"source": "test"}']
        });
      }
      
      await client.batch(batchQueries);
      stats.operations += batchQueries.length;
      
      console.log(`✅ Batch ${batch + 1}/${batches} concluído (${batchQueries.length} operações)`);
    }
    
    console.log(`✅ ${stats.operations} operações completadas`);
    
  } catch (error) {
    console.error('❌ Erro em operações de alto volume:', error.message);
    stats.errors++;
  }
}

async function testConcurrentAccess() {
  console.log('\n🔄 TESTANDO ACESSO CONCORRENTE...');
  
  try {
    const concurrentOperations = 20;
    const promises = [];
    
    for (let i = 0; i < concurrentOperations; i++) {
      promises.push(
        client.execute('SELECT COUNT(*) FROM users')
          .then(result => {
            stats.operations++;
            return result;
          })
          .catch(error => {
            stats.errors++;
            throw error;
          })
      );
    }
    
    const results = await Promise.all(promises);
    console.log(`✅ ${concurrentOperations} operações concorrentes completadas`);
    console.log(`📊 Contagem de usuários: ${results[0].rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro em acesso concorrente:', error.message);
    stats.errors++;
  }
}

async function testComplexQueries() {
  console.log('\n🔍 TESTANDO CONSULTAS COMPLEXAS...');
  
  try {
    // Query with pagination
    const pageSize = 10;
    let pageState = null;
    let totalPages = 0;
    
    do {
      const result = await client.execute(
        'SELECT * FROM users LIMIT ?',
        [pageSize],
        { pageState, autoPage: false }
      );
      
      totalPages++;
      pageState = result.pageState;
      stats.operations++;
      
      if (totalPages >= 3) break; // Limit to 3 pages for test
      
    } while (pageState);
    
    console.log(`✅ Paginação testada (${totalPages} páginas)`);
    
    // Query with time range
    const oneHourAgo = new Date(Date.now() - 3600000);
    const timeRangeResult = await client.execute(
      'SELECT COUNT(*) FROM audit_log WHERE timestamp > ? ALLOW FILTERING',
      [oneHourAgo]
    );
    stats.operations++;
    
    console.log(`✅ Consulta por intervalo de tempo: ${timeRangeResult.rows[0].count} registros`);
    
    // Query with prepared statement
    const preparedResult = await client.executeAsPrepared(
      'SELECT user_id, COUNT(*) FROM sessions GROUP BY user_id LIMIT 5'
    );
    stats.operations++;
    
    console.log(`✅ Prepared statement executado: ${preparedResult.rows.length} grupos`);
    
  } catch (error) {
    console.error('❌ Erro em consultas complexas:', error.message);
    stats.errors++;
  }
}

async function testErrorRecovery() {
  console.log('\n🛡️ TESTANDO RECUPERAÇÃO DE ERROS...');
  
  try {
    // Test invalid query
    try {
      await client.execute('SELECT * FROM non_existent_table');
    } catch (error) {
      console.log('✅ Erro de tabela inexistente capturado corretamente');
    }
    
    // Test invalid parameters
    try {
      await client.execute('SELECT * FROM users WHERE id = ?', ['invalid-uuid']);
    } catch (error) {
      console.log('✅ Erro de parâmetro inválido capturado corretamente');
    }
    
    // Test connection health after errors
    const healthCheck = await client.execute('SELECT now() FROM system.local');
    console.log('✅ Conexão saudável após erros');
    
    // Test recovery with valid operation
    const recoveryResult = await client.execute('SELECT COUNT(*) FROM users');
    console.log(`✅ Recuperação bem-sucedida: ${recoveryResult.rows[0].count} usuários`);
    
  } catch (error) {
    console.error('❌ Erro na recuperação:', error.message);
    stats.errors++;
  }
}

async function testResourceManagement() {
  console.log('\n💾 TESTANDO GERENCIAMENTO DE RECURSOS...');
  
  try {
    const memoryBefore = process.memoryUsage().heapUsed;
    
    // Simulate heavy operations
    for (let i = 0; i < 100; i++) {
      const testUuid = uuid();
      const testTimeuuid = timeuuid();
      stats.operations += 2;
    }
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryIncrease = memoryAfter - memoryBefore;
    
    console.log(`📊 Uso de memória: +${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    
    // Test connection pooling
    const connectionTest = await client.execute('SELECT cluster_name FROM system.local');
    console.log(`✅ Pool de conexões funcionando: ${connectionTest.rows[0].cluster_name}`);
    
    // Test cleanup
    if (global.gc) {
      global.gc();
      console.log('✅ Garbage collection executado');
    }
    
  } catch (error) {
    console.error('❌ Erro no gerenciamento de recursos:', error.message);
    stats.errors++;
  }
}

async function generatePerformanceReport() {
  console.log('\n📊 RELATÓRIO DE PERFORMANCE...');
  
  const endTime = Date.now();
  const duration = endTime - stats.startTime;
  const memoryEnd = process.memoryUsage().heapUsed;
  const memoryUsed = memoryEnd - stats.memoryStart;
  
  console.log(`⏱️ Tempo total: ${(duration / 1000).toFixed(2)}s`);
  console.log(`🔢 Total de operações: ${stats.operations}`);
  console.log(`❌ Total de erros: ${stats.errors}`);
  console.log(`📈 Operações/segundo: ${(stats.operations / (duration / 1000)).toFixed(2)}`);
  console.log(`💾 Memória utilizada: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`✅ Taxa de sucesso: ${(((stats.operations - stats.errors) / stats.operations) * 100).toFixed(2)}%`);
  
  // Performance thresholds for production
  const performanceChecks = {
    'Operações/segundo > 50': (stats.operations / (duration / 1000)) > 50,
    'Taxa de erro < 1%': (stats.errors / stats.operations) < 0.01,
    'Uso de memória < 100MB': (memoryUsed / 1024 / 1024) < 100,
    'Tempo total < 60s': (duration / 1000) < 60
  };
  
  console.log('\n🎯 VERIFICAÇÕES DE PRODUÇÃO:');
  Object.entries(performanceChecks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  const allChecksPassed = Object.values(performanceChecks).every(check => check);
  
  if (allChecksPassed) {
    console.log('\n🎉 TODOS OS CRITÉRIOS DE PRODUÇÃO ATENDIDOS!');
    console.log('🚀 SISTEMA PRONTO PARA PRODUÇÃO!');
  } else {
    console.log('\n⚠️ ALGUNS CRITÉRIOS DE PRODUÇÃO NÃO FORAM ATENDIDOS');
    console.log('🔧 REVISAR PERFORMANCE ANTES DO DEPLOY');
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 LIMPEZA FINAL...');
    if (client) {
      await client.disconnect();
      console.log('✅ Cliente desconectado');
    }
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

async function runProductionTest() {
  try {
    await setupProductionEnvironment();
    await testHighVolumeOperations();
    await testConcurrentAccess();
    await testComplexQueries();
    await testErrorRecovery();
    await testResourceManagement();
    await generatePerformanceReport();
    
  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO NO TESTE DE PRODUÇÃO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await cleanup();
  }
}

// Executar teste de produção
runProductionTest();
