# Time Series

## Overview
Specialized time-series data handling with automatic bucketing, downsampling, and retention policies.

## Time Series Manager

```typescript
import { TimeSeriesManager } from 'cassandraorm-js';

const timeSeries = new TimeSeriesManager(client.driver, 'myapp');

// Create time series table
await timeSeries.createTable('metrics', {
  metricName: 'text',
  timestamp: 'timestamp',
  value: 'double',
  tags: 'map<text, text>'
}, {
  partitionKey: ['metricName'],
  clusteringKey: ['timestamp'],
  bucketSize: '1h', // Automatic time bucketing
  retention: '30d'
});
```

## Data Insertion

```typescript
// Insert single point
await timeSeries.insert('metrics', {
  metricName: 'cpu_usage',
  timestamp: new Date(),
  value: 85.5,
  tags: { host: 'server1', region: 'us-east-1' }
});

// Batch insert
await timeSeries.insertBatch('metrics', [
  {
    metricName: 'memory_usage',
    timestamp: new Date(),
    value: 70.2,
    tags: { host: 'server1' }
  },
  {
    metricName: 'disk_usage',
    timestamp: new Date(),
    value: 45.8,
    tags: { host: 'server1' }
  }
]);
```

## Time Range Queries

```typescript
// Query time range
const data = await timeSeries.query('metrics', {
  metricName: 'cpu_usage',
  timeRange: {
    start: new Date('2024-01-01T00:00:00Z'),
    end: new Date('2024-01-02T00:00:00Z')
  },
  tags: { host: 'server1' }
});

// Query with aggregation
const hourlyAvg = await timeSeries.query('metrics', {
  metricName: 'cpu_usage',
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date()
  },
  aggregation: {
    function: 'avg',
    interval: '1h'
  }
});
```

## Downsampling

```typescript
// Configure downsampling rules
await timeSeries.configureDownsampling('metrics', [
  {
    sourceResolution: '1m',
    targetResolution: '5m',
    aggregation: 'avg',
    retention: '7d'
  },
  {
    sourceResolution: '5m',
    targetResolution: '1h',
    aggregation: 'avg',
    retention: '30d'
  },
  {
    sourceResolution: '1h',
    targetResolution: '1d',
    aggregation: 'avg',
    retention: '1y'
  }
]);

// Manual downsampling
const downsampled = await timeSeries.downsample('metrics', {
  metricName: 'cpu_usage',
  fromResolution: '1m',
  toResolution: '5m',
  aggregation: 'avg',
  timeRange: {
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date()
  }
});
```

## Retention Policies

```typescript
// Set retention policy
await timeSeries.setRetentionPolicy('metrics', {
  '1m': '24h',   // 1-minute data for 24 hours
  '5m': '7d',    // 5-minute data for 7 days
  '1h': '30d',   // 1-hour data for 30 days
  '1d': '1y'     // 1-day data for 1 year
});

// Manual cleanup
await timeSeries.cleanup('metrics', {
  olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
});
```

## Advanced Analytics

```typescript
// Moving averages
const movingAvg = await timeSeries.movingAverage('metrics', {
  metricName: 'cpu_usage',
  window: '5m',
  timeRange: {
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date()
  }
});

// Anomaly detection
const anomalies = await timeSeries.detectAnomalies('metrics', {
  metricName: 'cpu_usage',
  algorithm: 'zscore',
  threshold: 2.5,
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date()
  }
});

// Correlation analysis
const correlation = await timeSeries.correlate([
  { table: 'metrics', metricName: 'cpu_usage' },
  { table: 'metrics', metricName: 'memory_usage' }
], {
  timeRange: {
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date()
  }
});
```

## Real-time Streaming

```typescript
// Stream real-time data
const stream = timeSeries.createStream('metrics', {
  metricName: 'cpu_usage',
  tags: { host: 'server1' }
});

stream.on('data', (point) => {
  console.log('New data point:', point);
});

stream.on('anomaly', (anomaly) => {
  console.log('Anomaly detected:', anomaly);
});

await stream.start();
```
