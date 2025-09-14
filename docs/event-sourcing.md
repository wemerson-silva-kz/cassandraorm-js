# Event Sourcing

## Overview
Complete event sourcing implementation with CQRS, event store, snapshots, and domain-driven design patterns.

## Event Store Setup

```typescript
import { EventStore } from 'cassandraorm-js';

const eventStore = new EventStore(client.driver, 'myapp', {
  eventsTable: 'events',
  snapshotsTable: 'snapshots',
  enableSnapshots: true,
  snapshotFrequency: 100
});

await eventStore.initialize();
```

## Domain Events

```typescript
// Define domain events
interface UserCreated {
  type: 'UserCreated';
  data: {
    userId: string;
    email: string;
    name: string;
  };
}

interface UserEmailChanged {
  type: 'UserEmailChanged';
  data: {
    userId: string;
    oldEmail: string;
    newEmail: string;
  };
}

type UserEvent = UserCreated | UserEmailChanged;
```

## Aggregate Root

```typescript
import { BaseAggregateRoot } from 'cassandraorm-js';

class UserAggregate extends BaseAggregateRoot<UserEvent> {
  private userId: string;
  private email: string;
  private name: string;
  private isActive: boolean = true;

  constructor(id: string) {
    super(id);
    this.userId = id;
  }

  // Factory method
  static create(id: string, email: string, name: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent({
      type: 'UserCreated',
      data: { userId: id, email, name }
    });
    return user;
  }

  // Command methods
  changeEmail(newEmail: string): void {
    if (newEmail === this.email) return;
    
    this.addEvent({
      type: 'UserEmailChanged',
      data: {
        userId: this.userId,
        oldEmail: this.email,
        newEmail
      }
    });
  }

  // Event handlers
  protected applyEvent(event: UserEvent): void {
    switch (event.type) {
      case 'UserCreated':
        this.email = event.data.email;
        this.name = event.data.name;
        break;
        
      case 'UserEmailChanged':
        this.email = event.data.newEmail;
        break;
    }
  }

  // Getters
  getEmail(): string { return this.email; }
  getName(): string { return this.name; }
  isUserActive(): boolean { return this.isActive; }
}
```

## Repository Pattern

```typescript
import { AggregateRepository } from 'cassandraorm-js';

class UserRepository extends AggregateRepository<UserAggregate, UserEvent> {
  constructor(eventStore: EventStore) {
    super(eventStore, (id) => new UserAggregate(id));
  }

  async findByEmail(email: string): Promise<UserAggregate | null> {
    // Query read model or implement custom logic
    const events = await this.eventStore.getEventsByMetadata({
      aggregateType: 'User',
      'data.email': email
    });
    
    if (events.length === 0) return null;
    
    const aggregateId = events[0].aggregateId;
    return await this.getById(aggregateId);
  }
}

// Usage
const userRepository = new UserRepository(eventStore);

// Create new user
const user = UserAggregate.create(uuid(), 'john@example.com', 'John Doe');
await userRepository.save(user);

// Load and modify user
const existingUser = await userRepository.getById(userId);
existingUser.changeEmail('john.doe@example.com');
await userRepository.save(existingUser);
```

## Command Handlers

```typescript
import { CommandHandler } from 'cassandraorm-js';

interface CreateUserCommand {
  type: 'CreateUser';
  userId: string;
  email: string;
  name: string;
}

interface ChangeUserEmailCommand {
  type: 'ChangeUserEmail';
  userId: string;
  newEmail: string;
}

class UserCommandHandler extends CommandHandler {
  constructor(private userRepository: UserRepository) {
    super();
  }

  async handle(command: CreateUserCommand | ChangeUserEmailCommand): Promise<void> {
    switch (command.type) {
      case 'CreateUser':
        await this.handleCreateUser(command);
        break;
        
      case 'ChangeUserEmail':
        await this.handleChangeUserEmail(command);
        break;
    }
  }

  private async handleCreateUser(command: CreateUserCommand): Promise<void> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = UserAggregate.create(command.userId, command.email, command.name);
    await this.userRepository.save(user);
  }

  private async handleChangeUserEmail(command: ChangeUserEmailCommand): Promise<void> {
    const user = await this.userRepository.getById(command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.changeEmail(command.newEmail);
    await this.userRepository.save(user);
  }
}
```

## Event Handlers and Projections

```typescript
import { EventHandler, ProjectionBuilder } from 'cassandraorm-js';

// Read model
interface UserReadModel {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  version: number;
}

class UserProjectionHandler extends EventHandler<UserEvent> {
  constructor(private client: any) {
    super();
  }

  async handle(event: UserEvent, metadata: any): Promise<void> {
    switch (event.type) {
      case 'UserCreated':
        await this.handleUserCreated(event, metadata);
        break;
        
      case 'UserEmailChanged':
        await this.handleUserEmailChanged(event, metadata);
        break;
    }
  }

  private async handleUserCreated(event: UserCreated, metadata: any): Promise<void> {
    await this.client.execute(
      'INSERT INTO user_read_model (id, email, name, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?)',
      [
        event.data.userId,
        event.data.email,
        event.data.name,
        metadata.timestamp,
        metadata.timestamp,
        metadata.version
      ]
    );
  }

  private async handleUserEmailChanged(event: UserEmailChanged, metadata: any): Promise<void> {
    await this.client.execute(
      'UPDATE user_read_model SET email = ?, updated_at = ?, version = ? WHERE id = ?',
      [event.data.newEmail, metadata.timestamp, metadata.version, event.data.userId]
    );
  }
}
```

## Saga Pattern

```typescript
import { SagaManager } from 'cassandraorm-js';

class UserRegistrationSaga {
  constructor(
    private sagaManager: SagaManager,
    private userRepository: UserRepository,
    private emailService: any
  ) {}

  async handle(event: UserCreated): Promise<void> {
    const sagaId = `user-registration-${event.data.userId}`;
    
    const saga = await this.sagaManager.startSaga(sagaId, {
      userId: event.data.userId,
      email: event.data.email,
      step: 'user_created'
    });

    try {
      // Step 1: Send welcome email
      await this.emailService.sendWelcomeEmail(event.data.email);
      await saga.completeStep('welcome_email_sent');

      // Step 2: Create user profile
      await this.createUserProfile(event.data.userId);
      await saga.completeStep('profile_created');

      // Complete saga
      await saga.complete();
      
    } catch (error) {
      await saga.compensate(error);
    }
  }

  private async createUserProfile(userId: string): Promise<void> {
    // Create user profile logic
  }
}
```

## Snapshots

```typescript
// Enable automatic snapshots
const eventStore = new EventStore(client.driver, 'myapp', {
  enableSnapshots: true,
  snapshotFrequency: 50, // Every 50 events
  snapshotStrategy: 'time_based' // or 'event_based'
});

// Manual snapshot creation
class UserAggregate extends BaseAggregateRoot<UserEvent> {
  // ... existing code ...

  createSnapshot(): any {
    return {
      userId: this.userId,
      email: this.email,
      name: this.name,
      isActive: this.isActive,
      version: this.version
    };
  }

  loadFromSnapshot(snapshot: any): void {
    this.userId = snapshot.userId;
    this.email = snapshot.email;
    this.name = snapshot.name;
    this.isActive = snapshot.isActive;
    this.version = snapshot.version;
  }
}
```

## Event Versioning

```typescript
// Event versioning and upcasting
class EventUpcastingService {
  upcast(event: any): UserEvent {
    switch (event.version) {
      case 1:
        return this.upcastFromV1(event);
      case 2:
        return this.upcastFromV2(event);
      default:
        return event;
    }
  }

  private upcastFromV1(event: any): UserEvent {
    // Convert V1 event format to current format
    if (event.type === 'UserCreated') {
      return {
        type: 'UserCreated',
        data: {
          userId: event.userId, // V1 had userId at root level
          email: event.email,
          name: event.fullName // V1 used 'fullName' instead of 'name'
        }
      };
    }
    return event;
  }
}
```

## Query Side (CQRS)

```typescript
import { QueryHandler } from 'cassandraorm-js';

class UserQueryHandler extends QueryHandler {
  constructor(private client: any) {
    super();
  }

  async getUserById(id: string): Promise<UserReadModel | null> {
    const result = await this.client.execute(
      'SELECT * FROM user_read_model WHERE id = ?',
      [id]
    );
    
    return result.rows[0] || null;
  }

  async getUsersByEmail(email: string): Promise<UserReadModel[]> {
    const result = await this.client.execute(
      'SELECT * FROM user_read_model WHERE email = ?',
      [email]
    );
    
    return result.rows;
  }

  async getActiveUsers(): Promise<UserReadModel[]> {
    const result = await this.client.execute(
      'SELECT * FROM user_read_model WHERE is_active = true ALLOW FILTERING'
    );
    
    return result.rows;
  }
}
```
