# CQRS Implementation

## Overview
Complete Command Query Responsibility Segregation (CQRS) implementation with separate read/write models, event sourcing integration, and eventual consistency.

## CQRS Architecture Setup

```typescript
import { CQRSManager } from 'cassandraorm-js';

const cqrsManager = new CQRSManager(client, {
  commandStore: 'commands',
  eventStore: 'events',
  readModels: ['user_read_model', 'order_read_model'],
  eventBus: 'kafka'
});

await cqrsManager.initialize();
```

## Command Side Implementation

```typescript
// Command definitions
interface CreateUserCommand {
  type: 'CreateUser';
  userId: string;
  email: string;
  name: string;
}

interface UpdateUserEmailCommand {
  type: 'UpdateUserEmail';
  userId: string;
  newEmail: string;
}

// Command handler
import { CommandHandler } from 'cassandraorm-js';

class UserCommandHandler extends CommandHandler {
  constructor(
    private userRepository: UserRepository,
    private eventBus: EventBus
  ) {
    super();
  }

  async handle(command: CreateUserCommand | UpdateUserEmailCommand): Promise<void> {
    switch (command.type) {
      case 'CreateUser':
        await this.handleCreateUser(command);
        break;
      case 'UpdateUserEmail':
        await this.handleUpdateUserEmail(command);
        break;
    }
  }

  private async handleCreateUser(command: CreateUserCommand): Promise<void> {
    // Validate command
    if (await this.userRepository.existsByEmail(command.email)) {
      throw new Error('User with this email already exists');
    }

    // Create aggregate
    const user = UserAggregate.create(command.userId, command.email, command.name);
    
    // Save to command store
    await this.userRepository.save(user);
    
    // Publish events
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish('user.events', event);
    }
    
    user.markEventsAsCommitted();
  }

  private async handleUpdateUserEmail(command: UpdateUserEmailCommand): Promise<void> {
    const user = await this.userRepository.getById(command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.changeEmail(command.newEmail);
    await this.userRepository.save(user);
    
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish('user.events', event);
    }
  }
}
```

## Query Side Implementation

```typescript
// Read model
interface UserReadModel {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  status: string;
  profile_complete: boolean;
}

// Query handler
import { QueryHandler } from 'cassandraorm-js';

class UserQueryHandler extends QueryHandler {
  constructor(private readModelStore: ReadModelStore) {
    super();
  }

  async getUserById(id: string): Promise<UserReadModel | null> {
    return await this.readModelStore.findOne('user_read_model', { id });
  }

  async getUsersByStatus(status: string): Promise<UserReadModel[]> {
    return await this.readModelStore.find('user_read_model', { status });
  }

  async searchUsers(query: string): Promise<UserReadModel[]> {
    return await this.readModelStore.search('user_read_model', {
      fields: ['name', 'email'],
      query,
      limit: 50
    });
  }

  async getUserStatistics(): Promise<any> {
    return await this.readModelStore.aggregate('user_read_model', [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
  }
}
```

## Event Projections

```typescript
import { ProjectionHandler } from 'cassandraorm-js';

class UserProjectionHandler extends ProjectionHandler {
  constructor(private readModelStore: ReadModelStore) {
    super();
  }

  async handle(event: any): Promise<void> {
    switch (event.type) {
      case 'UserCreated':
        await this.handleUserCreated(event);
        break;
      case 'UserEmailChanged':
        await this.handleUserEmailChanged(event);
        break;
      case 'UserDeactivated':
        await this.handleUserDeactivated(event);
        break;
    }
  }

  private async handleUserCreated(event: any): Promise<void> {
    const readModel: UserReadModel = {
      id: event.data.userId,
      email: event.data.email,
      name: event.data.name,
      created_at: event.metadata.timestamp,
      updated_at: event.metadata.timestamp,
      status: 'active',
      profile_complete: false
    };

    await this.readModelStore.insert('user_read_model', readModel);
  }

  private async handleUserEmailChanged(event: any): Promise<void> {
    await this.readModelStore.update('user_read_model', 
      { id: event.data.userId },
      { 
        email: event.data.newEmail,
        updated_at: event.metadata.timestamp
      }
    );
  }

  private async handleUserDeactivated(event: any): Promise<void> {
    await this.readModelStore.update('user_read_model',
      { id: event.data.userId },
      { 
        status: 'inactive',
        updated_at: event.metadata.timestamp
      }
    );
  }
}
```

## Command Bus

```typescript
import { CommandBus } from 'cassandraorm-js';

const commandBus = new CommandBus({
  handlers: {
    'CreateUser': new UserCommandHandler(userRepository, eventBus),
    'UpdateUserEmail': new UserCommandHandler(userRepository, eventBus),
    'CreateOrder': new OrderCommandHandler(orderRepository, eventBus)
  },
  middleware: [
    new ValidationMiddleware(),
    new AuthorizationMiddleware(),
    new AuditMiddleware()
  ]
});

// Execute command
await commandBus.execute({
  type: 'CreateUser',
  userId: uuid(),
  email: 'john@example.com',
  name: 'John Doe'
});
```

## Query Bus

```typescript
import { QueryBus } from 'cassandraorm-js';

const queryBus = new QueryBus({
  handlers: {
    'GetUserById': new UserQueryHandler(readModelStore),
    'SearchUsers': new UserQueryHandler(readModelStore),
    'GetOrdersByUser': new OrderQueryHandler(readModelStore)
  },
  caching: {
    enabled: true,
    ttl: 300,
    keyGenerator: (query) => `query:${query.type}:${JSON.stringify(query.params)}`
  }
});

// Execute query
const user = await queryBus.execute({
  type: 'GetUserById',
  params: { id: userId }
});
```

## Read Model Synchronization

```typescript
import { ReadModelSynchronizer } from 'cassandraorm-js';

const synchronizer = new ReadModelSynchronizer(cqrsManager, {
  eventStore: eventStore,
  projectionHandlers: [
    new UserProjectionHandler(readModelStore),
    new OrderProjectionHandler(readModelStore)
  ],
  checkpointStore: 'projection_checkpoints'
});

// Start synchronization
await synchronizer.start();

// Handle projection failures
synchronizer.on('projectionError', async (error, event) => {
  console.error('Projection failed:', error);
  
  // Retry or send to dead letter queue
  await deadLetterQueue.add(event, error);
});

// Rebuild read model from events
await synchronizer.rebuildReadModel('user_read_model', {
  fromEvent: 0,
  batchSize: 1000
});
```

## Eventual Consistency Management

```typescript
import { ConsistencyManager } from 'cassandraorm-js';

const consistencyManager = new ConsistencyManager({
  maxInconsistencyWindow: 30000, // 30 seconds
  reconciliationInterval: 60000,  // 1 minute
  consistencyChecks: [
    {
      name: 'user_count_consistency',
      check: async () => {
        const commandSideCount = await userRepository.count();
        const querySideCount = await readModelStore.count('user_read_model');
        return Math.abs(commandSideCount - querySideCount) <= 10; // Allow small variance
      },
      onInconsistency: async () => {
        await synchronizer.rebuildReadModel('user_read_model');
      }
    }
  ]
});

await consistencyManager.start();
```

## CQRS with Microservices

```typescript
// Service-specific CQRS setup
class UserService {
  constructor() {
    this.commandBus = new CommandBus({
      handlers: {
        'CreateUser': new UserCommandHandler(),
        'UpdateUser': new UserCommandHandler()
      }
    });

    this.queryBus = new QueryBus({
      handlers: {
        'GetUser': new UserQueryHandler(),
        'SearchUsers': new UserQueryHandler()
      }
    });

    this.eventBus = new EventBus({
      topics: ['user.events'],
      subscribers: {
        'user.events': [new UserProjectionHandler()]
      }
    });
  }

  // Command endpoint
  async executeCommand(command: any): Promise<void> {
    await this.commandBus.execute(command);
  }

  // Query endpoint
  async executeQuery(query: any): Promise<any> {
    return await this.queryBus.execute(query);
  }
}

// Cross-service event handling
class OrderService {
  constructor() {
    this.eventBus = new EventBus({
      subscribers: {
        'user.events': [new UserEventHandler()]
      }
    });
  }
}

class UserEventHandler {
  async handle(event: any): Promise<void> {
    if (event.type === 'UserCreated') {
      // Create user profile in order service
      await this.createUserProfile(event.data.userId);
    }
  }
}
```

## Performance Optimization

```typescript
// Read model optimization
const optimizedReadModelStore = new ReadModelStore({
  denormalization: true,
  indexing: {
    'user_read_model': ['email', 'status', 'created_at'],
    'order_read_model': ['user_id', 'status', 'created_at']
  },
  caching: {
    enabled: true,
    strategy: 'write-through',
    ttl: 3600
  }
});

// Batch event processing
const batchProjectionHandler = new BatchProjectionHandler({
  batchSize: 100,
  flushInterval: 5000,
  parallelism: 4
});

// Snapshot-based read models
const snapshotManager = new ReadModelSnapshotManager({
  snapshotInterval: 1000, // Every 1000 events
  compressionEnabled: true
});
```
