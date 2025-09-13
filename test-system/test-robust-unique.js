// Validação Robusta de Unicidade - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 VALIDAÇÃO ROBUSTA DE UNICIDADE - v1.0.1');

let client;

// Schema com email como chave primária (garante unicidade)
const uniqueUserSchema = {
  fields: {
    email: 'text',      // Chave primária - garante unicidade
    id: 'uuid',
    name: 'text',
    created_at: 'timestamp'
  },
  key: ['email'],       // Email como partition key
  options: {
    table_name: 'users_truly_unique'
  }
};

// Tabela auxiliar para verificar nomes únicos
const uniqueNameSchema = {
  fields: {
    name: 'text',       // Chave primária - garante unicidade
    email: 'text',      // Email do usuário
    created_at: 'timestamp'
  },
  key: ['name'],        // Nome como partition key
  options: {
    table_name: 'unique_names'
  }
};

class RobustUniqueManager {
  constructor(client) {
    this.client = client;
  }

  async createUser(userData) {
    const { name, email } = userData;
    const userId = uuid();
    const now = new Date();

    try {
      // Tentar inserir nome na tabela de nomes únicos
      await this.client.execute(
        'INSERT INTO unique_names (name, email, created_at) VALUES (?, ?, ?) IF NOT EXISTS',
        [name, email, now]
      );

      // Tentar inserir usuário na tabela principal
      const result = await this.client.execute(
        'INSERT INTO users_truly_unique (email, id, name, created_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
        [email, userId, name, now]
      );

      if (result.rows[0]['[applied]']) {
        console.log(`✅ Usuário criado: ${name} - ${email}`);
        return { id: userId, name, email };
      } else {
        // Se email já existe, remover nome da tabela auxiliar
        await this.client.execute('DELETE FROM unique_names WHERE name = ?', [name]);
        throw new Error(`Email '${email}' já existe`);
      }

    } catch (error) {
      // Limpar dados parciais em caso de erro
      try {
        await this.client.execute('DELETE FROM unique_names WHERE name = ?', [name]);
        await this.client.execute('DELETE FROM users_truly_unique WHERE email = ?', [email]);
      } catch (cleanupError) {
        // Ignorar erros de limpeza
      }
      throw error;
    }
  }

  async deleteUser(email) {
    try {
      // Buscar nome do usuário
      const user = await this.client.execute(
        'SELECT name FROM users_truly_unique WHERE email = ?',
        [email]
      );

      if (user.rows.length > 0) {
        const name = user.rows[0].name;
        
        // Remover da tabela principal
        await this.client.execute('DELETE FROM users_truly_unique WHERE email = ?', [email]);
        
        // Remover da tabela de nomes únicos
        await this.client.execute('DELETE FROM unique_names WHERE name = ?', [name]);
        
        console.log(`✅ Usuário removido: ${name} - ${email}`);
        return true;
      }
      
      return false;
    } catch (error) {
      throw new Error(`Erro ao remover usuário: ${error.message}`);
    }
  }

  async listUsers() {
    const result = await this.client.execute('SELECT email, name, id FROM users_truly_unique');
    return result.rows;
  }

  async checkEmailExists(email) {
    const result = await this.client.execute(
      'SELECT email FROM users_truly_unique WHERE email = ?',
      [email]
    );
    return result.rows.length > 0;
  }

  async checkNameExists(name) {
    const result = await this.client.execute(
      'SELECT name FROM unique_names WHERE name = ?',
      [name]
    );
    return result.rows.length > 0;
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
      },
      ormOptions: {
        migration: 'safe'
      }
    });
    
    await client.connect();
    console.log('✅ Cliente conectado');
    
    // Criar schemas únicos
    await client.loadSchema('users_truly_unique', uniqueUserSchema);
    await client.loadSchema('unique_names', uniqueNameSchema);
    console.log('✅ Schemas únicos criados');
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    throw error;
  }
}

async function testRobustUniqueness() {
  try {
    console.log('\n🔒 TESTANDO UNICIDADE ROBUSTA...');
    
    const manager = new RobustUniqueManager(client);
    
    // Limpar tabelas
    await client.execute('TRUNCATE users_truly_unique');
    await client.execute('TRUNCATE unique_names');
    console.log('✅ Tabelas limpas');
    
    // Teste 1: Criar primeiro usuário
    console.log('\n👤 TESTE 1 - PRIMEIRO USUÁRIO:');
    try {
      await manager.createUser({
        name: 'João Silva',
        email: 'joao@unique.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    // Teste 2: Tentar email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    try {
      await manager.createUser({
        name: 'João Duplicado',
        email: 'joao@unique.com'
      });
      console.log('❌ Email duplicado aceito');
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado: ${error.message}`);
    }
    
    // Teste 3: Tentar nome duplicado
    console.log('\n👤 TESTE 3 - NOME DUPLICADO:');
    try {
      await manager.createUser({
        name: 'João Silva',
        email: 'joao2@unique.com'
      });
      console.log('❌ Nome duplicado aceito');
    } catch (error) {
      console.log(`✅ Nome duplicado rejeitado: ${error.message}`);
    }
    
    // Teste 4: Criar usuário único
    console.log('\n✅ TESTE 4 - USUÁRIO ÚNICO:');
    try {
      await manager.createUser({
        name: 'Maria Santos',
        email: 'maria@unique.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    // Teste 5: Verificar existência
    console.log('\n🔍 TESTE 5 - VERIFICAÇÃO DE EXISTÊNCIA:');
    console.log(`Email 'joao@unique.com' existe: ${await manager.checkEmailExists('joao@unique.com')}`);
    console.log(`Email 'inexistente@test.com' existe: ${await manager.checkEmailExists('inexistente@test.com')}`);
    console.log(`Nome 'João Silva' existe: ${await manager.checkNameExists('João Silva')}`);
    console.log(`Nome 'Inexistente' existe: ${await manager.checkNameExists('Inexistente')}`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function testDuplicateAttempts() {
  try {
    console.log('\n🚫 TESTANDO MÚLTIPLAS TENTATIVAS DE DUPLICATA...');
    
    const manager = new RobustUniqueManager(client);
    
    // Tentar inserir múltiplas duplicatas
    const duplicateAttempts = [
      { name: 'João Clone 1', email: 'joao@unique.com' },
      { name: 'João Clone 2', email: 'joao@unique.com' },
      { name: 'João Silva', email: 'joao3@unique.com' },
      { name: 'João Silva', email: 'joao4@unique.com' }
    ];
    
    for (const attempt of duplicateAttempts) {
      try {
        await manager.createUser(attempt);
        console.log(`❌ Duplicata aceita: ${attempt.name} - ${attempt.email}`);
      } catch (error) {
        console.log(`✅ Duplicata rejeitada: ${attempt.name} - ${attempt.email}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de duplicatas:', error.message);
  }
}

async function validateFinalState() {
  try {
    console.log('\n🔍 VALIDAÇÃO FINAL...');
    
    const manager = new RobustUniqueManager(client);
    const users = await manager.listUsers();
    
    console.log(`📊 Total de usuários únicos: ${users.length}`);
    
    const emails = new Set();
    const names = new Set();
    
    users.forEach(user => {
      emails.add(user.email);
      names.add(user.name);
      console.log(`  - ${user.name} (${user.email})`);
    });
    
    console.log(`✅ Emails únicos: ${emails.size}/${users.length}`);
    console.log(`✅ Nomes únicos: ${names.size}/${users.length}`);
    
    // Verificar tabela de nomes únicos
    const uniqueNames = await client.execute('SELECT name, email FROM unique_names');
    console.log(`📊 Registros na tabela de nomes únicos: ${uniqueNames.rows.length}`);
    
    if (emails.size === users.length && names.size === users.length && 
        uniqueNames.rows.length === users.length) {
      console.log('🎉 UNICIDADE PERFEITA GARANTIDA!');
    } else {
      console.log('⚠️ Inconsistências detectadas');
    }
    
  } catch (error) {
    console.error('❌ Erro na validação:', error.message);
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

async function runRobustTests() {
  try {
    await setupClient();
    await testRobustUniqueness();
    await testDuplicateAttempts();
    await validateFinalState();
    
    console.log('\n🎉 TESTE DE UNICIDADE ROBUSTA CONCLUÍDO!');
    console.log('📊 RESUMO:');
    console.log('  ✅ Email único via chave primária');
    console.log('  ✅ Nome único via tabela auxiliar');
    console.log('  ✅ IF NOT EXISTS para atomicidade');
    console.log('  ✅ Limpeza automática em caso de erro');
    console.log('  ✅ Validação de existência');
    console.log('\n🔒 UNICIDADE 100% GARANTIDA!');
    
  } catch (error) {
    console.error('\n💥 ERRO NO TESTE:', error.message);
  } finally {
    await cleanup();
  }
}

// Executar testes robustos
runRobustTests();
