# 🚀 CassandraORM JS - Complete Documentation

[![npm version](https://badge.fury.io/js/cassandraorm-js.svg)](https://www.npmjs.com/package/cassandraorm-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/wemerson-silva-kz/cassandraorm-js/workflows/Node.js%20CI/badge.svg)](https://github.com/wemerson-silva-kz/cassandraorm-js/actions)
[![Tests](https://img.shields.io/badge/tests-100%25%20passing-brightgreen.svg)](./testing/test-results.md)

> **The most advanced ORM for Apache Cassandra and ScyllaDB with native TypeScript support, AI/ML integration, and enterprise-grade features.**

## 📚 Table of Contents

### 🚀 Getting Started
- [Quick Start Guide](./getting-started/quick-start.md)
- [Installation](./getting-started/installation.md)
- [Configuration](./getting-started/configuration.md)
- [First Steps](./getting-started/first-steps.md)

### 🔧 Core Features
- [Models & Schemas](./core/models-schemas.md)
- [CRUD Operations](./core/crud-operations.md)
- [Data Types & CassandraTypes](./core/data-types.md) ⭐
- [Relationships](./core/relationships.md)
- [Validation](./core/validation.md)
- [Unique Constraints](./core/unique-constraints.md)

### 🧠 AI/ML Integration
- [Vector Search](./ai-ml/vector-search.md)
- [Semantic Caching](./ai-ml/semantic-caching.md)
- [Query Optimization](./ai-ml/query-optimization.md)
- [Anomaly Detection](./ai-ml/anomaly-detection.md)

### 🔄 Event Sourcing & CQRS
- [Event Store](./event-sourcing/event-store.md)
- [Aggregates](./event-sourcing/aggregates.md)
- [Domain Events](./event-sourcing/domain-events.md)
- [Sagas](./event-sourcing/sagas.md)
- [CQRS Patterns](./event-sourcing/cqrs-patterns.md)

### 🔀 Distributed Systems
- [Distributed Transactions](./distributed/transactions.md)
- [Two-Phase Commit](./distributed/two-phase-commit.md)
- [Saga Orchestration](./distributed/saga-orchestration.md)
- [Compensation Patterns](./distributed/compensation.md)

### 📡 Real-time Features
- [Subscriptions](./real-time/subscriptions.md)
- [WebSocket Integration](./real-time/websockets.md)
- [Server-Sent Events](./real-time/sse.md)
- [Event Broadcasting](./real-time/broadcasting.md)

### 🌐 GraphQL Integration
- [Schema Generation](./graphql/schema-generation.md)
- [Resolvers](./graphql/resolvers.md)
- [Data Sources](./graphql/data-sources.md)
- [Performance](./graphql/performance.md)

### 📊 Performance & Monitoring
- [Performance Profiling](./performance/profiling.md)
- [Metrics Collection](./performance/metrics.md)
- [Monitoring](./performance/monitoring.md)
- [Optimization](./performance/optimization.md)
- [Health Checks](./performance/health-checks.md)

### 🔍 Advanced Queries
- [Query Builder](./queries/query-builder.md)
- [Aggregations](./queries/aggregations.md)
- [Time Series](./queries/time-series.md)
- [Pagination](./queries/pagination.md)
- [Streaming](./queries/streaming.md)

### 🛠️ Developer Tools
- [CLI Tools](./tools/cli.md)
- [VS Code Extension](./tools/vscode.md)
- [Web Dashboard](./tools/dashboard.md)
- [Testing](./tools/testing.md)

### 🔌 Integrations
- [Elassandra](./integrations/elassandra.md)
- [Docker](./integrations/docker.md)
- [Kubernetes](./integrations/kubernetes.md)
- [Microservices](./integrations/microservices.md)

### 📖 API Reference
- [Client API](./api/client.md)
- [Model API](./api/model.md)
- [Types](./api/types.md)
- [Utilities](./api/utilities.md)

### 🎯 Examples & Tutorials
- [Basic Examples](./examples/basic.md)
- [Advanced Examples](./examples/advanced.md)
- [E-commerce Platform](./examples/ecommerce.md)
- [IoT Data Platform](./examples/iot.md)
- [Social Media App](./examples/social-media.md)

### 🔄 Migration & Deployment
- [Migration Guide](./migration/from-express-cassandra.md)
- [Production Deployment](./deployment/production.md)
- [Scaling](./deployment/scaling.md)
- [Best Practices](./deployment/best-practices.md)

## 🌟 Key Features Overview

### 🔧 **16 Advanced Feature Categories**

| Category | Features | Status |
|----------|----------|--------|
| **Core ORM** | Models, CRUD, Validation, Constraints | ✅ 100% |
| **AI/ML Integration** | Vector Search, Semantic Cache, Query Optimization | ✅ 100% |
| **Event Sourcing** | Event Store, Aggregates, Domain Events, Sagas | ✅ 100% |
| **Distributed Transactions** | 2PC, Saga Orchestration, Compensation | ✅ 100% |
| **Real-time** | Subscriptions, WebSocket, SSE, Broadcasting | ✅ 100% |
| **GraphQL** | Schema Generation, Resolvers, Data Sources | ✅ 100% |
| **Performance** | Profiling, Metrics, Monitoring, Optimization | ✅ 100% |
| **Advanced Queries** | Builder, Aggregations, Time Series, Streaming | ✅ 100% |

### 🚀 **Quick Example**

```typescript
import { createClient } from 'cassandraorm-js';

// Create client with AI/ML support
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

// Define model with validation and relations
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { type: 'text', unique: true, validate: { isEmail: true } },
    name: { type: 'text', validate: { required: true, minLength: 2 } },
    preferences: 'map<text,text>',
    created_at: 'timestamp'
  },
  relations: {
    posts: { model: 'posts', foreignKey: 'user_id', type: 'hasMany' }
  },
  key: ['id']
});

// CRUD with automatic validation
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe',
  preferences: { theme: 'dark', language: 'en' },
  created_at: new Date()
});

// AI-powered vector search
import { AIMLManager } from 'cassandraorm-js';
const aiml = new AIMLManager(client.driver, 'myapp');
const embedding = await aiml.generateEmbedding('search query');
const results = await aiml.similaritySearch('documents', embedding);

// Real-time subscriptions
import { SubscriptionManager } from 'cassandraorm-js';
const subscriptions = new SubscriptionManager(client.driver, 'myapp');
await subscriptions.subscribe(
  { table: 'users', operation: 'insert' },
  (event) => console.log('New user:', event.data)
);

// Event sourcing
import { EventStore, BaseAggregateRoot } from 'cassandraorm-js';
class OrderAggregate extends BaseAggregateRoot {
  static create(id: string, customerId: string): OrderAggregate {
    const order = new OrderAggregate(id);
    order.addEvent('OrderCreated', { customerId });
    return order;
  }
}
```

## 🎯 **Why CassandraORM JS?**

### ✅ **Enterprise-Ready**
- **Production-tested** with 100% test coverage
- **TypeScript-first** with complete type safety
- **Scalable architecture** for high-throughput applications
- **Enterprise features** like distributed transactions and event sourcing

### 🧠 **AI/ML Native**
- **Vector search** with embedding generation
- **Semantic caching** for intelligent query optimization
- **Anomaly detection** for performance monitoring
- **Query optimization** with AI suggestions

### 🔄 **Modern Patterns**
- **Event Sourcing & CQRS** for complex business logic
- **Distributed transactions** with 2PC and Saga patterns
- **Real-time subscriptions** with WebSocket and SSE
- **GraphQL integration** with automatic schema generation

### 📊 **Performance Focused**
- **Advanced monitoring** with metrics and tracing
- **Query optimization** with AI-powered suggestions
- **Connection pooling** with load balancing
- **Streaming support** for large datasets

## 🚀 **Getting Started**

1. **[Installation →](./getting-started/installation.md)**
2. **[Quick Start →](./getting-started/quick-start.md)**
3. **[Configuration →](./getting-started/configuration.md)**
4. **[First Steps →](./getting-started/first-steps.md)**

## 📖 **Popular Guides**

- **[Building an E-commerce Platform](./examples/ecommerce.md)** - Complete tutorial
- **[AI/ML Integration Guide](./ai-ml/vector-search.md)** - Vector search and recommendations
- **[Event Sourcing Tutorial](./event-sourcing/event-store.md)** - CQRS and domain events
- **[Real-time Features](./real-time/subscriptions.md)** - WebSocket and SSE integration
- **[Performance Optimization](./performance/optimization.md)** - Best practices and monitoring

## 🤝 **Community & Support**

- **[GitHub Issues](https://github.com/wemerson-silva-kz/cassandraorm-js/issues)** - Bug reports and feature requests
- **[Discussions](https://github.com/wemerson-silva-kz/cassandraorm-js/discussions)** - Community discussions
- **[Examples Repository](https://github.com/wemerson-silva-kz/cassandraorm-js-examples)** - Real-world examples
- **[Migration Guide](./migration/from-express-cassandra.md)** - From Express-Cassandra

## 📄 **License**

MIT License - see [LICENSE](../LICENSE) file for details.

---

**CassandraORM JS - The most advanced ORM for Cassandra/ScyllaDB** 🚀

*Built with ❤️ for the modern developer*
