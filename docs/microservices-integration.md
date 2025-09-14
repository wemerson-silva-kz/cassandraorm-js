# Microservices Integration

## Overview
Seamless microservices integration with service discovery, API gateway, distributed tracing, and inter-service communication patterns.

## Service Registry

```typescript
import { ServiceRegistry } from 'cassandraorm-js';

const serviceRegistry = new ServiceRegistry(client, {
  registryTable: 'service_registry',
  healthCheckInterval: 30000,
  ttl: 60000
});

// Register service
await serviceRegistry.register('user-service', {
  id: 'user-service-1',
  host: 'localhost',
  port: 3001,
  version: '1.2.0',
  metadata: {
    database: 'cassandra',
    region: 'us-east-1'
  },
  healthCheck: {
    endpoint: '/health',
    interval: 30000
  }
});

// Discover services
const userServices = await serviceRegistry.discover('user-service');
const availableService = userServices.find(s => s.status === 'healthy');
```

## API Gateway Integration

```typescript
import { APIGateway } from 'cassandraorm-js';

const gateway = new APIGateway({
  serviceRegistry,
  loadBalancer: 'round_robin',
  rateLimiting: {
    enabled: true,
    requests: 1000,
    window: '1m'
  },
  authentication: {
    enabled: true,
    provider: 'jwt'
  }
});

// Route configuration
gateway.addRoute('/api/users/*', {
  service: 'user-service',
  stripPrefix: '/api/users',
  timeout: 30000,
  retries: 3,
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    timeout: 60000
  }
});

gateway.addRoute('/api/orders/*', {
  service: 'order-service',
  stripPrefix: '/api/orders',
  middleware: [
    'authentication',
    'authorization',
    'rate_limiting'
  ]
});

await gateway.start(8080);
```

## Inter-Service Communication

```typescript
import { ServiceClient } from 'cassandraorm-js';

class UserService {
  constructor() {
    this.orderServiceClient = new ServiceClient('order-service', {
      serviceRegistry,
      timeout: 10000,
      retries: 3,
      circuitBreaker: true
    });
  }

  async getUserWithOrders(userId: string) {
    // Get user from local database
    const user = await User.findOne({ id: userId });
    
    // Get orders from order service
    const orders = await this.orderServiceClient.get(`/users/${userId}/orders`);
    
    return {
      ...user,
      orders: orders.data
    };
  }

  async createUserAndWelcomeOrder(userData: any) {
    // Create user locally
    const user = await User.create(userData);
    
    // Create welcome order in order service
    await this.orderServiceClient.post('/orders', {
      userId: user.id,
      type: 'welcome',
      items: [{ productId: 'welcome-kit', quantity: 1 }]
    });
    
    return user;
  }
}
```

## Event-Driven Communication

```typescript
import { EventBus } from 'cassandraorm-js';

const eventBus = new EventBus({
  transport: 'kafka',
  brokers: ['kafka1:9092', 'kafka2:9092'],
  groupId: 'user-service-group'
});

// Publish events
class UserService {
  async createUser(userData: any) {
    const user = await User.create(userData);
    
    // Publish user created event
    await eventBus.publish('user.created', {
      userId: user.id,
      email: user.email,
      timestamp: new Date()
    });
    
    return user;
  }
}

// Subscribe to events
class OrderService {
  constructor() {
    eventBus.subscribe('user.created', this.handleUserCreated.bind(this));
    eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this));
  }

  async handleUserCreated(event: any) {
    // Create user profile in order service
    await UserProfile.create({
      userId: event.userId,
      email: event.email,
      preferences: {}
    });
  }

  async handleUserUpdated(event: any) {
    // Update user profile
    await UserProfile.update(
      { userId: event.userId },
      { email: event.email }
    );
  }
}
```

## Distributed Tracing

```typescript
import { DistributedTracer } from 'cassandraorm-js';

const tracer = new DistributedTracer({
  serviceName: 'user-service',
  jaegerEndpoint: 'http://jaeger:14268/api/traces',
  samplingRate: 0.1
});

// Trace service calls
class UserService {
  async getUserProfile(userId: string) {
    const span = tracer.startSpan('get_user_profile');
    span.setTag('user.id', userId);
    
    try {
      // Database operation
      const dbSpan = tracer.startSpan('db_query', { childOf: span });
      const user = await User.findOne({ id: userId });
      dbSpan.finish();
      
      // External service call
      const serviceSpan = tracer.startSpan('profile_service_call', { childOf: span });
      const profile = await this.profileServiceClient.get(`/profiles/${userId}`);
      serviceSpan.finish();
      
      return { ...user, profile: profile.data };
    } catch (error) {
      span.setTag('error', true);
      span.log({ error: error.message });
      throw error;
    } finally {
      span.finish();
    }
  }
}

// Automatic tracing middleware
client.use(new TracingMiddleware(tracer));
```

## Service Mesh Integration

```typescript
import { ServiceMesh } from 'cassandraorm-js';

const serviceMesh = new ServiceMesh({
  meshProvider: 'istio', // or 'linkerd', 'consul'
  sidecarConfig: {
    injectTracing: true,
    injectMetrics: true,
    injectLogging: true
  },
  policies: {
    retryPolicy: {
      attempts: 3,
      perTryTimeout: '10s'
    },
    circuitBreaker: {
      consecutiveErrors: 5,
      interval: '30s'
    }
  }
});

// Service mesh aware client
const meshClient = serviceMesh.createClient('user-service');
```

## Data Consistency Patterns

```typescript
// Saga pattern for distributed transactions
import { DistributedSaga } from 'cassandraorm-js';

class OrderCreationSaga extends DistributedSaga {
  async execute(orderData: any) {
    const sagaId = this.generateId();
    
    try {
      // Step 1: Reserve inventory
      const inventoryResult = await this.callService('inventory-service', 'reserve', {
        items: orderData.items,
        sagaId
      });
      
      // Step 2: Process payment
      const paymentResult = await this.callService('payment-service', 'charge', {
        amount: orderData.total,
        paymentMethod: orderData.paymentMethod,
        sagaId
      });
      
      // Step 3: Create order
      const order = await Order.create({
        ...orderData,
        inventoryReservation: inventoryResult.reservationId,
        paymentTransaction: paymentResult.transactionId
      });
      
      return order;
      
    } catch (error) {
      // Compensate on failure
      await this.compensate(sagaId);
      throw error;
    }
  }
  
  async compensate(sagaId: string) {
    // Reverse operations in opposite order
    await this.callService('payment-service', 'refund', { sagaId });
    await this.callService('inventory-service', 'unreserve', { sagaId });
  }
}
```

## Service Configuration Management

```typescript
import { ConfigurationManager } from 'cassandraorm-js';

const configManager = new ConfigurationManager(client, {
  configTable: 'service_configs',
  environment: process.env.NODE_ENV,
  refreshInterval: 60000
});

// Load service configuration
const config = await configManager.getConfig('user-service', {
  database: {
    hosts: ['cassandra1', 'cassandra2'],
    keyspace: 'users',
    consistency: 'QUORUM'
  },
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 10000
  },
  features: {
    emailVerification: true,
    socialLogin: false
  }
});

// Watch for configuration changes
configManager.watch('user-service', (newConfig) => {
  console.log('Configuration updated:', newConfig);
  // Reload service with new configuration
});
```

## Health Monitoring

```typescript
import { ServiceHealthMonitor } from 'cassandraorm-js';

const healthMonitor = new ServiceHealthMonitor({
  serviceName: 'user-service',
  checks: [
    {
      name: 'database',
      check: async () => {
        try {
          await client.execute('SELECT now() FROM system.local');
          return { status: 'healthy' };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      }
    },
    {
      name: 'external_api',
      check: async () => {
        try {
          const response = await fetch('https://api.external.com/health');
          return { status: response.ok ? 'healthy' : 'unhealthy' };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      }
    }
  ]
});

// Health endpoint
app.get('/health', async (req, res) => {
  const health = await healthMonitor.check();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

## Service Deployment

```typescript
import { ServiceDeployer } from 'cassandraorm-js';

const deployer = new ServiceDeployer({
  platform: 'kubernetes', // or 'docker', 'ecs'
  registry: 'docker.io/myorg',
  namespace: 'production'
});

// Deploy service
await deployer.deploy('user-service', {
  image: 'user-service:1.2.0',
  replicas: 3,
  resources: {
    cpu: '500m',
    memory: '1Gi'
  },
  environment: {
    NODE_ENV: 'production',
    CASSANDRA_HOSTS: 'cassandra-cluster'
  },
  healthCheck: {
    path: '/health',
    port: 3000
  }
});

// Blue-green deployment
await deployer.blueGreenDeploy('user-service', {
  currentVersion: '1.1.0',
  newVersion: '1.2.0',
  trafficSplit: { blue: 90, green: 10 },
  rollbackOnFailure: true
});
```
