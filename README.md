# CassandraORM JS

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/wemerson-silva-kz/cassandraorm-js/workflows/Node.js%20CI/badge.svg)](https://github.com/wemerson-silva-kz/cassandraorm-js/actions)

The most advanced ORM for Apache Cassandra and ScyllaDB with native TypeScript support, AI/ML integration, and enterprise-grade features.

## 🌟 What Makes CassandraORM JS Special

**16 Advanced Features** across 4 development phases:
- **AI/ML Integration** - Vector search, query optimization, anomaly detection
- **Event Sourcing** - Complete CQRS implementation with domain events
- **Distributed Transactions** - 2PC and Saga patterns
- **Real-time Subscriptions** - WebSocket/SSE with intelligent filtering
- **GraphQL Integration** - Automatic schema generation
- **Semantic Caching** - AI-powered intelligent caching
- **Performance Optimization** - AI suggestions and monitoring
- **Multi-tenancy** - Flexible isolation strategies

## 🚀 Quick Start

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe'
  }
});

await client.connect();

// Define schema with validation and relations
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { 
      type: 'text', 
      unique: true,
      validate: { required: true, isEmail: true }
    },
    name: {
      type: 'text',
      validate: { required: true, minLength: 2 }
    }
  },
  relations: {
    posts: { model: 'posts', foreignKey: 'user_id', type: 'hasMany' }
  },
  key: ['id']
});
```

## 🧠 AI/ML Features

```typescript
import { AIMLManager, SemanticCache } from 'cassandraorm-js';

// Vector similarity search
const aiml = new AIMLManager(client.driver, 'myapp');
await aiml.createVectorTable('documents');

const embedding = await aiml.generateEmbedding('search query');
const results = await aiml.similaritySearch('documents', embedding);

// Semantic caching
const cache = new SemanticCache({ similarityThreshold: 0.85 });
await cache.set(query, params, result);
const cached = await cache.get(similarQuery, similarParams); // Smart cache hit!
```

## 🔄 Event Sourcing & CQRS

```typescript
import { EventStore, BaseAggregateRoot, AggregateRepository } from 'cassandraorm-js';

class UserAggregate extends BaseAggregateRoot {
  static create(id: string, name: string, email: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserCreated', { name, email });
    return user;
  }

  changeName(newName: string): void {
    this.addEvent('UserNameChanged', { oldName: this.name, newName });
  }
}

const eventStore = new EventStore(client.driver, 'myapp');
const repository = new AggregateRepository(eventStore, (id) => new UserAggregate(id));

const user = UserAggregate.create('user1', 'John', 'john@example.com');
await repository.save(user);
```

## 🌐 Real-time & GraphQL

```typescript
import { SubscriptionManager, GraphQLSchemaGenerator } from 'cassandraorm-js';

// Real-time subscriptions
const subscriptions = new SubscriptionManager(client.driver, 'myapp');
await subscriptions.subscribe(
  { table: 'users', operation: 'insert' },
  (event) => console.log('New user:', event.data)
);

// Auto-generated GraphQL schema
const generator = new GraphQLSchemaGenerator();
generator.addModel('users', userSchema);
const typeDefs = generator.generateSchema();
const resolvers = generator.getResolvers();
```

## 📊 Advanced Analytics

```typescript
import { AggregationsManager, TimeSeriesManager } from 'cassandraorm-js';

// MongoDB-style aggregations
const aggregations = new AggregationsManager(client.driver, 'myapp');
const stats = await aggregations.createPipeline('orders')
  .where('status', '=', 'completed')
  .groupBy('customer_id')
  .count('total_orders')
  .sum('amount', 'total_revenue')
  .having('total_orders').gt(5)
  .execute();

// Time series data
const timeSeries = new TimeSeriesManager(client.driver, 'myapp');
await timeSeries.insert('metrics', [{
  timestamp: new Date(),
  value: 100.5,
  tags: { metric: 'cpu_usage', host: 'server1' }
}]);
```

## 📚 Complete Documentation

**📖 [Complete Documentation](./docs/COMPLETE_DOCUMENTATION.md)** - Comprehensive guide covering all 16 features

**🔄 [Migration Guide](./docs/MIGRATION_GUIDE.md)** - Step-by-step migration from Express-Cassandra

### Quick Links
- [Phase 1: Foundation Features](./docs/COMPLETE_DOCUMENTATION.md#phase-1-foundation-features) - Relations, Aggregations, Connection Pool, Time Series
- [Phase 2: Scalability Features](./docs/COMPLETE_DOCUMENTATION.md#phase-2-scalability-features) - Streaming, Observability, Multi-tenancy, Schema Evolution
- [Phase 3: Integration Features](./docs/COMPLETE_DOCUMENTATION.md#phase-3-integration-features) - GraphQL, Backup/Restore, Performance Optimization, Subscriptions
- [Phase 4: AI/ML & Enterprise](./docs/COMPLETE_DOCUMENTATION.md#phase-4-aiml--enterprise-features) - AI/ML, Event Sourcing, Distributed Transactions, Semantic Caching

## 🧪 Testing

```bash
# Run all tests (47/48 passing - 97.9% success rate)
bun test

# Run specific phase tests
bun test tests/phase1-features.test.ts  # Foundation
bun test tests/phase2-features.test.ts  # Scalability  
bun test tests/phase3-features.test.ts  # Integration
bun test tests/phase4-features.test.ts  # AI/ML & Enterprise

# CI tests
npm test
```

## 🌍 Languages

- [English](./README.md) (current)
- [Português](./README.pt.md)

## 🔄 Migration from Express-Cassandra

CassandraORM JS is designed to be compatible with Express-Cassandra while providing significant enhancements. See our [Migration Guide](./docs/MIGRATION_GUIDE.md) for step-by-step instructions.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/cassandraorm-js)
- [GitHub Repository](https://github.com/wemerson-silva-kz/cassandraorm-js)
- [Complete Documentation](./docs/COMPLETE_DOCUMENTATION.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)
- [Examples](./examples/)

## ⭐ Support

If you find this project helpful, please give it a star on GitHub!

**CassandraORM JS - The most advanced ORM for Cassandra/ScyllaDB** 🚀
