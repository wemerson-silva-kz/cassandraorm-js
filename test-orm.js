const cassandra = require('cassandra-driver');

class CassandraORM {
  constructor(options) {
    // Primeiro conecta sem keyspace para criar o keyspace
    this.client = new cassandra.Client({
      contactPoints: options.contactPoints || ['localhost'],
      localDataCenter: options.localDataCenter || 'datacenter1'
    });
    this.keyspace = options.keyspace;
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Conectado ao Cassandra');
  }

  async createKeyspace() {
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${this.keyspace}
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `;
    await this.client.execute(query);
    console.log(`✅ Keyspace '${this.keyspace}' criado`);
    
    // Agora conecta ao keyspace
    await this.client.shutdown();
    this.client = new cassandra.Client({
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1',
      keyspace: this.keyspace
    });
    await this.client.connect();
    console.log(`✅ Conectado ao keyspace '${this.keyspace}'`);
  }

  uuid() {
    return cassandra.types.Uuid.random();
  }

  model(name, schema, options = {}) {
    return new Model(this.client, name, schema, options);
  }

  async shutdown() {
    await this.client.shutdown();
  }
}

class Model {
  constructor(client, name, schema, options) {
    this.client = client;
    this.name = name;
    this.schema = schema;
    this.options = options;
  }

  async createTable() {
    const fields = Object.entries(this.schema)
      .map(([key, type]) => `${key} ${type}`)
      .join(', ');
    
    const primaryKey = this.options.key ? this.options.key.join(', ') : 'id';
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.name} (
        ${fields},
        PRIMARY KEY (${primaryKey})
      )
    `;
    
    await this.client.execute(query);
    console.log(`✅ Tabela '${this.name}' criada`);
  }

  async create(data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${this.name} (${fields}) VALUES (${placeholders})`;
    await this.client.execute(query, values, { prepare: true });
    
    console.log(`✅ Registro criado em '${this.name}'`);
    return data;
  }

  async find(where = {}) {
    let query = `SELECT * FROM ${this.name}`;
    const values = [];

    if (Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .map(([key, value]) => {
          values.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      
      query += ` WHERE ${conditions}`;
    }

    const result = await this.client.execute(query, values, { prepare: true });
    console.log(`✅ Encontrados ${result.rows.length} registros em '${this.name}'`);
    return result.rows;
  }
}

// Teste do ORM
async function testORM() {
  const orm = new CassandraORM({
    contactPoints: ['localhost'],
    localDataCenter: 'datacenter1',
    keyspace: 'test_cassandraorm'
  });

  try {
    await orm.connect();
    await orm.createKeyspace();

    // Definir modelo User
    const User = orm.model('users', {
      id: 'uuid',
      name: 'text',
      email: 'text',
      age: 'int',
      created_at: 'timestamp'
    }, {
      key: ['id']
    });

    await User.createTable();

    // Criar usuário
    const user = await User.create({
      id: orm.uuid(),
      name: 'João Silva',
      email: 'joao@email.com',
      age: 30,
      created_at: new Date()
    });

    // Buscar usuários
    const users = await User.find();
    console.log('\n📋 Usuários encontrados:', users.length);
    users.forEach(u => {
      console.log(`  - ${u.name} (${u.email})`);
    });

    await orm.shutdown();
    console.log('\n🔌 Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testORM();
