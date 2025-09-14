# Error Handling

## Overview
Comprehensive error handling with custom error types, retry mechanisms, and graceful degradation strategies.

## Error Types

```typescript
import { 
  CassandraError,
  ValidationError,
  ConnectionError,
  TimeoutError,
  ConsistencyError
} from 'cassandraorm-js';

// Handle specific error types
try {
  await User.create({ email: 'invalid-email' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.errors);
  } else if (error instanceof ConnectionError) {
    console.log('Connection failed:', error.message);
  } else if (error instanceof TimeoutError) {
    console.log('Operation timed out:', error.timeout);
  }
}
```

## Custom Error Classes

```typescript
// Define custom errors
class BusinessLogicError extends CassandraError {
  constructor(message: string, code: string) {
    super(message);
    this.name = 'BusinessLogicError';
    this.code = code;
  }
}

class InsufficientFundsError extends BusinessLogicError {
  constructor(balance: number, required: number) {
    super(`Insufficient funds: ${balance} < ${required}`, 'INSUFFICIENT_FUNDS');
    this.balance = balance;
    this.required = required;
  }
}

// Use custom errors
async function processPayment(userId: string, amount: number) {
  const user = await User.findOne({ id: userId });
  if (user.balance < amount) {
    throw new InsufficientFundsError(user.balance, amount);
  }
  // Process payment...
}
```

## Global Error Handler

```typescript
import { ErrorHandler } from 'cassandraorm-js';

const errorHandler = new ErrorHandler({
  logErrors: true,
  logLevel: 'error',
  includeStackTrace: true
});

// Register global handler
client.setErrorHandler(errorHandler);

// Custom error handling
errorHandler.on('error', (error, context) => {
  console.log(`Error in ${context.operation}:`, error.message);
  
  // Send to monitoring service
  if (error instanceof ConnectionError) {
    alertingService.sendAlert('Database connection failed', error);
  }
});
```

## Retry Mechanisms

```typescript
import { RetryManager } from 'cassandraorm-js';

const retryManager = new RetryManager({
  maxRetries: 3,
  backoff: 'exponential',
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: [ConnectionError, TimeoutError]
});

// Retry with custom logic
async function reliableQuery(query: string, params: any[]) {
  return await retryManager.execute(async () => {
    return await client.execute(query, params);
  }, {
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    }
  });
}

// Conditional retry
const conditionalRetry = new RetryManager({
  shouldRetry: (error, attempt) => {
    if (error instanceof ValidationError) return false;
    if (attempt >= 5) return false;
    return true;
  }
});
```

## Circuit Breaker Pattern

```typescript
import { CircuitBreaker } from 'cassandraorm-js';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  monitoringPeriod: 10000
});

// Wrap operations with circuit breaker
async function protectedQuery(query: string) {
  return await circuitBreaker.execute(async () => {
    return await client.execute(query);
  });
}

// Monitor circuit breaker state
circuitBreaker.on('open', () => {
  console.log('Circuit breaker opened - failing fast');
});

circuitBreaker.on('halfOpen', () => {
  console.log('Circuit breaker half-open - testing');
});

circuitBreaker.on('close', () => {
  console.log('Circuit breaker closed - normal operation');
});
```

## Graceful Degradation

```typescript
import { FallbackManager } from 'cassandraorm-js';

const fallbackManager = new FallbackManager();

// Register fallback strategies
fallbackManager.register('getUserProfile', {
  primary: async (userId) => {
    return await UserProfile.findOne({ user_id: userId });
  },
  fallback: async (userId) => {
    // Fallback to cache or default profile
    const cached = await cache.get(`profile:${userId}`);
    return cached || { user_id: userId, name: 'Unknown User' };
  },
  condition: (error) => error instanceof ConnectionError
});

// Use with automatic fallback
const profile = await fallbackManager.execute('getUserProfile', userId);
```

## Error Recovery Strategies

```typescript
import { RecoveryManager } from 'cassandraorm-js';

const recoveryManager = new RecoveryManager({
  strategies: {
    connection: {
      maxAttempts: 5,
      backoff: 'exponential',
      recovery: async () => {
        await client.reconnect();
      }
    },
    consistency: {
      maxAttempts: 3,
      recovery: async (error, context) => {
        // Retry with lower consistency level
        return await client.execute(context.query, context.params, {
          consistency: 'ONE'
        });
      }
    }
  }
});

// Automatic recovery
try {
  await client.execute(query, params);
} catch (error) {
  const recovered = await recoveryManager.recover(error, { query, params });
  if (!recovered) {
    throw error;
  }
}
```

## Error Monitoring and Alerting

```typescript
import { ErrorMonitor } from 'cassandraorm-js';

const errorMonitor = new ErrorMonitor({
  thresholds: {
    errorRate: 0.05,      // 5% error rate
    timeWindow: 300000,   // 5 minutes
    minSamples: 100
  },
  alerts: {
    email: ['admin@company.com'],
    slack: 'https://hooks.slack.com/...',
    webhook: 'https://api.company.com/alerts'
  }
});

// Monitor error patterns
errorMonitor.on('threshold_exceeded', (metrics) => {
  console.log(`Error rate exceeded: ${metrics.errorRate}%`);
});

// Track specific error types
errorMonitor.track('validation_errors', ValidationError);
errorMonitor.track('connection_errors', ConnectionError);
```

## Error Context and Debugging

```typescript
import { ErrorContext } from 'cassandraorm-js';

// Enhanced error context
try {
  await User.create(userData);
} catch (error) {
  const context = ErrorContext.capture(error, {
    operation: 'user_creation',
    userId: userData.id,
    timestamp: new Date(),
    requestId: req.id,
    userAgent: req.headers['user-agent']
  });
  
  logger.error('User creation failed', context);
  
  // Send to error tracking service
  errorTracker.captureException(error, context);
}

// Error correlation
const correlationId = generateCorrelationId();
try {
  await processOrder(orderId, { correlationId });
} catch (error) {
  error.correlationId = correlationId;
  throw error;
}
```

## Testing Error Scenarios

```typescript
import { ErrorSimulator } from 'cassandraorm-js';

// Simulate errors for testing
const simulator = new ErrorSimulator();

// Simulate connection failures
simulator.simulateConnectionError({
  probability: 0.1, // 10% chance
  duration: 5000    // 5 seconds
});

// Simulate timeouts
simulator.simulateTimeout({
  operations: ['SELECT'],
  probability: 0.05,
  delay: 15000
});

// Test error handling
describe('Error Handling', () => {
  it('should handle connection errors gracefully', async () => {
    simulator.enable();
    
    const result = await fallbackManager.execute('getUser', userId);
    expect(result).toBeDefined();
    
    simulator.disable();
  });
});
```
