# CassandraORM JS

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/wemerson-silva-kz/cassandraorm-js/workflows/Node.js%20CI/badge.svg)](https://github.com/wemerson-silva-kz/cassandraorm-js/actions)

Um ORM moderno e otimizado para Apache Cassandra e ScyllaDB com suporte nativo ao TypeScript, recursos ES6+ e capacidades avançadas.

## 🚀 Recursos

### **Recursos Principais**
- **TypeScript First** - Suporte nativo com tipos completos
- **Módulos ES6+** - Sintaxe moderna de import/export
- **Async/Await** - API baseada em Promises
- **Auto-Criação** - Criação automática de keyspaces e tabelas
- **Validação de Schema** - Validação abrangente de dados
- **Constraints Únicos** - Previne inserção de dados duplicados

### **Recursos Avançados**
- **Query Builder** - API fluente para queries complexas
- **Cache Inteligente** - Estratégias de cache LRU/LFU/FIFO
- **Operações em Lote** - Bulk writer estilo MongoDB com processamento em lotes
- **Paginação Otimizada** - Paginação baseada em token e cursor
- **Hooks & Middleware** - Ciclo de vida extensível de operações
- **Monitoramento de Performance** - Métricas e observabilidade integradas

## 📦 Instalação

```bash
npm install cassandraorm-js
```

## ⚡ Início Rápido

### Uso Básico

```javascript
const { CassandraORM } = require('cassandraorm-js');

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'meuapp'
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
```

### Uso Moderno com TypeScript

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'meuapp'
  },
  ormOptions: {
    createKeyspace: true, // Auto-criar keyspace
    migration: 'safe'     // Auto-criar tabelas
  }
});

await client.connect(); // Cria keyspace automaticamente

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
}); // Cria tabela automaticamente com validação
```

### Query Builder Avançado

```typescript
import { AdvancedQueryBuilder } from 'cassandraorm-js';

const queryBuilder = new AdvancedQueryBuilder(client.driver, 'users', 'meuapp');

const users = await queryBuilder
  .select(['name', 'email', 'age'])
  .where('status').eq('ativo')
  .and('age').gte(18)
  .and('categoria').in(['premium', 'gold'])
  .orderBy('created_at', 'DESC')
  .limit(50)
  .allowFiltering()
  .execute();
```

### Operações em Lote

```typescript
import { BulkWriter } from 'cassandraorm-js';

const bulkWriter = new BulkWriter(client.driver, 'meuapp', {
  batchSize: 100,
  skipDuplicates: true
});

bulkWriter
  .insert('users', { id: client.uuid(), name: 'Usuário 1', email: 'user1@email.com' })
  .insert('users', { id: client.uuid(), name: 'Usuário 2', email: 'user2@email.com' })
  .update('users', { age: 26 }, { email: 'joao@email.com' });

const result = await bulkWriter.execute();
console.log(`Inseridos: ${result.inserted}, Atualizados: ${result.updated}`);
```

### Cache Inteligente

```typescript
import { IntelligentCache, QueryCache } from 'cassandraorm-js';

const cache = new IntelligentCache({
  ttl: 300,        // 5 minutos
  maxSize: 1000,   // Máximo 1000 itens
  strategy: 'lru'  // Least Recently Used
});

const queryCache = new QueryCache({ ttl: 600 });

// Cache de queries automático
const query = 'SELECT * FROM users WHERE status = ?';
const params = ['ativo'];

let result = queryCache.get(query, params);
if (!result) {
  result = await client.execute(query, params);
  queryCache.set(query, params, result.rows);
}
```

### Hooks e Middleware

```typescript
import { HooksMiddlewareSystem, CommonHooks } from 'cassandraorm-js';

const hooks = new HooksMiddlewareSystem();

// Adicionar timestamps automaticamente
hooks.beforeCreate(CommonHooks.addTimestamps);
hooks.beforeUpdate(CommonHooks.updateTimestamp);

// Adicionar validação
hooks.beforeCreate(CommonHooks.validate(userSchema));

// Adicionar hook personalizado
hooks.beforeCreate(async (data) => {
  if (data.password) {
    data.password = await hashPassword(data.password);
  }
  return data;
});

// Executar com hooks
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

## 📚 Documentação

### Português
- [Guia de Instalação](./docs/installation.pt.md)
- [Guia de Migração](./docs/migration.pt.md)
- [Referência da API](./docs/api-reference.pt.md)
- [Recursos Avançados](./docs/advanced-features.md)
- [Auto-Criação](./docs/auto-creation.md)
- [Operações em Lote](./docs/bulk-writer.md)
- [Exemplos](./docs/examples.pt.md)

### English
- [Installation Guide](./docs/installation.md)
- [Migration Guide](./docs/migration.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./docs/examples.md)

## 🌍 Idiomas

- [English](./README.md)
- [Português](./README.pt.md) (atual)

## 🔄 Migração

CassandraORM JS é compatível com Express-Cassandra, facilitando a migração.

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes específicos
npm run test:ci        # Testes CI
npm run test:bun       # Testes Bun
npm run test:bulk      # Operações em lote
npm run test:features  # Recursos avançados
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes.

## 📄 Licença

Licença MIT - veja o arquivo [LICENSE](./LICENSE) para detalhes.

## 🔗 Links

- [Pacote NPM](https://www.npmjs.com/package/cassandraorm-js)
- [Repositório GitHub](https://github.com/wemerson-silva-kz/cassandraorm-js)
- [Documentação](./docs/README.pt.md)
- [Exemplos](./examples/)

## ⭐ Suporte

Se este projeto foi útil para você, por favor dê uma estrela no GitHub!
