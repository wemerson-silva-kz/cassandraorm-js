# CassandraORM JS Documentation

A modern and optimized ORM for Apache Cassandra and ScyllaDB with native TypeScript support, ES6+ features and advanced capabilities.

## 🚀 Features

- **TypeScript First** - Native support with complete types
- **ES6+ Modules** - Modern import/export syntax
- **Async/Await** - Promise-based API throughout
- **Performance** - Optimized for high performance
- **Developer Experience** - Enhanced DX with full IntelliSense

## 📦 Installation

```bash
npm install cassandraorm-js
```

## ⚡ Quick Start

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

// Define model
const User = orm.model('User', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  createdAt: 'timestamp'
}, {
  key: ['id'],
  indexes: ['email']
});

// Use the model
const user = await User.create({
  id: orm.uuid(),
  name: 'John Doe',
  email: 'john@email.com',
  createdAt: new Date()
});
```

## 📚 Documentation Structure

- [Installation Guide](installation.md) - How to install and configure
- [Migration Guide](migration.md) - Migrate from Express-Cassandra
- [API Reference](api-reference.md) - Complete API documentation
- [Examples](examples.md) - Practical examples

## Features

✅ Support for Cassandra 4.x, 3.x and ScyllaDB 5.x  
✅ Complete CRUD operations  
✅ Data type validation  
✅ Support for collections and advanced types  
✅ Materialized views and indexes  
✅ Complex queries with pagination  
✅ User-defined types/functions/aggregates  
✅ Atomic batch operations  
✅ Save/update/delete hooks  
✅ Full Promise support  
✅ Automatic migrations (experimental)  
✅ Data import/export (experimental)  

## 🌍 Languages

- [English](README.md) (current)
- [Português](README.pt.md)

## Support

- [GitHub Issues](https://github.com/wemerson-silva-kz/cassandraorm-js/issues)
- [NPM Package](https://www.npmjs.com/package/cassandraorm-js)

## License

MIT License
