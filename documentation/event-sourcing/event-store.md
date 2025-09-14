# 🔄 Event Sourcing & CQRS

CassandraORM JS provides complete Event Sourcing and CQRS (Command Query Responsibility Segregation) implementation for building scalable, auditable applications.

## 📋 Table of Contents

- [Overview](#overview)
- [Event Store](#event-store)
- [Aggregates](#aggregates)
- [Domain Events](#domain-events)
- [Repositories](#repositories)
- [Sagas](#sagas)
- [CQRS Patterns](#cqrs-patterns)
- [Real-world Examples](#real-world-examples)

## 🎯 Overview

Event Sourcing captures all changes to application state as a sequence of events. Instead of storing current state, we store the events that led to that state.

### Benefits

- **Complete Audit Trail** - Every change is recorded
- **Temporal Queries** - Query state at any point in time
- **Event Replay** - Rebuild state from events
- **Scalability** - Separate read and write models
- **Business Intelligence** - Rich event data for analytics

## 🗄️ Event Store

### Setup Event Store

```typescript
import { EventStore } from 'cassandraorm-js';

const eventStore = new EventStore(client.driver, 'myapp', {
  eventsTable: 'events',
  snapshotsTable: 'snapshots',
  snapshotFrequency: 10, // Snapshot every 10 events
  maxEventsBeforeSnapshot: 100
});

await eventStore.initialize();
```

### Event Store Schema

The Event Store automatically creates these tables:

```sql
-- Events table
CREATE TABLE events (
  aggregate_id uuid,
  version int,
  event_id uuid,
  event_type text,
  event_data text,
  metadata text,
  timestamp timestamp,
  PRIMARY KEY (aggregate_id, version)
) WITH CLUSTERING ORDER BY (version ASC);

-- Snapshots table  
CREATE TABLE snapshots (
  aggregate_id uuid,
  version int,
  snapshot_data text,
  timestamp timestamp,
  PRIMARY KEY (aggregate_id, version)
) WITH CLUSTERING ORDER BY (version DESC);

-- Event types index
CREATE INDEX ON events (event_type);
CREATE INDEX ON events (timestamp);
```

### Save Events

```typescript
import { DomainEvent } from 'cassandraorm-js';

const event: DomainEvent = {
  id: client.uuid(),
  aggregateId: userId,
  aggregateType: 'User',
  eventType: 'UserCreated',
  eventData: {
    email: 'john@example.com',
    name: 'John Doe'
  },
  eventVersion: 1,
  timestamp: new Date(),
  userId: currentUserId,
  metadata: {
    source: 'web-app',
    correlationId: 'req-123'
  }
};

await eventStore.saveEvent(event);
```

### Retrieve Events

```typescript
// Get all events for an aggregate
const events = await eventStore.getEvents(userId);

// Get events from specific version
const recentEvents = await eventStore.getEvents(userId, 5);

// Get events by type
const userCreatedEvents = await eventStore.getEventsByType('UserCreated');

// Get events in date range
const todayEvents = await eventStore.getEventsByDateRange(
  new Date('2024-01-01'),
  new Date('2024-01-02')
);
```

## 🏗️ Aggregates

### Base Aggregate Root

```typescript
import { BaseAggregateRoot, DomainEvent } from 'cassandraorm-js';

export abstract class BaseAggregateRoot {
  protected id: string;
  protected version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getVersion(): number {
    return this.version;
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  protected addEvent(eventType: string, eventData: any): void {
    const event: DomainEvent = {
      id: this.generateEventId(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType,
      eventData,
      eventVersion: this.version + 1,
      timestamp: new Date()
    };

    this.uncommittedEvents.push(event);
    this.applyEvent(event);
    this.version++;
  }

  protected abstract applyEvent(event: DomainEvent): void;

  private generateEventId(): string {
    return require('uuid').v4();
  }
}
```

### User Aggregate Example

```typescript
class UserAggregate extends BaseAggregateRoot {
  private email: string = '';
  private name: string = '';
  private isActive: boolean = false;
  private preferences: Record<string, any> = {};

  // Factory method
  static create(id: string, email: string, name: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserCreated', { email, name });
    return user;
  }

  // Business methods
  changeEmail(newEmail: string): void {
    if (newEmail === this.email) return;
    
    this.addEvent('EmailChanged', {
      oldEmail: this.email,
      newEmail: newEmail
    });
  }

  activate(): void {
    if (this.isActive) return;
    this.addEvent('UserActivated', {});
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.addEvent('UserDeactivated', {});
  }

  updatePreferences(preferences: Record<string, any>): void {
    this.addEvent('PreferencesUpdated', {
      oldPreferences: this.preferences,
      newPreferences: preferences
    });
  }

  // Event application
  protected applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.email = event.eventData.email;
        this.name = event.eventData.name;
        this.isActive = false;
        break;

      case 'EmailChanged':
        this.email = event.eventData.newEmail;
        break;

      case 'UserActivated':
        this.isActive = true;
        break;

      case 'UserDeactivated':
        this.isActive = false;
        break;

      case 'PreferencesUpdated':
        this.preferences = { ...event.eventData.newPreferences };
        break;

      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  // Getters
  getEmail(): string { return this.email; }
  getName(): string { return this.name; }
  getIsActive(): boolean { return this.isActive; }
  getPreferences(): Record<string, any> { return { ...this.preferences }; }
}
```

### Order Aggregate Example

```typescript
class OrderAggregate extends BaseAggregateRoot {
  private customerId: string = '';
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;
  private totalAmount: number = 0;

  static create(id: string, customerId: string, items: OrderItem[]): OrderAggregate {
    const order = new OrderAggregate(id);
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    order.addEvent('OrderCreated', {
      customerId,
      items,
      totalAmount
    });
    
    return order;
  }

  addItem(item: OrderItem): void {
    this.addEvent('ItemAdded', { item });
  }

  removeItem(itemId: string): void {
    const item = this.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');
    
    this.addEvent('ItemRemoved', { itemId });
  }

  confirmPayment(paymentId: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Order cannot be paid');
    }
    
    this.addEvent('PaymentConfirmed', { paymentId });
  }

  ship(trackingNumber: string): void {
    if (this.status !== OrderStatus.PAID) {
      throw new Error('Order cannot be shipped');
    }
    
    this.addEvent('OrderShipped', { trackingNumber });
  }

  complete(): void {
    if (this.status !== OrderStatus.SHIPPED) {
      throw new Error('Order cannot be completed');
    }
    
    this.addEvent('OrderCompleted', {});
  }

  cancel(reason: string): void {
    if (this.status === OrderStatus.COMPLETED) {
      throw new Error('Completed order cannot be cancelled');
    }
    
    this.addEvent('OrderCancelled', { reason });
  }

  protected applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.customerId = event.eventData.customerId;
        this.items = [...event.eventData.items];
        this.totalAmount = event.eventData.totalAmount;
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

      case 'OrderCompleted':
        this.status = OrderStatus.COMPLETED;
        break;

      case 'OrderCancelled':
        this.status = OrderStatus.CANCELLED;
        break;
    }
  }

  private recalculateTotal(): void {
    this.totalAmount = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}
```

## 📦 Repositories

### Aggregate Repository

```typescript
import { AggregateRepository } from 'cassandraorm-js';

const userRepository = new AggregateRepository<UserAggregate>(
  eventStore,
  (id: string) => new UserAggregate(id)
);

// Save aggregate
const user = UserAggregate.create(
  client.uuid(),
  'john@example.com',
  'John Doe'
);

user.changeEmail('john.doe@example.com');
user.activate();

await userRepository.save(user);

// Load aggregate
const loadedUser = await userRepository.getById(user.getId(), UserAggregate);
console.log('User email:', loadedUser.getEmail());
console.log('User active:', loadedUser.getIsActive());
```

### Repository with Snapshots

```typescript
class UserRepository extends AggregateRepository<UserAggregate> {
  constructor(eventStore: EventStore) {
    super(eventStore, (id: string) => new UserAggregate(id));
  }

  async getById(id: string): Promise<UserAggregate | null> {
    // Try to load from snapshot first
    const snapshot = await this.eventStore.getSnapshot(id);
    let aggregate: UserAggregate;
    let fromVersion = 0;

    if (snapshot) {
      aggregate = this.createFromSnapshot(id, snapshot);
      fromVersion = snapshot.version;
    } else {
      aggregate = new UserAggregate(id);
    }

    // Load events after snapshot
    const events = await this.eventStore.getEvents(id, fromVersion);
    
    for (const event of events) {
      aggregate.applyEvent(event);
    }

    return aggregate;
  }

  private createFromSnapshot(id: string, snapshot: any): UserAggregate {
    const aggregate = new UserAggregate(id);
    // Restore state from snapshot
    Object.assign(aggregate, snapshot.data);
    return aggregate;
  }
}
```

## 🔄 Sagas

### Saga Manager

```typescript
import { SagaManager, SagaDefinition } from 'cassandraorm-js';

const sagaManager = new SagaManager(eventStore);

// Define order processing saga
const orderProcessingSaga: SagaDefinition = {
  sagaType: 'OrderProcessing',
  handle: async (event: DomainEvent) => {
    const resultEvents: DomainEvent[] = [];

    switch (event.eventType) {
      case 'OrderCreated':
        // Start payment process
        resultEvents.push({
          id: client.uuid(),
          aggregateId: event.aggregateId,
          aggregateType: 'Payment',
          eventType: 'PaymentRequested',
          eventData: {
            orderId: event.aggregateId,
            amount: event.eventData.totalAmount
          },
          eventVersion: 1,
          timestamp: new Date()
        });
        break;

      case 'PaymentConfirmed':
        // Reserve inventory
        resultEvents.push({
          id: client.uuid(),
          aggregateId: client.uuid(),
          aggregateType: 'Inventory',
          eventType: 'InventoryReserved',
          eventData: {
            orderId: event.aggregateId,
            items: event.eventData.items
          },
          eventVersion: 1,
          timestamp: new Date()
        });
        break;

      case 'InventoryReserved':
        // Create shipment
        resultEvents.push({
          id: client.uuid(),
          aggregateId: client.uuid(),
          aggregateType: 'Shipment',
          eventType: 'ShipmentCreated',
          eventData: {
            orderId: event.eventData.orderId
          },
          eventVersion: 1,
          timestamp: new Date()
        });
        break;
    }

    return resultEvents;
  }
};

sagaManager.registerSaga(orderProcessingSaga);

// Process events through sagas
eventStore.on('eventSaved', async (event) => {
  await sagaManager.handle(event);
});
```

### Complex Saga with Compensation

```typescript
const userRegistrationSaga: SagaDefinition = {
  sagaType: 'UserRegistration',
  handle: async (event: DomainEvent) => {
    const resultEvents: DomainEvent[] = [];

    switch (event.eventType) {
      case 'UserCreated':
        // Send welcome email
        try {
          await emailService.sendWelcomeEmail(event.eventData.email);
          resultEvents.push({
            id: client.uuid(),
            aggregateId: event.aggregateId,
            aggregateType: 'User',
            eventType: 'WelcomeEmailSent',
            eventData: { email: event.eventData.email },
            eventVersion: event.eventVersion + 1,
            timestamp: new Date()
          });
        } catch (error) {
          // Compensation: mark email as failed
          resultEvents.push({
            id: client.uuid(),
            aggregateId: event.aggregateId,
            aggregateType: 'User',
            eventType: 'WelcomeEmailFailed',
            eventData: { 
              email: event.eventData.email,
              error: error.message 
            },
            eventVersion: event.eventVersion + 1,
            timestamp: new Date()
          });
        }
        break;

      case 'WelcomeEmailFailed':
        // Retry logic or alternative action
        resultEvents.push({
          id: client.uuid(),
          aggregateId: event.aggregateId,
          aggregateType: 'User',
          eventType: 'EmailRetryScheduled',
          eventData: { 
            email: event.eventData.email,
            retryAt: new Date(Date.now() + 300000) // 5 minutes
          },
          eventVersion: event.eventVersion + 1,
          timestamp: new Date()
        });
        break;
    }

    return resultEvents;
  }
};
```

## 📖 CQRS Patterns

### Read Models (Projections)

```typescript
// User read model
interface UserReadModel {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  totalOrders: number;
  totalSpent: number;
}

class UserProjectionHandler {
  constructor(private client: CassandraClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'UserCreated':
        await this.createUserProjection(event);
        break;
      case 'EmailChanged':
        await this.updateUserEmail(event);
        break;
      case 'UserActivated':
      case 'UserDeactivated':
        await this.updateUserStatus(event);
        break;
    }
  }

  private async createUserProjection(event: DomainEvent): Promise<void> {
    const UserReadModel = await this.client.loadSchema('user_read_model', {
      fields: {
        id: 'uuid',
        email: 'text',
        name: 'text',
        is_active: 'boolean',
        created_at: 'timestamp',
        last_login_at: 'timestamp',
        total_orders: 'int',
        total_spent: 'decimal'
      },
      key: ['id']
    });

    await UserReadModel.create({
      id: event.aggregateId,
      email: event.eventData.email,
      name: event.eventData.name,
      is_active: false,
      created_at: event.timestamp,
      total_orders: 0,
      total_spent: 0
    });
  }

  private async updateUserEmail(event: DomainEvent): Promise<void> {
    await UserReadModel.update(
      { id: event.aggregateId },
      { email: event.eventData.newEmail }
    );
  }

  private async updateUserStatus(event: DomainEvent): Promise<void> {
    const isActive = event.eventType === 'UserActivated';
    await UserReadModel.update(
      { id: event.aggregateId },
      { is_active: isActive }
    );
  }
}
```

### Query Handlers

```typescript
class UserQueryHandler {
  constructor(private client: CassandraClient) {}

  async getUserById(id: string): Promise<UserReadModel | null> {
    const UserReadModel = await this.client.loadSchema('user_read_model', {/* schema */});
    return await UserReadModel.findOne({ id });
  }

  async getActiveUsers(limit: number = 50): Promise<UserReadModel[]> {
    const UserReadModel = await this.client.loadSchema('user_read_model', {/* schema */});
    return await UserReadModel.find(
      { is_active: true },
      { limit, allow_filtering: true }
    );
  }

  async getUsersByEmailDomain(domain: string): Promise<UserReadModel[]> {
    const UserReadModel = await this.client.loadSchema('user_read_model', {/* schema */});
    // Note: This would require a custom index or different modeling
    return await UserReadModel.find(
      { email: { $like: `%@${domain}` } },
      { allow_filtering: true }
    );
  }

  async getUserStatistics(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        AVG(total_orders) as avg_orders,
        AVG(total_spent) as avg_spent
      FROM user_read_model
    `;
    
    const result = await this.client.execute(query);
    return result.rows[0];
  }
}
```

### Command Handlers

```typescript
interface CreateUserCommand {
  id: string;
  email: string;
  name: string;
}

interface ChangeEmailCommand {
  userId: string;
  newEmail: string;
}

class UserCommandHandler {
  constructor(
    private userRepository: AggregateRepository<UserAggregate>
  ) {}

  async createUser(command: CreateUserCommand): Promise<void> {
    // Validate command
    if (!command.email || !command.name) {
      throw new Error('Email and name are required');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.getById(command.id);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create aggregate
    const user = UserAggregate.create(command.id, command.email, command.name);
    
    // Save aggregate
    await this.userRepository.save(user);
  }

  async changeEmail(command: ChangeEmailCommand): Promise<void> {
    // Load aggregate
    const user = await this.userRepository.getById(command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Execute business logic
    user.changeEmail(command.newEmail);

    // Save aggregate
    await this.userRepository.save(user);
  }
}
```

## 🛍️ Real-world Example: E-commerce Order System

```typescript
// Complete order processing system
class OrderProcessingSystem {
  private eventStore: EventStore;
  private orderRepository: AggregateRepository<OrderAggregate>;
  private sagaManager: SagaManager;
  private projectionHandler: OrderProjectionHandler;

  constructor(client: CassandraClient) {
    this.eventStore = new EventStore(client.driver, 'ecommerce');
    this.orderRepository = new AggregateRepository(
      this.eventStore,
      (id: string) => new OrderAggregate(id)
    );
    this.sagaManager = new SagaManager(this.eventStore);
    this.projectionHandler = new OrderProjectionHandler(client);

    this.setupSagas();
    this.setupEventHandlers();
  }

  private setupSagas(): void {
    // Order fulfillment saga
    this.sagaManager.registerSaga({
      sagaType: 'OrderFulfillment',
      handle: async (event: DomainEvent) => {
        switch (event.eventType) {
          case 'OrderCreated':
            return [
              this.createPaymentRequestEvent(event),
              this.createInventoryCheckEvent(event)
            ];
          
          case 'PaymentConfirmed':
            return [this.createShipmentEvent(event)];
          
          case 'OrderShipped':
            return [this.createNotificationEvent(event)];
        }
        return [];
      }
    });
  }

  private setupEventHandlers(): void {
    this.eventStore.on('eventSaved', async (event) => {
      // Process through sagas
      await this.sagaManager.handle(event);
      
      // Update projections
      await this.projectionHandler.handle(event);
    });
  }

  // Command handlers
  async createOrder(customerId: string, items: OrderItem[]): Promise<string> {
    const orderId = client.uuid();
    const order = OrderAggregate.create(orderId, customerId, items);
    await this.orderRepository.save(order);
    return orderId;
  }

  async confirmPayment(orderId: string, paymentId: string): Promise<void> {
    const order = await this.orderRepository.getById(orderId);
    if (!order) throw new Error('Order not found');
    
    order.confirmPayment(paymentId);
    await this.orderRepository.save(order);
  }

  async shipOrder(orderId: string, trackingNumber: string): Promise<void> {
    const order = await this.orderRepository.getById(orderId);
    if (!order) throw new Error('Order not found');
    
    order.ship(trackingNumber);
    await this.orderRepository.save(order);
  }

  // Query handlers
  async getOrderHistory(customerId: string): Promise<any[]> {
    const OrderReadModel = await this.client.loadSchema('order_read_model', {/* schema */});
    return await OrderReadModel.find({ customer_id: customerId });
  }

  async getOrderById(orderId: string): Promise<any> {
    const OrderReadModel = await this.client.loadSchema('order_read_model', {/* schema */});
    return await OrderReadModel.findOne({ id: orderId });
  }

  private createPaymentRequestEvent(event: DomainEvent): DomainEvent {
    return {
      id: client.uuid(),
      aggregateId: client.uuid(),
      aggregateType: 'Payment',
      eventType: 'PaymentRequested',
      eventData: {
        orderId: event.aggregateId,
        customerId: event.eventData.customerId,
        amount: event.eventData.totalAmount
      },
      eventVersion: 1,
      timestamp: new Date()
    };
  }
}
```

## 🔧 Best Practices

### Event Design

```typescript
// Good: Specific, immutable events
interface UserEmailChangedEvent {
  eventType: 'UserEmailChanged';
  eventData: {
    userId: string;
    oldEmail: string;
    newEmail: string;
    changedBy: string;
    reason?: string;
  };
}

// Bad: Generic, mutable events
interface UserUpdatedEvent {
  eventType: 'UserUpdated';
  eventData: {
    userId: string;
    changes: Record<string, any>; // Too generic
  };
}
```

### Versioning Events

```typescript
// Event versioning for backward compatibility
interface UserCreatedEventV1 {
  eventType: 'UserCreated';
  version: 1;
  eventData: {
    email: string;
    name: string;
  };
}

interface UserCreatedEventV2 {
  eventType: 'UserCreated';
  version: 2;
  eventData: {
    email: string;
    firstName: string;
    lastName: string;
    preferences: Record<string, any>;
  };
}

// Handle multiple versions in aggregate
protected applyEvent(event: DomainEvent): void {
  switch (event.eventType) {
    case 'UserCreated':
      if (event.version === 1) {
        this.applyUserCreatedV1(event);
      } else {
        this.applyUserCreatedV2(event);
      }
      break;
  }
}
```

## 📊 Performance Considerations

### Snapshot Strategy

```typescript
// Automatic snapshots
const eventStore = new EventStore(client.driver, 'myapp', {
  snapshotFrequency: 10, // Every 10 events
  maxEventsBeforeSnapshot: 100,
  enableAsyncSnapshots: true
});

// Manual snapshots for critical aggregates
await eventStore.saveSnapshot(aggregateId, aggregate.getVersion(), {
  email: aggregate.getEmail(),
  name: aggregate.getName(),
  isActive: aggregate.getIsActive()
});
```

### Event Indexing

```typescript
// Create indexes for common queries
await client.execute(`
  CREATE INDEX ON events (event_type);
  CREATE INDEX ON events (timestamp);
  CREATE INDEX ON events (aggregate_type);
`);

// Materialized view for event statistics
await client.execute(`
  CREATE MATERIALIZED VIEW events_by_type AS
  SELECT event_type, COUNT(*) as count
  FROM events
  WHERE event_type IS NOT NULL
  PRIMARY KEY (event_type);
`);
```

## 🔗 Next Steps

- **[Aggregates →](./aggregates.md)** - Deep dive into aggregate design
- **[Domain Events →](./domain-events.md)** - Event design patterns
- **[Sagas →](./sagas.md)** - Complex workflow orchestration
- **[CQRS Patterns →](./cqrs-patterns.md)** - Command Query separation
- **[Examples →](../examples/event-sourcing-ecommerce.md)** - Complete examples

---

**Event Sourcing with CassandraORM JS provides a solid foundation for building scalable, auditable applications! 🔄✨**
