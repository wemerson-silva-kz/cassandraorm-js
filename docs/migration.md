# Migration Guide to CassandraORM JS

## From Express-Cassandra to CassandraORM JS

### Before (Express-Cassandra)

```javascript
const models = require('express-cassandra');

models.setDirectory(__dirname + '/models').bind({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    keyspace: 'mykeyspace'
  }
});

const user = new models.instance.User({
  name: 'John'
});

user.saveAsync().then(() => {
  console.log('Saved');
});
```

### After (CassandraORM JS)

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
  name: 'John'
});
```

## Key Changes

- ✅ ES6 Modules instead of CommonJS
- ✅ Native TypeScript support
- ✅ Cleaner and more consistent API
- ✅ Async/await by default
- ✅ Better performance
- ✅ Full IntelliSense support

## Compatibility

CassandraORM JS maintains compatibility with the core concepts of Express-Cassandra, making gradual migration easy.

## 🌍 Languages

- [English](migration.md) (current)
- [Português](migration.pt.md)
