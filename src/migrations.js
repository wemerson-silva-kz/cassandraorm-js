const fs = require('fs').promises;
const path = require('path');

class MigrationManager {
  constructor(client, migrationsPath = './migrations') {
    this.client = client;
    this.migrationsPath = migrationsPath;
    this.migrationsTable = 'cassandra_migrations';
  }

  async init() {
    // Create migrations tracking table
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id text PRIMARY KEY,
        executed_at timestamp,
        checksum text
      )
    `;
    await this.client.execute(query);
  }

  async createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `${timestamp}_${name}.js`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `
module.exports = {
  up: async (client) => {
    // Migration up logic
    // Example: await client.execute('CREATE TABLE ...');
  },

  down: async (client) => {
    // Migration down logic
    // Example: await client.execute('DROP TABLE ...');
  }
};
`;

    await fs.mkdir(this.migrationsPath, { recursive: true });
    await fs.writeFile(filepath, template.trim());
    
    console.log(`✅ Migration created: ${filename}`);
    return filepath;
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort();
    } catch (error) {
      return [];
    }
  }

  async getExecutedMigrations() {
    const result = await this.client.execute(`SELECT id FROM ${this.migrationsTable}`);
    return result.rows.map(row => row.id);
  }

  async executeMigration(filename) {
    const filepath = path.join(this.migrationsPath, filename);
    const migration = require(path.resolve(filepath));
    
    await migration.up(this.client);
    
    // Record migration as executed
    await this.client.execute(
      `INSERT INTO ${this.migrationsTable} (id, executed_at) VALUES (?, ?)`,
      [filename, new Date()],
      { prepare: true }
    );
    
    console.log(`✅ Executed migration: ${filename}`);
  }

  async rollbackMigration(filename) {
    const filepath = path.join(this.migrationsPath, filename);
    const migration = require(path.resolve(filepath));
    
    if (migration.down) {
      await migration.down(this.client);
      
      // Remove migration record
      await this.client.execute(
        `DELETE FROM ${this.migrationsTable} WHERE id = ?`,
        [filename],
        { prepare: true }
      );
      
      console.log(`✅ Rolled back migration: ${filename}`);
    } else {
      throw new Error(`Migration ${filename} does not have a down method`);
    }
  }

  async migrate() {
    await this.init();
    
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await getExecutedMigrations();
    
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Executing ${pendingMigrations.length} migrations...`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('✅ All migrations completed');
  }

  async rollback(steps = 1) {
    const executedMigrations = await this.getExecutedMigrations();
    const toRollback = executedMigrations.slice(-steps).reverse();
    
    for (const migration of toRollback) {
      await this.rollbackMigration(migration);
    }
  }

  async status() {
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    console.log('\n📋 Migration Status:');
    allMigrations.forEach(migration => {
      const status = executedMigrations.includes(migration) ? '✅' : '⏳';
      console.log(`${status} ${migration}`);
    });
  }
}

module.exports = { MigrationManager };
