import { EventEmitter } from 'events';
import type { Client } from "cassandra-driver";

export interface EventSourcingConfig {
  enabled?: boolean;
  snapshotFrequency?: number;
  maxEventsBeforeSnapshot?: number;
  eventStore?: string;
  snapshotStore?: string;
}

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  eventVersion: number;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  data: any;
  version: number;
  timestamp: Date;
}

export interface AggregateRoot {
  id: string;
  version: number;
  uncommittedEvents: DomainEvent[];
  applyEvent(event: DomainEvent): void;
  markEventsAsCommitted(): void;
}

export class EventStore extends EventEmitter {
  private client: Client;
  private keyspace: string;
  private config: Required<EventSourcingConfig>;

  constructor(client: Client, keyspace: string, config: EventSourcingConfig = {}) {
    super();
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      snapshotFrequency: 10,
      maxEventsBeforeSnapshot: 100,
      eventStore: 'event_store',
      snapshotStore: 'snapshot_store',
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    // Create event store table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.config.eventStore} (
        aggregate_id text,
        event_version int,
        event_id text,
        aggregate_type text,
        event_type text,
        event_data text,
        timestamp timestamp,
        user_id text,
        metadata map<text, text>,
        PRIMARY KEY (aggregate_id, event_version)
      ) WITH CLUSTERING ORDER BY (event_version ASC)
    `);

    // Create snapshot store table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.config.snapshotStore} (
        aggregate_id text PRIMARY KEY,
        aggregate_type text,
        data text,
        version int,
        timestamp timestamp
      )
    `);

    // Create indexes
    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS event_type_idx 
      ON ${this.keyspace}.${this.config.eventStore} (event_type)
    `);
  }

  async saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    if (!this.config.enabled || events.length === 0) return;

    // Check for concurrency conflicts
    const currentVersion = await this.getAggregateVersion(aggregateId);
    if (currentVersion !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`);
    }

    // Save events in batch
    const batch = events.map((event, index) => ({
      query: `INSERT INTO ${this.keyspace}.${this.config.eventStore} 
              (aggregate_id, event_version, event_id, aggregate_type, event_type, event_data, timestamp, user_id, metadata) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        aggregateId,
        expectedVersion + index + 1,
        event.id,
        event.aggregateType,
        event.eventType,
        JSON.stringify(event.eventData),
        event.timestamp,
        event.userId,
        event.metadata || {}
      ]
    }));

    await this.client.batch(batch, { prepare: true });

    // Emit events for subscribers
    events.forEach(event => {
      this.emit('eventStored', event);
      this.emit(`${event.aggregateType}.${event.eventType}`, event);
    });

    // Check if snapshot is needed
    const newVersion = expectedVersion + events.length;
    if (newVersion % this.config.snapshotFrequency === 0) {
      this.emit('snapshotNeeded', { aggregateId, version: newVersion });
    }
  }

  async getEvents(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<DomainEvent[]> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.eventStore} 
       WHERE aggregate_id = ? AND event_version > ? 
       ORDER BY event_version ASC`,
      [aggregateId, fromVersion],
      { prepare: true }
    );

    return result.rows.map(row => ({
      id: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      eventData: JSON.parse(row.event_data),
      eventVersion: row.event_version,
      timestamp: row.timestamp,
      userId: row.user_id,
      metadata: row.metadata
    }));
  }

  async getEventsByType(
    eventType: string,
    limit: number = 100
  ): Promise<DomainEvent[]> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.eventStore} 
       WHERE event_type = ? LIMIT ? ALLOW FILTERING`,
      [eventType, limit],
      { prepare: true }
    );

    return result.rows.map(row => ({
      id: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      eventData: JSON.parse(row.event_data),
      eventVersion: row.event_version,
      timestamp: row.timestamp,
      userId: row.user_id,
      metadata: row.metadata
    }));
  }

  private async getAggregateVersion(aggregateId: string): Promise<number> {
    const result = await this.client.execute(
      `SELECT MAX(event_version) as max_version FROM ${this.keyspace}.${this.config.eventStore} 
       WHERE aggregate_id = ?`,
      [aggregateId],
      { prepare: true }
    );

    return result.rows[0]?.max_version || 0;
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${this.config.snapshotStore} 
       (aggregate_id, aggregate_type, data, version, timestamp) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        snapshot.aggregateId,
        snapshot.aggregateType,
        JSON.stringify(snapshot.data),
        snapshot.version,
        snapshot.timestamp
      ],
      { prepare: true }
    );

    this.emit('snapshotSaved', snapshot);
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.snapshotStore} 
       WHERE aggregate_id = ?`,
      [aggregateId],
      { prepare: true }
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      data: JSON.parse(row.data),
      version: row.version,
      timestamp: row.timestamp
    };
  }

  async replayEvents(
    aggregateId: string,
    aggregate: AggregateRoot
  ): Promise<AggregateRoot> {
    // Try to load from snapshot first
    const snapshot = await this.getSnapshot(aggregateId);
    let fromVersion = 0;

    if (snapshot) {
      // Restore from snapshot
      Object.assign(aggregate, snapshot.data);
      aggregate.version = snapshot.version;
      fromVersion = snapshot.version;
    }

    // Load and apply events since snapshot
    const events = await this.getEvents(aggregateId, fromVersion);
    events.forEach(event => {
      aggregate.applyEvent(event);
      aggregate.version = event.eventVersion;
    });

    return aggregate;
  }
}

// Base aggregate root implementation
export abstract class BaseAggregateRoot implements AggregateRoot {
  public id: string;
  public version: number = 0;
  public uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  abstract applyEvent(event: DomainEvent): void;

  protected addEvent(eventType: string, eventData: any, userId?: string): void {
    const event: DomainEvent = {
      id: this.generateEventId(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType,
      eventData,
      eventVersion: this.version + this.uncommittedEvents.length + 1,
      timestamp: new Date(),
      userId
    };

    this.uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  markEventsAsCommitted(): void {
    this.version += this.uncommittedEvents.length;
    this.uncommittedEvents = [];
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Repository pattern for aggregates
export class AggregateRepository<T extends AggregateRoot> {
  constructor(
    private eventStore: EventStore,
    private aggregateFactory: (id: string) => T
  ) {}

  async getById(id: string): Promise<T | null> {
    const aggregate = this.aggregateFactory(id);
    
    try {
      await this.eventStore.replayEvents(id, aggregate);
      return aggregate.version > 0 ? aggregate : null;
    } catch (error) {
      return null;
    }
  }

  async save(aggregate: T): Promise<void> {
    if (aggregate.uncommittedEvents.length === 0) return;

    const expectedVersion = aggregate.version;
    await this.eventStore.saveEvents(
      aggregate.id,
      aggregate.uncommittedEvents,
      expectedVersion
    );

    aggregate.markEventsAsCommitted();
  }
}

// Saga pattern for distributed transactions
export class Saga extends EventEmitter {
  private steps: SagaStep[] = [];
  private compensations: SagaStep[] = [];
  private currentStep = 0;
  private isCompensating = false;

  constructor(private sagaId: string) {
    super();
  }

  addStep(step: SagaStep): this {
    this.steps.push(step);
    return this;
  }

  addCompensation(compensation: SagaStep): this {
    this.compensations.unshift(compensation); // Reverse order for compensation
    return this;
  }

  async execute(): Promise<void> {
    this.emit('sagaStarted', { sagaId: this.sagaId });

    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStep = i;
        await this.steps[i].execute();
        this.emit('stepCompleted', { sagaId: this.sagaId, step: i });
      }

      this.emit('sagaCompleted', { sagaId: this.sagaId });
    } catch (error) {
      this.emit('sagaFailed', { sagaId: this.sagaId, step: this.currentStep, error });
      await this.compensate();
      throw error;
    }
  }

  private async compensate(): Promise<void> {
    this.isCompensating = true;
    this.emit('compensationStarted', { sagaId: this.sagaId });

    // Execute compensations for completed steps
    for (let i = 0; i < this.currentStep && i < this.compensations.length; i++) {
      try {
        await this.compensations[i].execute();
        this.emit('compensationCompleted', { sagaId: this.sagaId, step: i });
      } catch (error) {
        this.emit('compensationFailed', { sagaId: this.sagaId, step: i, error });
        // Continue with other compensations
      }
    }

    this.emit('compensationFinished', { sagaId: this.sagaId });
  }
}

export interface SagaStep {
  execute(): Promise<void>;
}

// Example aggregate implementation
export class UserAggregate extends BaseAggregateRoot {
  public name: string = '';
  public email: string = '';
  public isActive: boolean = false;

  static create(id: string, name: string, email: string, userId?: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserCreated', { name, email }, userId);
    return user;
  }

  changeName(newName: string, userId?: string): void {
    if (newName !== this.name) {
      this.addEvent('UserNameChanged', { oldName: this.name, newName }, userId);
    }
  }

  changeEmail(newEmail: string, userId?: string): void {
    if (newEmail !== this.email) {
      this.addEvent('UserEmailChanged', { oldEmail: this.email, newEmail }, userId);
    }
  }

  activate(userId?: string): void {
    if (!this.isActive) {
      this.addEvent('UserActivated', {}, userId);
    }
  }

  deactivate(userId?: string): void {
    if (this.isActive) {
      this.addEvent('UserDeactivated', {}, userId);
    }
  }

  applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.name = event.eventData.name;
        this.email = event.eventData.email;
        this.isActive = true;
        break;
      case 'UserNameChanged':
        this.name = event.eventData.newName;
        break;
      case 'UserEmailChanged':
        this.email = event.eventData.newEmail;
        break;
      case 'UserActivated':
        this.isActive = true;
        break;
      case 'UserDeactivated':
        this.isActive = false;
        break;
    }
  }
}
