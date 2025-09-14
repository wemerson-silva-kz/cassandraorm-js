# Performance Monitoring

## Overview
Monitor query performance, connection health, and system metrics with built-in monitoring tools.

## Query Performance Monitoring

```typescript
import { PerformanceMonitor } from 'cassandraorm-js';

const monitor = new PerformanceMonitor(client);

// Enable query timing
monitor.enableQueryTiming();

// Monitor slow queries
monitor.onSlowQuery((query, duration) => {
  console.log(`Slow query detected: ${duration}ms`);
  console.log(`Query: ${query.cql}`);
});

// Get performance metrics
const metrics = await monitor.getMetrics();
console.log(`Average query time: ${metrics.avgQueryTime}ms`);
console.log(`Total queries: ${metrics.totalQueries}`);
```

## Real-time Metrics Dashboard

```typescript
import { MetricsDashboard } from 'cassandraorm-js';

const dashboard = new MetricsDashboard({
  port: 3001,
  updateInterval: 1000
});

// Start metrics server
await dashboard.start();

// Custom metrics
dashboard.addMetric('custom_counter', 'counter', 'Custom counter metric');
dashboard.increment('custom_counter');

// View at http://localhost:3001/metrics
```

## Connection Pool Monitoring

```typescript
import { ConnectionPoolMonitor } from 'cassandraorm-js';

const poolMonitor = new ConnectionPoolMonitor(client);

// Monitor pool health
poolMonitor.on('poolExhausted', () => {
  console.log('Connection pool exhausted!');
});

poolMonitor.on('connectionCreated', (host) => {
  console.log(`New connection to ${host}`);
});

// Get pool statistics
const poolStats = await poolMonitor.getStats();
console.log(`Active connections: ${poolStats.active}`);
console.log(`Idle connections: ${poolStats.idle}`);
```

## Memory Usage Monitoring

```typescript
import { MemoryMonitor } from 'cassandraorm-js';

const memoryMonitor = new MemoryMonitor();

// Monitor memory usage
memoryMonitor.on('highMemoryUsage', (usage) => {
  console.log(`High memory usage: ${usage.percentage}%`);
});

// Get memory statistics
const memStats = memoryMonitor.getStats();
console.log(`Heap used: ${memStats.heapUsed} MB`);
console.log(`External: ${memStats.external} MB`);
```

## Alerting System

```typescript
import { AlertManager } from 'cassandraorm-js';

const alertManager = new AlertManager({
  email: {
    smtp: 'smtp.gmail.com',
    user: 'alerts@company.com',
    pass: 'password'
  },
  slack: {
    webhook: 'https://hooks.slack.com/...'
  }
});

// Configure alerts
alertManager.addAlert('high_latency', {
  condition: (metrics) => metrics.avgQueryTime > 1000,
  message: 'High query latency detected',
  channels: ['email', 'slack']
});

// Start monitoring
alertManager.start();
```
