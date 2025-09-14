import { Client } from 'cassandra-driver';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export interface Migration {
  version: string;
  name: string;
  up: (schema: SchemaBuilder) => Promise<void> | void;
  down?: (schema: SchemaBuilder) => Promise<void> | void;
  executed_at?: Date;
  batch?: number;
}

export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  content: string;
}

export interface SchemaBuilder {
  createTable(tableName: string): TableBuilder;
  dropTable(tableName: string): Promise<void>;
  alterTable(tableName: string): TableBuilder;
  createIndex(tableName: string, columns: string | string[], indexName?: string): Promise<void>;
  dropIndex(indexName: string): Promise<void>;
  createKeyspace(keyspaceName: string, options?: KeyspaceOptions): Promise<void>;
  dropKeyspace(keyspaceName: string): Promise<void>;
  raw(query: string, params?: any[]): Promise<void>;
}

export interface TableBuilder {
  uuid(columnName: string): ColumnBuilder;
  text(columnName: string): ColumnBuilder;
  int(columnName: string): ColumnBuilder;
  bigint(columnName: string): ColumnBuilder;
  float(columnName: string): ColumnBuilder;
  double(columnName: string): ColumnBuilder;
  boolean(columnName: string): ColumnBuilder;
  timestamp(columnName: string): ColumnBuilder;
  date(columnName: string): ColumnBuilder;
  time(columnName: string): ColumnBuilder;
  blob(columnName: string): ColumnBuilder;
  list(columnName: string, type: string): ColumnBuilder;
  set(columnName: string, type: string): ColumnBuilder;
  map(columnName: string, keyType: string, valueType: string): ColumnBuilder;
  counter(columnName: string): ColumnBuilder;
  primaryKey(columns: string | string[]): TableBuilder;
  clusteringOrder(column: string, order: 'ASC' | 'DESC'): TableBuilder;
  withOptions(options: Record<string, any>): TableBuilder;
  addColumn(columnName: string, type: string): Promise<void>;
  dropColumn(columnName: string): Promise<void>;
  renameColumn(oldName: string, newName: string): Promise<void>;
  execute(): Promise<void>;
}

export interface ColumnBuilder {
  primaryKey(): ColumnBuilder;
  static(): ColumnBuilder;
  notNull(): ColumnBuilder;
  default(value: any): ColumnBuilder;
}

export interface KeyspaceOptions {
  replication?: {
    class: string;
    replication_factor?: number;
    [key: string]: any;
  };
  durableWrites?: boolean;
}

class CassandraSchemaBuilder implements SchemaBuilder {
  constructor(private client: Client, private keyspace: string) {}

  createTable(tableName: string): TableBuilder {
    return new CassandraTableBuilder(this.client, this.keyspace, tableName, 'CREATE');
  }

  dropTable(tableName: string): Promise<void> {
    const query = `DROP TABLE IF EXISTS ${this.getTableName(tableName)}`;
    return this.client.execute(query);
  }

  alterTable(tableName: string): TableBuilder {
    return new CassandraTableBuilder(this.client, this.keyspace, tableName, 'ALTER');
  }

  async createIndex(tableName: string, columns: string | string[], indexName?: string): Promise<void> {
    const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
    const name = indexName || `idx_${tableName}_${Array.isArray(columns) ? columns.join('_') : columns}`;
    const query = `CREATE INDEX IF NOT EXISTS ${name} ON ${this.getTableName(tableName)} (${columnList})`;
    await this.client.execute(query);
  }

  async dropIndex(indexName: string): Promise<void> {
    const query = `DROP INDEX IF EXISTS ${indexName}`;
    await this.client.execute(query);
  }

  async createKeyspace(keyspaceName: string, options: KeyspaceOptions = {}): Promise<void> {
    const replication = options.replication || {
      class: 'SimpleStrategy',
      replication_factor: 1
    };

    const replicationStr = Object.entries(replication)
      .map(([key, value]) => `'${key}': ${typeof value === 'string' ? `'${value}'` : value}`)
      .join(', ');

    let query = `CREATE KEYSPACE IF NOT EXISTS ${keyspaceName} WITH REPLICATION = {${replicationStr}}`;
    
    if (options.durableWrites !== undefined) {
      query += ` AND DURABLE_WRITES = ${options.durableWrites}`;
    }

    await this.client.execute(query);
  }

  async dropKeyspace(keyspaceName: string): Promise<void> {
    const query = `DROP KEYSPACE IF EXISTS ${keyspaceName}`;
    await this.client.execute(query);
  }

  async raw(query: string, params: any[] = []): Promise<void> {
    await this.client.execute(query, params);
  }

  private getTableName(tableName: string): string {
    return this.keyspace ? `"${this.keyspace}"."${tableName}"` : `"${tableName}"`;
  }
}

class CassandraTableBuilder implements TableBuilder {
  private columns: string[] = [];
  private primaryKeyColumns: string[] = [];
  private clusteringColumns: { column: string; order: 'ASC' | 'DESC' }[] = [];
  private options: Record<string, any> = {};

  constructor(
    private client: Client,
    private keyspace: string,
    private tableName: string,
    private operation: 'CREATE' | 'ALTER'
  ) {}

  uuid(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'uuid');
  }

  text(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'text');
  }

  int(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'int');
  }

  bigint(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'bigint');
  }

  float(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'float');
  }

  double(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'double');
  }

  boolean(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'boolean');
  }

  timestamp(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'timestamp');
  }

  date(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'date');
  }

  time(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'time');
  }

  blob(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'blob');
  }

  list(columnName: string, type: string): ColumnBuilder {
    return this.addColumn(columnName, `list<${type}>`);
  }

  set(columnName: string, type: string): ColumnBuilder {
    return this.addColumn(columnName, `set<${type}>`);
  }

  map(columnName: string, keyType: string, valueType: string): ColumnBuilder {
    return this.addColumn(columnName, `map<${keyType}, ${valueType}>`);
  }

  counter(columnName: string): ColumnBuilder {
    return this.addColumn(columnName, 'counter');
  }

  primaryKey(columns: string | string[]): TableBuilder {
    this.primaryKeyColumns = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  clusteringOrder(column: string, order: 'ASC' | 'DESC' = 'ASC'): TableBuilder {
    this.clusteringColumns.push({ column, order });
    return this;
  }

  withOptions(options: Record<string, any>): TableBuilder {
    this.options = { ...this.options, ...options };
    return this;
  }

  async addColumn(columnName: string, type: string): Promise<void> {
    if (this.operation !== 'ALTER') {
      throw new Error('addColumn can only be used with ALTER TABLE');
    }
    
    const query = `ALTER TABLE ${this.getTableName()} ADD ${columnName} ${type}`;
    await this.client.execute(query);
  }

  async dropColumn(columnName: string): Promise<void> {
    if (this.operation !== 'ALTER') {
      throw new Error('dropColumn can only be used with ALTER TABLE');
    }
    
    const query = `ALTER TABLE ${this.getTableName()} DROP ${columnName}`;
    await this.client.execute(query);
  }

  async renameColumn(oldName: string, newName: string): Promise<void> {
    if (this.operation !== 'ALTER') {
      throw new Error('renameColumn can only be used with ALTER TABLE');
    }
    
    const query = `ALTER TABLE ${this.getTableName()} RENAME ${oldName} TO ${newName}`;
    await this.client.execute(query);
  }

  async execute(): Promise<void> {
    if (this.operation === 'CREATE') {
      await this.executeCreate();
    }
  }

  private async executeCreate(): Promise<void> {
    if (this.columns.length === 0) {
      throw new Error('No columns defined for table');
    }

    let query = `CREATE TABLE IF NOT EXISTS ${this.getTableName()} (${this.columns.join(', ')}`;

    if (this.primaryKeyColumns.length > 0) {
      query += `, PRIMARY KEY (${this.primaryKeyColumns.join(', ')})`;
    }

    query += ')';

    // Add clustering order
    if (this.clusteringColumns.length > 0) {
      const clusteringOrder = this.clusteringColumns
        .map(c => `${c.column} ${c.order}`)
        .join(', ');
      query += ` WITH CLUSTERING ORDER BY (${clusteringOrder})`;
    }

    // Add other options
    if (Object.keys(this.options).length > 0) {
      const optionsStr = Object.entries(this.options)
        .map(([key, value]) => `${key} = ${typeof value === 'string' ? `'${value}'` : value}`)
        .join(' AND ');
      
      if (this.clusteringColumns.length > 0) {
        query += ` AND ${optionsStr}`;
      } else {
        query += ` WITH ${optionsStr}`;
      }
    }

    await this.client.execute(query);
  }

  private addColumn(columnName: string, type: string): ColumnBuilder {
    const columnBuilder = new CassandraColumnBuilder(columnName, type);
    
    // Add to columns when column builder is finalized
    columnBuilder.onFinalize = (columnDef: string) => {
      this.columns.push(columnDef);
    };

    return columnBuilder;
  }

  private getTableName(): string {
    return this.keyspace ? `"${this.keyspace}"."${this.tableName}"` : `"${this.tableName}"`;
  }
}

class CassandraColumnBuilder implements ColumnBuilder {
  private modifiers: string[] = [];
  public onFinalize?: (columnDef: string) => void;

  constructor(private columnName: string, private type: string) {
    // Auto-finalize when no more methods are chained
    setTimeout(() => this.finalize(), 0);
  }

  primaryKey(): ColumnBuilder {
    this.modifiers.push('PRIMARY KEY');
    return this;
  }

  static(): ColumnBuilder {
    this.modifiers.push('STATIC');
    return this;
  }

  notNull(): ColumnBuilder {
    // Cassandra doesn't have NOT NULL, but we can track it for validation
    return this;
  }

  default(value: any): ColumnBuilder {
    // Cassandra doesn't support DEFAULT values in column definitions
    // This would need to be handled at the application level
    return this;
  }

  private finalize(): void {
    const columnDef = `${this.columnName} ${this.type}${this.modifiers.length > 0 ? ' ' + this.modifiers.join(' ') : ''}`;
    this.onFinalize?.(columnDef);
  }
}

export class MigrationManager {
  private migrationsPath: string;
  private schemaBuilder: SchemaBuilder;

  constructor(
    private client: Client,
    private keyspace: string,
    migrationsPath?: string
  ) {
    this.migrationsPath = migrationsPath || './migrations';
    this.schemaBuilder = new CassandraSchemaBuilder(client, keyspace);
  }

  async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace ? `"${this.keyspace}".` : ''}migrations (
        version text PRIMARY KEY,
        name text,
        batch int,
        executed_at timestamp
      )
    `;
    await this.client.execute(query);
  }

  async getExecutedMigrations(): Promise<Migration[]> {
    await this.createMigrationsTable();
    
    const result = await this.client.execute(
      `SELECT version, name, batch, executed_at FROM ${this.keyspace ? `"${this.keyspace}".` : ''}migrations ORDER BY version`
    );
    
    return result.rows.map(row => ({
      version: row.version,
      name: row.name,
      batch: row.batch,
      executed_at: row.executed_at,
      up: () => {},
      down: () => {}
    }));
  }

  async getPendingMigrations(): Promise<MigrationFile[]> {
    const allMigrations = await this.loadMigrationFiles();
    const executed = await this.getExecutedMigrations();
    const executedVersions = new Set(executed.map(m => m.version));

    return allMigrations.filter(m => !executedVersions.has(m.version));
  }

  async loadMigrationFiles(): Promise<MigrationFile[]> {
    if (!existsSync(this.migrationsPath)) {
      return [];
    }

    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
      .sort();

    const migrations: MigrationFile[] = [];

    for (const filename of migrationFiles) {
      const filePath = join(this.migrationsPath, filename);
      const content = await readFile(filePath, 'utf-8');
      
      // Extract version from filename (assuming format: YYYYMMDDHHMMSS_migration_name.js)
      const versionMatch = filename.match(/^(\d{14})_(.+)\.(js|ts)$/);
      if (versionMatch) {
        migrations.push({
          version: versionMatch[1],
          name: versionMatch[2].replace(/_/g, ' '),
          filename,
          content
        });
      }
    }

    return migrations;
  }

  async executeMigration(migration: Migration, batch: number): Promise<void> {
    console.log(`Executing migration: ${migration.name}`);
    
    try {
      await migration.up(this.schemaBuilder);
      
      await this.client.execute(
        `INSERT INTO ${this.keyspace ? `"${this.keyspace}".` : ''}migrations (version, name, batch, executed_at) VALUES (?, ?, ?, ?)`,
        [migration.version, migration.name, batch, new Date()],
        { prepare: true }
      );
      
      console.log(`✅ Migration completed: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${migration.name}`, error);
      throw error;
    }
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    if (!migration.down) {
      throw new Error(`Migration ${migration.name} has no down method`);
    }

    console.log(`Rolling back migration: ${migration.name}`);
    
    try {
      await migration.down(this.schemaBuilder);
      
      await this.client.execute(
        `DELETE FROM ${this.keyspace ? `"${this.keyspace}".` : ''}migrations WHERE version = ?`,
        [migration.version],
        { prepare: true }
      );
      
      console.log(`✅ Rollback completed: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${migration.name}`, error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    const executed = await this.getExecutedMigrations();
    const nextBatch = Math.max(0, ...executed.map(m => m.batch || 0)) + 1;

    console.log(`Running ${pending.length} migrations...`);

    for (const migrationFile of pending) {
      const migration = await this.loadMigration(migrationFile);
      await this.executeMigration(migration, nextBatch);
    }

    console.log('All migrations completed');
  }

  async rollback(steps: number = 1): Promise<void> {
    const executed = await this.getExecutedMigrations();
    
    if (executed.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const toRollback = executed.slice(-steps).reverse();
    
    console.log(`Rolling back ${toRollback.length} migrations...`);

    for (const migration of toRollback) {
      const migrationFile = await this.findMigrationFile(migration.version);
      if (migrationFile) {
        const fullMigration = await this.loadMigration(migrationFile);
        await this.rollbackMigration(fullMigration);
      }
    }

    console.log('Rollback completed');
  }

  async reset(): Promise<void> {
    const executed = await this.getExecutedMigrations();
    
    console.log(`Rolling back all ${executed.length} migrations...`);
    
    for (const migration of executed.reverse()) {
      const migrationFile = await this.findMigrationFile(migration.version);
      if (migrationFile) {
        const fullMigration = await this.loadMigration(migrationFile);
        await this.rollbackMigration(fullMigration);
      }
    }

    console.log('Database reset completed');
  }

  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
    const filePath = join(this.migrationsPath, filename);

    // Ensure migrations directory exists
    if (!existsSync(this.migrationsPath)) {
      await mkdir(this.migrationsPath, { recursive: true });
    }

    const template = `// Migration: ${name}
// Created: ${new Date().toISOString()}

export const up = async (schema) => {
  // Add your migration logic here
  // Example:
  // await schema.createTable('users')
  //   .uuid('id').primaryKey()
  //   .text('name')
  //   .text('email')
  //   .timestamp('created_at')
  //   .execute();
};

export const down = async (schema) => {
  // Add your rollback logic here
  // Example:
  // await schema.dropTable('users');
};
`;

    await writeFile(filePath, template);
    console.log(`Migration created: ${filename}`);
    
    return filePath;
  }

  private async loadMigration(migrationFile: MigrationFile): Promise<Migration> {
    const filePath = join(this.migrationsPath, migrationFile.filename);
    
    // Dynamic import for ES modules
    const module = await import(resolve(filePath));
    
    return {
      version: migrationFile.version,
      name: migrationFile.name,
      up: module.up,
      down: module.down
    };
  }

  private async findMigrationFile(version: string): Promise<MigrationFile | null> {
    const allMigrations = await this.loadMigrationFiles();
    return allMigrations.find(m => m.version === version) || null;
  }

  // Status and info methods
  async status(): Promise<{ executed: Migration[]; pending: MigrationFile[] }> {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();
    
    return { executed, pending };
  }

  async info(): Promise<void> {
    const { executed, pending } = await this.status();
    
    console.log('\n📊 Migration Status:');
    console.log(`✅ Executed: ${executed.length}`);
    console.log(`⏳ Pending: ${pending.length}`);
    
    if (executed.length > 0) {
      console.log('\n✅ Executed Migrations:');
      executed.forEach(m => {
        console.log(`  - ${m.version}: ${m.name} (${m.executed_at?.toISOString()})`);
      });
    }
    
    if (pending.length > 0) {
      console.log('\n⏳ Pending Migrations:');
      pending.forEach(m => {
        console.log(`  - ${m.version}: ${m.name}`);
      });
    }
  }
}
