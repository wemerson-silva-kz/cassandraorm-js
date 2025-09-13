const cassandra = require('cassandra-driver');

class CassandraORM {
  constructor(options) {
    this.client = new cassandra.Client({
      contactPoints: options.contactPoints || ['localhost'],
      localDataCenter: options.localDataCenter || 'datacenter1'
    });
    this.keyspace = options.keyspace;
  }

  async connect() {
    await this.client.connect();
    if (this.keyspace) {
      await this.createKeyspace();
      await this.client.shutdown();
      this.client = new cassandra.Client({
        contactPoints: ['localhost'],
        localDataCenter: 'datacenter1',
        keyspace: this.keyspace
      });
      await this.client.connect();
    }
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
  }

  async create(data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${this.name} (${fields}) VALUES (${placeholders})`;
    await this.client.execute(query, values, { prepare: true });
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
    return result.rows;
  }

  async findOne(where = {}) {
    const results = await this.find(where);
    return results[0] || null;
  }

  async update(where, data) {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const values = [...Object.values(data), ...Object.values(where)];
    const query = `UPDATE ${this.name} SET ${setClause} WHERE ${whereClause}`;
    
    await this.client.execute(query, values, { prepare: true });
  }

  async delete(where) {
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const values = Object.values(where);
    const query = `DELETE FROM ${this.name} WHERE ${whereClause}`;
    
    await this.client.execute(query, values, { prepare: true });
  }
}

module.exports = { CassandraORM, Model };
