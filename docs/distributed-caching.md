# Distributed Caching

## Overview
Scalable distributed caching with Redis Cluster, consistent hashing, cache coherence, and intelligent invalidation strategies.

## Distributed Cache Setup

```typescript
import { DistributedCacheManager } from 'cassandraorm-js';

const distributedCache = new DistributedCacheManager({
  nodes: [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 }
  ],
  strategy: 'consistent_hashing',
  replication: 2,
  failover: true,
  compression: {
    enabled: true,
    threshold: 1024 // Compress objects > 1KB
  }
});

await distributedCache.initialize();
```

## Consistent Hashing

```typescript
import { ConsistentHashRing } from 'cassandraorm-js';

const hashRing = new ConsistentHashRing({
  nodes: ['redis-1:6379', 'redis-2:6379', 'redis-3:6379'],
  virtualNodes: 150,
  hashFunction: 'sha256'
});

// Cache operations with consistent hashing
await distributedCache.set('user:123', userData, {
  ttl: 3600,
  replication: 2 // Store on 2 nodes
});

const cachedUser = await distributedCache.get('user:123');

// Add/remove nodes dynamically
await hashRing.addNode('redis-4:6379');
await hashRing.removeNode('redis-1:6379');
```

## Cache Replication

```typescript
// Configure replication strategy
const replicatedCache = new DistributedCacheManager({
  replication: {
    factor: 3,
    strategy: 'async', // or 'sync'
    consistency: 'eventual', // or 'strong'
    readPreference: 'primary' // or 'secondary', 'nearest'
  }
});

// Write with replication
await replicatedCache.set('critical:data', value, {
  replication: {
    factor: 3,
    consistency: 'strong' // Wait for all replicas
  }
});

// Read with consistency preference
const data = await replicatedCache.get('critical:data', {
  consistency: 'strong',
  readFrom: 'majority' // Read from majority of replicas
});
```

## Cache Partitioning

```typescript
import { CachePartitioner } from 'cassandraorm-js';

const partitioner = new CachePartitioner({
  partitions: [
    { name: 'users', nodes: ['redis-1', 'redis-2'] },
    { name: 'orders', nodes: ['redis-2', 'redis-3'] },
    { name: 'products', nodes: ['redis-1', 'redis-3'] }
  ],
  partitionKey: (key) => {
    if (key.startsWith('user:')) return 'users';
    if (key.startsWith('order:')) return 'orders';
    if (key.startsWith('product:')) return 'products';
    return 'default';
  }
});

// Partition-aware caching
await partitioner.set('user:123', userData);
await partitioner.set('order:456', orderData);
```

## Cache Coherence

```typescript
import { CacheCoherenceManager } from 'cassandraorm-js';

const coherenceManager = new CacheCoherenceManager(distributedCache, {
  protocol: 'write_invalidate', // or 'write_update'
  invalidationStrategy: 'broadcast',
  consistencyLevel: 'eventual'
});

// Write with coherence
await coherenceManager.set('shared:config', configData, {
  coherence: {
    invalidateOthers: true,
    waitForAck: false
  }
});

// Subscribe to invalidation events
coherenceManager.on('invalidation', (key, source) => {
  console.log(`Cache key ${key} invalidated by ${source}`);
});
```

## Distributed Cache Patterns

```typescript
// Write-through pattern
const writeThroughCache = new DistributedCacheManager({
  writeThrough: {
    enabled: true,
    dataStore: cassandraClient,
    batchSize: 100
  }
});

await writeThroughCache.set('user:123', userData); // Writes to both cache and DB

// Write-behind pattern
const writeBehindCache = new DistributedCacheManager({
  writeBehind: {
    enabled: true,
    flushInterval: 5000,
    batchSize: 50,
    dataStore: cassandraClient
  }
});

await writeBehindCache.set('user:123', userData); // Writes to cache immediately, DB later

// Read-through pattern
const readThroughCache = new DistributedCacheManager({
  readThrough: {
    enabled: true,
    loader: async (key) => {
      const [type, id] = key.split(':');
      if (type === 'user') {
        return await User.findOne({ id });
      }
      return null;
    }
  }
});

const user = await readThroughCache.get('user:123'); // Loads from DB if not in cache
```

## Cache Synchronization

```typescript
import { CacheSynchronizer } from 'cassandraorm-js';

const synchronizer = new CacheSynchronizer({
  caches: [distributedCache],
  eventBus: 'kafka',
  syncStrategy: 'event_driven'
});

// Synchronize cache across regions
await synchronizer.syncAcrossRegions('user:123', {
  regions: ['us-east', 'us-west', 'eu-west'],
  consistency: 'eventual'
});

// Handle sync conflicts
synchronizer.on('conflict', async (key, versions) => {
  const resolved = await resolveConflict(versions);
  await synchronizer.resolveConflict(key, resolved);
});
```

## Cache Analytics

```typescript
import { DistributedCacheAnalytics } from 'cassandraorm-js';

const analytics = new DistributedCacheAnalytics(distributedCache);

// Real-time metrics
const metrics = await analytics.getMetrics();
console.log(`Hit rate: ${metrics.hitRate}%`);
console.log(`Network latency: ${metrics.avgNetworkLatency}ms`);
console.log(`Replication lag: ${metrics.avgReplicationLag}ms`);

// Hot key detection
const hotKeys = await analytics.getHotKeys({
  threshold: 1000, // requests per minute
  timeWindow: '5m'
});

// Cache distribution analysis
const distribution = await analytics.getDistribution();
console.log('Node utilization:', distribution.nodeUtilization);
console.log('Key distribution:', distribution.keyDistribution);
```

## Failover and Recovery

```typescript
import { CacheFailoverManager } from 'cassandraorm-js';

const failoverManager = new CacheFailoverManager(distributedCache, {
  healthCheckInterval: 5000,
  failoverTimeout: 10000,
  autoRecovery: true
});

// Handle node failures
failoverManager.on('nodeDown', async (nodeId) => {
  console.log(`Node ${nodeId} is down, initiating failover`);
  
  // Redistribute keys to healthy nodes
  await failoverManager.redistributeKeys(nodeId);
});

failoverManager.on('nodeRecovered', async (nodeId) => {
  console.log(`Node ${nodeId} recovered, rebalancing`);
  
  // Rebalance keys back to recovered node
  await failoverManager.rebalanceKeys();
});

// Manual failover
await failoverManager.failoverNode('redis-1:6379', 'redis-4:6379');
```

## Cache Security

```typescript
import { CacheSecurityManager } from 'cassandraorm-js';

const securityManager = new CacheSecurityManager(distributedCache, {
  encryption: {
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyRotationInterval: '24h'
  },
  authentication: {
    enabled: true,
    method: 'token_based'
  },
  authorization: {
    enabled: true,
    rules: [
      { pattern: 'user:*', permissions: ['read', 'write'], roles: ['user_service'] },
      { pattern: 'admin:*', permissions: ['read', 'write', 'delete'], roles: ['admin_service'] }
    ]
  }
});

// Secure cache operations
await securityManager.set('sensitive:data', encryptedData, {
  encryption: true,
  accessControl: { roles: ['admin_service'] }
});
```

## Performance Optimization

```typescript
// Connection pooling
const optimizedCache = new DistributedCacheManager({
  connectionPool: {
    min: 5,
    max: 50,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 300000
  },
  pipelining: {
    enabled: true,
    batchSize: 100
  },
  compression: {
    enabled: true,
    algorithm: 'lz4'
  }
});

// Batch operations
const batch = distributedCache.batch();
batch.set('key1', value1);
batch.set('key2', value2);
batch.set('key3', value3);
await batch.execute();

// Pipeline operations
const pipeline = distributedCache.pipeline();
pipeline.get('key1');
pipeline.get('key2');
pipeline.get('key3');
const results = await pipeline.execute();
```

## Cache Warming Strategies

```typescript
import { DistributedCacheWarmer } from 'cassandraorm-js';

const warmer = new DistributedCacheWarmer(distributedCache);

// Predictive warming
await warmer.enablePredictiveWarming({
  analysisWindow: '7d',
  predictionHorizon: '1h',
  warmingThreshold: 0.7
});

// Scheduled warming
await warmer.scheduleWarming('popular_products', {
  schedule: '0 */6 * * *', // Every 6 hours
  loader: async () => {
    return await Product.find({ popular: true }).limit(1000);
  },
  keyGenerator: (product) => `product:${product.id}`
});

// Cross-region warming
await warmer.warmAcrossRegions(['us-east', 'eu-west'], {
  keys: ['config:*', 'popular:*'],
  strategy: 'parallel'
});
```
