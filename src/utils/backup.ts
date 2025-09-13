import { EventEmitter } from 'events';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import type { Client } from "cassandra-driver";

export interface BackupConfig {
  destination: string;
  compression?: boolean;
  encryption?: boolean;
  schedule?: string; // Cron format
  retention?: string; // e.g., '30d', '1y'
  includeSchema?: boolean;
  excludeTables?: string[];
  batchSize?: number;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  keyspace: string;
  tables: string[];
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum?: string;
}

export interface RestoreOptions {
  backupId?: string;
  backupPath?: string;
  targetKeyspace?: string;
  includeSchema?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
}

export class BackupManager extends EventEmitter {
  private client: Client;
  private keyspace: string;
  private config: Required<BackupConfig>;

  constructor(client: Client, keyspace: string, config: BackupConfig) {
    super();
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      compression: true,
      encryption: false,
      schedule: '',
      retention: '30d',
      includeSchema: true,
      excludeTables: [],
      batchSize: 1000,
      ...config
    };
  }

  async createBackup(options: { 
    tables?: string[];
    description?: string;
  } = {}): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    
    this.emit('backupStarted', { backupId, timestamp });

    try {
      // Get tables to backup
      const tables = options.tables || await this.getTables();
      const filteredTables = tables.filter(table => 
        !this.config.excludeTables.includes(table)
      );

      // Create backup directory
      const backupDir = join(this.config.destination, backupId);
      await mkdir(backupDir, { recursive: true });

      // Backup schema if requested
      if (this.config.includeSchema) {
        await this.backupSchema(backupDir);
      }

      // Backup data
      let totalSize = 0;
      for (const table of filteredTables) {
        const tableSize = await this.backupTable(backupDir, table);
        totalSize += tableSize;
        
        this.emit('tableBackedUp', { 
          backupId, 
          table, 
          size: tableSize,
          progress: filteredTables.indexOf(table) + 1,
          total: filteredTables.length
        });
      }

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        keyspace: this.keyspace,
        tables: filteredTables,
        size: totalSize,
        compressed: this.config.compression,
        encrypted: this.config.encryption
      };

      // Save metadata
      await this.saveMetadata(backupDir, metadata);

      this.emit('backupCompleted', metadata);
      return metadata;

    } catch (error) {
      this.emit('backupFailed', { backupId, error });
      throw error;
    }
  }

  private async getTables(): Promise<string[]> {
    const result = await this.client.execute(
      'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?',
      [this.keyspace]
    );
    return result.rows.map(row => row.table_name);
  }

  private async backupSchema(backupDir: string): Promise<void> {
    // Get keyspace schema
    const keyspaceResult = await this.client.execute(
      'SELECT * FROM system_schema.keyspaces WHERE keyspace_name = ?',
      [this.keyspace]
    );

    // Get tables schema
    const tablesResult = await this.client.execute(
      'SELECT * FROM system_schema.tables WHERE keyspace_name = ?',
      [this.keyspace]
    );

    // Get columns schema
    const columnsResult = await this.client.execute(
      'SELECT * FROM system_schema.columns WHERE keyspace_name = ?',
      [this.keyspace]
    );

    const schema = {
      keyspace: keyspaceResult.rows[0],
      tables: tablesResult.rows,
      columns: columnsResult.rows
    };

    const schemaPath = join(backupDir, 'schema.json');
    await writeFile(schemaPath, JSON.stringify(schema, null, 2));
  }

  private async backupTable(backupDir: string, tableName: string): Promise<number> {
    const filePath = join(backupDir, `${tableName}.jsonl`);
    let writeStream = createWriteStream(filePath);
    
    if (this.config.compression) {
      const gzipStream = createGzip();
      writeStream = gzipStream.pipe(createWriteStream(`${filePath}.gz`)) as any;
    }

    let totalSize = 0;
    let pageState: string | undefined;

    do {
      const result = await this.client.execute(
        `SELECT * FROM ${this.keyspace}.${tableName}`,
        [],
        { 
          prepare: true, 
          fetchSize: this.config.batchSize,
          pageState 
        }
      );

      for (const row of result.rows) {
        const line = JSON.stringify(row) + '\n';
        writeStream.write(line);
        totalSize += Buffer.byteLength(line);
      }

      pageState = result.pageState;
    } while (pageState);

    writeStream.end();
    return totalSize;
  }

  private async saveMetadata(backupDir: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = join(backupDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const backupDirs = await readdir(this.config.destination);
      const backups: BackupMetadata[] = [];

      for (const dir of backupDirs) {
        try {
          const metadataPath = join(this.config.destination, dir, 'metadata.json');
          const metadataContent = await readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          backups.push(metadata);
        } catch {
          // Skip invalid backup directories
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }

  async restore(options: RestoreOptions): Promise<void> {
    const backupPath = options.backupPath || 
      join(this.config.destination, options.backupId!);

    this.emit('restoreStarted', { backupPath });

    try {
      // Load metadata
      const metadataPath = join(backupPath, 'metadata.json');
      const metadataContent = await readFile(metadataPath, 'utf-8');
      const metadata: BackupMetadata = JSON.parse(metadataContent);

      const targetKeyspace = options.targetKeyspace || metadata.keyspace;

      // Restore schema if requested
      if (options.includeSchema && this.config.includeSchema) {
        await this.restoreSchema(backupPath, targetKeyspace);
      }

      // Restore data
      for (const table of metadata.tables) {
        if (options.dryRun) {
          this.emit('dryRunTable', { table, targetKeyspace });
          continue;
        }

        await this.restoreTable(backupPath, table, targetKeyspace, options.overwrite);
        
        this.emit('tableRestored', { 
          table, 
          targetKeyspace,
          progress: metadata.tables.indexOf(table) + 1,
          total: metadata.tables.length
        });
      }

      this.emit('restoreCompleted', { backupPath, targetKeyspace });

    } catch (error) {
      this.emit('restoreFailed', { backupPath, error });
      throw error;
    }
  }

  private async restoreSchema(backupPath: string, targetKeyspace: string): Promise<void> {
    const schemaPath = join(backupPath, 'schema.json');
    const schemaContent = await readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Create keyspace
    const keyspaceSchema = schema.keyspace;
    const replicationStr = JSON.stringify(keyspaceSchema.replication)
      .replace(/"/g, "'");

    await this.client.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${targetKeyspace}
      WITH REPLICATION = ${replicationStr}
    `);

    // Create tables
    for (const table of schema.tables) {
      const columns = schema.columns.filter((col: any) => 
        col.table_name === table.table_name
      );

      const columnDefs = columns.map((col: any) => 
        `${col.column_name} ${col.type}`
      ).join(', ');

      const primaryKey = columns
        .filter((col: any) => col.kind === 'partition_key' || col.kind === 'clustering')
        .sort((a: any, b: any) => a.position - b.position)
        .map((col: any) => col.column_name)
        .join(', ');

      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${targetKeyspace}.${table.table_name} (
          ${columnDefs},
          PRIMARY KEY (${primaryKey})
        )
      `);
    }
  }

  private async restoreTable(
    backupPath: string, 
    tableName: string, 
    targetKeyspace: string,
    overwrite?: boolean
  ): Promise<void> {
    if (overwrite) {
      await this.client.execute(`TRUNCATE ${targetKeyspace}.${tableName}`);
    }

    const filePath = join(backupPath, `${tableName}.jsonl`);
    const actualPath = this.config.compression ? `${filePath}.gz` : filePath;
    
    let readStream = createReadStream(actualPath);
    
    if (this.config.compression) {
      readStream = readStream.pipe(createGunzip());
    }

    const batch: any[] = [];
    let lineBuffer = '';

    readStream.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          const row = JSON.parse(line);
          const fields = Object.keys(row);
          const values = Object.values(row);
          const placeholders = fields.map(() => '?').join(', ');

          batch.push({
            query: `INSERT INTO ${targetKeyspace}.${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
            params: values
          });

          if (batch.length >= this.config.batchSize) {
            this.executeBatch(batch.splice(0));
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      readStream.on('end', async () => {
        if (batch.length > 0) {
          await this.executeBatch(batch);
        }
        resolve();
      });

      readStream.on('error', reject);
    });
  }

  private async executeBatch(batch: any[]): Promise<void> {
    if (batch.length === 0) return;
    
    try {
      await this.client.batch(batch, { prepare: true });
    } catch (error) {
      this.emit('batchError', { batch: batch.length, error });
      throw error;
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = join(this.config.destination, backupId);
    // Implementation would recursively delete the backup directory
    this.emit('backupDeleted', { backupId });
  }

  async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    const retentionMs = this.parseRetention(this.config.retention);
    const cutoffDate = new Date(Date.now() - retentionMs);

    const oldBackups = backups.filter(backup => 
      backup.timestamp < cutoffDate
    );

    for (const backup of oldBackups) {
      await this.deleteBackup(backup.id);
    }

    this.emit('cleanupCompleted', { 
      deleted: oldBackups.length,
      remaining: backups.length - oldBackups.length
    });
  }

  private parseRetention(retention: string): number {
    const match = retention.match(/^(\d+)([dwmy])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'd': return num * 24 * 60 * 60 * 1000;
      case 'w': return num * 7 * 24 * 60 * 60 * 1000;
      case 'm': return num * 30 * 24 * 60 * 60 * 1000;
      case 'y': return num * 365 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `backup-${timestamp}`;
  }
}
