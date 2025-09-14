# Middleware System

## Overview
Extensible middleware system for query interception, transformation, validation, and custom processing.

## Basic Middleware

```typescript
import { Middleware } from 'cassandraorm-js';

// Query logging middleware
const loggingMiddleware: Middleware = {
  name: 'logging',
  beforeQuery: async (context) => {
    console.log(`Executing: ${context.query}`);
    context.startTime = Date.now();
    return context;
  },
  afterQuery: async (context) => {
    const duration = Date.now() - context.startTime;
    console.log(`Query completed in ${duration}ms`);
    return context;
  }
};

// Register middleware
client.use(loggingMiddleware);
```

## Validation Middleware

```typescript
const validationMiddleware: Middleware = {
  name: 'validation',
  beforeQuery: async (context) => {
    if (context.operation === 'insert' || context.operation === 'update') {
      const errors = await validateData(context.data, context.schema);
      if (errors.length > 0) {
        throw new ValidationError('Data validation failed', errors);
      }
    }
    return context;
  }
};

// Custom validator
async function validateData(data: any, schema: any) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema.fields)) {
    if (rules.required && !data[field]) {
      errors.push(`${field} is required`);
    }
    
    if (rules.validate && data[field]) {
      const isValid = await rules.validate(data[field]);
      if (!isValid) {
        errors.push(`${field} validation failed`);
      }
    }
  }
  
  return errors;
}
```

## Caching Middleware

```typescript
import { CacheMiddleware } from 'cassandraorm-js';

const cacheMiddleware = new CacheMiddleware({
  store: 'redis',
  ttl: 300, // 5 minutes
  keyGenerator: (context) => {
    return `query:${context.table}:${JSON.stringify(context.params)}`;
  }
});

client.use(cacheMiddleware);

// Cache-specific operations
const cachedResult = await User.findOne({ id: userId }, { 
  cache: { ttl: 600 } // Override default TTL
});
```

## Security Middleware

```typescript
const securityMiddleware: Middleware = {
  name: 'security',
  beforeQuery: async (context) => {
    // SQL injection prevention
    if (context.query.includes('DROP') || context.query.includes('DELETE')) {
      if (!context.user?.permissions?.includes('admin')) {
        throw new SecurityError('Insufficient permissions');
      }
    }
    
    // Rate limiting
    const key = `rate_limit:${context.user?.id}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 1 minute window
    }
    if (count > 100) {
      throw new RateLimitError('Rate limit exceeded');
    }
    
    return context;
  }
};
```

## Transformation Middleware

```typescript
const transformationMiddleware: Middleware = {
  name: 'transformation',
  beforeQuery: async (context) => {
    // Transform input data
    if (context.data) {
      context.data = transformInput(context.data);
    }
    return context;
  },
  afterQuery: async (context) => {
    // Transform output data
    if (context.result) {
      context.result = transformOutput(context.result);
    }
    return context;
  }
};

function transformInput(data: any) {
  // Convert dates to timestamps
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      data[key] = value.getTime();
    }
  }
  return data;
}

function transformOutput(result: any) {
  // Convert timestamps back to dates
  if (result.rows) {
    result.rows = result.rows.map(row => {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'number' && key.includes('_at')) {
          row[key] = new Date(value);
        }
      }
      return row;
    });
  }
  return result;
}
```

## Conditional Middleware

```typescript
// Apply middleware conditionally
const conditionalMiddleware: Middleware = {
  name: 'conditional',
  condition: (context) => {
    return context.table === 'sensitive_data' && 
           context.operation === 'select';
  },
  beforeQuery: async (context) => {
    // Add encryption/decryption logic
    return context;
  }
};

client.use(conditionalMiddleware);
```

## Middleware Chain

```typescript
// Create middleware chain
const middlewareChain = [
  securityMiddleware,
  validationMiddleware,
  cacheMiddleware,
  loggingMiddleware,
  transformationMiddleware
];

// Apply all middleware
middlewareChain.forEach(middleware => {
  client.use(middleware);
});

// Remove middleware
client.removeMiddleware('logging');

// Get middleware info
const activeMiddleware = client.getMiddleware();
console.log('Active middleware:', activeMiddleware.map(m => m.name));
```
