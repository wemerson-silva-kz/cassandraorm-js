# CassandraORM JS

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

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

// Definir modelo
const User = orm.model('User', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  createdAt: 'timestamp'
}, {
  key: ['id'],
  indexes: ['email']
});

// Usar o modelo
const user = await User.create({
  id: orm.uuid(),
  name: 'João Silva',
  email: 'joao@email.com',
  createdAt: new Date()
});
```

## 📚 Documentação

- [Instalação](installation.md)
- [Guia de Migração](migration.md)
- [API Reference](api-reference.md)
- [Exemplos](examples.md)

## 🔄 Migração do Express-Cassandra

CassandraORM JS mantém compatibilidade com a API original, mas oferece melhorias significativas em performance e developer experience.

## 📄 Licença

MIT
