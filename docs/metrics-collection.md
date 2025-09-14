# Metrics Collection

## Overview
Collect and export metrics to monitoring systems like Prometheus, Grafana, and custom dashboards.

## Prometheus Integration

```typescript
import { PrometheusExporter } from 'cassandraorm-js';

const exporter = new PrometheusExporter({
  port: 9090,
  endpoint: '/metrics'
});

// Start metrics server
await exporter.start();

// Custom metrics
exporter.createCounter('cassandra_queries_total', 'Total number of queries');
exporter.createHistogram('cassandra_query_duration', 'Query duration in seconds');

// Increment metrics
exporter.increment('cassandra_queries_total', { operation: 'select' });
exporter.observe('cassandra_query_duration', 0.150, { table: 'users' });
```

## Grafana Dashboard

```typescript
import { GrafanaDashboard } from 'cassandraorm-js';

const dashboard = new GrafanaDashboard({
  grafanaUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Create dashboard
await dashboard.create('CassandraORM Metrics', {
  panels: [
    {
      title: 'Query Rate',
      type: 'graph',
      targets: ['rate(cassandra_queries_total[5m])']
    },
    {
      title: 'Query Duration',
      type: 'heatmap',
      targets: ['cassandra_query_duration']
    }
  ]
});
```

## Custom Metrics Collection

```typescript
import { MetricsCollector } from 'cassandraorm-js';

const collector = new MetricsCollector({
  interval: 5000, // 5 seconds
  storage: 'memory' // or 'redis', 'file'
});

// Collect custom metrics
collector.collect('table_size', async () => {
  const result = await client.execute('SELECT COUNT(*) FROM users');
  return result.rows[0].count;
});

// Get collected metrics
const metrics = await collector.getMetrics('table_size', {
  from: new Date(Date.now() - 3600000), // Last hour
  to: new Date()
});
```

## StatsD Integration

```typescript
import { StatsDExporter } from 'cassandraorm-js';

const statsD = new StatsDExporter({
  host: 'localhost',
  port: 8125,
  prefix: 'cassandraorm.'
});

// Send metrics
statsD.increment('queries.select');
statsD.timing('query.duration', 150);
statsD.gauge('connections.active', 10);
```

## Health Checks

```typescript
import { HealthChecker } from 'cassandraorm-js';

const healthChecker = new HealthChecker(client);

// Add custom health checks
healthChecker.addCheck('database', async () => {
  try {
    await client.execute('SELECT now() FROM system.local');
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
});

// HTTP health endpoint
app.get('/health', async (req, res) => {
  const health = await healthChecker.check();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```
