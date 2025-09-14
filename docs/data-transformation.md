# Data Transformation

## Overview
Powerful data transformation pipeline with ETL operations, format conversion, and real-time processing.

## Transformation Pipeline

```typescript
import { TransformationPipeline } from 'cassandraorm-js';

const pipeline = new TransformationPipeline()
  .source('users', { status: 'active' })
  .transform('normalize', (data) => ({
    id: data.id.toString(),
    email: data.email.toLowerCase(),
    name: data.name.trim(),
    created_at: new Date(data.created_at)
  }))
  .transform('enrich', async (data) => {
    const profile = await UserProfile.findOne({ user_id: data.id });
    return { ...data, profile };
  })
  .filter((data) => data.profile !== null)
  .destination('enriched_users');

await pipeline.execute();
```

## Built-in Transformers

```typescript
import { Transformers } from 'cassandraorm-js';

// String transformations
const stringTransforms = new TransformationPipeline()
  .transform(Transformers.string.toLowerCase('email'))
  .transform(Transformers.string.trim(['name', 'description']))
  .transform(Transformers.string.replace('phone', /[^\d]/g, ''))
  .transform(Transformers.string.truncate('bio', 500));

// Date transformations
const dateTransforms = new TransformationPipeline()
  .transform(Transformers.date.format('created_at', 'YYYY-MM-DD'))
  .transform(Transformers.date.addDays('due_date', 30))
  .transform(Transformers.date.toTimezone('timestamp', 'UTC'));

// Number transformations
const numberTransforms = new TransformationPipeline()
  .transform(Transformers.number.round('price', 2))
  .transform(Transformers.number.clamp('rating', 1, 5))
  .transform(Transformers.number.scale('percentage', 100));
```

## Custom Transformers

```typescript
// Register custom transformer
Transformers.register('calculateAge', (birthDate) => {
  return Math.floor((Date.now() - new Date(birthDate)) / (365.25 * 24 * 60 * 60 * 1000));
});

Transformers.register('geocode', async (address) => {
  const response = await fetch(`https://api.geocoding.com/v1?address=${encodeURIComponent(address)}`);
  const data = await response.json();
  return { lat: data.lat, lng: data.lng };
});

// Use custom transformers
const pipeline = new TransformationPipeline()
  .transform('calculateAge', 'birth_date')
  .transform('geocode', 'address');
```

## Conditional Transformations

```typescript
const conditionalPipeline = new TransformationPipeline()
  .transform('conditionalDiscount', (data) => {
    if (data.customer_type === 'premium') {
      data.discount = data.total * 0.1;
    } else if (data.total > 100) {
      data.discount = data.total * 0.05;
    } else {
      data.discount = 0;
    }
    return data;
  })
  .transform('statusUpdate', (data) => {
    data.status = data.payment_received ? 'paid' : 'pending';
    return data;
  });
```

## Batch Transformations

```typescript
import { BatchTransformer } from 'cassandraorm-js';

const batchTransformer = new BatchTransformer({
  batchSize: 1000,
  parallel: true,
  maxConcurrency: 5
});

// Transform large datasets
const transformedData = await batchTransformer.transform(
  'SELECT * FROM raw_data',
  (batch) => {
    return batch.map(row => ({
      id: row.id,
      processed_at: new Date(),
      normalized_value: normalizeValue(row.raw_value)
    }));
  }
);

// Insert transformed data
await batchTransformer.insertBatch('processed_data', transformedData);
```

## Real-time Transformations

```typescript
import { StreamTransformer } from 'cassandraorm-js';

const streamTransformer = new StreamTransformer()
  .source('kafka', { topic: 'user_events' })
  .transform('parseEvent', (event) => JSON.parse(event.value))
  .transform('enrichUser', async (event) => {
    const user = await User.findOne({ id: event.user_id });
    return { ...event, user };
  })
  .filter((event) => event.user !== null)
  .destination('cassandra', { table: 'processed_events' });

await streamTransformer.start();
```

## Data Validation in Transformations

```typescript
const validatingPipeline = new TransformationPipeline()
  .validate('input', {
    email: { required: true, isEmail: true },
    age: { required: true, min: 0, max: 150 }
  })
  .transform('normalize', normalizeData)
  .validate('output', {
    normalized_email: { required: true },
    age_group: { required: true, isIn: ['child', 'adult', 'senior'] }
  });
```

## Error Handling

```typescript
const robustPipeline = new TransformationPipeline()
  .onError('skip', (error, data) => {
    console.log(`Skipping record due to error: ${error.message}`);
    return null; // Skip this record
  })
  .onError('retry', { maxRetries: 3, backoff: 'exponential' })
  .onError('deadLetter', { table: 'failed_transformations' });

// Global error handling
pipeline.onError((error, context) => {
  logger.error('Transformation failed', {
    error: error.message,
    data: context.data,
    step: context.step
  });
});
```

## Performance Monitoring

```typescript
const monitoredPipeline = new TransformationPipeline()
  .monitor({
    metrics: ['throughput', 'latency', 'errors'],
    interval: 5000 // 5 seconds
  })
  .onMetrics((metrics) => {
    console.log(`Processed ${metrics.throughput} records/sec`);
    console.log(`Average latency: ${metrics.latency}ms`);
  });

// Get transformation statistics
const stats = await pipeline.getStats();
console.log(`Total processed: ${stats.totalProcessed}`);
console.log(`Success rate: ${stats.successRate}%`);
```

## Schema Evolution

```typescript
const evolutionPipeline = new TransformationPipeline()
  .transform('migrateSchema', (data) => {
    // Handle schema version differences
    if (data.schema_version === 1) {
      return {
        ...data,
        new_field: data.old_field,
        schema_version: 2
      };
    }
    return data;
  })
  .transform('validateSchema', (data) => {
    const requiredFields = ['id', 'email', 'schema_version'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    return data;
  });
```
