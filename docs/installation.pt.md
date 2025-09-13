# Instalação - CassandraORM JS

## Pré-requisitos

- Node.js >= 16.0.0
- TypeScript >= 4.5.0 (opcional)
- Cassandra >= 3.11 ou ScyllaDB >= 4.0

## Instalação

```bash
npm install cassandraorm-js
```

## Configuração Básica

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['localhost'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

await orm.connect();
```

## Variáveis de Ambiente

```env
CASSANDRA_HOSTS=localhost
CASSANDRA_KEYSPACE=myapp
CASSANDRA_DATACENTER=datacenter1
```

## Verificação

```typescript
try {
  await orm.connect();
  console.log('✅ Conectado ao Cassandra');
} catch (error) {
  console.error('❌ Erro na conexão:', error);
}
```

## 🌍 Idiomas

- [English](installation.md)
- [Português](installation.pt.md) (atual)
