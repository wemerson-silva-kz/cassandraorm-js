# Bulk Writer & Unique Constraints

O CassandraORM JS oferece funcionalidades avançadas para operações em lote e controle de unicidade, similares ao MongoDB.

## Unique Constraints

### Definindo Campos Únicos no Schema

```typescript
import { createClient } from 'cassandraorm-js';

const userSchema = {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      unique: true  // Campo único
    },
    username: {
      type: 'text',
      unique: true  // Campo único  
    },
    name: 'text',
    age: 'int'
  },
  key: ['id']
};

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  }
});

await client.connect();

// Automaticamente cria constraints únicos para email e username
const User = client.loadSchema('users', userSchema);
```

### Configuração Manual

```typescript
import { createClient, UniqueConstraintManager } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  }
});

await client.connect();

// Criar gerenciador de constraints únicos
const uniqueManager = new UniqueConstraintManager(client.driver, 'myapp');

// Adicionar constraint único para email
await uniqueManager.createUniqueTable('users', ['email']);
```

### Uso

```typescript
// Verificar se valor é único antes de inserir
try {
  await uniqueManager.checkUnique('users', { email: 'user@example.com' });
  // Valor é único, pode inserir
} catch (error) {
  // Valor duplicado
  console.log(error.message); // "Duplicate value for unique field 'email': user@example.com"
}

// Registrar valor único após inserção
await uniqueManager.insertUnique('users', { email: 'user@example.com' });

// Remover valor único após deleção
await uniqueManager.removeUnique('users', { email: 'user@example.com' });
```

## Bulk Writer

### Configuração Básica

```typescript
import { BulkWriter } from 'cassandraorm-js';

const bulkWriter = new BulkWriter(client.driver, 'myapp', {
  batchSize: 100,           // Tamanho do lote (padrão: 100)
  skipDuplicates: true,     // Pular duplicados (padrão: true)
  uniqueManager            // Gerenciador de constraints únicos (opcional)
});
```

### Operações de Inserção

```typescript
// Inserção simples
bulkWriter.insert('users', {
  id: client.uuid(),
  email: 'user1@example.com',
  name: 'User 1',
  age: 25
});

// Inserção com opção de pular se existir
bulkWriter.insert('users', {
  id: client.uuid(),
  email: 'user2@example.com',
  name: 'User 2',
  age: 30
}, { skipIfExists: true });

// Múltiplas inserções
const users = [
  { id: client.uuid(), email: 'user3@example.com', name: 'User 3' },
  { id: client.uuid(), email: 'user4@example.com', name: 'User 4' },
  { id: client.uuid(), email: 'user5@example.com', name: 'User 5' }
];

users.forEach(user => {
  bulkWriter.insert('users', user);
});
```

### Operações de Atualização

```typescript
// Atualização simples
bulkWriter.update('users', 
  { age: 26 },              // Dados para atualizar
  { email: 'user1@example.com' }  // Condição WHERE
);

// Múltiplas atualizações
const updates = [
  { data: { age: 27 }, where: { id: userId1 } },
  { data: { age: 28 }, where: { id: userId2 } }
];

updates.forEach(({ data, where }) => {
  bulkWriter.update('users', data, where);
});
```

### Operações de Deleção

```typescript
// Deleção simples
bulkWriter.delete('users', { id: userId });

// Múltiplas deleções
const userIds = [userId1, userId2, userId3];

userIds.forEach(id => {
  bulkWriter.delete('users', { id });
});
```

### Execução e Resultados

```typescript
// Executar todas as operações
const result = await bulkWriter.execute();

console.log('Resultados:');
console.log(`Inseridos: ${result.inserted}`);
console.log(`Atualizados: ${result.updated}`);
console.log(`Deletados: ${result.deleted}`);
console.log(`Pulados: ${result.skipped}`);
console.log(`Erros: ${result.errors.length}`);

// Verificar erros
if (result.errors.length > 0) {
  result.errors.forEach((error, index) => {
    console.log(`Erro ${index + 1}: ${error.error}`);
    if (error.operation) {
      console.log(`Operação: ${error.operation.type} na tabela ${error.operation.tableName}`);
    }
  });
}
```

### Exemplo Completo

```typescript
import { createClient, BulkWriter, UniqueConstraintManager } from 'cassandraorm-js';

async function bulkOperationsExample() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'myapp'
    }
  });

  await client.connect();

  // Configurar constraint único
  const uniqueManager = new UniqueConstraintManager(client.driver, 'myapp');
  await uniqueManager.createUniqueTable('users', ['email']);

  // Criar bulk writer
  const bulkWriter = new BulkWriter(client.driver, 'myapp', {
    batchSize: 50,
    skipDuplicates: true,
    uniqueManager
  });

  // Adicionar operações
  const users = [
    { id: client.uuid(), email: 'john@example.com', name: 'John Doe', age: 30 },
    { id: client.uuid(), email: 'jane@example.com', name: 'Jane Smith', age: 25 },
    { id: client.uuid(), email: 'john@example.com', name: 'John Duplicate', age: 31 } // Duplicado
  ];

  users.forEach(user => {
    bulkWriter.insert('users', user, { skipIfExists: true });
  });

  // Executar
  const result = await bulkWriter.execute();
  
  console.log(`Processados: ${result.inserted} inseridos, ${result.skipped} pulados`);

  await client.disconnect();
}
```

## Características Avançadas

### Controle de Lotes

O Bulk Writer automaticamente divide as operações em lotes do tamanho especificado:

```typescript
const bulkWriter = new BulkWriter(client.driver, 'myapp', {
  batchSize: 25  // Processa 25 operações por vez
});

// Adicionar 100 operações
for (let i = 0; i < 100; i++) {
  bulkWriter.insert('users', {
    id: client.uuid(),
    email: `user${i}@example.com`,
    name: `User ${i}`
  });
}

// Será executado em 4 lotes de 25 operações cada
const result = await bulkWriter.execute();
```

### Tratamento de Erros

```typescript
const bulkWriter = new BulkWriter(client.driver, 'myapp', {
  skipDuplicates: false  // Não pular duplicados, lançar erro
});

try {
  const result = await bulkWriter.execute();
} catch (error) {
  console.log('Erro durante execução em lote:', error.message);
}
```

### Limpeza e Reutilização

```typescript
// Limpar operações pendentes
bulkWriter.clear();

// Verificar número de operações
console.log(`Operações pendentes: ${bulkWriter.count()}`);

// Reutilizar o mesmo bulk writer
bulkWriter.insert('users', newUser);
await bulkWriter.execute();
```

## Melhores Práticas

1. **Tamanho do Lote**: Use lotes de 50-100 operações para melhor performance
2. **Unique Constraints**: Configure constraints únicos apenas para campos realmente necessários
3. **Tratamento de Erros**: Sempre verifique `result.errors` após execução
4. **Reutilização**: Limpe o bulk writer com `clear()` antes de reutilizar
5. **Monitoramento**: Use métricas para monitorar performance das operações em lote

## Limitações

- Unique constraints são implementados usando tabelas auxiliares
- Operações em lote são atômicas por lote, não globalmente
- Constraints únicos têm overhead adicional de verificação
- Requer Cassandra 2.0+ para suporte a `IF NOT EXISTS`
