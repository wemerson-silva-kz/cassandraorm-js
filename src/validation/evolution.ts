import type { Client } from "cassandra-driver";

export interface MigrationStep {
  id: string;
  description: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
  validate?: () => Promise<boolean>;
}

export interface SchemaEvolutionConfig {
  enabled?: boolean;
  migrationsTable?: string;
  autoRun?: boolean;
  backupBeforeMigration?: boolean;
  validateAfterMigration?: boolean;
}

export interface MigrationRecord {
  id: string;
  description: string;
  applied_at: Date;
  execution_time_ms: number;
  checksum?: string;
}

export class SchemaEvolution {
  private client: Client;
  private keyspace: string;
  private config: Required<SchemaEvolutionConfig>;
  private migrations: MigrationStep[] = [];

  constructor(client: Client, keyspace: string, config: SchemaEvolutionConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      migrationsTable: 'schema_migrations',
      autoRun: false,
      backupBeforeMigration: false,
      validateAfterMigration: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    await this.createMigrationsTable();
  }

  private async createMigrationsTable(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.config.migrationsTable} (
        id text PRIMARY KEY,
        description text,
        applied_at timestamp,
        execution_time_ms int,
        checksum text
      )
    `);
  }

  // Add migration step
  addMigration(migration: MigrationStep): this {
    this.migrations.push(migration);
    return this;
  }

  // Fluent API for building migrations
  migration(id: string, description: string): MigrationBuilder {
    return new MigrationBuilder(this, id, description);
  }

  // Get applied migrations
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.migrationsTable}`
    );
    
    return result.rows.map(row => ({
      id: row.id,
      description: row.description,
      applied_at: row.applied_at,
      execution_time_ms: row.execution_time_ms,
      checksum: row.checksum
    })).sort((a, b) => a.applied_at.getTime() - b.applied_at.getTime());
  }

  // Get pending migrations
  async getPendingMigrations(): Promise<MigrationStep[]> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map(m => m.id));
    
    return this.migrations.filter(m => !appliedIds.has(m.id));
  }

  // Run all pending migrations
  async migrate(): Promise<MigrationRecord[]> {
    if (!this.config.enabled) {
      throw new Error('Schema evolution is disabled');
    }

    const pending = await this.getPendingMigrations();
    const results: MigrationRecord[] = [];

    for (const migration of pending) {
      const result = await this.runMigration(migration);
      results.push(result);
    }

    return results;
  }

  // Run specific migration
  async runMigration(migration: MigrationStep): Promise<MigrationRecord> {
    const startTime = Date.now();
    
    try {
      // Validate before running
      if (migration.validate) {
        const isValid = await migration.validate();
        if (!isValid) {
          throw new Error(`Migration ${migration.id} validation failed`);
        }
      }

      // Run the migration
      await migration.up();
      
      const executionTime = Date.now() - startTime;
      const record: MigrationRecord = {
        id: migration.id,
        description: migration.description,
        applied_at: new Date(),
        execution_time_ms: executionTime
      };

      // Record the migration
      await this.client.execute(
        `INSERT INTO ${this.keyspace}.${this.config.migrationsTable} 
         (id, description, applied_at, execution_time_ms) 
         VALUES (?, ?, ?, ?)`,
        [record.id, record.description, record.applied_at, record.execution_time_ms],
        { prepare: true }
      );

      return record;
      
    } catch (error) {
      throw new Error(`Migration ${migration.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Rollback migration
  async rollback(migrationId: string): Promise<void> {
    const migration = this.migrations.find(m => m.id === migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${migrationId} has no rollback function`);
    }

    try {
      await migration.down();
      
      // Remove from migrations table
      await this.client.execute(
        `DELETE FROM ${this.keyspace}.${this.config.migrationsTable} WHERE id = ?`,
        [migrationId],
        { prepare: true }
      );
      
    } catch (error) {
      throw new Error(`Rollback of ${migrationId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get migration status
  async getStatus(): Promise<{
    applied: number;
    pending: number;
    total: number;
    lastMigration?: MigrationRecord;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      applied: applied.length,
      pending: pending.length,
      total: this.migrations.length,
      lastMigration: applied[applied.length - 1]
    };
  }
}

export class MigrationBuilder {
  private evolution: SchemaEvolution;
  private migration: Partial<MigrationStep>;

  constructor(evolution: SchemaEvolution, id: string, description: string) {
    this.evolution = evolution;
    this.migration = { id, description };
  }

  // Add column to table
  addColumn(tableName: string, columnName: string, columnType: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(
        `ALTER TABLE ${this.evolution['keyspace']}.${tableName} ADD ${columnName} ${columnType}`
      );
    };

    const currentDown = this.migration.down;
    this.migration.down = async () => {
      await this.evolution['client'].execute(
        `ALTER TABLE ${this.evolution['keyspace']}.${tableName} DROP ${columnName}`
      );
      if (currentDown) await currentDown();
    };

    return this;
  }

  // Drop column from table
  dropColumn(tableName: string, columnName: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(
        `ALTER TABLE ${this.evolution['keyspace']}.${tableName} DROP ${columnName}`
      );
    };

    return this;
  }

  // Create table
  createTable(tableName: string, schema: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(
        `CREATE TABLE IF NOT EXISTS ${this.evolution['keyspace']}.${tableName} ${schema}`
      );
    };

    const currentDown = this.migration.down;
    this.migration.down = async () => {
      await this.evolution['client'].execute(
        `DROP TABLE IF EXISTS ${this.evolution['keyspace']}.${tableName}`
      );
      if (currentDown) await currentDown();
    };

    return this;
  }

  // Drop table
  dropTable(tableName: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(
        `DROP TABLE IF EXISTS ${this.evolution['keyspace']}.${tableName}`
      );
    };

    return this;
  }

  // Create index
  createIndex(indexName: string, tableName: string, column: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${this.evolution['keyspace']}.${tableName} (${column})`
      );
    };

    const currentDown = this.migration.down;
    this.migration.down = async () => {
      await this.evolution['client'].execute(`DROP INDEX IF EXISTS ${indexName}`);
      if (currentDown) await currentDown();
    };

    return this;
  }

  // Execute custom SQL
  execute(sql: string): this {
    const currentUp = this.migration.up;
    this.migration.up = async () => {
      if (currentUp) await currentUp();
      await this.evolution['client'].execute(sql);
    };

    return this;
  }

  // Add custom up function
  up(fn: () => Promise<void>): this {
    this.migration.up = fn;
    return this;
  }

  // Add custom down function
  down(fn: () => Promise<void>): this {
    this.migration.down = fn;
    return this;
  }

  // Add validation function
  validate(fn: () => Promise<boolean>): this {
    this.migration.validate = fn;
    return this;
  }

  // Finalize and add to evolution
  build(): SchemaEvolution {
    if (!this.migration.up) {
      throw new Error('Migration must have an up function');
    }

    this.evolution.addMigration(this.migration as MigrationStep);
    return this.evolution;
  }
}

// Built-in migration helpers
export class MigrationHelpers {
  constructor(private client: Client, private keyspace: string) {}

  async tableExists(tableName: string): Promise<boolean> {
    try {
      await this.client.execute(
        `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ? AND table_name = ?`,
        [this.keyspace, tableName]
      );
      return true;
    } catch {
      return false;
    }
  }

  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const result = await this.client.execute(
        `SELECT column_name FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ? AND column_name = ?`,
        [this.keyspace, tableName, columnName]
      );
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  async indexExists(indexName: string): Promise<boolean> {
    try {
      const result = await this.client.execute(
        `SELECT index_name FROM system_schema.indexes WHERE keyspace_name = ? AND index_name = ?`,
        [this.keyspace, indexName]
      );
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  async backfillColumn(
    tableName: string, 
    columnName: string, 
    defaultValue: any,
    batchSize: number = 1000
  ): Promise<void> {
    let pageState: string | undefined;
    
    do {
      const result = await this.client.execute(
        `SELECT * FROM ${this.keyspace}.${tableName}`,
        [],
        { prepare: true, fetchSize: batchSize, pageState }
      );

      if (result.rows.length > 0) {
        const batch = result.rows.map(row => ({
          query: `UPDATE ${this.keyspace}.${tableName} SET ${columnName} = ? WHERE id = ?`,
          params: [defaultValue, row.id]
        }));

        await this.client.batch(batch, { prepare: true });
      }

      pageState = result.pageState;
    } while (pageState);
  }
}
