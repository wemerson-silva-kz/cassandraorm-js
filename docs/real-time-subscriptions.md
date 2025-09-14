# Real-time Subscriptions

## Overview
Real-time data subscriptions with WebSocket/SSE support, intelligent filtering, and scalable event distribution.

## Subscription Manager Setup

```typescript
import { SubscriptionManager } from 'cassandraorm-js';

const subscriptions = new SubscriptionManager(client.driver, 'myapp', {
  transport: 'websocket',
  port: 3001,
  enableSSE: true,
  maxConnections: 10000
});

await subscriptions.start();
```

## Basic Subscriptions

```typescript
// Subscribe to table changes
await subscriptions.subscribe({
  table: 'users',
  operations: ['insert', 'update', 'delete'],
  callback: (event) => {
    console.log(`User ${event.operation}:`, event.data);
  }
});

// Subscribe with filters
await subscriptions.subscribe({
  table: 'posts',
  operations: ['insert'],
  filters: {
    status: 'published',
    category: 'technology'
  },
  callback: (event) => {
    console.log('New tech post:', event.data);
  }
});
```

## WebSocket Integration

```typescript
import { WebSocketServer } from 'cassandraorm-js';

const wsServer = new WebSocketServer({
  port: 3002,
  subscriptionManager: subscriptions
});

// Client-side subscription
wsServer.on('connection', (ws) => {
  ws.on('subscribe', async (request) => {
    const subscription = await subscriptions.subscribe({
      table: request.table,
      filters: request.filters,
      callback: (event) => {
        ws.send(JSON.stringify(event));
      }
    });
    
    ws.subscriptionId = subscription.id;
  });
  
  ws.on('close', () => {
    if (ws.subscriptionId) {
      subscriptions.unsubscribe(ws.subscriptionId);
    }
  });
});
```

## Server-Sent Events (SSE)

```typescript
import express from 'express';

const app = express();

app.get('/events/:table', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const subscription = await subscriptions.subscribe({
    table: req.params.table,
    filters: req.query,
    callback: (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  });

  req.on('close', () => {
    subscriptions.unsubscribe(subscription.id);
  });
});
```

## Advanced Filtering

```typescript
// Complex filter expressions
await subscriptions.subscribe({
  table: 'orders',
  operations: ['insert', 'update'],
  filters: {
    $and: [
      { amount: { $gte: 100 } },
      { status: { $in: ['pending', 'processing'] } },
      { 
        $or: [
          { priority: 'high' },
          { customer_tier: 'premium' }
        ]
      }
    ]
  },
  callback: handleHighValueOrder
});

// Custom filter functions
await subscriptions.subscribe({
  table: 'user_activity',
  operations: ['insert'],
  customFilter: (event) => {
    const hour = new Date(event.data.timestamp).getHours();
    return hour >= 9 && hour <= 17; // Business hours only
  },
  callback: handleBusinessHoursActivity
});
```

## Event Aggregation

```typescript
import { EventAggregator } from 'cassandraorm-js';

const aggregator = new EventAggregator(subscriptions);

// Time-based aggregation
await aggregator.createAggregation('user_activity_hourly', {
  source: { table: 'user_activity', operation: 'insert' },
  window: '1h',
  groupBy: ['user_id', 'action_type'],
  aggregations: {
    count: { $sum: 1 },
    unique_sessions: { $addToSet: 'session_id' }
  },
  callback: (aggregatedData) => {
    console.log('Hourly activity summary:', aggregatedData);
  }
});

// Count-based aggregation
await aggregator.createAggregation('order_batches', {
  source: { table: 'orders', operation: 'insert' },
  batchSize: 100,
  aggregations: {
    total_amount: { $sum: 'amount' },
    avg_amount: { $avg: 'amount' },
    order_count: { $sum: 1 }
  }
});
```

## Multi-table Subscriptions

```typescript
// Subscribe to related tables
await subscriptions.subscribeMultiple([
  {
    table: 'users',
    operations: ['update'],
    alias: 'user_updates'
  },
  {
    table: 'user_profiles',
    operations: ['update'],
    alias: 'profile_updates'
  }
], {
  correlationKey: 'user_id',
  callback: (events) => {
    console.log('Related user changes:', events);
  }
});

// Join-like subscriptions
await subscriptions.subscribeWithJoin({
  primary: { table: 'orders', operations: ['insert'] },
  joins: [
    { table: 'users', on: 'user_id', select: ['name', 'email'] },
    { table: 'products', on: 'product_id', select: ['name', 'price'] }
  ],
  callback: (enrichedEvent) => {
    console.log('Order with user and product info:', enrichedEvent);
  }
});
```

## Subscription Management

```typescript
// List active subscriptions
const activeSubscriptions = await subscriptions.getActiveSubscriptions();
console.log(`Active subscriptions: ${activeSubscriptions.length}`);

// Subscription statistics
const stats = await subscriptions.getStats();
console.log(`Events processed: ${stats.eventsProcessed}`);
console.log(`Active connections: ${stats.activeConnections}`);

// Pause/resume subscriptions
await subscriptions.pause(subscriptionId);
await subscriptions.resume(subscriptionId);

// Update subscription filters
await subscriptions.updateFilters(subscriptionId, {
  status: 'active',
  priority: { $gte: 3 }
});
```

## Event Replay

```typescript
import { EventReplay } from 'cassandraorm-js';

const replay = new EventReplay(subscriptions);

// Replay events from specific time
await replay.replayFrom({
  table: 'user_activity',
  startTime: new Date('2024-01-15T10:00:00Z'),
  endTime: new Date('2024-01-15T11:00:00Z'),
  callback: (event) => {
    console.log('Replayed event:', event);
  }
});

// Replay with filters
await replay.replayFiltered({
  table: 'orders',
  filters: { status: 'completed' },
  timeRange: { last: '24h' },
  speed: 2.0 // 2x speed
});
```

## Scalability Features

```typescript
// Horizontal scaling with Redis
const scalableSubscriptions = new SubscriptionManager(client.driver, 'myapp', {
  scaling: {
    type: 'redis',
    redis: {
      host: 'redis-cluster',
      port: 6379
    },
    partitioning: 'consistent_hash'
  }
});

// Load balancing
const loadBalancer = new SubscriptionLoadBalancer({
  instances: [
    'ws://server1:3001',
    'ws://server2:3001',
    'ws://server3:3001'
  ],
  strategy: 'round_robin'
});

// Auto-scaling based on connection count
await subscriptions.enableAutoScaling({
  minInstances: 2,
  maxInstances: 10,
  scaleUpThreshold: 8000,  // connections
  scaleDownThreshold: 2000,
  cooldownPeriod: 300000   // 5 minutes
});
```

## Error Handling and Reliability

```typescript
// Retry failed event deliveries
await subscriptions.configureRetry({
  maxRetries: 3,
  backoff: 'exponential',
  deadLetterQueue: 'failed_events'
});

// Circuit breaker for external callbacks
await subscriptions.enableCircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000
});

// Health monitoring
subscriptions.on('error', (error, context) => {
  console.error('Subscription error:', error);
  // Send alert to monitoring system
});

subscriptions.on('connectionLost', (subscriptionId) => {
  console.log(`Connection lost for subscription: ${subscriptionId}`);
  // Attempt reconnection
});
```
