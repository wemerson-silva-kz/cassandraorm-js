# Aggregations

## Overview
MongoDB-style aggregation pipeline for complex data processing and analytics.

## Aggregation Pipeline

```typescript
import { AggregationsManager } from 'cassandraorm-js';

const aggregations = new AggregationsManager(client.driver, 'myapp');

// Basic aggregation
const userStats = await aggregations.createPipeline('users')
  .match({ status: 'active' })
  .group({
    _id: '$department',
    count: { $sum: 1 },
    avgAge: { $avg: '$age' },
    maxSalary: { $max: '$salary' }
  })
  .sort({ count: -1 })
  .execute();
```

## Advanced Grouping

```typescript
// Multi-level grouping
const salesByRegionAndMonth = await aggregations.createPipeline('orders')
  .match({ 
    status: 'completed',
    created_at: { $gte: new Date('2024-01-01') }
  })
  .group({
    _id: {
      region: '$shipping_address.region',
      month: { $month: '$created_at' }
    },
    totalSales: { $sum: '$amount' },
    orderCount: { $sum: 1 },
    avgOrderValue: { $avg: '$amount' }
  })
  .sort({ '_id.region': 1, '_id.month': 1 })
  .execute();
```

## Time-Series Aggregations

```typescript
// Daily metrics with time buckets
const dailyMetrics = await aggregations.createPipeline('events')
  .match({
    timestamp: {
      $gte: new Date('2024-01-01'),
      $lt: new Date('2024-02-01')
    }
  })
  .group({
    _id: {
      $dateToString: {
        format: '%Y-%m-%d',
        date: '$timestamp'
      }
    },
    totalEvents: { $sum: 1 },
    uniqueUsers: { $addToSet: '$user_id' },
    avgDuration: { $avg: '$duration' }
  })
  .addFields({
    uniqueUserCount: { $size: '$uniqueUsers' }
  })
  .project({
    date: '$_id',
    totalEvents: 1,
    uniqueUserCount: 1,
    avgDuration: 1
  })
  .sort({ date: 1 })
  .execute();
```

## Statistical Operations

```typescript
// Statistical analysis
const performanceStats = await aggregations.createPipeline('api_calls')
  .match({ endpoint: '/api/users' })
  .group({
    _id: null,
    count: { $sum: 1 },
    avgResponseTime: { $avg: '$response_time' },
    minResponseTime: { $min: '$response_time' },
    maxResponseTime: { $max: '$response_time' },
    stdDevResponseTime: { $stdDevPop: '$response_time' },
    responseTimes: { $push: '$response_time' }
  })
  .addFields({
    p50: { $percentile: { input: '$responseTimes', p: [0.5] } },
    p95: { $percentile: { input: '$responseTimes', p: [0.95] } },
    p99: { $percentile: { input: '$responseTimes', p: [0.99] } }
  })
  .execute();
```

## Faceted Search

```typescript
// Multi-faceted aggregation
const productFacets = await aggregations.createPipeline('products')
  .match({ status: 'active' })
  .facet({
    categories: [
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ],
    priceRanges: [
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 50, 100, 200, 500, 1000],
          default: '1000+',
          output: { count: { $sum: 1 } }
        }
      }
    ],
    brands: [
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]
  })
  .execute();
```

## Custom Aggregation Functions

```typescript
// Register custom aggregation function
aggregations.registerFunction('customAvg', {
  accumulator: (acc, value) => {
    acc.sum = (acc.sum || 0) + value;
    acc.count = (acc.count || 0) + 1;
    return acc;
  },
  finalize: (acc) => acc.count > 0 ? acc.sum / acc.count : 0
});

// Use custom function
const customStats = await aggregations.createPipeline('metrics')
  .group({
    _id: '$category',
    customAverage: { $customAvg: '$value' }
  })
  .execute();
```

## Real-time Aggregations

```typescript
// Streaming aggregations
const streamingAgg = aggregations.createStreamingPipeline('events')
  .match({ type: 'user_action' })
  .group({
    _id: {
      $dateToString: {
        format: '%Y-%m-%d %H:%M',
        date: '$timestamp'
      }
    },
    count: { $sum: 1 }
  })
  .window({ size: '5m', slide: '1m' });

streamingAgg.on('result', (result) => {
  console.log('Real-time aggregation result:', result);
});

await streamingAgg.start();
```
