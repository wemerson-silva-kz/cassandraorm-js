# Advanced Features - CassandraORM JS

## Connection Pooling

Automatic connection pool management for optimal performance:

```javascript
const orm = new CassandraORM({
  contactPoints: ['localhost'],
  pooling: {
    coreConnectionsPerHost: { local: 4, remote: 2 },
    maxConnectionsPerHost: { local: 8, remote: 4 },
    maxRequestsPerConnection: 32768
  }
});

// Get pool statistics
const stats = orm.getMetrics().connectionPool;
```

## Query Builder

Fluent interface for building complex queries:

```javascript
// Select with conditions
const users = await orm.query('users')
  .select(['name', 'email'])
  .where('age', '>', 18)
  .orderBy('name', 'ASC')
  .limit(10)
  .all();

// Insert
await orm.query('users')
  .insert({
    id: orm.uuid(),
    name: 'John Doe',
    email: 'john@example.com'
  })
  .execute();

// Update
await orm.query('users')
  .update({ age: 31 })
  .where('email', '=', 'john@example.com')
  .execute();

// Delete
await orm.query('users')
  .delete()
  .where('age', '<', 18)
  .execute();
```

## Migrations

Database schema versioning and migration system:

```javascript
// Create a new migration
await orm.createMigration('add_user_table');

// Run pending migrations
await orm.migrate();

// Rollback migrations
await orm.rollback(1);

// Check migration status
await orm.migrationManager.status();
```

### Migration File Example

```javascript
// migrations/20250913_add_user_table.js
module.exports = {
  up: async (client) => {
    await client.execute(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        name text,
        email text,
        created_at timestamp
      )
    `);
  },

  down: async (client) => {
    await client.execute('DROP TABLE users');
  }
};
```

## Monitoring & Metrics

Built-in monitoring with structured logging:

```javascript
const orm = new CassandraORM({
  monitoring: {
    enabled: true,
    logLevel: 'info'
  }
});

// Get comprehensive metrics
const metrics = orm.getMetrics();
console.log(metrics.queries.total); // Total queries executed
console.log(metrics.performance.avgResponseTime); // Average response time

// Health check endpoint
const health = orm.getHealthCheck();
console.log(health.status); // 'healthy' or 'unhealthy'
```

## Plugin System

Extensible architecture with built-in and custom plugins:

### Built-in Plugins

```javascript
// Cache plugin
orm.use('cache', {
  ttl: 300000, // 5 minutes
  maxSize: 1000
});

// Validation plugin
orm.use('validation');
```

### Custom Plugin

```javascript
const customPlugin = {
  name: 'audit',
  install(pluginManager) {
    pluginManager.addHook('afterInsert', async (context) => {
      console.log(`Audit: Inserted into ${context.model}`);
    });
  }
};

orm.use(customPlugin);
```

## Advanced Query Features

### Model Query Builder

```javascript
// Use query builder on specific model
const activeUsers = await User.query()
  .select('*')
  .where('status', '=', 'active')
  .where('last_login', '>', new Date('2024-01-01'))
  .orderBy('created_at', 'DESC')
  .limit(50)
  .all();
```

### Batch Operations with Monitoring

```javascript
const batch = orm.batch();

batch.insert(User, { id: orm.uuid(), name: 'User 1' });
batch.insert(User, { id: orm.uuid(), name: 'User 2' });
batch.update(User, { id: userId }, { status: 'active' });

await batch.execute(); // Automatically monitored and logged
```

## Performance Optimization

### Connection Pool Tuning

```javascript
const orm = new CassandraORM({
  pooling: {
    coreConnectionsPerHost: {
      [cassandra.distance.local]: 4,
      [cassandra.distance.remote]: 2
    },
    maxConnectionsPerHost: {
      [cassandra.distance.local]: 10,
      [cassandra.distance.remote]: 5
    },
    heartBeatInterval: 30000
  }
});
```

### Query Optimization

```javascript
// Use prepared statements (automatic)
const users = await User.find({ status: 'active' });

// Monitor slow queries
const metrics = orm.getMetrics();
console.log(metrics.performance.slowQueries);
```

## 🌍 Languages

- [English](advanced-features.md) (current)
- [Português](advanced-features.pt.md)
