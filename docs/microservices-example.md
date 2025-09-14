# Microservices Example

## Overview
Complete microservices architecture example with service discovery, API gateway, event-driven communication, and distributed data management.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile App     │    │  Admin Panel    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │     API Gateway         │
                    │   (Load Balancer)       │
                    └─────────────┬───────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────┴────────┐    ┌─────────┴────────┐    ┌─────────┴────────┐
│  User Service  │    │ Product Service  │    │  Order Service   │
│   (Port 3001)  │    │   (Port 3002)    │    │   (Port 3003)    │
└───────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
        │                       │                        │
        └───────────────────────┼────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Message Queue     │
                    │     (Kafka)         │
                    └─────────────────────┘
```

## Service Discovery

```typescript
// shared/service-discovery/ServiceRegistry.ts
import { ServiceRegistry } from 'cassandraorm-js';

export class MicroserviceRegistry {
  private registry: ServiceRegistry;

  constructor(client: any) {
    this.registry = new ServiceRegistry(client, {
      registryTable: 'service_registry',
      healthCheckInterval: 30000,
      ttl: 60000
    });
  }

  async registerService(serviceInfo: {
    name: string;
    version: string;
    host: string;
    port: number;
    healthEndpoint: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.registry.register(serviceInfo.name, {
      id: `${serviceInfo.name}-${process.env.HOSTNAME || 'local'}`,
      host: serviceInfo.host,
      port: serviceInfo.port,
      version: serviceInfo.version,
      metadata: {
        ...serviceInfo.metadata,
        healthEndpoint: serviceInfo.healthEndpoint,
        startTime: new Date().toISOString()
      },
      healthCheck: {
        endpoint: serviceInfo.healthEndpoint,
        interval: 30000
      }
    });

    console.log(`Service ${serviceInfo.name} registered successfully`);
  }

  async discoverService(serviceName: string): Promise<any> {
    const services = await this.registry.discover(serviceName);
    const healthyServices = services.filter(s => s.status === 'healthy');
    
    if (healthyServices.length === 0) {
      throw new Error(`No healthy instances of ${serviceName} found`);
    }

    // Simple round-robin load balancing
    const randomIndex = Math.floor(Math.random() * healthyServices.length);
    return healthyServices[randomIndex];
  }

  async getAllServices(): Promise<any[]> {
    return await this.registry.getAll();
  }
}
```

## API Gateway

```typescript
// gateway/src/Gateway.ts
import express from 'express';
import httpProxy from 'http-proxy-middleware';
import { MicroserviceRegistry } from '../shared/service-discovery/ServiceRegistry';
import { RateLimiter } from './middleware/RateLimiter';
import { AuthMiddleware } from './middleware/AuthMiddleware';

export class APIGateway {
  private app: express.Application;
  private serviceRegistry: MicroserviceRegistry;
  private rateLimiter: RateLimiter;
  private authMiddleware: AuthMiddleware;

  constructor() {
    this.app = express();
    this.serviceRegistry = new MicroserviceRegistry(client);
    this.rateLimiter = new RateLimiter();
    this.authMiddleware = new AuthMiddleware();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(this.rateLimiter.middleware());
    this.app.use('/api', this.authMiddleware.middleware());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Service discovery endpoint
    this.app.get('/services', async (req, res) => {
      try {
        const services = await this.serviceRegistry.getAllServices();
        res.json(services);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Dynamic service routing
    this.app.use('/api/:service/*', this.createServiceProxy());
  }

  private createServiceProxy() {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const serviceName = req.params.service;
        const service = await this.serviceRegistry.discoverService(serviceName);
        
        const proxy = httpProxy.createProxyMiddleware({
          target: `http://${service.host}:${service.port}`,
          changeOrigin: true,
          pathRewrite: {
            [`^/api/${serviceName}`]: ''
          },
          onError: (err, req, res) => {
            console.error(`Proxy error for ${serviceName}:`, err);
            res.status(503).json({ 
              error: 'Service temporarily unavailable',
              service: serviceName 
            });
          },
          onProxyReq: (proxyReq, req, res) => {
            // Add correlation ID for tracing
            proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] || this.generateCorrelationId());
            // Forward user context
            if (req.user) {
              proxyReq.setHeader('X-User-Context', JSON.stringify(req.user));
            }
          }
        });

        proxy(req, res, next);
      } catch (error) {
        res.status(503).json({ 
          error: 'Service discovery failed',
          message: error.message 
        });
      }
    };
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  start(port: number = 3000): void {
    this.app.listen(port, () => {
      console.log(`API Gateway running on port ${port}`);
    });
  }
}
```

## User Service

```typescript
// services/user-service/src/UserService.ts
import express from 'express';
import { createClient } from 'cassandraorm-js';
import { MicroserviceRegistry } from '../../../shared/service-discovery/ServiceRegistry';
import { EventBus } from './events/EventBus';

export class UserService {
  private app: express.Application;
  private client: any;
  private serviceRegistry: MicroserviceRegistry;
  private eventBus: EventBus;

  constructor() {
    this.app = express();
    this.client = createClient({
      clientOptions: {
        contactPoints: process.env.CASSANDRA_HOSTS?.split(',') || ['localhost:9042'],
        localDataCenter: 'datacenter1',
        keyspace: 'user_service'
      },
      ormOptions: {
        createKeyspace: true
      }
    });
    
    this.serviceRegistry = new MicroserviceRegistry(this.client);
    this.eventBus = new EventBus();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupModels();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      // Extract user context from gateway
      const userContext = req.headers['x-user-context'];
      if (userContext) {
        req.user = JSON.parse(userContext as string);
      }
      next();
    });
  }

  private async setupModels(): Promise<void> {
    await this.client.connect();

    // User model
    this.User = await this.client.loadSchema('users', {
      fields: {
        id: 'uuid',
        email: 'text',
        name: 'text',
        password_hash: 'text',
        profile: 'frozen<user_profile>',
        preferences: 'map<text, text>',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['email'],
      validate: {
        email: { required: true, isEmail: true, unique: true },
        name: { required: true, minLength: 2 }
      }
    });

    // User profile UDT
    await this.client.execute(`
      CREATE TYPE IF NOT EXISTS user_profile (
        bio text,
        avatar_url text,
        phone text,
        address frozen<address_type>
      )
    `);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        service: 'user-service',
        timestamp: new Date().toISOString() 
      });
    });

    // User CRUD operations
    this.app.post('/users', this.createUser.bind(this));
    this.app.get('/users/:id', this.getUser.bind(this));
    this.app.put('/users/:id', this.updateUser.bind(this));
    this.app.delete('/users/:id', this.deleteUser.bind(this));
    this.app.get('/users', this.listUsers.bind(this));

    // User-specific operations
    this.app.post('/users/:id/profile', this.updateProfile.bind(this));
    this.app.get('/users/:id/preferences', this.getPreferences.bind(this));
    this.app.put('/users/:id/preferences', this.updatePreferences.bind(this));
  }

  private async createUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, name, password } = req.body;
      const userId = uuid();
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await this.User.create({
        id: userId,
        email,
        name,
        password_hash: passwordHash,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Publish user created event
      await this.eventBus.publish('user.created', {
        userId: user.id,
        email: user.email,
        name: user.name,
        timestamp: new Date()
      });

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  private async getUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.User.findOne({ id });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          profile: user.profile,
          created_at: user.created_at
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async start(port: number = 3001): Promise<void> {
    await this.client.connect();
    
    // Register service
    await this.serviceRegistry.registerService({
      name: 'user-service',
      version: '1.0.0',
      host: process.env.SERVICE_HOST || 'localhost',
      port,
      healthEndpoint: '/health',
      metadata: {
        description: 'User management service',
        capabilities: ['user-crud', 'authentication', 'profiles']
      }
    });

    this.app.listen(port, () => {
      console.log(`User Service running on port ${port}`);
    });
  }
}
```

## Product Service

```typescript
// services/product-service/src/ProductService.ts
export class ProductService {
  private app: express.Application;
  private client: any;
  private searchManager: SearchManager;
  private aimlManager: AIMLManager;

  constructor() {
    this.app = express();
    this.client = createClient({
      clientOptions: {
        contactPoints: process.env.CASSANDRA_HOSTS?.split(',') || ['localhost:9042'],
        localDataCenter: 'datacenter1',
        keyspace: 'product_service'
      }
    });
    
    this.searchManager = new SearchManager(this.client);
    this.aimlManager = new AIMLManager(this.client.driver, 'product_service');
    
    this.setupRoutes();
    this.setupModels();
  }

  private async setupModels(): Promise<void> {
    await this.client.connect();

    // Product model
    this.Product = await this.client.loadSchema('products', {
      fields: {
        id: 'uuid',
        name: 'text',
        description: 'text',
        category: 'text',
        brand: 'text',
        price: 'decimal',
        currency: 'text',
        inventory_count: 'int',
        attributes: 'map<text, text>',
        tags: 'set<text>',
        images: 'list<text>',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['category', 'brand'],
      validate: {
        name: { required: true, minLength: 3 },
        price: { required: true, min: 0 },
        category: { required: true }
      }
    });

    // Setup search index
    await this.searchManager.createIndex('products_search', {
      table: 'products',
      fields: {
        name: { boost: 2.0, analyzer: 'standard' },
        description: { analyzer: 'standard' },
        category: { analyzer: 'keyword' },
        brand: { analyzer: 'keyword' }
      }
    });

    // Setup AI/ML for recommendations
    await this.aimlManager.createVectorTable('product_embeddings', {
      product_id: 'uuid',
      embedding: 'vector<float, 1536>',
      metadata: 'map<text, text>'
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'product-service' });
    });

    // Product CRUD
    this.app.post('/products', this.createProduct.bind(this));
    this.app.get('/products/:id', this.getProduct.bind(this));
    this.app.put('/products/:id', this.updateProduct.bind(this));
    this.app.delete('/products/:id', this.deleteProduct.bind(this));
    this.app.get('/products', this.listProducts.bind(this));

    // Search and recommendations
    this.app.get('/products/search', this.searchProducts.bind(this));
    this.app.get('/products/:id/recommendations', this.getRecommendations.bind(this));
    this.app.get('/categories/:category/products', this.getProductsByCategory.bind(this));
  }

  private async searchProducts(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { q, category, brand, minPrice, maxPrice, limit = 20 } = req.query;
      
      const searchQuery: any = {};
      
      if (q) {
        searchQuery.query = {
          multi_match: {
            query: q as string,
            fields: ['name^2', 'description', 'category', 'brand']
          }
        };
      }

      const filters = [];
      if (category) filters.push({ term: { category } });
      if (brand) filters.push({ term: { brand } });
      if (minPrice || maxPrice) {
        const priceFilter: any = {};
        if (minPrice) priceFilter.gte = parseFloat(minPrice as string);
        if (maxPrice) priceFilter.lte = parseFloat(maxPrice as string);
        filters.push({ range: { price: priceFilter } });
      }

      if (filters.length > 0) {
        searchQuery.filter = filters;
      }

      const results = await this.searchManager.search('products_search', {
        ...searchQuery,
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: results.hits,
        total: results.total,
        facets: results.facets
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  private async getRecommendations(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 10 } = req.query;

      const product = await this.Product.findOne({ id });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Generate embedding for the product
      const text = `${product.name} ${product.description} ${product.category}`;
      const embedding = await this.aimlManager.generateEmbedding(text);

      // Find similar products
      const similar = await this.aimlManager.similaritySearch('product_embeddings', embedding, {
        limit: parseInt(limit as string) + 1, // +1 to exclude self
        threshold: 0.7
      });

      // Filter out the original product
      const recommendations = similar.filter(p => p.product_id !== id);

      res.json({
        success: true,
        data: recommendations.slice(0, parseInt(limit as string))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
```

## Event-Driven Communication

```typescript
// shared/events/EventBus.ts
import { EventBus as CassandraEventBus } from 'cassandraorm-js';

export class EventBus {
  private eventBus: CassandraEventBus;

  constructor() {
    this.eventBus = new CassandraEventBus({
      transport: 'kafka',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      groupId: process.env.SERVICE_NAME || 'default-service'
    });
  }

  async publish(topic: string, event: any): Promise<void> {
    await this.eventBus.publish(topic, {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date(),
      source: process.env.SERVICE_NAME
    });
  }

  async subscribe(topic: string, handler: (event: any) => Promise<void>): Promise<void> {
    await this.eventBus.subscribe(topic, async (event) => {
      try {
        console.log(`Processing event ${event.eventId} from ${event.source}`);
        await handler(event);
      } catch (error) {
        console.error(`Error processing event ${event.eventId}:`, error);
        // Could implement dead letter queue here
      }
    });
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Order Service with Saga

```typescript
// services/order-service/src/OrderService.ts
export class OrderService {
  private sagaOrchestrator: SagaOrchestrator;
  private eventBus: EventBus;

  constructor() {
    // ... setup code ...
    this.sagaOrchestrator = new SagaOrchestrator(this.client);
    this.eventBus = new EventBus();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for user events
    this.eventBus.subscribe('user.created', this.handleUserCreated.bind(this));
    
    // Listen for product events
    this.eventBus.subscribe('product.updated', this.handleProductUpdated.bind(this));
  }

  private async handleUserCreated(event: any): Promise<void> {
    // Create user profile in order service
    await this.UserProfile.create({
      user_id: event.userId,
      email: event.email,
      order_count: 0,
      total_spent: 0,
      created_at: new Date()
    });
  }

  private async createOrder(req: express.Request, res: express.Response): Promise<void> {
    try {
      const orderData = req.body;
      
      // Start order processing saga
      const sagaId = await this.sagaOrchestrator.startSaga('order_processing', orderData);
      
      res.status(202).json({
        success: true,
        message: 'Order processing started',
        sagaId,
        orderId: orderData.orderId
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}
```

## Docker Compose Configuration

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
      - CASSANDRA_HOSTS=cassandra:9042
    depends_on:
      - cassandra
      - user-service
      - product-service
      - order-service

  # Microservices
  user-service:
    build: ./services/user-service
    ports:
      - "3001:3001"
    environment:
      - SERVICE_NAME=user-service
      - SERVICE_HOST=user-service
      - CASSANDRA_HOSTS=cassandra:9042
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - cassandra
      - kafka

  product-service:
    build: ./services/product-service
    ports:
      - "3002:3002"
    environment:
      - SERVICE_NAME=product-service
      - SERVICE_HOST=product-service
      - CASSANDRA_HOSTS=cassandra:9042
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    depends_on:
      - cassandra
      - elasticsearch

  order-service:
    build: ./services/order-service
    ports:
      - "3003:3003"
    environment:
      - SERVICE_NAME=order-service
      - SERVICE_HOST=order-service
      - CASSANDRA_HOSTS=cassandra:9042
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - cassandra
      - kafka

  # Infrastructure
  cassandra:
    image: cassandra:4.1
    ports:
      - "9042:9042"
    environment:
      - CASSANDRA_CLUSTER_NAME=microservices-cluster
    volumes:
      - cassandra_data:/var/lib/cassandra

  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  elasticsearch:
    image: elasticsearch:8.5.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

volumes:
  cassandra_data:
```
