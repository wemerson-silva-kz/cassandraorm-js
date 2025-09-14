# Advanced Example

## Overview
Advanced e-commerce platform demonstrating all CassandraORM features including AI/ML, event sourcing, real-time subscriptions, and microservices architecture.

## Project Architecture

```
ecommerce-platform/
├── services/
│   ├── user-service/
│   ├── product-service/
│   ├── order-service/
│   ├── payment-service/
│   └── notification-service/
├── shared/
│   ├── events/
│   ├── types/
│   └── utils/
├── gateway/
├── docker-compose.yml
└── k8s/
```

## Event Sourcing Setup

```typescript
// shared/events/UserEvents.ts
export interface UserCreated {
  type: 'UserCreated';
  data: {
    userId: string;
    email: string;
    name: string;
    timestamp: Date;
  };
}

export interface UserProfileUpdated {
  type: 'UserProfileUpdated';
  data: {
    userId: string;
    changes: Record<string, any>;
    timestamp: Date;
  };
}

export type UserEvent = UserCreated | UserProfileUpdated;
```

```typescript
// services/user-service/src/aggregates/UserAggregate.ts
import { BaseAggregateRoot } from 'cassandraorm-js';
import { UserEvent } from '../../../shared/events/UserEvents';

export class UserAggregate extends BaseAggregateRoot<UserEvent> {
  private userId: string;
  private email: string;
  private name: string;
  private profile: UserProfile;
  private preferences: UserPreferences;

  constructor(id: string) {
    super(id);
    this.userId = id;
  }

  static create(id: string, email: string, name: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent({
      type: 'UserCreated',
      data: { userId: id, email, name, timestamp: new Date() }
    });
    return user;
  }

  updateProfile(profileData: Partial<UserProfile>): void {
    const changes = { ...profileData };
    this.addEvent({
      type: 'UserProfileUpdated',
      data: { userId: this.userId, changes, timestamp: new Date() }
    });
  }

  protected applyEvent(event: UserEvent): void {
    switch (event.type) {
      case 'UserCreated':
        this.email = event.data.email;
        this.name = event.data.name;
        break;
      case 'UserProfileUpdated':
        this.profile = { ...this.profile, ...event.data.changes };
        break;
    }
  }

  // Getters
  getEmail(): string { return this.email; }
  getName(): string { return this.name; }
  getProfile(): UserProfile { return this.profile; }
}
```

## CQRS Implementation

```typescript
// services/user-service/src/commands/UserCommands.ts
export interface CreateUserCommand {
  type: 'CreateUser';
  userId: string;
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserProfileCommand {
  type: 'UpdateUserProfile';
  userId: string;
  profileData: Partial<UserProfile>;
}

// Command Handler
import { CommandHandler } from 'cassandraorm-js';

export class UserCommandHandler extends CommandHandler {
  constructor(
    private userRepository: UserRepository,
    private eventBus: EventBus
  ) {
    super();
  }

  async handle(command: CreateUserCommand | UpdateUserProfileCommand): Promise<void> {
    switch (command.type) {
      case 'CreateUser':
        await this.handleCreateUser(command);
        break;
      case 'UpdateUserProfile':
        await this.handleUpdateUserProfile(command);
        break;
    }
  }

  private async handleCreateUser(command: CreateUserCommand): Promise<void> {
    const user = UserAggregate.create(command.userId, command.email, command.name);
    await this.userRepository.save(user);
    
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish('user.events', event);
    }
  }
}
```

## AI/ML Integration

```typescript
// services/product-service/src/ai/RecommendationEngine.ts
import { AIMLManager, RecommendationEngine } from 'cassandraorm-js';

export class ProductRecommendationService {
  private aiml: AIMLManager;
  private recommender: RecommendationEngine;

  constructor(client: any) {
    this.aiml = new AIMLManager(client.driver, 'ecommerce');
    this.recommender = new RecommendationEngine(client);
  }

  async setupRecommendations(): Promise<void> {
    // Create vector table for product embeddings
    await this.aiml.createVectorTable('product_embeddings', {
      product_id: 'uuid',
      name: 'text',
      description: 'text',
      category: 'text',
      embedding: 'vector<float, 1536>',
      metadata: 'map<text, text>'
    });

    // Setup collaborative filtering
    await this.recommender.createModel('user_product_cf', {
      type: 'collaborative_filtering',
      userTable: 'users',
      itemTable: 'products',
      interactionTable: 'user_interactions'
    });
  }

  async generateProductEmbeddings(): Promise<void> {
    const products = await Product.find({});
    
    for (const product of products) {
      const text = `${product.name} ${product.description} ${product.category}`;
      const embedding = await this.aiml.generateEmbedding(text);
      
      await this.aiml.insertVector('product_embeddings', {
        product_id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        embedding: embedding,
        metadata: {
          price: product.price.toString(),
          brand: product.brand
        }
      });
    }
  }

  async getRecommendations(userId: string, limit: number = 10): Promise<Product[]> {
    // Get user's interaction history
    const interactions = await UserInteraction.find({ user_id: userId });
    
    if (interactions.length === 0) {
      // Cold start: recommend popular products
      return await this.getPopularProducts(limit);
    }

    // Get collaborative filtering recommendations
    const cfRecommendations = await this.recommender.recommend('user_product_cf', {
      userId,
      limit: limit * 2
    });

    // Get content-based recommendations using vector similarity
    const recentProducts = interactions.slice(-5).map(i => i.product_id);
    const contentRecommendations = await this.getContentBasedRecommendations(
      recentProducts, 
      limit
    );

    // Combine and rank recommendations
    return this.combineRecommendations(cfRecommendations, contentRecommendations, limit);
  }

  private async getContentBasedRecommendations(
    productIds: string[], 
    limit: number
  ): Promise<Product[]> {
    const recommendations = [];
    
    for (const productId of productIds) {
      const product = await Product.findOne({ id: productId });
      if (!product) continue;

      const embedding = await this.aiml.generateEmbedding(
        `${product.name} ${product.description}`
      );

      const similar = await this.aiml.similaritySearch('product_embeddings', embedding, {
        limit: 5,
        threshold: 0.7,
        filters: { category: product.category }
      });

      recommendations.push(...similar);
    }

    return recommendations.slice(0, limit);
  }
}
```

## Real-time Features

```typescript
// services/order-service/src/realtime/OrderSubscriptions.ts
import { SubscriptionManager, WebSocketManager } from 'cassandraorm-js';

export class OrderRealtimeService {
  private subscriptions: SubscriptionManager;
  private wsManager: WebSocketManager;

  constructor(client: any) {
    this.subscriptions = new SubscriptionManager(client.driver, 'ecommerce');
    this.wsManager = new WebSocketManager(client, { port: 3001 });
  }

  async setupSubscriptions(): Promise<void> {
    // Subscribe to order status changes
    await this.subscriptions.subscribe({
      table: 'orders',
      operations: ['update'],
      filters: {
        status: { $in: ['processing', 'shipped', 'delivered'] }
      },
      callback: this.handleOrderStatusChange.bind(this)
    });

    // Subscribe to inventory changes
    await this.subscriptions.subscribe({
      table: 'inventory',
      operations: ['update'],
      filters: {
        quantity: { $lt: 10 } // Low stock alert
      },
      callback: this.handleLowStock.bind(this)
    });
  }

  private async handleOrderStatusChange(event: any): Promise<void> {
    const { order_id, status, user_id } = event.data;
    
    // Notify user via WebSocket
    this.wsManager.broadcastToRoom(`user:${user_id}`, {
      type: 'order_status_update',
      data: { order_id, status, timestamp: new Date() }
    });

    // Send push notification
    await this.sendPushNotification(user_id, {
      title: 'Order Update',
      body: `Your order is now ${status}`,
      data: { order_id, status }
    });
  }

  private async handleLowStock(event: any): Promise<void> {
    const { product_id, quantity } = event.data;
    
    // Notify admin dashboard
    this.wsManager.broadcastToRoom('admin', {
      type: 'low_stock_alert',
      data: { product_id, quantity, timestamp: new Date() }
    });

    // Auto-reorder if configured
    const product = await Product.findOne({ id: product_id });
    if (product?.auto_reorder && quantity <= product.reorder_threshold) {
      await this.triggerAutoReorder(product_id, product.reorder_quantity);
    }
  }
}
```

## Distributed Transactions

```typescript
// services/order-service/src/sagas/OrderProcessingSaga.ts
import { SagaOrchestrator } from 'cassandraorm-js';

export class OrderProcessingSaga {
  constructor(private sagaOrchestrator: SagaOrchestrator) {}

  async processOrder(orderData: CreateOrderData): Promise<string> {
    const sagaId = this.generateSagaId();
    
    const saga = this.sagaOrchestrator.createSaga('order_processing', [
      {
        name: 'validate_inventory',
        action: this.validateInventory,
        compensation: this.releaseInventoryReservation,
        timeout: 30000
      },
      {
        name: 'reserve_inventory',
        action: this.reserveInventory,
        compensation: this.unreserveInventory,
        timeout: 15000
      },
      {
        name: 'process_payment',
        action: this.processPayment,
        compensation: this.refundPayment,
        timeout: 45000
      },
      {
        name: 'create_order',
        action: this.createOrder,
        compensation: this.cancelOrder,
        timeout: 10000
      },
      {
        name: 'update_inventory',
        action: this.updateInventory,
        compensation: this.restoreInventory,
        timeout: 10000
      },
      {
        name: 'send_confirmation',
        action: this.sendOrderConfirmation,
        compensation: this.sendCancellationNotice,
        timeout: 5000
      }
    ]);

    return await saga.execute(orderData);
  }

  private async validateInventory(context: any): Promise<any> {
    const inventoryService = new InventoryService();
    const validation = await inventoryService.validateAvailability(context.items);
    
    if (!validation.valid) {
      throw new Error(`Insufficient inventory: ${validation.unavailableItems.join(', ')}`);
    }
    
    return { validated: true, reservationIds: validation.reservationIds };
  }

  private async processPayment(context: any): Promise<any> {
    const paymentService = new PaymentService();
    const result = await paymentService.processPayment({
      amount: context.total,
      paymentMethod: context.paymentMethod,
      customerId: context.customerId
    });
    
    return { paymentId: result.paymentId, transactionId: result.transactionId };
  }

  // ... other saga steps
}
```

## Microservices Communication

```typescript
// gateway/src/GraphQLGateway.ts
import { GraphQLSchemaGenerator, ServiceRegistry } from 'cassandraorm-js';
import { buildFederatedSchema } from '@apollo/federation';

export class GraphQLGateway {
  private serviceRegistry: ServiceRegistry;
  private schemaGenerator: GraphQLSchemaGenerator;

  constructor() {
    this.serviceRegistry = new ServiceRegistry(client);
    this.schemaGenerator = new GraphQLSchemaGenerator();
  }

  async buildFederatedSchema(): Promise<any> {
    const services = await this.serviceRegistry.discover();
    const subschemas = [];

    for (const service of services) {
      if (service.metadata.graphql) {
        const schema = await this.fetchServiceSchema(service);
        subschemas.push({
          schema,
          executor: this.createServiceExecutor(service)
        });
      }
    }

    return buildFederatedSchema(subschemas);
  }

  private createServiceExecutor(service: any) {
    return async ({ document, variables, context }) => {
      const response = await fetch(`${service.url}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': context.authorization
        },
        body: JSON.stringify({ query: document, variables })
      });

      return await response.json();
    };
  }
}
```

## Multi-tenant Architecture

```typescript
// shared/middleware/TenantMiddleware.ts
import { TenantManager } from 'cassandraorm-js';

export class TenantMiddleware {
  private tenantManager: TenantManager;

  constructor(client: any) {
    this.tenantManager = new TenantManager(client, {
      isolationStrategy: 'schema',
      tenantTable: 'tenants'
    });
  }

  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        // Extract tenant from subdomain or header
        const tenantId = this.extractTenantId(req);
        
        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant not specified' });
        }

        // Get tenant-specific client
        const tenantClient = await this.tenantManager.getTenantClient(tenantId);
        
        // Add to request context
        req.tenant = { id: tenantId, client: tenantClient };
        
        next();
      } catch (error) {
        res.status(500).json({ error: 'Tenant resolution failed' });
      }
    };
  }

  private extractTenantId(req: any): string | null {
    // From subdomain: tenant1.api.example.com
    const subdomain = req.hostname.split('.')[0];
    if (subdomain && subdomain !== 'api') {
      return subdomain;
    }

    // From header
    return req.headers['x-tenant-id'] || null;
  }
}
```

## Performance Optimization

```typescript
// shared/optimization/QueryOptimizer.ts
import { AIQueryOptimizer, CacheManager } from 'cassandraorm-js';

export class PerformanceOptimizer {
  private queryOptimizer: AIQueryOptimizer;
  private cacheManager: CacheManager;

  constructor(client: any) {
    this.queryOptimizer = new AIQueryOptimizer(client);
    this.cacheManager = new CacheManager({
      stores: [
        { name: 'memory', type: 'memory', maxSize: 1000 },
        { name: 'redis', type: 'redis', host: 'redis', port: 6379 }
      ]
    });
  }

  async optimizeQuery(query: string, params: any[]): Promise<any> {
    // Check cache first
    const cacheKey = this.generateCacheKey(query, params);
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Get AI optimization suggestions
    const suggestions = await this.queryOptimizer.optimize(query, params);
    
    // Use optimized query if available
    const finalQuery = suggestions.optimizedQuery || query;
    const finalParams = suggestions.optimizedParams || params;

    // Execute query
    const result = await client.execute(finalQuery, finalParams);

    // Cache result
    await this.cacheManager.set(cacheKey, result, { ttl: 300 });

    return result;
  }

  private generateCacheKey(query: string, params: any[]): string {
    return `query:${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
  }
}
```

## Deployment Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # API Gateway
  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - user-service
      - product-service
      - order-service

  # Microservices
  user-service:
    build: ./services/user-service
    environment:
      - CASSANDRA_HOSTS=cassandra-1:9042,cassandra-2:9042
      - REDIS_URL=redis://redis:6379
    depends_on:
      - cassandra-1
      - redis

  product-service:
    build: ./services/product-service
    environment:
      - CASSANDRA_HOSTS=cassandra-1:9042,cassandra-2:9042
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    depends_on:
      - cassandra-1
      - elasticsearch

  order-service:
    build: ./services/order-service
    environment:
      - CASSANDRA_HOSTS=cassandra-1:9042,cassandra-2:9042
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - cassandra-1
      - kafka

  # Infrastructure
  cassandra-1:
    image: cassandra:4.1
    environment:
      - CASSANDRA_SEEDS=cassandra-1,cassandra-2
      - CASSANDRA_CLUSTER_NAME=ecommerce-cluster
    volumes:
      - cassandra1_data:/var/lib/cassandra

  cassandra-2:
    image: cassandra:4.1
    environment:
      - CASSANDRA_SEEDS=cassandra-1,cassandra-2
      - CASSANDRA_CLUSTER_NAME=ecommerce-cluster
    volumes:
      - cassandra2_data:/var/lib/cassandra

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092

  elasticsearch:
    image: elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

volumes:
  cassandra1_data:
  cassandra2_data:
  redis_data:
  elasticsearch_data:
```
