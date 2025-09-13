# Funcionalidades Avançadas

O CassandraORM JS oferece funcionalidades avançadas que melhoram significativamente a experiência de desenvolvimento com Cassandra.

## 🔍 Query Builder Avançado

### Uso Básico

```typescript
import { createClient, AdvancedQueryBuilder } from 'cassandraorm-js';

const client = createClient({ /* config */ });
await client.connect();

const queryBuilder = new AdvancedQueryBuilder(client.driver, 'users', 'myapp');

// Query complexa
const users = await queryBuilder
  .select(['name', 'email', 'age'])
  .where('status').eq('active')
  .and('age').gte(18)
  .and('category').in(['premium', 'gold'])
  .orderBy('created_at', 'DESC')
  .limit(50)
  .allowFiltering()
  .execute();
```

### Operadores Disponíveis

```typescript
// Comparação
.where('age').eq(25)        // age = 25
.where('age').gt(18)        // age > 18
.where('age').gte(18)       // age >= 18
.where('age').lt(65)        // age < 65
.where('age').lte(65)       // age <= 65

// Arrays e Collections
.where('status').in(['active', 'premium'])  // status IN (...)
.where('tags').contains('featured')         // tags CONTAINS 'featured'
.where('metadata').containsKey('priority')  // metadata CONTAINS KEY 'priority'
```

### Métodos Especiais

```typescript
// Contar registros
const count = await queryBuilder
  .where('status').eq('active')
  .count();

// Primeiro resultado
const user = await queryBuilder
  .where('email').eq('user@example.com')
  .first();

// Construir query sem executar
const { query, params } = queryBuilder
  .select('*')
  .where('id').eq(userId)
  .build();
```

## ✅ Validação de Schema

### Definindo Validações

```typescript
const userSchema = {
  fields: {
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true
      }
    },
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 2,
        maxLength: 100
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 0,
        max: 120
      }
    },
    status: {
      type: 'text',
      validate: {
        enum: ['active', 'inactive', 'pending']
      }
    },
    password: {
      type: 'text',
      validate: {
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
        custom: (value) => {
          if (value.includes('password')) {
            return 'Password cannot contain the word "password"';
          }
          return true;
        }
      }
    }
  }
};
```

### Validando Dados

```typescript
import { SchemaValidator } from 'cassandraorm-js';

const userData = {
  email: 'user@example.com',
  name: 'John Doe',
  age: 25,
  status: 'active'
};

const errors = SchemaValidator.validate(userData, userSchema);

if (errors.length > 0) {
  console.log('Validation errors:');
  errors.forEach(error => {
    console.log(`- ${error.field}: ${error.message}`);
  });
}
```

### Validações Disponíveis

| Regra | Descrição | Exemplo |
|-------|-----------|---------|
| `required` | Campo obrigatório | `required: true` |
| `min/max` | Valor mínimo/máximo (números) | `min: 0, max: 100` |
| `minLength/maxLength` | Tamanho mínimo/máximo (strings) | `minLength: 2, maxLength: 50` |
| `pattern` | Regex pattern | `pattern: /^\d{3}-\d{3}-\d{4}$/` |
| `isEmail` | Validação de email | `isEmail: true` |
| `isUUID` | Validação de UUID | `isUUID: true` |
| `enum` | Valores permitidos | `enum: ['active', 'inactive']` |
| `custom` | Função personalizada | `custom: (value) => value !== 'admin'` |

## 💾 Cache Inteligente

### Configuração Básica

```typescript
import { IntelligentCache, QueryCache } from 'cassandraorm-js';

// Cache geral
const cache = new IntelligentCache({
  ttl: 300,        // 5 minutos
  maxSize: 1000,   // Máximo 1000 itens
  strategy: 'lru'  // Least Recently Used
});

// Cache de queries
const queryCache = new QueryCache({
  ttl: 600,        // 10 minutos
  maxSize: 500
});
```

### Uso do Cache

```typescript
// Cache simples
cache.set('user:123', userData, 600); // TTL personalizado
const user = cache.get('user:123');

// Cache de queries
const query = 'SELECT * FROM users WHERE status = ?';
const params = ['active'];

// Verificar cache primeiro
let result = queryCache.get(query, params);
if (!result) {
  result = await client.execute(query, params);
  queryCache.set(query, params, result.rows);
}
```

### Estratégias de Eviction

```typescript
// LRU - Least Recently Used (padrão)
const lruCache = new IntelligentCache({ strategy: 'lru' });

// LFU - Least Frequently Used
const lfuCache = new IntelligentCache({ strategy: 'lfu' });

// FIFO - First In, First Out
const fifoCache = new IntelligentCache({ strategy: 'fifo' });
```

### Invalidação de Cache

```typescript
// Invalidar item específico
cache.delete('user:123');

// Invalidar por padrão
queryCache.invalidate('SELECT * FROM users*');

// Limpar tudo
cache.clear();
```

### Estatísticas

```typescript
const stats = cache.stats();
console.log(`Cache size: ${stats.size}`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Total hits: ${stats.totalHits}`);
```

## 📄 Paginação Otimizada

### Paginação com Token (Recomendada)

```typescript
import { OptimizedPagination } from 'cassandraorm-js';

const pagination = new OptimizedPagination(client.driver, 'myapp');

// Primeira página
const page1 = await pagination.paginate(
  'SELECT * FROM users WHERE status = ?',
  ['active'],
  { limit: 20 }
);

console.log(`Found ${page1.data.length} users`);
console.log(`Has more: ${page1.hasMore}`);

// Próxima página
if (page1.pageState) {
  const page2 = await pagination.paginate(
    'SELECT * FROM users WHERE status = ?',
    ['active'],
    { limit: 20, pageState: page1.pageState }
  );
}
```

### Paginação com Cursor

```typescript
// Primeira página
const page1 = await pagination.cursorPaginate('users', {
  limit: 20,
  orderBy: 'created_at',
  direction: 'DESC'
});

// Próxima página
if (page1.hasNext) {
  const page2 = await pagination.cursorPaginate('users', {
    limit: 20,
    cursor: page1.nextCursor,
    orderBy: 'created_at',
    direction: 'DESC'
  });
}
```

### Auto-Paginação para Grandes Datasets

```typescript
// Processar todos os dados em lotes
for await (const batch of pagination.autoPaginate('SELECT * FROM users', [], 1000)) {
  console.log(`Processing batch of ${batch.length} users`);
  // Processar lote
}

// Streaming com callback
await pagination.streamPaginate(
  'SELECT * FROM users',
  [],
  async (batch) => {
    // Processar cada lote
    await processBatch(batch);
  },
  1000 // Tamanho do lote
);
```

## 🪝 Hooks e Middlewares

### Configuração de Hooks

```typescript
import { HooksMiddlewareSystem, CommonHooks } from 'cassandraorm-js';

const hooks = new HooksMiddlewareSystem();

// Hooks de timestamps
hooks.beforeCreate(CommonHooks.addTimestamps);
hooks.beforeUpdate(CommonHooks.updateTimestamp);

// Hook de validação
hooks.beforeCreate(CommonHooks.validate(userSchema));

// Hook de auditoria
hooks.afterCreate(CommonHooks.auditLog('users'));

// Hook personalizado
hooks.beforeCreate(async (data) => {
  if (data.password) {
    data.password = await hashPassword(data.password);
  }
  return data;
});
```

### Middlewares

```typescript
// Middleware de logging
hooks.use(CommonMiddleware.logging());

// Middleware de rate limiting
hooks.use(CommonMiddleware.rateLimit(100, 60000)); // 100 req/min

// Middleware de performance
hooks.use(CommonMiddleware.performanceMonitor());

// Middleware personalizado
hooks.use(async (data, next) => {
  console.log('Processing:', data);
  const result = await next();
  console.log('Completed');
  return result;
});
```

### Execução de Operações com Hooks

```typescript
// Executar operação completa com hooks
const result = await hooks.executeOperation(
  'create',
  userData,
  { operation: 'create', tableName: 'users' },
  async () => {
    // Operação real
    return await client.execute(
      'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
      [userData.id, userData.name, userData.email]
    );
  }
);
```

### Hooks Comuns Disponíveis

```typescript
// Timestamps automáticos
CommonHooks.addTimestamps     // Adiciona created_at e updated_at
CommonHooks.updateTimestamp   // Atualiza updated_at

// Validação
CommonHooks.validate(schema)  // Valida dados contra schema

// Soft delete
CommonHooks.softDelete        // Marca como deletado

// Sanitização
CommonHooks.sanitize          // Remove campos sensíveis

// Auditoria
CommonHooks.auditLog(table)   // Log de operações

// Cache
CommonHooks.invalidateCache(key) // Invalida cache
```

## 🔧 Integração com Modelos

### Usando com CassandraClient

```typescript
const client = createClient({ /* config */ });
await client.connect();

// Query builder integrado
const User = await client.loadSchema('users', userSchema);

// Adicionar query builder ao modelo
User.query = () => new AdvancedQueryBuilder(client.driver, 'users', client.keyspace);

// Usar
const activeUsers = await User.query()
  .where('status').eq('active')
  .execute();
```

### Cache Automático

```typescript
// Cache integrado ao cliente
client.enableCache({
  ttl: 300,
  maxSize: 1000
});

// Queries serão automaticamente cacheadas
const users = await client.execute('SELECT * FROM users WHERE status = ?', ['active']);
```

## 📊 Exemplos Práticos

### Sistema de Usuários Completo

```typescript
import { 
  createClient, 
  AdvancedQueryBuilder, 
  SchemaValidator,
  IntelligentCache,
  HooksMiddlewareSystem,
  CommonHooks 
} from 'cassandraorm-js';

class UserService {
  private client: any;
  private cache: IntelligentCache;
  private hooks: HooksMiddlewareSystem;

  constructor() {
    this.client = createClient({ /* config */ });
    this.cache = new IntelligentCache({ ttl: 300 });
    this.hooks = new HooksMiddlewareSystem();
    
    // Setup hooks
    this.hooks.beforeCreate(CommonHooks.addTimestamps);
    this.hooks.beforeCreate(CommonHooks.validate(userSchema));
    this.hooks.afterFind(CommonHooks.sanitize);
  }

  async findActiveUsers(limit = 20, pageState?: string) {
    const cacheKey = `active_users:${limit}:${pageState || 'first'}`;
    
    // Check cache
    let result = this.cache.get(cacheKey);
    if (result) return result;

    // Query with advanced builder
    const queryBuilder = new AdvancedQueryBuilder(this.client.driver, 'users', 'myapp');
    
    result = await queryBuilder
      .select(['id', 'name', 'email', 'status'])
      .where('status').eq('active')
      .orderBy('created_at', 'DESC')
      .limit(limit)
      .allowFiltering()
      .execute();

    // Cache result
    this.cache.set(cacheKey, result, 300);
    
    return result;
  }

  async createUser(userData: any) {
    return this.hooks.executeOperation(
      'create',
      userData,
      { operation: 'create', tableName: 'users' },
      async () => {
        const processedData = await this.hooks.executeHook('beforeCreate', userData);
        
        await this.client.execute(
          'INSERT INTO users (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [processedData.id, processedData.name, processedData.email, processedData.created_at, processedData.updated_at]
        );
        
        // Invalidate cache
        this.cache.invalidate('active_users:*');
        
        return processedData;
      }
    );
  }
}
```

As funcionalidades avançadas estão prontas e testadas! 🚀
