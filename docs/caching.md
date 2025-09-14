# Caching Strategies

## Overview
Multi-level caching with Redis, in-memory, and semantic caching for optimal performance.

## Cache Configuration

```typescript
import { CacheManager } from 'cassandraorm-js';

const cacheManager = new CacheManager({
  stores: [
    {
      name: 'memory',
      type: 'memory',
      maxSize: 1000,
      ttl: 300
    },
    {
      name: 'redis',
      type: 'redis',
      host: 'localhost',
      port: 6379,
      ttl: 3600
    }
  ],
  defaultStore: 'redis'
});

client.setCacheManager(cacheManager);
```

## Query Result Caching

```typescript
// Cache query results
const users = await User.find({ status: 'active' }, {
  cache: {
    key: 'active_users',
    ttl: 600, // 10 minutes
    store: 'redis'
  }
});

// Cache with tags for invalidation
const userPosts = await Post.find({ user_id: userId }, {
  cache: {
    key: `user_posts:${userId}`,
    tags: ['posts', `user:${userId}`],
    ttl: 300
  }
});
```

## Multi-level Caching

```typescript
// L1 (memory) + L2 (Redis) caching
const result = await User.findOne({ id: userId }, {
  cache: {
    levels: [
      { store: 'memory', ttl: 60 },   // L1: 1 minute
      { store: 'redis', ttl: 3600 }   // L2: 1 hour
    ]
  }
});

// Write-through caching
await User.update({ id: userId }, { name: 'New Name' }, {
  cache: {
    writeThrough: true,
    invalidate: [`user:${userId}`, 'active_users']
  }
});
```

## Semantic Caching

```typescript
import { SemanticCache } from 'cassandraorm-js';

const semanticCache = new SemanticCache({
  similarityThreshold: 0.85,
  embeddingModel: 'text-embedding-ada-002'
});

// Cache with semantic similarity
const searchResults = await semanticCache.get(
  'find users with programming experience',
  { skills: 'javascript' }
);

if (!searchResults) {
  const results = await User.find({ skills: { $contains: 'javascript' } });
  await semanticCache.set(
    'find users with programming experience',
    { skills: 'javascript' },
    results
  );
}
```

## Cache Invalidation

```typescript
// Tag-based invalidation
await cacheManager.invalidateByTag('posts');
await cacheManager.invalidateByTag(`user:${userId}`);

// Pattern-based invalidation
await cacheManager.invalidateByPattern('user_posts:*');

// Time-based invalidation
await cacheManager.invalidateOlderThan(new Date(Date.now() - 3600000));

// Manual invalidation
await cacheManager.delete('active_users');
```

## Cache Warming

```typescript
import { CacheWarmer } from 'cassandraorm-js';

const warmer = new CacheWarmer(cacheManager);

// Warm frequently accessed data
await warmer.warm([
  {
    key: 'active_users',
    query: () => User.find({ status: 'active' }),
    schedule: '0 */5 * * * *' // Every 5 minutes
  },
  {
    key: 'popular_posts',
    query: () => Post.find({}).orderBy('views', 'desc').limit(100),
    schedule: '0 0 * * * *' // Every hour
  }
]);

await warmer.start();
```

## Cache Analytics

```typescript
// Cache hit/miss statistics
const stats = await cacheManager.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Total hits: ${stats.hits}`);
console.log(`Total misses: ${stats.misses}`);

// Per-key statistics
const keyStats = await cacheManager.getKeyStats('active_users');
console.log(`Key hits: ${keyStats.hits}`);
console.log(`Last accessed: ${keyStats.lastAccessed}`);
```

## Distributed Caching

```typescript
// Redis Cluster configuration
const distributedCache = new CacheManager({
  stores: [
    {
      name: 'redis-cluster',
      type: 'redis-cluster',
      nodes: [
        { host: 'redis1', port: 6379 },
        { host: 'redis2', port: 6379 },
        { host: 'redis3', port: 6379 }
      ],
      options: {
        enableReadyCheck: false,
        redisOptions: {
          password: 'your-password'
        }
      }
    }
  ]
});

// Consistent hashing for cache distribution
const result = await User.findOne({ id: userId }, {
  cache: {
    store: 'redis-cluster',
    consistentHashing: true
  }
});
```

## Cache Compression

```typescript
// Enable compression for large objects
const compressedCache = new CacheManager({
  stores: [
    {
      name: 'redis',
      type: 'redis',
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 1024 // Compress objects > 1KB
      }
    }
  ]
});
```
