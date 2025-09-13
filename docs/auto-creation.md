# Auto-Creation de Keyspace e Tabelas

O CassandraORM JS pode criar automaticamente keyspaces e tabelas baseado na configuração e schemas definidos.

## Configuração

### Auto-Criação de Keyspace

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'meu_app' // Será criado automaticamente
  },
  ormOptions: {
    createKeyspace: true, // Habilita auto-criação
    defaultReplicationStrategy: {
      class: 'SimpleStrategy',
      replication_factor: 1
    }
  }
});

// Conectar criará o keyspace automaticamente se não existir
await client.connect();
```

### Auto-Criação de Tabelas

```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'meu_app'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe' // Habilita auto-criação de tabelas
  }
});

await client.connect();

// Schema será convertido automaticamente em CREATE TABLE
const userSchema = {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    age: 'int',
    created_at: 'timestamp'
  },
  key: ['id']
};

// Criará a tabela automaticamente
const User = await client.loadSchema('users', userSchema);
```

## Modos de Migration

### `safe` (Recomendado)
- Cria tabelas apenas se não existirem
- Não modifica tabelas existentes
- Seguro para produção

```typescript
ormOptions: {
  migration: 'safe'
}
```

### `alter`
- Cria tabelas se não existirem
- Tenta alterar tabelas existentes (experimental)
- Use com cuidado

```typescript
ormOptions: {
  migration: 'alter'
}
```

### `drop`
- Remove e recria tabelas (PERIGOSO)
- Apenas para desenvolvimento
- Perda de dados garantida

```typescript
ormOptions: {
  migration: 'drop' // ⚠️ CUIDADO: Remove dados!
}
```

## Exemplo Completo

```typescript
import { createClient } from 'cassandraorm-js';

async function exemploAutoCreate() {
  // Cliente com auto-criação completa
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'loja_online'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe',
      defaultReplicationStrategy: {
        class: 'SimpleStrategy',
        replication_factor: 3
      }
    }
  });

  // Conectar (cria keyspace automaticamente)
  await client.connect();

  // Schema de produtos
  const productSchema = {
    fields: {
      id: 'uuid',
      name: 'text',
      price: 'decimal',
      category: 'text',
      created_at: 'timestamp'
    },
    key: ['id'],
    indexes: ['category'] // Índices também são criados
  };

  // Carregar schema (cria tabela automaticamente)
  const Product = await client.loadSchema('products', productSchema);

  // Schema de usuários com campos únicos
  const userSchema = {
    fields: {
      id: 'uuid',
      email: {
        type: 'text',
        unique: true // Constraint único criado automaticamente
      },
      name: 'text'
    },
    key: ['id']
  };

  const User = await client.loadSchema('users', userSchema);

  console.log('✅ Keyspace, tabelas e constraints criados automaticamente!');
}
```

## Estratégias de Replicação

### SimpleStrategy (Desenvolvimento)
```typescript
defaultReplicationStrategy: {
  class: 'SimpleStrategy',
  replication_factor: 1
}
```

### NetworkTopologyStrategy (Produção)
```typescript
defaultReplicationStrategy: {
  class: 'NetworkTopologyStrategy',
  datacenter1: 3,
  datacenter2: 2
}
```

## Conversão de Tipos

O sistema converte automaticamente tipos do schema para CQL:

| Schema Type | CQL Type |
|-------------|----------|
| `'text'` | `text` |
| `'int'` | `int` |
| `'uuid'` | `uuid` |
| `'timestamp'` | `timestamp` |
| `'decimal'` | `decimal` |
| `'boolean'` | `boolean` |
| `'blob'` | `blob` |

### Tipos Complexos
```typescript
fields: {
  tags: 'list<text>',
  metadata: 'map<text, text>',
  coordinates: 'tuple<double, double>'
}
```

## Chaves Primárias

### Chave Simples
```typescript
key: ['id']
// CREATE TABLE ... PRIMARY KEY (id)
```

### Chave Composta
```typescript
key: [['user_id', 'category'], 'created_at']
// CREATE TABLE ... PRIMARY KEY ((user_id, category), created_at)
```

### Chave com Clustering
```typescript
key: ['user_id', 'created_at', 'id']
// CREATE TABLE ... PRIMARY KEY (user_id, created_at, id)
```

## Limitações

1. **Alterações de Schema**: Modo `safe` não altera tabelas existentes
2. **Tipos Complexos**: UDTs devem ser criados manualmente primeiro
3. **Índices**: Criação de índices secundários é limitada
4. **Constraints**: Apenas unique constraints são suportados

## Melhores Práticas

1. **Use `migration: 'safe'`** em produção
2. **Defina replication_factor adequado** para seu ambiente
3. **Teste schemas** em ambiente de desenvolvimento primeiro
4. **Monitore logs** para verificar criação de objetos
5. **Backup dados** antes de usar `migration: 'alter'` ou `'drop'`

## Troubleshooting

### Keyspace não criado
- Verifique `createKeyspace: true`
- Confirme permissões do usuário
- Verifique conectividade com Cassandra

### Tabela não criada
- Verifique `migration: 'safe'`
- Confirme sintaxe do schema
- Verifique logs de erro

### Erro de permissão
```
Error: User does not have sufficient privileges
```
- Usuário precisa de permissão `CREATE` no cluster
- Para keyspaces: `CREATE KEYSPACE`
- Para tabelas: `CREATE TABLE`
