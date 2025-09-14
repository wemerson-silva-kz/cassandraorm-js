# Logging

## Overview
Comprehensive logging system with structured logging, multiple transports, and query tracing.

## Basic Logging Setup

```typescript
import { createClient, Logger } from 'cassandraorm-js';

const logger = new Logger({
  level: 'info',
  format: 'json',
  transports: ['console', 'file']
});

const client = createClient({
  logger,
  logQueries: true
});
```

## Query Logging

```typescript
// Enable query logging
client.enableQueryLogging({
  logLevel: 'debug',
  logParams: true,
  logResults: false,
  slowQueryThreshold: 1000 // Log queries > 1s
});

// Custom query logger
client.onQuery((query, params, duration) => {
  logger.info('Query executed', {
    cql: query,
    params,
    duration,
    timestamp: new Date().toISOString()
  });
});
```

## Structured Logging

```typescript
import { StructuredLogger } from 'cassandraorm-js';

const logger = new StructuredLogger({
  service: 'cassandraorm-app',
  version: '1.0.0',
  environment: process.env.NODE_ENV
});

// Log with context
logger.info('User created', {
  userId: '123',
  email: 'user@example.com',
  operation: 'create_user'
});

// Log errors with stack trace
logger.error('Database connection failed', error, {
  host: 'localhost:9042',
  keyspace: 'myapp'
});
```

## Multiple Transports

```typescript
const logger = new Logger({
  transports: [
    {
      type: 'console',
      level: 'debug',
      colorize: true
    },
    {
      type: 'file',
      filename: 'app.log',
      level: 'info',
      maxSize: '10MB',
      maxFiles: 5
    },
    {
      type: 'elasticsearch',
      host: 'localhost:9200',
      index: 'cassandraorm-logs',
      level: 'warn'
    }
  ]
});
```

## Request Tracing

```typescript
import { RequestTracer } from 'cassandraorm-js';

const tracer = new RequestTracer({
  sampleRate: 0.1, // 10% sampling
  maxTraceSize: 1000
});

// Trace database operations
const trace = tracer.startTrace('user_operation');
trace.addEvent('query_start', { table: 'users' });

const user = await User.findOne({ id: userId });

trace.addEvent('query_end', { duration: 150 });
trace.finish();
```
