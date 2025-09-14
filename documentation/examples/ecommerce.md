# 🛍️ E-commerce Platform Example

Complete e-commerce platform built with CassandraORM JS showcasing all advanced features.

## 🎯 Overview

This example demonstrates:
- **Event Sourcing** for order processing
- **AI/ML** for product recommendations  
- **Real-time** notifications
- **GraphQL** API
- **Performance** monitoring
- **Distributed** transactions

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Mobile App    │    │   Admin Panel   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      GraphQL API         │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   CassandraORM JS        │
                    │   - Event Sourcing       │
                    │   - AI/ML Integration    │
                    │   - Real-time Events     │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Cassandra/ScyllaDB     │
                    └───────────────────────────┘
```

## 📦 Setup

```typescript
import { 
  createClient,
  EventStore,
  BaseAggregateRoot,
  AIMLManager,
  SubscriptionManager,
  GraphQLSchemaGenerator
} from 'cassandraorm-js';

// Initialize client
const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'ecommerce'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe'
  }
});

await client.connect();
```

## 📋 Data Models

### Core Models

```typescript
// Customer model
const Customer = await client.loadSchema('customers', {
  fields: {
    id: 'uuid',
    email: { type: 'text', unique: true },
    name: 'text',
    phone: 'text',
    address: 'map<text,text>',
    preferences: 'map<text,text>',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id']
});

// Product model with AI features
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    sku: { type: 'text', unique: true },
    name: 'text',
    description: 'text',
    price: 'decimal',
    category: 'text',
    tags: 'set<text>',
    inventory_count: 'int',
    rating: 'float',
    vector_embedding: 'list<float>',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id']
});

// Order model for read projections
const Order = await client.loadSchema('orders', {
  fields: {
    id: 'uuid',
    customer_id: 'uuid',
    items: 'list<frozen<map<text,text>>>',
    status: 'text',
    total_amount: 'decimal',
    shipping_address: 'map<text,text>',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id']
});
```

## 🔄 Event Sourcing Implementation

### Order Aggregate

```typescript
class OrderAggregate extends BaseAggregateRoot {
  private customerId: string = '';
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;
  private totalAmount: number = 0;
  private shippingAddress: Address | null = null;

  static create(
    id: string, 
    customerId: string, 
    items: OrderItem[], 
    shippingAddress: Address
  ): OrderAggregate {
    const order = new OrderAggregate(id);
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    order.addEvent('OrderCreated', {
      customerId,
      items,
      totalAmount,
      shippingAddress
    });
    
    return order;
  }

  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    
    this.addEvent('ItemAdded', { item });
  }

  removeItem(itemId: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    
    const item = this.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');
    
    this.addEvent('ItemRemoved', { itemId });
  }

  confirmPayment(paymentId: string, amount: number): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Order already processed');
    }
    
    if (amount !== this.totalAmount) {
      throw new Error('Payment amount mismatch');
    }
    
    this.addEvent('PaymentConfirmed', { paymentId, amount });
  }

  ship(trackingNumber: string, carrier: string): void {
    if (this.status !== OrderStatus.PAID) {
      throw new Error('Order not ready for shipping');
    }
    
    this.addEvent('OrderShipped', { trackingNumber, carrier });
  }

  deliver(): void {
    if (this.status !== OrderStatus.SHIPPED) {
      throw new Error('Order not shipped');
    }
    
    this.addEvent('OrderDelivered', { deliveredAt: new Date() });
  }

  cancel(reason: string): void {
    if (this.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel delivered order');
    }
    
    this.addEvent('OrderCancelled', { reason, cancelledAt: new Date() });
  }

  protected applyEvent(event: any): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.customerId = event.eventData.customerId;
        this.items = [...event.eventData.items];
        this.totalAmount = event.eventData.totalAmount;
        this.shippingAddress = event.eventData.shippingAddress;
        this.status = OrderStatus.PENDING;
        break;

      case 'ItemAdded':
        this.items.push(event.eventData.item);
        this.recalculateTotal();
        break;

      case 'ItemRemoved':
        this.items = this.items.filter(i => i.id !== event.eventData.itemId);
        this.recalculateTotal();
        break;

      case 'PaymentConfirmed':
        this.status = OrderStatus.PAID;
        break;

      case 'OrderShipped':
        this.status = OrderStatus.SHIPPED;
        break;

      case 'OrderDelivered':
        this.status = OrderStatus.DELIVERED;
        break;

      case 'OrderCancelled':
        this.status = OrderStatus.CANCELLED;
        break;
    }
  }

  private recalculateTotal(): void {
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Getters
  getCustomerId(): string { return this.customerId; }
  getItems(): OrderItem[] { return [...this.items]; }
  getStatus(): OrderStatus { return this.status; }
  getTotalAmount(): number { return this.totalAmount; }
  getShippingAddress(): Address | null { return this.shippingAddress; }
}

enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}
```

### Event Store Setup

```typescript
const eventStore = new EventStore(client.driver, 'ecommerce');
await eventStore.initialize();

const orderRepository = new AggregateRepository(
  eventStore,
  (id: string) => new OrderAggregate(id)
);
```

## 🧠 AI/ML Product Recommendations

```typescript
class ProductRecommendationService {
  private aiml: AIMLManager;

  constructor(client: CassandraClient) {
    this.aiml = new AIMLManager(client.driver, 'ecommerce');
  }

  async initialize(): Promise<void> {
    // Create vector table for product embeddings
    await this.aiml.createVectorTable('product_embeddings', {
      vectorDimension: 384,
      additionalFields: {
        product_id: 'uuid',
        name: 'text',
        category: 'text',
        price: 'decimal',
        rating: 'float',
        tags: 'set<text>'
      }
    });
  }

  async indexProduct(product: any): Promise<void> {
    // Generate embedding from product data
    const productText = `${product.name} ${product.description} ${product.category} ${product.tags?.join(' ') || ''}`;
    const embedding = await this.aiml.generateEmbedding(productText);

    // Store product with embedding
    await this.aiml.insertVector('product_embeddings', {
      id: client.uuid(),
      product_id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      rating: product.rating || 0,
      tags: product.tags || [],
      vector: embedding
    });
  }

  async getPersonalizedRecommendations(
    customerId: string, 
    limit: number = 10
  ): Promise<any[]> {
    // Get customer's order history
    const customerOrders = await this.getCustomerOrderHistory(customerId);
    
    if (customerOrders.length === 0) {
      return this.getPopularProducts(limit);
    }

    // Generate customer preference embedding
    const purchasedProducts = customerOrders.flatMap(order => 
      order.items.map(item => item.name)
    );
    
    const customerPreferences = purchasedProducts.join(' ');
    const customerEmbedding = await this.aiml.generateEmbedding(customerPreferences);

    // Find similar products
    const recommendations = await this.aiml.similaritySearch(
      'product_embeddings',
      customerEmbedding,
      {
        limit: limit * 2, // Get more to filter
        threshold: 0.6,
        filters: {
          rating: { $gte: 4.0 } // Only recommend highly rated products
        }
      }
    );

    // Filter out already purchased products
    const purchasedProductIds = new Set(
      customerOrders.flatMap(order => 
        order.items.map(item => item.productId)
      )
    );

    return recommendations
      .filter(rec => !purchasedProductIds.has(rec.product_id))
      .slice(0, limit);
  }

  async getSimilarProducts(productId: string, limit: number = 5): Promise<any[]> {
    // Get product embedding
    const productEmbedding = await this.getProductEmbedding(productId);
    if (!productEmbedding) return [];

    // Find similar products
    return await this.aiml.similaritySearch(
      'product_embeddings',
      productEmbedding.vector,
      {
        limit: limit + 1, // +1 to exclude the product itself
        threshold: 0.7,
        filters: {
          product_id: { $ne: productId } // Exclude the same product
        }
      }
    );
  }

  private async getCustomerOrderHistory(customerId: string): Promise<any[]> {
    return await Order.find({ customer_id: customerId });
  }

  private async getPopularProducts(limit: number): Promise<any[]> {
    return await Product.find(
      { rating: { $gte: 4.5 } },
      { 
        limit,
        orderBy: { rating: 'DESC' },
        allow_filtering: true 
      }
    );
  }

  private async getProductEmbedding(productId: string): Promise<any> {
    const result = await this.aiml.similaritySearch(
      'product_embeddings',
      [], // Empty vector for exact match query
      {
        limit: 1,
        filters: { product_id: productId }
      }
    );
    
    return result[0] || null;
  }
}
```

## 📡 Real-time Notifications

```typescript
class NotificationService {
  private subscriptions: SubscriptionManager;

  constructor(client: CassandraClient) {
    this.subscriptions = new SubscriptionManager(client.driver, 'ecommerce');
  }

  async initialize(): Promise<void> {
    await this.subscriptions.initialize();
    await this.setupSubscriptions();
  }

  private async setupSubscriptions(): Promise<void> {
    // Order status updates
    await this.subscriptions.subscribe(
      { table: 'orders', operation: 'update' },
      async (event) => {
        await this.handleOrderUpdate(event);
      }
    );

    // New product notifications
    await this.subscriptions.subscribe(
      { table: 'products', operation: 'insert' },
      async (event) => {
        await this.handleNewProduct(event);
      }
    );

    // Inventory alerts
    await this.subscriptions.subscribe(
      { 
        table: 'products', 
        operation: 'update',
        conditions: { inventory_count: { $lt: 10 } }
      },
      async (event) => {
        await this.handleLowInventory(event);
      }
    );
  }

  private async handleOrderUpdate(event: any): Promise<void> {
    const order = event.data;
    const customer = await Customer.findOne({ id: order.customer_id });
    
    if (!customer) return;

    // Send email notification
    await this.sendOrderStatusEmail(customer.email, order);
    
    // Send push notification
    await this.sendPushNotification(customer.id, {
      title: 'Order Update',
      message: `Your order #${order.id.slice(0, 8)} is now ${order.status}`,
      data: { orderId: order.id, status: order.status }
    });
  }

  private async handleNewProduct(event: any): Promise<void> {
    const product = event.data;
    
    // Notify customers interested in this category
    const interestedCustomers = await this.getCustomersInterestedInCategory(
      product.category
    );

    for (const customer of interestedCustomers) {
      await this.sendNewProductNotification(customer, product);
    }
  }

  private async handleLowInventory(event: any): Promise<void> {
    const product = event.data;
    
    // Alert admin
    await this.sendAdminAlert({
      type: 'LOW_INVENTORY',
      message: `Product ${product.name} has low inventory: ${product.inventory_count}`,
      productId: product.id
    });
  }

  private async sendOrderStatusEmail(email: string, order: any): Promise<void> {
    // Email service integration
    console.log(`📧 Sending order status email to ${email}`);
  }

  private async sendPushNotification(customerId: string, notification: any): Promise<void> {
    // Push notification service integration
    console.log(`📱 Sending push notification to ${customerId}:`, notification);
  }

  private async getCustomersInterestedInCategory(category: string): Promise<any[]> {
    return await Customer.find(
      { preferences: { $contains_key: 'categories' } },
      { allow_filtering: true }
    );
  }

  private async sendNewProductNotification(customer: any, product: any): Promise<void> {
    console.log(`🔔 New product notification for ${customer.email}:`, product.name);
  }

  private async sendAdminAlert(alert: any): Promise<void> {
    console.log('🚨 Admin alert:', alert);
  }
}
```

## 🌐 GraphQL API

```typescript
class EcommerceGraphQLAPI {
  private generator: GraphQLSchemaGenerator;
  private dataSource: CassandraDataSource;
  private recommendationService: ProductRecommendationService;

  constructor(client: CassandraClient) {
    this.generator = new GraphQLSchemaGenerator();
    this.dataSource = new CassandraDataSource({ client, keyspace: 'ecommerce' });
    this.recommendationService = new ProductRecommendationService(client);
  }

  generateSchema(): string {
    // Define GraphQL types
    this.generator.addModel('Customer', {
      fields: {
        id: { type: 'ID', required: true },
        email: { type: 'String', required: true },
        name: { type: 'String', required: true },
        phone: { type: 'String' },
        address: { type: 'JSON' },
        preferences: { type: 'JSON' },
        createdAt: { type: 'DateTime' }
      },
      relations: {
        orders: { type: '[Order]', resolver: 'customerOrders' }
      }
    });

    this.generator.addModel('Product', {
      fields: {
        id: { type: 'ID', required: true },
        sku: { type: 'String', required: true },
        name: { type: 'String', required: true },
        description: { type: 'String' },
        price: { type: 'Float', required: true },
        category: { type: 'String' },
        tags: { type: '[String]' },
        inventoryCount: { type: 'Int' },
        rating: { type: 'Float' }
      }
    });

    this.generator.addModel('Order', {
      fields: {
        id: { type: 'ID', required: true },
        customerId: { type: 'ID', required: true },
        items: { type: '[OrderItem]' },
        status: { type: 'OrderStatus' },
        totalAmount: { type: 'Float' },
        shippingAddress: { type: 'Address' },
        createdAt: { type: 'DateTime' }
      },
      relations: {
        customer: { type: 'Customer', resolver: 'orderCustomer' }
      }
    });

    // Add custom types
    this.generator.addCustomTypes([
      {
        name: 'OrderItem',
        fields: {
          id: 'ID',
          productId: 'ID',
          name: 'String',
          price: 'Float',
          quantity: 'Int'
        }
      },
      {
        name: 'Address',
        fields: {
          street: 'String',
          city: 'String',
          state: 'String',
          zipCode: 'String',
          country: 'String'
        }
      }
    ]);

    return this.generator.generateSchema();
  }

  getResolvers(): any {
    return {
      Query: {
        // Customer queries
        customer: async (parent: any, args: any) => {
          return await this.dataSource.findOne('customers', { id: args.id });
        },
        
        customers: async (parent: any, args: any) => {
          return await this.dataSource.findMany('customers', args.where, {
            limit: args.limit,
            offset: args.offset
          });
        },

        // Product queries
        product: async (parent: any, args: any) => {
          return await this.dataSource.findOne('products', { id: args.id });
        },
        
        products: async (parent: any, args: any) => {
          return await this.dataSource.findMany('products', args.where, {
            limit: args.limit,
            offset: args.offset
          });
        },

        // Search products
        searchProducts: async (parent: any, args: any) => {
          return await Product.find(
            { name: { $like: `%${args.query}%` } },
            { limit: args.limit || 20, allow_filtering: true }
          );
        },

        // AI-powered recommendations
        recommendedProducts: async (parent: any, args: any) => {
          return await this.recommendationService.getPersonalizedRecommendations(
            args.customerId,
            args.limit || 10
          );
        },

        similarProducts: async (parent: any, args: any) => {
          return await this.recommendationService.getSimilarProducts(
            args.productId,
            args.limit || 5
          );
        },

        // Order queries
        order: async (parent: any, args: any) => {
          return await this.dataSource.findOne('orders', { id: args.id });
        },
        
        customerOrders: async (parent: any, args: any) => {
          return await this.dataSource.findMany('orders', 
            { customer_id: args.customerId },
            { limit: args.limit }
          );
        }
      },

      Mutation: {
        // Customer mutations
        createCustomer: async (parent: any, args: any) => {
          return await this.dataSource.create('customers', {
            ...args.input,
            created_at: new Date(),
            updated_at: new Date()
          });
        },

        updateCustomer: async (parent: any, args: any) => {
          return await this.dataSource.update('customers', 
            { id: args.id }, 
            { ...args.input, updated_at: new Date() }
          );
        },

        // Product mutations
        createProduct: async (parent: any, args: any) => {
          const product = await this.dataSource.create('products', {
            ...args.input,
            created_at: new Date(),
            updated_at: new Date()
          });

          // Index product for AI recommendations
          await this.recommendationService.indexProduct(product);

          return product;
        },

        updateProduct: async (parent: any, args: any) => {
          return await this.dataSource.update('products',
            { id: args.id },
            { ...args.input, updated_at: new Date() }
          );
        },

        // Order mutations (using Event Sourcing)
        createOrder: async (parent: any, args: any) => {
          const orderId = client.uuid();
          const order = OrderAggregate.create(
            orderId,
            args.input.customerId,
            args.input.items,
            args.input.shippingAddress
          );

          await orderRepository.save(order);

          // Return order projection
          return await this.dataSource.findOne('orders', { id: orderId });
        },

        confirmPayment: async (parent: any, args: any) => {
          const order = await orderRepository.getById(args.orderId);
          if (!order) throw new Error('Order not found');

          order.confirmPayment(args.paymentId, args.amount);
          await orderRepository.save(order);

          return await this.dataSource.findOne('orders', { id: args.orderId });
        },

        shipOrder: async (parent: any, args: any) => {
          const order = await orderRepository.getById(args.orderId);
          if (!order) throw new Error('Order not found');

          order.ship(args.trackingNumber, args.carrier);
          await orderRepository.save(order);

          return await this.dataSource.findOne('orders', { id: args.orderId });
        }
      },

      // Relation resolvers
      Customer: {
        orders: async (parent: any) => {
          return await this.dataSource.findMany('orders', 
            { customer_id: parent.id }
          );
        }
      },

      Order: {
        customer: async (parent: any) => {
          return await this.dataSource.findOne('customers', 
            { id: parent.customer_id }
          );
        }
      }
    };
  }
}
```

## 📊 Performance Monitoring

```typescript
class EcommerceMonitoringService {
  private monitor: Monitor;
  private profiler: PerformanceProfiler;
  private metrics: MetricsCollector;

  constructor(client: CassandraClient) {
    this.monitor = new Monitor({
      interval: 5000,
      enableSystemMetrics: true,
      enableCassandraMetrics: true
    });

    this.profiler = new PerformanceProfiler({
      enableQueryProfiling: true,
      sampleRate: 0.1
    });

    this.metrics = new MetricsCollector({
      collectInterval: 10000,
      retentionPeriod: 86400000 // 24 hours
    });
  }

  async initialize(): Promise<void> {
    await this.monitor.start();
    await this.profiler.start();
    await this.metrics.start();

    // Setup custom metrics
    this.setupCustomMetrics();
    
    // Setup alerts
    this.setupAlerts();
  }

  private setupCustomMetrics(): void {
    // Track order metrics
    eventStore.on('eventSaved', (event) => {
      if (event.eventType === 'OrderCreated') {
        this.metrics.incrementCounter('orders.created');
        this.metrics.recordHistogram('orders.amount', event.eventData.totalAmount);
      }
      
      if (event.eventType === 'PaymentConfirmed') {
        this.metrics.incrementCounter('payments.confirmed');
      }
    });

    // Track recommendation metrics
    this.metrics.incrementCounter('recommendations.requested');
    this.metrics.recordHistogram('recommendations.response_time', 150);
  }

  private setupAlerts(): void {
    this.monitor.setAlertThresholds({
      cpuUsage: 80,
      memoryUsage: 85,
      queryTime: 1000,
      errorRate: 5
    });

    this.monitor.on('alert', (alert) => {
      console.log('🚨 Performance Alert:', alert);
      // Send to monitoring service (Datadog, New Relic, etc.)
    });
  }

  async getDashboardData(): Promise<any> {
    const systemMetrics = await this.monitor.getSystemMetrics();
    const profilingResults = await this.profiler.getResults();
    const customMetrics = await this.metrics.getMetrics();

    return {
      system: {
        cpu: systemMetrics.cpuUsage,
        memory: systemMetrics.memoryUsage,
        disk: systemMetrics.diskUsage
      },
      performance: {
        avgQueryTime: profilingResults.averageQueryTime,
        slowestQuery: profilingResults.slowestQueryTime,
        queriesProfiled: profilingResults.queriesProfiled
      },
      business: {
        ordersCreated: customMetrics.counters['orders.created'] || 0,
        paymentsConfirmed: customMetrics.counters['payments.confirmed'] || 0,
        avgOrderAmount: customMetrics.histograms['orders.amount']?.avg || 0,
        recommendationsRequested: customMetrics.counters['recommendations.requested'] || 0
      }
    };
  }
}
```

## 🚀 Complete Application

```typescript
class EcommercePlatform {
  private client: CassandraClient;
  private recommendationService: ProductRecommendationService;
  private notificationService: NotificationService;
  private graphqlAPI: EcommerceGraphQLAPI;
  private monitoringService: EcommerceMonitoringService;

  constructor() {
    this.client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'ecommerce'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    this.recommendationService = new ProductRecommendationService(this.client);
    this.notificationService = new NotificationService(this.client);
    this.graphqlAPI = new EcommerceGraphQLAPI(this.client);
    this.monitoringService = new EcommerceMonitoringService(this.client);
  }

  async initialize(): Promise<void> {
    // Connect to database
    await this.client.connect();
    console.log('✅ Connected to Cassandra');

    // Initialize services
    await this.recommendationService.initialize();
    console.log('✅ AI/ML recommendation service initialized');

    await this.notificationService.initialize();
    console.log('✅ Real-time notification service initialized');

    await this.monitoringService.initialize();
    console.log('✅ Performance monitoring initialized');

    console.log('🚀 E-commerce platform ready!');
  }

  getGraphQLSchema(): string {
    return this.graphqlAPI.generateSchema();
  }

  getGraphQLResolvers(): any {
    return this.graphqlAPI.getResolvers();
  }

  async getDashboard(): Promise<any> {
    return await this.monitoringService.getDashboardData();
  }

  async shutdown(): Promise<void> {
    await this.client.close();
    console.log('✅ E-commerce platform shutdown complete');
  }
}

// Usage
const platform = new EcommercePlatform();
await platform.initialize();

// Start GraphQL server
const { ApolloServer } = require('apollo-server-express');
const server = new ApolloServer({
  typeDefs: platform.getGraphQLSchema(),
  resolvers: platform.getGraphQLResolvers()
});

await server.start();
console.log('🌐 GraphQL API running at http://localhost:4000/graphql');
```

## 🎯 Key Features Demonstrated

- ✅ **Event Sourcing** - Complete order lifecycle with events
- ✅ **AI/ML Integration** - Product recommendations with vector search
- ✅ **Real-time Notifications** - Order updates and inventory alerts
- ✅ **GraphQL API** - Complete API with custom resolvers
- ✅ **Performance Monitoring** - System and business metrics
- ✅ **Distributed Architecture** - Scalable microservices pattern

This example shows how CassandraORM JS enables building sophisticated, production-ready applications with modern patterns and enterprise features! 🛍️✨
