# 📖 Client API Reference

Complete API reference for the CassandraORM JS client.

## 🔌 CassandraClient

### Constructor

```typescript
import { createClient, CassandraClient } from 'cassandraorm-js';

const client = createClient(options: CassandraClientOptions);
// or
const client = new CassandraClient(options: CassandraClientOptions);
```

### Configuration Options

```typescript
interface CassandraClientOptions {
  clientOptions: {
    contactPoints: string[];
    localDataCenter: string;
    keyspace?: string;
    credentials?: {
      username: string;
      password: string;
    };
    sslOptions?: {
      ca: string[];
      cert?: string;
      key?: string;
    };
    pooling?: {
      maxRequestsPerConnection?: number;
      coreConnectionsPerHost?: number;
    };
  };
  ormOptions?: {
    createKeyspace?: boolean;
    migration?: 'safe' | 'alter' | 'drop';
    enableQueryOptimization?: boolean;
    enableMetrics?: boolean;
  };
}
```

### Connection Methods

#### `connect(): Promise<void>`
Establishes connection to Cassandra/ScyllaDB.

```typescript
await client.connect();
```

#### `close(): Promise<void>`
Closes the connection.

```typescript
await client.close();
```

#### `getConnectionStats(): object`
Returns connection statistics.

```typescript
const stats = client.getConnectionStats();
console.log('Active connections:', stats.activeConnections);
```

### Schema Methods

#### `loadSchema<T>(name: string, schema: ModelSchema): Promise<ModelStatic<T>>`
Loads a model schema and returns the model class.

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text'
  },
  key: ['id']
});
```

### Query Methods

#### `execute(query: string, params?: any[], options?: QueryOptions): Promise<ResultSet>`
Executes a raw CQL query.

```typescript
const result = await client.execute(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { prepare: true }
);
```

#### `batch(queries: BatchQuery[], options?: QueryOptions): Promise<any[]>`
Executes multiple queries in batch.

```typescript
const queries = [
  { query: 'INSERT INTO users (id, name) VALUES (?, ?)', params: [id1, 'John'] },
  { query: 'INSERT INTO users (id, name) VALUES (?, ?)', params: [id2, 'Jane'] }
];

await client.batch(queries);
```

### Utility Methods

#### `uuid(): string`
Generates a new UUID.

```typescript
const id = client.uuid();
```

#### `timeuuid(): string`
Generates a new TimeUUID.

```typescript
const timeId = client.timeuuid();
```

## 📋 Model API

### Static Methods

#### `create(data: Partial<T>, options?: CreateOptions): Promise<T>`
Creates a new record.

```typescript
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe'
});
```

#### `find(query?: FindQuery, options?: QueryOptions): Promise<T[]>`
Finds multiple records.

```typescript
// Find all
const users = await User.find();

// Find with conditions
const activeUsers = await User.find({ active: true });

// Find with options
const recentUsers = await User.find({}, { 
  limit: 10,
  orderBy: { created_at: 'DESC' }
});
```

#### `findOne(query?: FindQuery, options?: QueryOptions): Promise<T | null>`
Finds a single record.

```typescript
const user = await User.findOne({ email: 'john@example.com' });
```

#### `update(query: FindQuery, data: Partial<T>, options?: QueryOptions): Promise<any>`
Updates records.

```typescript
await User.update(
  { id: userId },
  { name: 'John Updated', updated_at: new Date() }
);
```

#### `delete(query: FindQuery, options?: QueryOptions): Promise<any>`
Deletes records.

```typescript
await User.delete({ id: userId });
```

#### `createMany(data: Partial<T>[], options?: CreateManyOptions): Promise<T[]>`
Creates multiple records.

```typescript
const users = await User.createMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
], { ignoreDuplicates: true });
```

#### `upsert(data: Partial<T>, options?: QueryOptions): Promise<T>`
Creates or updates a record.

```typescript
const user = await User.upsert({
  id: userId,
  email: 'john@example.com',
  name: 'John Doe'
});
```

#### `createTable(): Promise<void>`
Creates the table if it doesn't exist.

```typescript
await User.createTable();
```

### Instance Methods

#### `save(options?: QueryOptions): Promise<this>`
Saves the instance.

```typescript
const user = new User({ email: 'john@example.com' });
await user.save();
```

#### `delete(options?: QueryOptions): Promise<void>`
Deletes the instance.

```typescript
await user.delete();
```

#### `toJSON(): Record<string, any>`
Converts instance to plain object.

```typescript
const userData = user.toJSON();
```

#### `isModified(field?: string): boolean`
Checks if instance is modified.

```typescript
if (user.isModified()) {
  await user.save();
}
```

## 🧠 AI/ML API

### AIMLManager

```typescript
import { AIMLManager } from 'cassandraorm-js';

const aiml = new AIMLManager(client.driver, keyspace, options?);
```

#### `createVectorTable(name: string, options: VectorTableOptions): Promise<void>`
Creates a table for vector storage.

#### `generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>`
Generates text embedding.

#### `similaritySearch(table: string, vector: number[], options?: VectorSearchOptions): Promise<any[]>`
Performs similarity search.

### SemanticCache

```typescript
import { SemanticCache } from 'cassandraorm-js';

const cache = new SemanticCache(options);
```

#### `set(key: string, params: any, value: any): Promise<void>`
Sets cache value.

#### `get(key: string, params: any): Promise<any | null>`
Gets cache value with semantic similarity.

## 🔄 Event Sourcing API

### EventStore

```typescript
import { EventStore } from 'cassandraorm-js';

const eventStore = new EventStore(client.driver, keyspace, options?);
```

#### `saveEvent(event: DomainEvent): Promise<void>`
Saves a domain event.

#### `getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>`
Gets events for an aggregate.

#### `saveSnapshot(aggregateId: string, version: number, data: any): Promise<void>`
Saves an aggregate snapshot.

### BaseAggregateRoot

```typescript
import { BaseAggregateRoot } from 'cassandraorm-js';

class MyAggregate extends BaseAggregateRoot {
  protected applyEvent(event: DomainEvent): void {
    // Apply event to aggregate state
  }
}
```

#### `addEvent(eventType: string, eventData: any): void`
Adds an event to the aggregate.

#### `getUncommittedEvents(): DomainEvent[]`
Gets uncommitted events.

#### `markEventsAsCommitted(): void`
Marks events as committed.

## 📡 Real-time API

### SubscriptionManager

```typescript
import { SubscriptionManager } from 'cassandraorm-js';

const subscriptions = new SubscriptionManager(client.driver, keyspace);
```

#### `subscribe(filter: SubscriptionFilter, callback: Function): Promise<Subscription>`
Creates a subscription.

#### `unsubscribe(subscriptionId: string): Promise<void>`
Removes a subscription.

## 🌐 GraphQL API

### GraphQLSchemaGenerator

```typescript
import { GraphQLSchemaGenerator } from 'cassandraorm-js';

const generator = new GraphQLSchemaGenerator();
```

#### `addModel(name: string, definition: GraphQLModelDefinition): void`
Adds a model to the schema.

#### `generateSchema(): string`
Generates GraphQL schema.

#### `generateCRUDResolvers(models: string[]): object`
Generates CRUD resolvers.

## 📊 Performance API

### Monitor

```typescript
import { Monitor } from 'cassandraorm-js';

const monitor = new Monitor(options);
```

#### `start(): Promise<void>`
Starts monitoring.

#### `getSystemMetrics(): Promise<SystemMetrics>`
Gets system metrics.

#### `getHealthStatus(): Promise<HealthStatus>`
Gets health status.

### PerformanceProfiler

```typescript
import { PerformanceProfiler } from 'cassandraorm-js';

const profiler = new PerformanceProfiler(options);
```

#### `start(): Promise<void>`
Starts profiling.

#### `getResults(): Promise<ProfilingResults>`
Gets profiling results.

---

**Complete API documentation for building powerful applications with CassandraORM JS! 📖✨**
