# CassandraORM JS

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern and optimized ORM for Apache Cassandra and ScyllaDB with native TypeScript support, ES6+ features and advanced capabilities.

## 🚀 Features

- **TypeScript First** - Native support with complete types
- **ES6+ Modules** - Modern import/export syntax
- **Async/Await** - Promise-based API throughout
- **Performance** - Optimized for high performance
- **Developer Experience** - Enhanced DX with full IntelliSense
- **Bulk Operations** - MongoDB-style bulk writer with batch processing
- **Unique Constraints** - Prevent duplicate data insertion

## 📦 Installation

```bash
npm install cassandraorm-js
```

## ⚡ Quick Start

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

// Find users
const users = await User.find();

// Auto-creation example (TypeScript)
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
    email: { type: 'text', unique: true },
    name: 'text'
  },
  key: ['id']
}); // Creates table automatically

// Bulk operations (MongoDB-style)
const bulkWriter = orm.bulkWriter({ batchSize: 100 });

bulkWriter
  .insert('users', { id: orm.uuid(), name: 'User 1', email: 'user1@email.com' })
  .insert('users', { id: orm.uuid(), name: 'User 2', email: 'user2@email.com' })
  .update('users', { age: 26 }, { email: 'john@email.com' });

const result = await bulkWriter.execute();
console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}`);
```

## 📚 Documentation

See the [complete documentation](./docs/README.md) for more details.

- [Installation Guide](./docs/installation.md)
- [Migration Guide](./docs/migration.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./docs/examples.md)

## 🌍 Languages

- [English](./README.md) (current)
- [Português](./README.pt.md)

## 🔄 Migration

CassandraORM JS is compatible with Express-Cassandra, making migration easy.

## 📄 License

MIT
