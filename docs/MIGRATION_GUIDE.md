# Migration Guide - From Express-Cassandra to CassandraORM JS

This guide helps you migrate from Express-Cassandra to CassandraORM JS, taking advantage of all the new advanced features.

## 📋 Migration Overview

CassandraORM JS is designed to be compatible with Express-Cassandra while providing significant enhancements:

- **TypeScript First** - Native TypeScript support
- **16 Advanced Features** - AI/ML, Event Sourcing, Distributed Transactions
- **Modern Architecture** - ES6+ modules, async/await
- **Enterprise Features** - Multi-tenancy, GraphQL, Real-time subscriptions

## 🔄 Step-by-Step Migration

### Step 1: Installation

```bash
# Remove old package
npm uninstall express-cassandra

# Install new package
npm install cassandraorm-js
```

### Step 2: Basic Connection Migration

**Before (Express-Cassandra):**
```javascript
const models = require('express-cassandra');

models.setDirectory(__dirname + '/models').bind({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    protocolOptions: { port: 9042 },
    keyspace: 'mykeyspace',
    queryOptions: { consistency: models.consistencies.one }
  },
  ormOptions: {
    defaultReplicationStrategy: {
      class: 'SimpleStrategy',
      replication_factor: 1
    },
    migration: 'safe'
  }
});
```

**After (CassandraORM JS):**
```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'mykeyspace'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe',
    defaultReplicationStrategy: {
      class: 'SimpleStrategy',
      replication_factor: 1
    }
  }
});

await client.connect();
```

### Step 3: Model Definition Migration

**Before (Express-Cassandra):**
```javascript
// models/User.js
module.exports = {
  fields: {
    id: 'uuid',
    name: 'text',
    email: 'text',
    created_at: 'timestamp'
  },
  key: ['id'],
  table_name: 'users'
};
```

**After (CassandraORM JS):**
```typescript
// Enhanced with validation and relations
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 2
      }
    },
    email: {
      type: 'text',
      unique: true,
      validate: {
        required: true,
        isEmail: true
      }
    },
    created_at: 'timestamp'
  },
  relations: {
    posts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany'
    }
  },
  key: ['id']
});
```

### Step 4: Query Migration

**Before (Express-Cassandra):**
```javascript
// Basic queries
const users = await models.instance.User.findAsync({});
const user = await models.instance.User.findOneAsync({ id: userId });

// Create
const newUser = new models.instance.User({
  id: models.uuid(),
  name: 'John Doe',
  email: 'john@example.com'
});
await newUser.saveAsync();
```

**After (CassandraORM JS):**
```typescript
// Basic queries (compatible)
const users = await User.find({});
const user = await User.findOne({ id: userId });

// Create (enhanced)
const newUser = await User.create({
  id: client.uuid(),
  name: 'John Doe',
  email: 'john@example.com',
  created_at: new Date()
});

// Advanced query builder
import { AdvancedQueryBuilder } from 'cassandraorm-js';

const queryBuilder = new AdvancedQueryBuilder(client.driver, 'users', 'mykeyspace');
const results = await queryBuilder
  .select(['id', 'name', 'email'])
  .where('status').eq('active')
  .and('age').gte(18)
  .orderBy('created_at', 'DESC')
  .limit(50)
  .execute();
```

## 🚀 Leveraging New Features

### 1. Add Relations

```typescript
import { RelationsManager } from 'cassandraorm-js';

const relations = new RelationsManager(client.driver, 'mykeyspace');

// Register models with relations
relations.registerModel('users', userSchema);
relations.registerModel('posts', postSchema);

// Populate relations automatically
const users = await client.execute('SELECT * FROM users LIMIT 10');
const populatedUsers = await relations.populate('users', users.rows, ['posts']);
```

### 2. Add Aggregations

```typescript
import { AggregationsManager } from 'cassandraorm-js';

const aggregations = new AggregationsManager(client.driver, 'mykeyspace');

// MongoDB-style aggregations
const stats = await aggregations.createPipeline('orders')
  .where('status', '=', 'completed')
  .groupBy('customer_id')
  .count('total_orders')
  .sum('amount', 'total_revenue')
  .having('total_orders').gt(5)
  .execute();
```

### 3. Add Caching

```typescript
import { IntelligentCache, SemanticCache } from 'cassandraorm-js';

// Traditional cache
const cache = new IntelligentCache({
  ttl: 300,
  maxSize: 1000,
  strategy: 'lru'
});

// Semantic cache (AI-powered)
const semanticCache = new SemanticCache({
  similarityThreshold: 0.85,
  maxCacheSize: 1000
});

// Cache queries automatically
const cachedResult = await semanticCache.get(query, params);
if (!cachedResult) {
  const result = await client.execute(query, params);
  await semanticCache.set(query, params, result.rows);
}
```

### 4. Add Real-time Features

```typescript
import { SubscriptionManager } from 'cassandraorm-js';

const subscriptions = new SubscriptionManager(client.driver, 'mykeyspace');

// Real-time subscriptions
await subscriptions.subscribe(
  {
    table: 'users',
    operation: 'insert'
  },
  (event) => {
    console.log('New user created:', event.data);
    // Notify clients, update analytics, etc.
  }
);
```

### 5. Add AI/ML Features

```typescript
import { AIMLManager } from 'cassandraorm-js';

const aiml = new AIMLManager(client.driver, 'mykeyspace');

// Create vector search
await aiml.createVectorTable('documents');

// Generate embeddings and search
const embedding = await aiml.generateEmbedding('search query');
const results = await aiml.similaritySearch('documents', embedding);

// Query optimization
const suggestions = await aiml.optimizeQuery(
  'SELECT * FROM users WHERE email = ? ALLOW FILTERING'
);
```

## 📊 Feature Comparison

| Feature | Express-Cassandra | CassandraORM JS |
|---------|------------------|-----------------|
| TypeScript Support | ❌ | ✅ Native |
| Relations | ❌ | ✅ hasOne, hasMany, belongsTo |
| Aggregations | ❌ | ✅ MongoDB-style pipeline |
| Caching | ❌ | ✅ Intelligent + Semantic |
| Real-time | ❌ | ✅ WebSocket/SSE subscriptions |
| AI/ML | ❌ | ✅ Vector search, optimization |
| Event Sourcing | ❌ | ✅ Complete CQRS implementation |
| Distributed Transactions | ❌ | ✅ 2PC + Saga patterns |
| GraphQL | ❌ | ✅ Auto-generated schemas |
| Multi-tenancy | ❌ | ✅ Multiple isolation strategies |
| Performance Optimization | ❌ | ✅ AI-powered suggestions |
| Backup/Restore | ❌ | ✅ Automated with compression |
| Connection Pool | Basic | ✅ Advanced with load balancing |
| Observability | ❌ | ✅ Metrics + Tracing |
| Schema Evolution | ❌ | ✅ Automated migrations |
| Time Series | ❌ | ✅ Optimized partitioning |

## 🔧 Migration Checklist

### Phase 1: Basic Migration
- [ ] Install CassandraORM JS
- [ ] Update connection configuration
- [ ] Convert model definitions
- [ ] Update basic queries
- [ ] Test existing functionality

### Phase 2: Add Advanced Features
- [ ] Implement relations
- [ ] Add aggregation queries
- [ ] Setup intelligent caching
- [ ] Configure connection pooling
- [ ] Add schema validation

### Phase 3: Enterprise Features
- [ ] Setup observability (metrics/tracing)
- [ ] Implement multi-tenancy
- [ ] Add real-time subscriptions
- [ ] Configure backup/restore
- [ ] Setup GraphQL integration

### Phase 4: AI/ML Integration
- [ ] Implement vector search
- [ ] Add query optimization
- [ ] Setup event sourcing
- [ ] Configure distributed transactions
- [ ] Enable semantic caching

## 🚨 Breaking Changes

### 1. Connection Initialization
- Now requires `await client.connect()`
- Auto-creation options moved to `ormOptions`

### 2. Model Definition
- Enhanced schema with validation and relations
- TypeScript interfaces recommended

### 3. Query Methods
- Async/await throughout (no more callbacks)
- Enhanced error handling

### 4. Configuration
- Restructured configuration object
- New options for advanced features

## 💡 Best Practices

### 1. Gradual Migration
```typescript
// Start with basic migration
const client = createClient(basicConfig);

// Gradually add features
const relations = new RelationsManager(client.driver, keyspace);
const cache = new IntelligentCache();
const aiml = new AIMLManager(client.driver, keyspace);
```

### 2. TypeScript Integration
```typescript
// Define interfaces for type safety
interface User {
  id: string;
  name: string;
  email: string;
  created_at: Date;
}

// Use with models
const user: User = await User.findOne({ id: userId });
```

### 3. Error Handling
```typescript
try {
  const result = await client.execute(query, params);
  return result.rows;
} catch (error) {
  console.error('Query failed:', error);
  throw error;
}
```

### 4. Performance Optimization
```typescript
// Use connection pooling
const pool = new AdvancedConnectionPool(clientOptions, poolConfig);

// Enable caching
const cache = new SemanticCache({ similarityThreshold: 0.8 });

// Monitor performance
const optimizer = new PerformanceOptimizer(client.driver, keyspace);
```

## 🎯 Migration Timeline

### Week 1: Basic Migration
- Install and configure CassandraORM JS
- Migrate basic models and queries
- Test core functionality

### Week 2: Enhanced Features
- Add relations and aggregations
- Implement caching
- Setup connection pooling

### Week 3: Enterprise Features
- Add observability
- Implement multi-tenancy
- Setup real-time subscriptions

### Week 4: Advanced Features
- Integrate AI/ML features
- Setup event sourcing
- Configure distributed transactions

## 📞 Support

If you need help with migration:

1. Check the [Complete Documentation](./COMPLETE_DOCUMENTATION.md)
2. Review [Examples](../examples/)
3. Open an [Issue](https://github.com/wemerson-silva-kz/cassandraorm-js/issues)
4. Join our community discussions

**Happy migrating to the most advanced Cassandra ORM!** 🚀
