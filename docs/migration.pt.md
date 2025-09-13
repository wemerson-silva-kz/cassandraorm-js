# Guia de Migração para CassandraORM JS

## Do Express-Cassandra para CassandraORM JS

### Antes (Express-Cassandra)

```javascript
const models = require('express-cassandra');

models.setDirectory(__dirname + '/models').bind({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    keyspace: 'mykeyspace'
  }
});

const user = new models.instance.User({
  name: 'João'
});

user.saveAsync().then(() => {
  console.log('Salvo');
});
```

### Depois (CassandraORM JS)

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  keyspace: 'mykeyspace'
});

const User = orm.model('User', {
  name: 'text'
});

const user = await User.create({
  name: 'João'
});
```

## Principais Mudanças

- ✅ ES6 Modules em vez de CommonJS
- ✅ TypeScript nativo
- ✅ API mais limpa e consistente
- ✅ Async/await por padrão
- ✅ Melhor performance
- ✅ IntelliSense completo

## Compatibilidade

CassandraORM JS mantém compatibilidade com os conceitos principais do Express-Cassandra, facilitando a migração gradual.

## 🌍 Idiomas

- [English](migration.md)
- [Português](migration.pt.md) (atual)
