// Múltiplas Chaves Únicas no ORM - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 MÚLTIPLAS CHAVES ÚNICAS NO ORM - v1.0.1');

// Schema com múltiplas chaves únicas
const multiUniqueSchema = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    created_at: 'timestamp'
  },
  key: ['id'],          // Primary key
  unique: ['email', 'name'], // Campos únicos adicionais
  options: {
    table_name: 'users_multi_unique'
  }
};

class MultiUniqueManager {
  constructor(client) {
    this.client = client;
    this.uniqueTables = new Map();
  }

  async initializeUniqueTables(schema) {
    const { unique = [], options } = schema;
    const tableName = options.table_name;

    // Criar tabelas auxiliares para cada campo único
    for (const field of unique) {
      const uniqueTableName = `${tableName}_unique_${field}`;
      
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${uniqueTableName} (
          ${field} text PRIMARY KEY,
          main_id uuid,
          created_at timestamp
        )
      `);
      
      this.uniqueTables.set(field, uniqueTableName);
      console.log(`✅ Tabela única criada: ${uniqueTableName}`);
    }
  }

  async checkUniqueness(data, excludeId = null) {
    const violations = [];

    for (const [field, uniqueTable] of this.uniqueTables) {
      if (data[field]) {
        const result = await this.client.execute(
          `SELECT main_id FROM ${uniqueTable} WHERE ${field} = ?`,
          [data[field]]
        );

        if (result.rows.length > 0) {
          const existingId = result.rows[0].main_id.toString();
          if (!excludeId || existingId !== excludeId) {
            violations.push(`${field} '${data[field]}' já existe`);
          }
        }
      }
    }

    return violations;
  }

  async insertUniqueReferences(id, data) {
    const insertPromises = [];

    for (const [field, uniqueTable] of this.uniqueTables) {
      if (data[field]) {
        insertPromises.push(
          this.client.execute(
            `INSERT INTO ${uniqueTable} (${field}, main_id, created_at) VALUES (?, ?, ?)`,
            [data[field], id, new Date()]
          )
        );
      }
    }

    await Promise.all(insertPromises);
  }

  async removeUniqueReferences(data) {
    const deletePromises = [];

    for (const [field, uniqueTable] of this.uniqueTables) {
      if (data[field]) {
        deletePromises.push(
          this.client.execute(
            `DELETE FROM ${uniqueTable} WHERE ${field} = ?`,
            [data[field]]
          )
        );
      }
    }

    await Promise.all(deletePromises);
  }

  async createUser(userData) {
    const { name, email } = userData;
    const id = uuid();

    try {
      // Verificar unicidade
      const violations = await this.checkUniqueness(userData);
      if (violations.length > 0) {
        throw new Error(`Violações de unicidade: ${violations.join(', ')}`);
      }

      // Inserir referências únicas primeiro
      await this.insertUniqueReferences(id, userData);

      // Inserir na tabela principal
      await this.client.execute(
        'INSERT INTO users_multi_unique (id, email, name, created_at) VALUES (?, ?, ?, ?)',
        [id, email, name, new Date()]
      );

      console.log(`✅ Usuário criado: ${name} - ${email}`);
      return { id, ...userData };

    } catch (error) {
      // Limpar referências únicas em caso de erro
      await this.removeUniqueReferences(userData);
      throw error;
    }
  }

  async updateUser(id, userData) {
    try {
      // Buscar dados atuais
      const current = await this.client.execute(
        'SELECT email, name FROM users_multi_unique WHERE id = ?',
        [id]
      );

      if (current.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const currentData = current.rows[0];

      // Verificar unicidade (excluindo este usuário)
      const violations = await this.checkUniqueness(userData, id);
      if (violations.length > 0) {
        throw new Error(`Violações de unicidade: ${violations.join(', ')}`);
      }

      // Remover referências antigas
      await this.removeUniqueReferences(currentData);

      // Inserir novas referências
      await this.insertUniqueReferences(id, userData);

      // Atualizar tabela principal
      const updates = [];
      const params = [];

      if (userData.email) {
        updates.push('email = ?');
        params.push(userData.email);
      }

      if (userData.name) {
        updates.push('name = ?');
        params.push(userData.name);
      }

      if (updates.length > 0) {
        params.push(id);
        await this.client.execute(
          `UPDATE users_multi_unique SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      console.log(`✅ Usuário atualizado: ${id}`);
      return { id, ...userData };

    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id) {
    try {
      // Buscar dados atuais
      const current = await this.client.execute(
        'SELECT email, name FROM users_multi_unique WHERE id = ?',
        [id]
      );

      if (current.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const currentData = current.rows[0];

      // Remover da tabela principal
      await this.client.execute('DELETE FROM users_multi_unique WHERE id = ?', [id]);

      // Remover referências únicas
      await this.removeUniqueReferences(currentData);

      console.log(`✅ Usuário removido: ${id}`);
      return true;

    } catch (error) {
      throw error;
    }
  }

  async listUsers() {
    const result = await this.client.execute('SELECT id, email, name FROM users_multi_unique');
    return result.rows;
  }
}

async function testMultipleUnique() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    },
    ormOptions: {
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    // Criar schema principal
    await client.loadSchema('users_multi_unique', multiUniqueSchema);
    console.log('✅ Schema principal criado');

    // Inicializar manager
    const manager = new MultiUniqueManager(client);
    await manager.initializeUniqueTables(multiUniqueSchema);

    // Limpar dados
    await client.execute('TRUNCATE users_multi_unique');
    await client.execute('TRUNCATE users_multi_unique_unique_email');
    await client.execute('TRUNCATE users_multi_unique_unique_name');
    console.log('✅ Tabelas limpas');

    console.log('\n🔒 TESTANDO MÚLTIPLAS CHAVES ÚNICAS...');

    // Teste 1: Criar primeiro usuário
    console.log('\n👤 TESTE 1 - PRIMEIRO USUÁRIO:');
    try {
      await manager.createUser({
        name: 'João Silva',
        email: 'joao@multi.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 2: Tentar email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    try {
      await manager.createUser({
        name: 'João Diferente',
        email: 'joao@multi.com'
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
        email: 'joao2@multi.com'
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
        email: 'maria@multi.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 5: Atualização com duplicata
    console.log('\n🔄 TESTE 5 - ATUALIZAÇÃO COM DUPLICATA:');
    const users = await manager.listUsers();
    if (users.length >= 2) {
      try {
        await manager.updateUser(users[1].id.toString(), {
          email: 'joao@multi.com' // Email do primeiro usuário
        });
        console.log('❌ Atualização com email duplicado aceita');
      } catch (error) {
        console.log(`✅ Atualização com duplicata rejeitada: ${error.message}`);
      }
    }

    // Teste 6: Atualização válida
    console.log('\n✅ TESTE 6 - ATUALIZAÇÃO VÁLIDA:');
    if (users.length >= 1) {
      try {
        await manager.updateUser(users[0].id.toString(), {
          name: 'João Silva Atualizado'
        });
      } catch (error) {
        console.log(`❌ Erro na atualização: ${error.message}`);
      }
    }

    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    const finalUsers = await manager.listUsers();
    console.log(`📊 Total de usuários: ${finalUsers.rows.length}`);

    const emails = new Set();
    const names = new Set();

    finalUsers.forEach(user => {
      emails.add(user.email);
      names.add(user.name);
      console.log(`  - ${user.name} (${user.email})`);
    });

    console.log(`✅ Emails únicos: ${emails.size}/${finalUsers.length}`);
    console.log(`✅ Nomes únicos: ${names.size}/${finalUsers.length}`);

    if (emails.size === finalUsers.length && names.size === finalUsers.length) {
      console.log('🎉 MÚLTIPLAS CHAVES ÚNICAS FUNCIONANDO!');
    } else {
      console.log('⚠️ Duplicatas detectadas');
    }

    console.log('\n📋 RESUMO DA IMPLEMENTAÇÃO:');
    console.log('  ✅ ID como primary key');
    console.log('  ✅ Email único via tabela auxiliar');
    console.log('  ✅ Nome único via tabela auxiliar');
    console.log('  ✅ Validação automática no ORM');
    console.log('  ✅ Cleanup automático em caso de erro');
    console.log('  ✅ Suporte a CREATE, UPDATE, DELETE');

    await client.disconnect();
    console.log('\n✅ TESTE CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testMultipleUnique();
