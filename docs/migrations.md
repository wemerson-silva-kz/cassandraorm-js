# Migrations

## Overview
Manage schema changes safely with automated migrations, rollbacks, and version control.

## Migration Files

```typescript
// migrations/001_create_users.ts
import { Migration } from 'cassandraorm-js';

export default class CreateUsers extends Migration {
  async up() {
    await this.createTable('users', {
      id: 'uuid PRIMARY KEY',
      email: 'text',
      name: 'text',
      created_at: 'timestamp'
    });
    
    await this.createIndex('users_email_idx', 'users', 'email');
  }

  async down() {
    await this.dropTable('users');
  }
}
```

## Running Migrations

```typescript
import { MigrationRunner } from 'cassandraorm-js';

const runner = new MigrationRunner(client, {
  migrationsPath: './migrations',
  tableName: 'schema_migrations'
});

// Run pending migrations
await runner.migrate();

// Rollback last migration
await runner.rollback();

// Get migration status
const status = await runner.getStatus();
console.log('Pending migrations:', status.pending);
```

## Schema Versioning

```typescript
// migrations/002_add_user_profile.ts
export default class AddUserProfile extends Migration {
  async up() {
    await this.addColumn('users', 'profile', 'frozen<user_profile>');
    
    await this.createType('user_profile', {
      bio: 'text',
      avatar_url: 'text',
      preferences: 'map<text, text>'
    });
  }

  async down() {
    await this.dropColumn('users', 'profile');
    await this.dropType('user_profile');
  }
}
```

## Data Migrations

```typescript
// migrations/003_migrate_user_data.ts
export default class MigrateUserData extends Migration {
  async up() {
    const users = await this.execute('SELECT * FROM users');
    
    for (const user of users.rows) {
      await this.execute(
        'UPDATE users SET profile = ? WHERE id = ?',
        [{ bio: '', avatar_url: '', preferences: {} }, user.id]
      );
    }
  }

  async down() {
    await this.execute('UPDATE users SET profile = null');
  }
}
```

## CLI Integration

```bash
# Generate migration
cassandraorm generate migration AddUserProfile

# Run migrations
cassandraorm migrate

# Rollback
cassandraorm migrate:rollback

# Status
cassandraorm migrate:status
```
