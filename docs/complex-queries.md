# Complex Queries

## Overview
Advanced query patterns including subqueries, joins, window functions, and analytical queries.

## Subqueries and CTEs

```typescript
import { QueryBuilder } from 'cassandraorm-js';

const qb = new QueryBuilder(client);

// Subquery simulation with multiple queries
const recentUsers = await qb
  .select('id')
  .from('users')
  .where('created_at', '>', new Date(Date.now() - 86400000))
  .execute();

const userIds = recentUsers.rows.map(row => row.id);

const userPosts = await qb
  .select('*')
  .from('posts')
  .where('user_id', 'IN', userIds)
  .execute();
```

## Analytical Queries

```typescript
// Time-series aggregations
const dailyMetrics = await qb
  .select('DATE(created_at) as date')
  .addSelect('COUNT(*) as total_posts')
  .addSelect('COUNT(DISTINCT user_id) as unique_users')
  .from('posts')
  .where('created_at', '>=', startDate)
  .groupBy('DATE(created_at)')
  .orderBy('date', 'ASC')
  .execute();

// Percentile calculations
const responseTimePercentiles = await qb
  .select('PERCENTILE_CONT(0.50) as p50')
  .addSelect('PERCENTILE_CONT(0.95) as p95')
  .addSelect('PERCENTILE_CONT(0.99) as p99')
  .from('api_metrics')
  .where('timestamp', '>=', startTime)
  .execute();
```

## Join Simulations

```typescript
import { JoinHelper } from 'cassandraorm-js';

const joinHelper = new JoinHelper(client);

// Left join simulation
const usersWithPosts = await joinHelper.leftJoin({
  left: {
    table: 'users',
    key: 'id',
    select: ['id', 'name', 'email']
  },
  right: {
    table: 'posts',
    key: 'user_id',
    select: ['title', 'created_at']
  },
  on: 'users.id = posts.user_id'
});

// Inner join with filtering
const activeUsersWithRecentPosts = await joinHelper.innerJoin({
  left: {
    table: 'users',
    where: { status: 'active' }
  },
  right: {
    table: 'posts',
    where: { created_at: { $gte: recentDate } }
  },
  on: 'users.id = posts.user_id'
});
```

## Window Functions

```typescript
// Ranking queries
const topUsersByPosts = await qb
  .select('user_id')
  .addSelect('COUNT(*) as post_count')
  .addSelect('RANK() OVER (ORDER BY COUNT(*) DESC) as rank')
  .from('posts')
  .groupBy('user_id')
  .having('COUNT(*)', '>', 10)
  .orderBy('post_count', 'DESC')
  .limit(10)
  .execute();

// Running totals
const runningTotals = await qb
  .select('date')
  .addSelect('daily_count')
  .addSelect('SUM(daily_count) OVER (ORDER BY date) as running_total')
  .from('daily_stats')
  .orderBy('date')
  .execute();
```

## Full-Text Search

```typescript
import { SearchManager } from 'cassandraorm-js';

const searchManager = new SearchManager(client);

// Create search index
await searchManager.createIndex('posts_search', {
  table: 'posts',
  fields: ['title', 'content'],
  analyzer: 'standard'
});

// Full-text search
const searchResults = await searchManager.search('posts_search', {
  query: 'cassandra database',
  fields: ['title^2', 'content'], // Boost title matches
  filters: {
    status: 'published',
    created_at: { $gte: new Date('2024-01-01') }
  },
  sort: [{ score: 'desc' }, { created_at: 'desc' }],
  limit: 20
});
```

## Batch Operations

```typescript
// Complex batch with conditions
const batch = client.batch();

// Conditional updates
batch.add('UPDATE users SET last_login = ? WHERE id = ? IF status = ?', 
  [new Date(), userId, 'active']);

// Multiple table updates
batch.add('INSERT INTO user_activity (user_id, action, timestamp) VALUES (?, ?, ?)',
  [userId, 'login', new Date()]);

batch.add('UPDATE user_stats SET login_count = login_count + 1 WHERE user_id = ?',
  [userId]);

const result = await batch.execute();
```
