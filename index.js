const cassandra = require('cassandra-driver');
const { ConnectionPool } = require('./src/connection-pool');
const { QueryBuilder } = require('./src/query-builder');
const { MigrationManager } = require('./src/migrations');
const { Monitor } = require('./src/monitoring');
const { PluginManager, CachePlugin, ValidationPlugin } = require('./src/plugin-system');

class CassandraORM {
  constructor(options = {}) {
    this.options = options;
    this.keyspace = options.keyspace;
    this.models = new Map();
    
    // Initialize advanced features
    this.connectionPool = new ConnectionPool(options);
    this.monitor = new Monitor(options.monitoring);
    this.pluginManager = new PluginManager();
    this.migrationManager = null;
    
    // Setup client reference for backward compatibility
    this.client = null;
  }

  async connect() {
    this.client = await this.connectionPool.getConnection(this.keyspace);
    this.monitor.recordConnection('connect');
    
    // Initialize migration manager
    this.migrationManager = new MigrationManager(this.client, this.options.migrationsPath);
    
    // Execute hooks
    await this.pluginManager.executeHook('afterConnect', { client: this.client });
    
    this.monitor.log('info', 'Connected to Cassandra', { keyspace: this.keyspace });
  }

  async createKeyspace() {
    const replication = this.options.replication || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };
    
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${this.keyspace}
      WITH REPLICATION = ${JSON.stringify(replication).replace(/"/g, "'")}
    `;
    
    const queryContext = this.monitor.startQuery(query);
    try {
      await this.client.execute(query);
      this.monitor.endQuery(queryContext);
    } catch (error) {
      this.monitor.endQuery(queryContext, error);
      throw error;
    }
  }

  // Query Builder
  query(tableName) {
    return new QueryBuilder(this.client, tableName);
  }

  // UUID utilities
  uuid() {
    return cassandra.types.Uuid.random();
  }

  timeuuid() {
    return cassandra.types.TimeUuid.now();
  }

  // Model management
  model(name, schema, options = {}) {
    if (this.models.has(name)) {
      return this.models.get(name);
    }
    
    const model = new Model(this.client, name, schema, options, this);
    this.models.set(name, model);
    return model;
  }

  // Migration methods
  async migrate() {
    if (!this.migrationManager) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.migrationManager.migrate();
  }

  async createMigration(name) {
    if (!this.migrationManager) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.migrationManager.createMigration(name);
  }

  async rollback(steps = 1) {
    if (!this.migrationManager) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.migrationManager.rollback(steps);
  }

  // Plugin methods
  use(plugin, options = {}) {
    if (typeof plugin === 'string') {
      // Built-in plugins
      switch (plugin) {
        case 'cache':
          this.pluginManager.register('cache', new CachePlugin(options));
          break;
        case 'validation':
          this.pluginManager.register('validation', new ValidationPlugin(options));
          break;
        default:
          throw new Error(`Unknown built-in plugin: ${plugin}`);
      }
    } else {
      // Custom plugin
      const name = options.name || plugin.name || 'anonymous';
      this.pluginManager.register(name, plugin);
    }
    return this;
  }

  // Monitoring
  getMetrics() {
    return {
      ...this.monitor.getMetrics(),
      connectionPool: this.connectionPool.getPoolStats()
    };
  }

  getHealthCheck() {
    return this.monitor.getHealthCheck();
  }

  // Batch operations
  batch() {
    return new BatchQuery(this.client, this.monitor, this.pluginManager);
  }

  async shutdown() {
    this.monitor.recordConnection('disconnect');
    await this.connectionPool.closeAll();
    await this.pluginManager.executeHook('beforeDisconnect');
  }
}

class Model {
  constructor(client, name, schema, options, orm) {
    this.client = client;
    this.name = name;
    this.schema = schema;
    this.options = options;
    this.orm = orm;
  }

  // Query builder for this model
  query() {
    return new QueryBuilder(this.client, this.name);
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
    
    const queryContext = this.orm.monitor.startQuery(query);
    try {
      await this.client.execute(query);
      this.orm.monitor.endQuery(queryContext);
    } catch (error) {
      this.orm.monitor.endQuery(queryContext, error);
      throw error;
    }
  }

  async create(data) {
    // Execute hooks
    const context = await this.orm.pluginManager.executeHook('beforeInsert', {
      data, schema: this.schema, model: this.name
    });

    const fields = Object.keys(context.data).join(', ');
    const placeholders = Object.keys(context.data).map(() => '?').join(', ');
    const values = Object.values(context.data);

    const query = `INSERT INTO ${this.name} (${fields}) VALUES (${placeholders})`;
    
    const queryContext = this.orm.monitor.startQuery(query, values);
    try {
      await this.client.execute(query, values, { prepare: true });
      this.orm.monitor.endQuery(queryContext);
      
      await this.orm.pluginManager.executeHook('afterInsert', { data: context.data, model: this.name });
      return context.data;
    } catch (error) {
      this.orm.monitor.endQuery(queryContext, error);
      throw error;
    }
  }

  async find(where = {}, options = {}) {
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

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const queryContext = this.orm.monitor.startQuery(query, values);
    try {
      const result = await this.client.execute(query, values, { prepare: true });
      this.orm.monitor.endQuery(queryContext);
      return result.rows;
    } catch (error) {
      this.orm.monitor.endQuery(queryContext, error);
      throw error;
    }
  }

  async findOne(where = {}, options = {}) {
    const results = await this.find(where, { ...options, limit: 1 });
    return results[0] || null;
  }

  async update(where, data) {
    const context = await this.orm.pluginManager.executeHook('beforeUpdate', {
      data, where, schema: this.schema, model: this.name
    });

    const setClause = Object.keys(context.data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = [...Object.values(context.data), ...Object.values(where)];
    
    const query = `UPDATE ${this.name} SET ${setClause} WHERE ${whereClause}`;
    
    const queryContext = this.orm.monitor.startQuery(query, values);
    try {
      await this.client.execute(query, values, { prepare: true });
      this.orm.monitor.endQuery(queryContext);
      
      await this.orm.pluginManager.executeHook('afterUpdate', { data: context.data, where, model: this.name });
    } catch (error) {
      this.orm.monitor.endQuery(queryContext, error);
      throw error;
    }
  }

  async delete(where) {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);
    const query = `DELETE FROM ${this.name} WHERE ${whereClause}`;
    
    const queryContext = this.orm.monitor.startQuery(query, values);
    try {
      await this.client.execute(query, values, { prepare: true });
      this.orm.monitor.endQuery(queryContext);
      
      await this.orm.pluginManager.executeHook('afterDelete', { where, model: this.name });
    } catch (error) {
      this.orm.monitor.endQuery(queryContext, error);
      throw error;
    }
  }
}

class BatchQuery {
  constructor(client, monitor, pluginManager) {
    this.client = client;
    this.monitor = monitor;
    this.pluginManager = pluginManager;
    this.queries = [];
  }

  insert(model, data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    this.queries.push({
      query: `INSERT INTO ${model.name} (${fields}) VALUES (${placeholders})`,
      params: values
    });
    return this;
  }

  update(model, where, data) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = [...Object.values(data), ...Object.values(where)];
    
    this.queries.push({
      query: `UPDATE ${model.name} SET ${setClause} WHERE ${whereClause}`,
      params: values
    });
    return this;
  }

  delete(model, where) {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);
    
    this.queries.push({
      query: `DELETE FROM ${model.name} WHERE ${whereClause}`,
      params: values
    });
    return this;
  }

  async execute() {
    const queryContext = this.monitor.startQuery('BATCH', this.queries);
    try {
      await this.client.batch(this.queries, { prepare: true });
      this.monitor.endQuery(queryContext);
      this.queries = [];
      
      await this.pluginManager.executeHook('afterBatch', { queries: this.queries });
    } catch (error) {
      this.monitor.endQuery(queryContext, error);
      throw error;
    }
  }
}

module.exports = { 
  CassandraORM, 
  Model, 
  BatchQuery,
  QueryBuilder,
  MigrationManager,
  Monitor,
  PluginManager,
  CachePlugin,
  ValidationPlugin
};
