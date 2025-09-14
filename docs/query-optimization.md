# Query Optimization

## Overview
Advanced query optimization with automatic query analysis, index suggestions, and performance tuning.

## Query Analyzer

```typescript
import { QueryAnalyzer } from 'cassandraorm-js';

const analyzer = new QueryAnalyzer(client);

// Analyze query performance
const analysis = await analyzer.analyze('SELECT * FROM users WHERE email = ?', ['user@example.com']);

console.log('Query Analysis:');
console.log(`Execution time: ${analysis.executionTime}ms`);
console.log(`Rows examined: ${analysis.rowsExamined}`);
console.log(`Rows returned: ${analysis.rowsReturned}`);
console.log(`Index used: ${analysis.indexUsed}`);
console.log(`Suggestions: ${analysis.suggestions}`);
```

## Automatic Index Suggestions

```typescript
import { IndexOptimizer } from 'cassandraorm-js';

const optimizer = new IndexOptimizer(client);

// Analyze query patterns and suggest indexes
const suggestions = await optimizer.analyzeTables(['users', 'posts', 'comments']);

suggestions.forEach(suggestion => {
  console.log(`Table: ${suggestion.table}`);
  console.log(`Suggested index: ${suggestion.indexDefinition}`);
  console.log(`Expected improvement: ${suggestion.expectedImprovement}%`);
  console.log(`Query patterns: ${suggestion.queryPatterns.join(', ')}`);
});

// Auto-create recommended indexes
await optimizer.createRecommendedIndexes({
  minImprovement: 20, // Only create if >20% improvement expected
  maxIndexes: 5       // Limit number of indexes per table
});
```

## Query Plan Optimization

```typescript
import { QueryPlanner } from 'cassandraorm-js';

const planner = new QueryPlanner(client);

// Optimize query execution plan
const optimizedQuery = await planner.optimize(`
  SELECT u.name, p.title, COUNT(c.id) as comment_count
  FROM users u
  JOIN posts p ON u.id = p.user_id
  LEFT JOIN comments c ON p.id = c.post_id
  WHERE u.status = 'active'
  GROUP BY u.id, p.id
  ORDER BY comment_count DESC
  LIMIT 10
`);

console.log('Original query cost:', optimizedQuery.originalCost);
console.log('Optimized query cost:', optimizedQuery.optimizedCost);
console.log('Improvement:', optimizedQuery.improvement);
console.log('Optimized CQL:', optimizedQuery.cql);
```

## Batch Query Optimization

```typescript
import { BatchOptimizer } from 'cassandraorm-js';

const batchOptimizer = new BatchOptimizer();

// Optimize batch operations
const queries = [
  { cql: 'INSERT INTO users (id, name) VALUES (?, ?)', params: [uuid1, 'John'] },
  { cql: 'INSERT INTO users (id, name) VALUES (?, ?)', params: [uuid2, 'Jane'] },
  { cql: 'UPDATE users SET last_login = ? WHERE id = ?', params: [new Date(), uuid1] }
];

const optimizedBatch = await batchOptimizer.optimize(queries);

// Execute optimized batch
await client.batch(optimizedBatch.queries, optimizedBatch.options);
```

## Partition Key Optimization

```typescript
import { PartitionAnalyzer } from 'cassandraorm-js';

const partitionAnalyzer = new PartitionAnalyzer(client);

// Analyze partition distribution
const analysis = await partitionAnalyzer.analyzeTable('user_events');

console.log('Partition Analysis:');
console.log(`Total partitions: ${analysis.totalPartitions}`);
console.log(`Average partition size: ${analysis.avgPartitionSize}`);
console.log(`Largest partition: ${analysis.largestPartition.size} rows`);
console.log(`Hot partitions: ${analysis.hotPartitions.length}`);

// Suggest partition key improvements
const suggestions = await partitionAnalyzer.suggestPartitionKey('user_events', {
  targetPartitionSize: 100000,
  queryPatterns: ['SELECT * FROM user_events WHERE user_id = ?']
});
```

## Query Caching Optimization

```typescript
import { QueryCacheOptimizer } from 'cassandraorm-js';

const cacheOptimizer = new QueryCacheOptimizer();

// Analyze query patterns for caching
const cacheAnalysis = await cacheOptimizer.analyzeQueries({
  timeWindow: '24h',
  minFrequency: 10
});

// Auto-configure caching
cacheAnalysis.recommendations.forEach(rec => {
  if (rec.cacheHitPotential > 0.7) {
    client.enableQueryCache(rec.queryPattern, {
      ttl: rec.recommendedTTL,
      maxSize: rec.recommendedSize
    });
  }
});
```

## Materialized View Optimization

```typescript
import { MaterializedViewOptimizer } from 'cassandraorm-js';

const mvOptimizer = new MaterializedViewOptimizer(client);

// Suggest materialized views
const mvSuggestions = await mvOptimizer.analyzeQueries('posts', {
  queryLog: 'query_log_table',
  timeWindow: '7d'
});

mvSuggestions.forEach(suggestion => {
  console.log(`Suggested MV: ${suggestion.name}`);
  console.log(`Base table: ${suggestion.baseTable}`);
  console.log(`Where clause: ${suggestion.whereClause}`);
  console.log(`Expected queries served: ${suggestion.queriesServed}`);
});

// Create recommended materialized views
await mvOptimizer.createRecommendedViews({
  minQueriesServed: 100,
  maxViews: 3
});
```

## Real-time Query Monitoring

```typescript
import { QueryMonitor } from 'cassandraorm-js';

const queryMonitor = new QueryMonitor({
  slowQueryThreshold: 1000, // 1 second
  trackTopQueries: 100,
  sampleRate: 0.1 // 10% sampling
});

// Monitor slow queries
queryMonitor.on('slowQuery', (query) => {
  console.log(`Slow query detected: ${query.duration}ms`);
  console.log(`Query: ${query.cql}`);
  console.log(`Frequency: ${query.frequency}`);
});

// Get query statistics
const stats = await queryMonitor.getStats();
console.log('Top slow queries:', stats.topSlowQueries);
console.log('Most frequent queries:', stats.mostFrequentQueries);
```

## Consistency Level Optimization

```typescript
import { ConsistencyOptimizer } from 'cassandraorm-js';

const consistencyOptimizer = new ConsistencyOptimizer();

// Optimize consistency levels based on query patterns
const optimizations = await consistencyOptimizer.analyze({
  readPatterns: ['SELECT * FROM users WHERE id = ?'],
  writePatterns: ['INSERT INTO users (id, name) VALUES (?, ?)'],
  requirements: {
    readLatency: 'low',
    writeLatency: 'medium',
    consistency: 'eventual'
  }
});

// Apply optimized consistency levels
optimizations.forEach(opt => {
  client.setDefaultConsistency(opt.operation, opt.recommendedLevel);
});
```

## Query Rewriting

```typescript
import { QueryRewriter } from 'cassandraorm-js';

const rewriter = new QueryRewriter();

// Register rewrite rules
rewriter.addRule('avoid_allow_filtering', {
  pattern: /SELECT .* FROM .* WHERE .* ALLOW FILTERING/,
  rewrite: (query, context) => {
    // Suggest creating an index instead
    const suggestion = `Consider creating an index: CREATE INDEX ON ${context.table} (${context.filterColumn})`;
    throw new Error(`Query uses ALLOW FILTERING. ${suggestion}`);
  }
});

rewriter.addRule('optimize_in_queries', {
  pattern: /WHERE .* IN \([^)]{100,}\)/, // Large IN clauses
  rewrite: (query) => {
    // Split large IN clauses into multiple queries
    return splitInClause(query);
  }
});

// Apply rewrite rules
const optimizedQuery = await rewriter.rewrite(originalQuery);
```

## Performance Benchmarking

```typescript
import { QueryBenchmark } from 'cassandraorm-js';

const benchmark = new QueryBenchmark();

// Benchmark query performance
const results = await benchmark.run([
  {
    name: 'user_lookup_by_id',
    query: 'SELECT * FROM users WHERE id = ?',
    params: [userId],
    iterations: 1000
  },
  {
    name: 'user_lookup_by_email',
    query: 'SELECT * FROM users WHERE email = ?',
    params: [email],
    iterations: 1000
  }
]);

console.log('Benchmark Results:');
results.forEach(result => {
  console.log(`${result.name}:`);
  console.log(`  Average: ${result.avgTime}ms`);
  console.log(`  P95: ${result.p95}ms`);
  console.log(`  P99: ${result.p99}ms`);
  console.log(`  Throughput: ${result.throughput} ops/sec`);
});
```
