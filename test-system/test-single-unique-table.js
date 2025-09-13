// Uma Única Tabela para Todos os Campos Únicos - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 UMA ÚNICA TABELA PARA CAMPOS ÚNICOS - v1.0.1');

class SingleTableUniqueManager {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.uniqueTableName = `${tableName}_unique_constraints`;
  }

  async initializeUniqueTable() {
    // Uma única tabela para todos os campos únicos
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.uniqueTableName} (
        field_name text,
        field_value text,
        main_id uuid,
        created_at timestamp,
        PRIMARY KEY (field_name, field_value)
      )
    `);
    
    console.log(`✅ Tabela única criada: ${this.uniqueTableName}`);
  }

  async checkUniqueness(data, uniqueFields, excludeId = null) {
    const violations = [];

    for (const field of uniqueFields) {
      if (data[field]) {
        const result = await this.client.execute(
          `SELECT main_id FROM ${this.uniqueTableName} WHERE field_name = ? AND field_value = ?`,
          [field, data[field]]
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

  async insertUniqueReferences(id, data, uniqueFields) {
    const insertPromises = [];

    for (const field of uniqueFields) {
      if (data[field]) {
        insertPromises.push(
          this.client.execute(
            `INSERT INTO ${this.uniqueTableName} (field_name, field_value, main_id, created_at) VALUES (?, ?, ?, ?)`,
            [field, data[field], id, new Date()]
          )
        );
      }
    }

    await Promise.all(insertPromises);
  }

  async removeUniqueReferences(data, uniqueFields) {
    const deletePromises = [];

    for (const field of uniqueFields) {
      if (data[field]) {
        deletePromises.push(
          this.client.execute(
            `DELETE FROM ${this.uniqueTableName} WHERE field_name = ? AND field_value = ?`,
            [field, data[field]]
          )
        );
      }
    }

    await Promise.all(deletePromises);
  }

  async createUser(userData) {
    const uniqueFields = ['email', 'name'];
    const { name, email } = userData;
    const id = uuid();

    try {
      // Verificar unicidade
      const violations = await this.checkUniqueness(userData, uniqueFields);
      if (violations.length > 0) {
        throw new Error(`Violações de unicidade: ${violations.join(', ')}`);
      }

      // Inserir referências únicas primeiro
      await this.insertUniqueReferences(id, userData, uniqueFields);

      // Inserir na tabela principal
      await this.client.execute(
        `INSERT INTO ${this.tableName} (id, email, name, created_at) VALUES (?, ?, ?, ?)`,
        [id, email, name, new Date()]
      );

      console.log(`✅ Usuário criado: ${name} - ${email}`);
      return { id, ...userData };

    } catch (error) {
      // Limpar referências únicas em caso de erro
      await this.removeUniqueReferences(userData, uniqueFields);
      throw error;
    }
  }

  async updateUser(id, userData) {
    const uniqueFields = ['email', 'name'];

    try {
      // Buscar dados atuais
      const current = await this.client.execute(
        `SELECT email, name FROM ${this.tableName} WHERE id = ?`,
        [id]
      );

      if (current.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const currentData = current.rows[0];

      // Verificar unicidade (excluindo este usuário)
      const violations = await this.checkUniqueness(userData, uniqueFields, id);
      if (violations.length > 0) {
        throw new Error(`Violações de unicidade: ${violations.join(', ')}`);
      }

      // Remover referências antigas
      await this.removeUniqueReferences(currentData, uniqueFields);

      // Inserir novas referências
      await this.insertUniqueReferences(id, userData, uniqueFields);

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
          `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      console.log(`✅ Usuário atualizado: ${id}`);
      return { id, ...userData };

    } catch (error) {
      throw error;
    }
  }

  async listUsers() {
    const result = await this.client.execute(`SELECT id, email, name FROM ${this.tableName}`);
    return result.rows;
  }

  async listUniqueConstraints() {
    const result = await this.client.execute(`SELECT field_name, field_value, main_id FROM ${this.uniqueTableName}`);
    return result.rows;
  }
}

async function testSingleUniqueTable() {
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

    // Criar tabela principal
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users_single_unique (
        id uuid PRIMARY KEY,
        email text,
        name text,
        created_at timestamp
      )
    `);
    console.log('✅ Tabela principal criada');

    // Inicializar manager
    const manager = new SingleTableUniqueManager(client, 'users_single_unique');
    await manager.initializeUniqueTable();

    // Limpar dados
    await client.execute('TRUNCATE users_single_unique');
    await client.execute(`TRUNCATE ${manager.uniqueTableName}`);
    console.log('✅ Tabelas limpas');

    console.log('\n🔒 TESTANDO TABELA ÚNICA PARA CONSTRAINTS...');

    // Teste 1: Criar primeiro usuário
    console.log('\n👤 TESTE 1 - PRIMEIRO USUÁRIO:');
    try {
      await manager.createUser({
        name: 'João Silva',
        email: 'joao@single.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Teste 2: Email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    try {
      await manager.createUser({
        name: 'João Diferente',
        email: 'joao@single.com'
      });
      console.log('❌ Email duplicado aceito');
    } catch (error) {
      console.log(`✅ Email duplicado rejeitado: ${error.message}`);
    }

    // Teste 3: Nome duplicado
    console.log('\n👤 TESTE 3 - NOME DUPLICADO:');
    try {
      await manager.createUser({
        name: 'João Silva',
        email: 'joao2@single.com'
      });
      console.log('❌ Nome duplicado aceito');
    } catch (error) {
      console.log(`✅ Nome duplicado rejeitado: ${error.message}`);
    }

    // Teste 4: Usuário único
    console.log('\n✅ TESTE 4 - USUÁRIO ÚNICO:');
    try {
      await manager.createUser({
        name: 'Maria Santos',
        email: 'maria@single.com'
      });
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    // Mostrar estrutura da tabela única
    console.log('\n📊 ESTRUTURA DA TABELA ÚNICA:');
    const constraints = await manager.listUniqueConstraints();
    console.log('Constraints armazenados:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.field_name}: "${constraint.field_value}" -> ${constraint.main_id.toString().substring(0, 8)}...`);
    });

    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    const users = await manager.listUsers();
    console.log(`📊 Total de usuários: ${users.length}`);
    console.log(`📊 Total de constraints: ${constraints.length}`);

    const emails = new Set();
    const names = new Set();

    users.forEach(user => {
      emails.add(user.email);
      names.add(user.name);
      console.log(`  - ${user.name} (${user.email})`);
    });

    console.log(`✅ Emails únicos: ${emails.size}/${users.length}`);
    console.log(`✅ Nomes únicos: ${names.size}/${users.length}`);

    if (emails.size === users.length && names.size === users.length) {
      console.log('🎉 TABELA ÚNICA FUNCIONANDO PERFEITAMENTE!');
    } else {
      console.log('⚠️ Duplicatas detectadas');
    }

    console.log('\n📋 VANTAGENS DA TABELA ÚNICA:');
    console.log('  ✅ Apenas 1 tabela auxiliar para todos os campos únicos');
    console.log('  ✅ Estrutura simples: (field_name, field_value) -> main_id');
    console.log('  ✅ Escalável para qualquer número de campos únicos');
    console.log('  ✅ Fácil de consultar e manter');
    console.log('  ✅ Menos overhead de tabelas');

    await client.disconnect();
    console.log('\n✅ TESTE CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testSingleUniqueTable();
