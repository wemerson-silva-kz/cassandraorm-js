# Streaming Data

## Overview
High-throughput streaming data processing with Kafka integration, real-time analytics, and backpressure handling.

## Stream Processor Setup

```typescript
import { StreamProcessor } from 'cassandraorm-js';

const processor = new StreamProcessor(client, {
  batchSize: 1000,
  flushInterval: 5000,
  maxConcurrency: 10,
  backpressure: {
    enabled: true,
    threshold: 10000,
    strategy: 'drop_oldest'
  }
});
```

## Kafka Integration

```typescript
import { KafkaStreamConnector } from 'cassandraorm-js';

const kafkaConnector = new KafkaStreamConnector({
  brokers: ['kafka1:9092', 'kafka2:9092'],
  groupId: 'cassandra-consumer-group',
  topics: ['user-events', 'order-events']
});

// Stream from Kafka to Cassandra
await kafkaConnector.stream({
  topic: 'user-events',
  processor: async (messages) => {
    const events = messages.map(msg => JSON.parse(msg.value));
    await processor.processBatch('user_events', events);
  },
  options: {
    autoCommit: false,
    batchSize: 500
  }
});
```

## Real-time Data Ingestion

```typescript
// High-throughput ingestion
const ingestionStream = processor.createIngestionStream('metrics', {
  schema: {
    timestamp: 'timestamp',
    metric_name: 'text',
    value: 'double',
    tags: 'map<text, text>'
  },
  partitionKey: ['metric_name'],
  ttl: 86400 // 24 hours
});

// Process streaming data
ingestionStream.on('data', async (batch) => {
  await client.batch(batch.map(record => ({
    query: 'INSERT INTO metrics (timestamp, metric_name, value, tags) VALUES (?, ?, ?, ?)',
    params: [record.timestamp, record.metric_name, record.value, record.tags]
  })));
});

// Handle backpressure
ingestionStream.on('backpressure', (queueSize) => {
  console.log(`Queue size: ${queueSize}, applying backpressure`);
});
```

## Stream Transformations

```typescript
import { StreamTransformer } from 'cassandraorm-js';

const transformer = new StreamTransformer()
  .source('kafka', { topic: 'raw-events' })
  .transform('parse', (data) => JSON.parse(data.value))
  .transform('enrich', async (event) => {
    const user = await User.findOne({ id: event.user_id });
    return { ...event, user_segment: user?.segment };
  })
  .filter((event) => event.user_segment === 'premium')
  .transform('aggregate', {
    window: '5m',
    groupBy: ['user_id'],
    aggregations: {
      event_count: { $sum: 1 },
      total_value: { $sum: 'value' }
    }
  })
  .destination('cassandra', { table: 'user_activity_summary' });

await transformer.start();
```

## Windowed Operations

```typescript
import { WindowedProcessor } from 'cassandraorm-js';

const windowProcessor = new WindowedProcessor({
  windowSize: '10m',
  slideInterval: '1m',
  watermark: '30s'
});

// Tumbling window
await windowProcessor.createTumblingWindow('page_views', {
  source: 'user_events',
  window: '5m',
  aggregations: {
    total_views: { $sum: 1 },
    unique_users: { $addToSet: 'user_id' },
    avg_session_duration: { $avg: 'session_duration' }
  },
  output: 'page_view_metrics'
});

// Sliding window
await windowProcessor.createSlidingWindow('real_time_metrics', {
  source: 'sensor_data',
  window: '1h',
  slide: '5m',
  aggregations: {
    avg_temperature: { $avg: 'temperature' },
    max_humidity: { $max: 'humidity' }
  }
});
```

## Stream Analytics

```typescript
import { StreamAnalytics } from 'cassandraorm-js';

const analytics = new StreamAnalytics(processor);

// Real-time anomaly detection
await analytics.createAnomalyDetector('temperature_anomalies', {
  source: 'sensor_data',
  field: 'temperature',
  algorithm: 'zscore',
  threshold: 2.5,
  window: '10m',
  callback: (anomaly) => {
    console.log('Temperature anomaly detected:', anomaly);
    // Trigger alert
  }
});

// Pattern detection
await analytics.createPatternDetector('user_behavior_patterns', {
  source: 'user_events',
  patterns: [
    {
      name: 'rapid_clicks',
      condition: 'COUNT(*) > 10 IN 30s WHERE action = "click"',
      groupBy: 'user_id'
    }
  ],
  callback: (pattern) => {
    console.log('Pattern detected:', pattern);
  }
});
```

## Stream State Management

```typescript
import { StreamStateManager } from 'cassandraorm-js';

const stateManager = new StreamStateManager(client, {
  stateTable: 'stream_state',
  checkpointInterval: 10000
});

// Stateful stream processing
const statefulProcessor = processor.createStatefulStream('user_sessions', {
  keyBy: 'user_id',
  stateManager: stateManager,
  processFunction: async (key, value, state) => {
    const currentSession = state.get('current_session') || {};
    
    if (value.event_type === 'session_start') {
      currentSession.start_time = value.timestamp;
      currentSession.events = [];
    }
    
    currentSession.events.push(value);
    
    if (value.event_type === 'session_end') {
      currentSession.end_time = value.timestamp;
      currentSession.duration = currentSession.end_time - currentSession.start_time;
      
      // Emit completed session
      return currentSession;
    }
    
    state.set('current_session', currentSession);
    return null;
  }
});
```

## Error Handling and Recovery

```typescript
// Dead letter queue for failed messages
const deadLetterQueue = processor.createDeadLetterQueue('failed_events', {
  maxRetries: 3,
  retryDelay: 5000,
  storage: 'cassandra'
});

// Stream recovery
processor.on('error', async (error, context) => {
  console.error('Stream processing error:', error);
  
  if (error.retryable) {
    await deadLetterQueue.add(context.message, error);
  } else {
    // Log and skip
    console.log('Non-retryable error, skipping message');
  }
});

// Checkpoint and recovery
await processor.enableCheckpointing({
  interval: 30000,
  storage: 'cassandra',
  table: 'stream_checkpoints'
});

// Recover from checkpoint
await processor.recoverFromCheckpoint('user_events_processor');
```

## Performance Monitoring

```typescript
import { StreamMetrics } from 'cassandraorm-js';

const metrics = new StreamMetrics(processor);

// Real-time metrics
setInterval(async () => {
  const stats = await metrics.getStats();
  
  console.log('Stream Processing Stats:');
  console.log(`Throughput: ${stats.messagesPerSecond} msg/sec`);
  console.log(`Latency P95: ${stats.latencyP95}ms`);
  console.log(`Error rate: ${stats.errorRate}%`);
  console.log(`Queue depth: ${stats.queueDepth}`);
}, 10000);

// Export to monitoring systems
await metrics.exportToPrometheus({
  endpoint: '/stream-metrics',
  port: 9091
});
```

## Multi-stream Processing

```typescript
// Process multiple streams
const multiStreamProcessor = new StreamProcessor(client, {
  streams: [
    {
      name: 'user_events',
      source: { type: 'kafka', topic: 'user-events' },
      destination: { table: 'user_activity' }
    },
    {
      name: 'order_events',
      source: { type: 'kafka', topic: 'order-events' },
      destination: { table: 'order_history' }
    }
  ],
  coordination: 'timestamp' // Coordinate by event timestamp
});

// Stream joining
const joinedStream = processor.joinStreams([
  { name: 'orders', keyBy: 'user_id' },
  { name: 'users', keyBy: 'id' }
], {
  window: '5m',
  joinType: 'inner',
  output: 'enriched_orders'
});
```
