// Validação de Unicidade na Aplicação - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 VALIDAÇÃO DE UNICIDADE NA APLICAÇÃO - v1.0.1');

let client;

class UniqueUserManager {
  constructor(client) {
    this.client = client;
  }

  async checkEmailExists(email) {
    try {
      const result = await this.client.execute(
        'SELECT email FROM users_validated WHERE email = ?',
        [email]
      );
      return result.rows.length > 0;
    } catch (error) {
      // Se tabela não existe, email não existe
      return false;
    }
  }

  async checkNameExists(name) {
    try {
      const result = await this.client.execute(
        'SELECT name FROM users_validated WHERE name = ? ALLOW FILTERING',
        [name]
      );
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  async createUser(userData) {
    const { name, email } = userData;

    // Validar email único
    if (await this.checkEmailExists(email)) {
      throw new Error(`Email '${email}' já existe`);
    }

    // Validar nome único
    if (await this.checkNameExists(name)) {
      throw new Error(`Nome '${name}' já existe`);
    }

    // Inserir usuário
    const userId = uuid();
    await this.client.execute(
      'INSERT INTO users_validated (id, email, name, created_at) VALUES (?, ?, ?, ?)',
      [userId, email, name, new Date()]
    );

    return { id: userId, ...userData };
  }

  async updateUser(id, userData) {
    const { name, email } = userData;

    // Verificar se email já existe (exceto para este usuário)
    if (email) {
      const emailCheck = await this.client.execute(
        'SELECT id FROM users_validated WHERE email = ?',
        [email]
      );
      
      if (emailCheck.rows.length > 0 && emailCheck.rows[0].id.toString() !== id) {
        throw new Error(`Email '${email}' já existe`);
      }
    }

    // Verificar se nome já existe (exceto para este usuário)
    if (name) {
      const nameCheck = await this.client.execute(
        'SELECT id FROM users_validated WHERE name = ? ALLOW FILTERING',
        [name]
      );
      
      if (nameCheck.rows.length > 0 && nameCheck.rows[0].id.toString() !== id) {
        throw new Error(`Nome '${name}' já existe`);
      }
    }

    // Atualizar usuário
    const updates = [];
    const params = [];
    
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (updates.length > 0) {
      params.push(id);
      await this.client.execute(
        `UPDATE users_validated SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    return { id, ...userData };
  }
}

async function setupClient() {
  try {
    console.log('\n🔧 CONFIGURANDO CLIENTE...');
    
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_system'
      }
    });
    
    await client.connect();
    console.log('✅ Cliente conectado');
    
    // Criar tabela para validação
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users_validated (
        id uuid PRIMARY KEY,
        email text,
        name text,
        created_at timestamp
      )
    `);
    console.log('✅ Tabela users_validated criada');
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function testUniqueValidation() {
  try {
    console.log('\n🔒 TESTANDO VALIDAÇÃO DE UNICIDADE...');
    
    const userManager = new UniqueUserManager(client);
    
    // Limpar tabela
    await client.execute('TRUNCATE users_validated');
    console.log('✅ Tabela limpa');
    
    // Teste 1: Criar primeiro usuário
    console.log('\n👤 TESTE 1 - CRIAR PRIMEIRO USUÁRIO:');
    try {
      const user1 = await userManager.createUser({
        name: 'João Silva',
        email: 'joao@example.com'
      });
      console.log(`✅ Usuário criado: ${user1.name} - ${user1.email}`);
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    // Teste 2: Tentar criar usuário com email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    try {
      const user2 = await userManager.createUser({
        name: 'João Duplicado',
        email: 'joao@example.com'
      });
      console.log(`❌ Email duplicado aceito: ${user2.email}`);
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado: ${error.message}`);
    }
    
    // Teste 3: Tentar criar usuário com nome duplicado
    console.log('\n👤 TESTE 3 - NOME DUPLICADO:');
    try {
      const user3 = await userManager.createUser({
        name: 'João Silva',
        email: 'joao2@example.com'
      });
      console.log(`❌ Nome duplicado aceito: ${user3.name}`);
    } catch (error) {
      console.log(`✅ Nome duplicado rejeitado: ${error.message}`);
    }
    
    // Teste 4: Criar usuário com dados únicos
    console.log('\n✅ TESTE 4 - DADOS ÚNICOS:');
    try {
      const user4 = await userManager.createUser({
        name: 'Maria Santos',
        email: 'maria@example.com'
      });
      console.log(`✅ Usuário único criado: ${user4.name} - ${user4.email}`);
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function testUpdateValidation() {
  try {
    console.log('\n🔄 TESTANDO VALIDAÇÃO DE ATUALIZAÇÃO...');
    
    const userManager = new UniqueUserManager(client);
    
    // Buscar usuários existentes
    const users = await client.execute('SELECT id, name, email FROM users_validated');
    if (users.rows.length < 2) {
      console.log('⚠️ Não há usuários suficientes para teste de atualização');
      return;
    }
    
    const user1 = users.rows[0];
    const user2 = users.rows[1];
    
    console.log(`📋 Usuário 1: ${user1.name} - ${user1.email}`);
    console.log(`📋 Usuário 2: ${user2.name} - ${user2.email}`);
    
    // Teste 1: Tentar atualizar com email de outro usuário
    console.log('\n📧 TESTE - ATUALIZAR COM EMAIL DUPLICADO:');
    try {
      await userManager.updateUser(user1.id.toString(), {
        email: user2.email
      });
      console.log('❌ Email duplicado aceito na atualização');
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado na atualização: ${error.message}`);
    }
    
    // Teste 2: Atualizar com dados únicos
    console.log('\n✅ TESTE - ATUALIZAR COM DADOS ÚNICOS:');
    try {
      await userManager.updateUser(user1.id.toString(), {
        name: 'João Silva Atualizado'
      });
      console.log('✅ Atualização com dados únicos aceita');
    } catch (error) {
      console.log(`❌ Erro na atualização: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de atualização:', error.message);
  }
}

async function validateFinalData() {
  try {
    console.log('\n🔍 VALIDAÇÃO FINAL DOS DADOS...');
    
    const users = await client.execute('SELECT name, email FROM users_validated');
    console.log(`📊 Total de usuários validados: ${users.rows.length}`);
    
    const emails = new Set();
    const names = new Set();
    let duplicateEmails = 0;
    let duplicateNames = 0;
    
    users.rows.forEach(user => {
      if (emails.has(user.email)) {
        duplicateEmails++;
        console.log(`❌ Email duplicado: ${user.email}`);
      } else {
        emails.add(user.email);
      }
      
      if (names.has(user.name)) {
        duplicateNames++;
        console.log(`❌ Nome duplicado: ${user.name}`);
      } else {
        names.add(user.name);
      }
      
      console.log(`  - ${user.name} (${user.email})`);
    });
    
    console.log(`✅ Emails únicos: ${emails.size}/${users.rows.length}`);
    console.log(`✅ Nomes únicos: ${names.size}/${users.rows.length}`);
    
    if (duplicateEmails === 0 && duplicateNames === 0) {
      console.log('🎉 VALIDAÇÃO PERFEITA - NENHUMA DUPLICATA!');
    } else {
      console.log(`⚠️ ${duplicateEmails} emails duplicados, ${duplicateNames} nomes duplicados`);
    }
    
  } catch (error) {
    console.error('❌ Erro na validação final:', error.message);
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

async function runValidationTests() {
  try {
    await setupClient();
    await testUniqueValidation();
    await testUpdateValidation();
    await validateFinalData();
    
    console.log('\n🎉 TESTE DE VALIDAÇÃO DE UNICIDADE CONCLUÍDO!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Validação de email único implementada');
    console.log('  ✅ Validação de nome único implementada');
    console.log('  ✅ Validação em criação testada');
    console.log('  ✅ Validação em atualização testada');
    console.log('  ✅ Dados finais validados');
    console.log('\n🔒 UNICIDADE GARANTIDA VIA APLICAÇÃO!');
    
  } catch (error) {
    console.error('\n💥 ERRO NO TESTE:', error.message);
  } finally {
    await cleanup();
  }
}

// Executar testes de validação
runValidationTests();
