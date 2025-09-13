# Exemplos - CassandraORM JS

## Configuração Inicial

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['localhost'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

await orm.connect();
```

## Modelo Básico

```typescript
const User = orm.model('User', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  age: 'int',
  createdAt: 'timestamp'
}, {
  key: ['id'],
  indexes: ['email']
});
```

## CRUD Operações

```typescript
// Criar
const user = await User.create({
  id: orm.uuid(),
  name: 'João Silva',
  email: 'joao@email.com',
  age: 30,
  createdAt: new Date()
});

// Buscar
const users = await User.find({ age: { $gte: 18 } });
const user = await User.findOne({ email: 'joao@email.com' });

// Atualizar
await User.update({ email: 'joao@email.com' }, { age: 31 });

// Deletar
await User.delete({ email: 'joao@email.com' });
```

## Relacionamentos

```typescript
const Post = orm.model('Post', {
  id: 'uuid',
  userId: 'uuid',
  title: 'text',
  content: 'text'
}, {
  key: ['id'],
  indexes: ['userId']
});

// Buscar posts do usuário
const userPosts = await Post.find({ userId: user.id });
```

## Batch Operations

```typescript
const batch = orm.batch();

batch.insert(User, { name: 'User 1' });
batch.insert(User, { name: 'User 2' });
batch.update(User, { id: userId }, { name: 'Updated' });

await batch.execute();
```
