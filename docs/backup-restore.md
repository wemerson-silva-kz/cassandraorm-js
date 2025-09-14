# Backup & Restore

## Overview
Automated backup and restore operations with incremental backups, compression, and cloud storage integration.

## Backup Manager

```typescript
import { BackupManager } from 'cassandraorm-js';

const backupManager = new BackupManager(client, {
  storage: {
    type: 's3',
    bucket: 'cassandra-backups',
    region: 'us-east-1'
  },
  compression: 'gzip',
  encryption: true
});

// Full backup
const backup = await backupManager.createBackup({
  keyspaces: ['myapp'],
  type: 'full',
  name: 'daily-backup-2024-01-15'
});

console.log('Backup created:', backup.id);
```

## Incremental Backups

```typescript
// Enable incremental backups
await backupManager.enableIncrementalBackups({
  interval: '1h',
  retention: '30d'
});

// Create incremental backup
const incrementalBackup = await backupManager.createBackup({
  keyspaces: ['myapp'],
  type: 'incremental',
  basedOn: 'daily-backup-2024-01-15'
});
```

## Scheduled Backups

```typescript
import { BackupScheduler } from 'cassandraorm-js';

const scheduler = new BackupScheduler(backupManager);

// Daily full backup at 2 AM
scheduler.schedule('daily-full', {
  cron: '0 2 * * *',
  type: 'full',
  keyspaces: ['myapp'],
  retention: '7d'
});

// Hourly incremental backups
scheduler.schedule('hourly-incremental', {
  cron: '0 * * * *',
  type: 'incremental',
  keyspaces: ['myapp'],
  retention: '24h'
});

await scheduler.start();
```

## Restore Operations

```typescript
// List available backups
const backups = await backupManager.listBackups();

// Restore from backup
await backupManager.restore({
  backupId: 'daily-backup-2024-01-15',
  keyspace: 'myapp',
  tables: ['users', 'posts'], // Optional: specific tables
  targetKeyspace: 'myapp_restored' // Optional: restore to different keyspace
});

// Point-in-time restore
await backupManager.restoreToPoint({
  keyspace: 'myapp',
  timestamp: new Date('2024-01-15T10:30:00Z'),
  targetKeyspace: 'myapp_pit'
});
```

## Cloud Storage Integration

```typescript
// S3 configuration
const s3BackupManager = new BackupManager(client, {
  storage: {
    type: 's3',
    bucket: 'my-cassandra-backups',
    region: 'us-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Google Cloud Storage
const gcsBackupManager = new BackupManager(client, {
  storage: {
    type: 'gcs',
    bucket: 'my-cassandra-backups',
    projectId: 'my-project',
    keyFilename: './service-account.json'
  }
});
```

## Backup Verification

```typescript
// Verify backup integrity
const verification = await backupManager.verifyBackup('daily-backup-2024-01-15');

if (verification.valid) {
  console.log('Backup is valid');
} else {
  console.log('Backup verification failed:', verification.errors);
}

// Test restore (dry run)
const testRestore = await backupManager.testRestore({
  backupId: 'daily-backup-2024-01-15',
  dryRun: true
});

console.log('Restore test results:', testRestore);
```
