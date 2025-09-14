# 🚀 Quick Start Guide

Get up and running with CassandraORM JS in minutes!

## 📦 Installation

```bash
# Install CassandraORM JS
npm install cassandraorm-js

# Install CLI tools (optional)
npm install -g cassandraorm-cli
```

## 🐳 Setup Cassandra/ScyllaDB

### Using Docker (Recommended)

```bash
# Start Cassandra
docker run --name cassandra -p 9042:9042 -d cassandra:latest

# Or use Docker Compose
curl -O https://raw.githubusercontent.com/wemerson-silva-kz/cassandraorm-js/main/docker-compose.yml
docker-compose up -d
```

### Using ScyllaDB

```bash
# Start ScyllaDB
docker run --name scylla -p 9042:9042 -d scylladb/scylla:latest
```

## 🔌 Basic Connection

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
console.log('✅ Connected to Cassandra!');
```

## 📋 Define Your First Model

```typescript
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
    },
    age: 'int',
    preferences: 'map<text,text>',
    tags: 'set<text>',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id']
});

console.log('✅ User model loaded!');
```

## 📝 CRUD Operations

### Create

```typescript
// Create a new user
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30,
  preferences: { theme: 'dark', language: 'en' },
  tags: ['developer', 'typescript'],
  created_at: new Date(),
  updated_at: new Date()
});

console.log('User created:', user.id);
```

### Read

```typescript
// Find all users
const allUsers = await User.find();

// Find by email
const user = await User.findOne({ email: 'john@example.com' });

// Find with conditions
const developers = await User.find({ 
  tags: { $contains: 'developer' } 
}, { 
  limit: 10,
  allow_filtering: true 
});
```

### Update

```typescript
// Update user
await User.update(
  { id: user.id },
  { 
    age: 31,
    updated_at: new Date()
  }
);
```

### Delete

```typescript
// Delete user
await User.delete({ id: user.id });
```

## 🔗 Relationships

```typescript
// Define Post model with relationship
const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    title: 'text',
    content: 'text',
    published: 'boolean',
    created_at: 'timestamp'
  },
  relations: {
    user: { model: 'users', foreignKey: 'user_id', type: 'belongsTo' }
  },
  key: ['id']
});

// Create post
const post = await Post.create({
  user_id: user.id,
  title: 'My First Post',
  content: 'Hello, CassandraORM!',
  published: true,
  created_at: new Date()
});

// Find posts with user data
const postsWithUsers = await Post.find({}, {
  populate: ['user']
});
```

## 🧠 AI/ML Features

```typescript
import { AIMLManager, SemanticCache } from 'cassandraorm-js';

// Setup AI/ML
const aiml = new AIMLManager(client.driver, 'myapp');

// Create vector table for search
await aiml.createVectorTable('documents', {
  vectorDimension: 384,
  additionalFields: {
    title: 'text',
    content: 'text',
    category: 'text'
  }
});

// Generate embedding and search
const embedding = await aiml.generateEmbedding('machine learning tutorial');
const results = await aiml.similaritySearch('documents', embedding, {
  limit: 5,
  threshold: 0.8
});

// Semantic caching
const cache = new SemanticCache({ similarityThreshold: 0.85 });
await cache.set('query', { category: 'tech' }, results);
const cached = await cache.get('similar query', { category: 'tech' });
```

## 📡 Real-time Subscriptions

```typescript
import { SubscriptionManager } from 'cassandraorm-js';

const subscriptions = new SubscriptionManager(client.driver, 'myapp');
await subscriptions.initialize();

// Subscribe to new users
await subscriptions.subscribe(
  { table: 'users', operation: 'insert' },
  (event) => {
    console.log('New user registered:', event.data.email);
    // Send welcome email, update analytics, etc.
  }
);

// Subscribe with filters
await subscriptions.subscribe(
  { 
    table: 'posts', 
    operation: 'insert',
    conditions: { published: true }
  },
  (event) => {
    console.log('New post published:', event.data.title);
  }
);
```

## 🔄 Event Sourcing

```typescript
import { EventStore, BaseAggregateRoot, AggregateRepository } from 'cassandraorm-js';

// Define aggregate
class UserAggregate extends BaseAggregateRoot {
  private email: string = '';
  private name: string = '';

  static create(id: string, email: string, name: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserCreated', { email, name });
    return user;
  }

  changeEmail(newEmail: string): void {
    if (newEmail !== this.email) {
      this.addEvent('EmailChanged', { 
        oldEmail: this.email, 
        newEmail 
      });
    }
  }

  protected applyEvent(event: any): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.email = event.data.email;
        this.name = event.data.name;
        break;
      case 'EmailChanged':
        this.email = event.data.newEmail;
        break;
    }
  }
}

// Setup event store
const eventStore = new EventStore(client.driver, 'myapp');
await eventStore.initialize();

const repository = new AggregateRepository(
  eventStore,
  (id: string) => new UserAggregate(id)
);

// Use aggregate
const userAggregate = UserAggregate.create(
  client.uuid(),
  'john@example.com',
  'John Doe'
);

userAggregate.changeEmail('john.doe@example.com');
await repository.save(userAggregate);
```

## 🌐 GraphQL Integration

```typescript
import { GraphQLSchemaGenerator, CassandraDataSource } from 'cassandraorm-js';

// Generate GraphQL schema
const generator = new GraphQLSchemaGenerator();
generator.addModel('User', {
  fields: {
    id: { type: 'ID', required: true },
    email: { type: 'String', required: true },
    name: { type: 'String', required: true },
    age: { type: 'Int' }
  }
});

const typeDefs = generator.generateSchema();
const resolvers = generator.generateCRUDResolvers(['User']);

// Create data source
const dataSource = new CassandraDataSource({
  client: client,
  keyspace: 'myapp'
});
```

## 📊 Performance Monitoring

```typescript
import { Monitor, PerformanceProfiler, MetricsCollector } from 'cassandraorm-js';

// Setup monitoring
const monitor = new Monitor({
  interval: 1000,
  enableSystemMetrics: true,
  enableCassandraMetrics: true
});

await monitor.start();

// Performance profiling
const profiler = new PerformanceProfiler({
  enableQueryProfiling: true,
  sampleRate: 0.1
});

await profiler.start();

// Metrics collection
const metrics = new MetricsCollector({
  collectInterval: 5000,
  retentionPeriod: 3600000
});

await metrics.start();

// Get health status
const health = await monitor.getHealthStatus();
console.log('System health:', health.status);
```

## 🔧 CLI Tools

```bash
# Initialize new project
cassandraorm init my-project --typescript --ai

# Generate models
cassandraorm generate model User --fields "name:text,email:text"

# Run migrations
cassandraorm migrate

# Start dashboard
cassandraorm dashboard
```

## 🎯 Next Steps

Now that you have the basics, explore advanced features:

- **[AI/ML Integration →](../ai-ml/vector-search.md)** - Vector search and recommendations
- **[Event Sourcing →](../event-sourcing/event-store.md)** - CQRS and domain events  
- **[Real-time Features →](../real-time/subscriptions.md)** - WebSocket and SSE
- **[Performance →](../performance/monitoring.md)** - Monitoring and optimization
- **[Examples →](../examples/ecommerce.md)** - Complete application examples

## 🆘 Need Help?

- **[API Reference →](../api/client.md)** - Complete API documentation
- **[Examples →](../examples/basic.md)** - More code examples
- **[GitHub Issues](https://github.com/wemerson-silva-kz/cassandraorm-js/issues)** - Report bugs
- **[Discussions](https://github.com/wemerson-silva-kz/cassandraorm-js/discussions)** - Ask questions

---

**Ready to build something amazing? Let's go! 🚀**
