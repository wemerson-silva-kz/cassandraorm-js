// Teste Completo de Todos os Cenários - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🧪 TESTE COMPLETO DE TODOS OS CENÁRIOS - v1.0.1');

// Schema de teste com múltiplos campos únicos
const testSchema = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    username: 'text',
    phone: 'text',
    created_at: 'timestamp'
  },
  key: ['id'],
  unique: ['email', 'name', 'username', 'phone'],
  options: {
    table_name: 'test_complete_unique'
  }
};

let client;
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function logTest(testName, success, message = '') {
  testResults.total++;
  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: ${message}`);
  }
}

async function setupAndCleanDatabase() {
  try {
    console.log('\n🧹 LIMPANDO E CONFIGURANDO DATABASE...');
    
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_system'
      },
      ormOptions: {
        migration: 'safe'
      }
    });
    
    await client.connect();
    console.log('✅ Conectado ao Cassandra');
    
    // Limpar tabela se existir
    try {
      await client.execute('DROP TABLE IF EXISTS test_complete_unique');
      console.log('✅ Tabela anterior removida');
    } catch (error) {
      console.log('ℹ️ Nenhuma tabela anterior para remover');
    }
    
    // Criar schema limpo
    const TestModel = await client.loadSchema('test_complete_unique', testSchema);
    console.log('✅ Schema criado com campos únicos: email, name, username, phone');
    
    return TestModel;
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function testInsertScenarios() {
  console.log('\n📝 CENÁRIOS DE INSERT...');
  
  // Cenário 1: Insert válido
  try {
    const userData = {
      id: uuid(),
      email: 'user1@test.com',
      name: 'User One',
      username: 'user1',
      phone: '+1234567890',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert válido com todos os campos únicos', true);
  } catch (error) {
    logTest('Insert válido com todos os campos únicos', false, error.message);
  }
  
  // Cenário 2: Insert com email duplicado
  try {
    const userData = {
      id: uuid(),
      email: 'user1@test.com', // Duplicado
      name: 'User Two',
      username: 'user2',
      phone: '+1234567891',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com email duplicado deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Insert com email duplicado deve falhar', true);
  }
  
  // Cenário 3: Insert com nome duplicado
  try {
    const userData = {
      id: uuid(),
      email: 'user2@test.com',
      name: 'User One', // Duplicado
      username: 'user2',
      phone: '+1234567891',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com nome duplicado deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Insert com nome duplicado deve falhar', true);
  }
  
  // Cenário 4: Insert com username duplicado
  try {
    const userData = {
      id: uuid(),
      email: 'user2@test.com',
      name: 'User Two',
      username: 'user1', // Duplicado
      phone: '+1234567891',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com username duplicado deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Insert com username duplicado deve falhar', true);
  }
  
  // Cenário 5: Insert com phone duplicado
  try {
    const userData = {
      id: uuid(),
      email: 'user2@test.com',
      name: 'User Two',
      username: 'user2',
      phone: '+1234567890', // Duplicado
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com phone duplicado deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Insert com phone duplicado deve falhar', true);
  }
  
  // Cenário 6: Insert válido com dados únicos
  try {
    const userData = {
      id: uuid(),
      email: 'user2@test.com',
      name: 'User Two',
      username: 'user2',
      phone: '+1234567891',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert válido com dados únicos', true);
  } catch (error) {
    logTest('Insert válido com dados únicos', false, error.message);
  }
  
  // Cenário 7: Insert com múltiplos campos duplicados
  try {
    const userData = {
      id: uuid(),
      email: 'user1@test.com', // Duplicado
      name: 'User Two', // Duplicado
      username: 'user3',
      phone: '+1234567892',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com múltiplos campos duplicados deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    const hasMultipleViolations = error.message.includes('email') && error.message.includes('name');
    logTest('Insert com múltiplos campos duplicados deve falhar', hasMultipleViolations);
  }
}

async function testUpdateScenarios() {
  console.log('\n🔄 CENÁRIOS DE UPDATE...');
  
  // Buscar usuários existentes
  const users = await client.execute('SELECT id, email, name, username, phone FROM test_complete_unique');
  
  if (users.rows.length < 2) {
    logTest('Usuários suficientes para teste de UPDATE', false, 'Menos de 2 usuários encontrados');
    return;
  }
  
  const user1 = users.rows[0];
  const user2 = users.rows[1];
  
  // Cenário 8: Update válido com mesmo valor
  try {
    await client.updateWithUniqueValidation('test_complete_unique', user1.id.toString(), {
      email: user1.email // Mesmo email
    }, testSchema);
    logTest('Update com mesmo valor deve ser aceito', true);
  } catch (error) {
    logTest('Update com mesmo valor deve ser aceito', false, error.message);
  }
  
  // Cenário 9: Update com email de outro usuário
  try {
    await client.updateWithUniqueValidation('test_complete_unique', user1.id.toString(), {
      email: user2.email // Email do outro usuário
    }, testSchema);
    logTest('Update com email de outro usuário deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Update com email de outro usuário deve falhar', true);
  }
  
  // Cenário 10: Update com nome de outro usuário
  try {
    await client.updateWithUniqueValidation('test_complete_unique', user1.id.toString(), {
      name: user2.name // Nome do outro usuário
    }, testSchema);
    logTest('Update com nome de outro usuário deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Update com nome de outro usuário deve falhar', true);
  }
  
  // Cenário 11: Update válido com novo valor único
  try {
    await client.updateWithUniqueValidation('test_complete_unique', user1.id.toString(), {
      phone: '+9999999999' // Novo phone único
    }, testSchema);
    logTest('Update com novo valor único deve ser aceito', true);
  } catch (error) {
    logTest('Update com novo valor único deve ser aceito', false, error.message);
  }
  
  // Cenário 12: Update com múltiplos campos, alguns duplicados
  try {
    await client.updateWithUniqueValidation('test_complete_unique', user1.id.toString(), {
      email: user2.email, // Duplicado
      username: 'newusername' // Único
    }, testSchema);
    logTest('Update com campo duplicado deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Update com campo duplicado deve falhar', true);
  }
}

async function testEdgeCases() {
  console.log('\n🔍 CASOS EXTREMOS...');
  
  // Cenário 13: Insert com campos null/undefined
  try {
    const userData = {
      id: uuid(),
      email: 'user3@test.com',
      name: null, // null
      username: undefined, // undefined
      phone: '+1234567893',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com campos null/undefined deve ser aceito', true);
  } catch (error) {
    logTest('Insert com campos null/undefined deve ser aceito', false, error.message);
  }
  
  // Cenário 14: Insert com strings vazias
  try {
    const userData = {
      id: uuid(),
      email: '', // String vazia
      name: 'User Empty',
      username: 'userempty',
      phone: '+1234567894',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com string vazia deve ser aceito', true);
  } catch (error) {
    logTest('Insert com string vazia deve ser aceito', false, error.message);
  }
  
  // Cenário 15: Insert com string vazia duplicada
  try {
    const userData = {
      id: uuid(),
      email: '', // String vazia duplicada
      name: 'User Empty 2',
      username: 'userempty2',
      phone: '+1234567895',
      created_at: new Date()
    };
    
    await client.insertWithUniqueValidation('test_complete_unique', userData, testSchema);
    logTest('Insert com string vazia duplicada deve falhar', false, 'Foi aceito quando deveria falhar');
  } catch (error) {
    logTest('Insert com string vazia duplicada deve falhar', true);
  }
}

async function validateFinalState() {
  console.log('\n🔍 VALIDAÇÃO DO ESTADO FINAL...');
  
  try {
    const users = await client.execute('SELECT id, email, name, username, phone FROM test_complete_unique');
    console.log(`📊 Total de usuários na tabela: ${users.rows.length}`);
    
    // Verificar unicidade
    const emails = new Set();
    const names = new Set();
    const usernames = new Set();
    const phones = new Set();
    
    users.rows.forEach(user => {
      if (user.email) emails.add(user.email);
      if (user.name) names.add(user.name);
      if (user.username) usernames.add(user.username);
      if (user.phone) phones.add(user.phone);
    });
    
    const emailsUnique = emails.size === users.rows.filter(u => u.email).length;
    const namesUnique = names.size === users.rows.filter(u => u.name).length;
    const usernamesUnique = usernames.size === users.rows.filter(u => u.username).length;
    const phonesUnique = phones.size === users.rows.filter(u => u.phone).length;
    
    logTest('Emails são únicos', emailsUnique);
    logTest('Names são únicos', namesUnique);
    logTest('Usernames são únicos', usernamesUnique);
    logTest('Phones são únicos', phonesUnique);
    
    console.log('\n👥 USUÁRIOS FINAIS:');
    users.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name || 'null'} (${user.email || 'null'}, @${user.username || 'null'}, ${user.phone || 'null'})`);
    });
    
  } catch (error) {
    logTest('Validação do estado final', false, error.message);
  }
}

async function generateFinalReport() {
  console.log('\n📋 RELATÓRIO FINAL...');
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  console.log(`📊 ESTATÍSTICAS:`);
  console.log(`  ✅ Testes aprovados: ${testResults.passed}`);
  console.log(`  ❌ Testes falharam: ${testResults.failed}`);
  console.log(`  📈 Total de testes: ${testResults.total}`);
  console.log(`  🎯 Taxa de sucesso: ${successRate}%`);
  
  console.log('\n🎯 CENÁRIOS TESTADOS:');
  console.log('  ✅ Insert com dados únicos');
  console.log('  ✅ Insert com campos duplicados (email, name, username, phone)');
  console.log('  ✅ Insert com múltiplos campos duplicados');
  console.log('  ✅ Update com mesmo valor');
  console.log('  ✅ Update com valores de outros usuários');
  console.log('  ✅ Update com novos valores únicos');
  console.log('  ✅ Campos null/undefined');
  console.log('  ✅ Strings vazias e duplicadas');
  
  if (testResults.failed === 0) {
    console.log('\n🎉 TODOS OS CENÁRIOS PASSARAM!');
    console.log('🚀 VALIDAÇÃO ÚNICA NO ORM 100% FUNCIONAL!');
  } else {
    console.log(`\n⚠️ ${testResults.failed} cenários falharam`);
    console.log('🔧 Revisar implementação antes da produção');
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 LIMPEZA FINAL...');
    if (client) {
      await client.disconnect();
      console.log('✅ Desconectado');
    }
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

async function runCompleteTest() {
  try {
    await setupAndCleanDatabase();
    await testInsertScenarios();
    await testUpdateScenarios();
    await testEdgeCases();
    await validateFinalState();
    await generateFinalReport();
    
  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await cleanup();
  }
}

// Executar teste completo
runCompleteTest();
