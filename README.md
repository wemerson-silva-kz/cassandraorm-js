# CassandraORM JS

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/wemerson-silva-kz/cassandraorm-js/workflows/Node.js%20CI/badge.svg)](https://github.com/wemerson-silva-kz/cassandraorm-js/actions)

A modern and optimized ORM for Apache Cassandra and ScyllaDB with native TypeScript support, ES6+ features and advanced capabilities.

## 🚀 Features

### **Core Features**
- **TypeScript First** - Native support with complete types
- **ES6+ Modules** - Modern import/export syntax
- **Async/Await** - Promise-based API throughout
- **Auto-Creation** - Automatic keyspace and table creation
- **Schema Validation** - Comprehensive data validation
- **Unique Constraints** - Prevent duplicate data insertion

### **Advanced Features**
- **Query Builder** - Fluent API for complex queries
- **Intelligent Cache** - LRU/LFU/FIFO caching strategies
- **Bulk Operations** - MongoDB-style bulk writer with batch processing
- **Optimized Pagination** - Token-based and cursor pagination
- **Hooks & Middleware** - Extensible operation lifecycle
- **Performance Monitoring** - Built-in metrics and observability

## 📦 Installation

```bash
npm install cassandraorm-js
```

## ⚡ Quick Start

### Basic Usage

```javascript
const { CassandraORM } = require('cassandraorm-js');

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

await orm.connect();

// Define model
const User = orm.model('users', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  createdAt: 'timestamp'
}, {
  key: ['id']
});

await User.createTable();

// Create user
const user = await User.create({
  id: orm.uuid(),
  name: 'John Doe',
  email: 'john@email.com',
  createdAt: new Date()
});
```

### Modern TypeScript Usage

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  },
  ormOptions: {
    createKeyspace: true, // Auto-create keyspace
    migration: 'safe'     // Auto-create tables
  }
});

await client.connect(); // Creates keyspace automatically

const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { 
      type: 'text', 
      unique: true,
      validate: {
        required: true,
        isEmail: true
      }
    },
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 2
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 0,
        max: 120
      }
    }
  },
  key: ['id']
}); // Creates table automatically with validation
```

### Advanced Query Builder

```typescript
import { AdvancedQueryBuilder } from 'cassandraorm-js';

const queryBuilder = new AdvancedQueryBuilder(client.driver, 'users', 'myapp');

const users = await queryBuilder
  .select(['name', 'email', 'age'])
  .where('status').eq('active')
  .and('age').gte(18)
  .and('category').in(['premium', 'gold'])
  .orderBy('created_at', 'DESC')
  .limit(50)
  .allowFiltering()
  .execute();
```

### Bulk Operations

```typescript
import { BulkWriter } from 'cassandraorm-js';

const bulkWriter = new BulkWriter(client.driver, 'myapp', {
  batchSize: 100,
  skipDuplicates: true
});

bulkWriter
  .insert('users', { id: client.uuid(), name: 'User 1', email: 'user1@email.com' })
  .insert('users', { id: client.uuid(), name: 'User 2', email: 'user2@email.com' })
  .update('users', { age: 26 }, { email: 'john@email.com' });

const result = await bulkWriter.execute();
console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}`);
```

### Intelligent Caching

```typescript
import { IntelligentCache, QueryCache } from 'cassandraorm-js';

const cache = new IntelligentCache({
  ttl: 300,        // 5 minutes
  maxSize: 1000,   // Max 1000 items
  strategy: 'lru'  // Least Recently Used
});

const queryCache = new QueryCache({ ttl: 600 });

// Cache queries automatically
const query = 'SELECT * FROM users WHERE status = ?';
const params = ['active'];

let result = queryCache.get(query, params);
if (!result) {
  result = await client.execute(query, params);
  queryCache.set(query, params, result.rows);
}
```

### Hooks and Middleware

```typescript
import { HooksMiddlewareSystem, CommonHooks } from 'cassandraorm-js';

const hooks = new HooksMiddlewareSystem();

// Add timestamps automatically
hooks.beforeCreate(CommonHooks.addTimestamps);
hooks.beforeUpdate(CommonHooks.updateTimestamp);

// Add validation
hooks.beforeCreate(CommonHooks.validate(userSchema));

// Add custom hook
hooks.beforeCreate(async (data) => {
  if (data.password) {
    data.password = await hashPassword(data.password);
  }
  return data;
});

// Execute with hooks
const result = await hooks.executeOperation(
  'create',
  userData,
  { operation: 'create', tableName: 'users' },
  async () => {
    return await client.execute(
      'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
      [userData.id, userData.name, userData.email]
    );
  }
);
```

## 📚 Documentation

### English
- [Installation Guide](./docs/installation.md)
- [Migration Guide](./docs/migration.md)
- [API Reference](./docs/api-reference.md)
- [Advanced Features](./docs/advanced-features.md)
- [Auto-Creation](./docs/auto-creation.md)
- [Bulk Operations](./docs/bulk-writer.md)
- [Examples](./docs/examples.md)

### Português
- [Guia de Instalação](./docs/installation.pt.md)
- [Guia de Migração](./docs/migration.pt.md)
- [Referência da API](./docs/api-reference.pt.md)
- [Exemplos](./docs/examples.pt.md)

## 🌍 Languages

- [English](./README.md) (current)
- [Português](./README.pt.md)

## 🔄 Migration

CassandraORM JS is compatible with Express-Cassandra, making migration easy.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm run test:ci        # CI tests
npm run test:bun       # Bun tests
npm run test:bulk      # Bulk operations
npm run test:features  # Advanced features
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/cassandraorm-js)
- [GitHub Repository](https://github.com/wemerson-silva-kz/cassandraorm-js)
- [Documentation](./docs/README.md)
- [Examples](./examples/)

## ⭐ Support

If you find this project helpful, please give it a star on GitHub!
