# CassandraORM JS

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Um ORM moderno e otimizado para Apache Cassandra e ScyllaDB com suporte nativo para TypeScript, ES6+ e recursos avançados.

## 🚀 Características

- **TypeScript First** - Suporte nativo com tipos completos
- **ES6+ Modules** - Import/export moderno
- **Async/Await** - API totalmente baseada em Promises
- **Performance** - Otimizações para alta performance
- **Developer Experience** - Melhor DX com IntelliSense completo

## 📦 Instalação

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

// Definir modelo
const User = orm.model('users', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  createdAt: 'timestamp'
}, {
  key: ['id']
});

await User.createTable();

// Criar usuário
const user = await User.create({
  id: orm.uuid(),
  name: 'João Silva',
  email: 'joao@email.com',
  createdAt: new Date()
});

// Buscar usuários
const users = await User.find();
```

## 📚 Documentação

Veja a [documentação completa](./docs/README.md) para mais detalhes.

## 🔄 Migração

CassandraORM JS é compatível com Express-Cassandra, facilitando a migração.

## 📄 Licença

MIT
