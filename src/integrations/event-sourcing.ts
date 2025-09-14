import { Client } from "cassandra-driver";

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  eventVersion: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EventStoreConfig {
  keyspace: string;
  eventsTable?: string;
  snapshotsTable?: string;
}

export class EventStore {
  private config: Required<EventStoreConfig>;

  constructor(private client: Client, config: EventStoreConfig) {
    this.config = {
      eventsTable: 'events',
      snapshotsTable: 'snapshots',
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Create events table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.config.keyspace}.${this.config.eventsTable} (
        aggregate_id uuid,
        event_version int,
        event_id uuid,
        aggregate_type text,
        event_type text,
        event_data text,
        timestamp timestamp,
        metadata map<text, text>,
        PRIMARY KEY (aggregate_id, event_version)
      ) WITH CLUSTERING ORDER BY (event_version ASC)
    `);

    // Create snapshots table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.config.keyspace}.${this.config.snapshotsTable} (
        aggregate_id uuid PRIMARY KEY,
        aggregate_type text,
        snapshot_version int,
        snapshot_data text,
        timestamp timestamp
      )
    `);
  }

  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const batch = events.map((event, index) => ({
      query: `
        INSERT INTO ${this.config.keyspace}.${this.config.eventsTable}
        (aggregate_id, event_version, event_id, aggregate_type, event_type, event_data, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        aggregateId,
        expectedVersion + index + 1,
        event.id,
        event.aggregateType,
        event.eventType,
        JSON.stringify(event.eventData),
        event.timestamp,
        event.metadata || {}
      ]
    }));

    await this.client.batch(batch, { prepare: true });
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    const query = `
      SELECT * FROM ${this.config.keyspace}.${this.config.eventsTable}
      WHERE aggregate_id = ? AND event_version > ?
      ORDER BY event_version ASC
    `;

    const result = await this.client.execute(query, [aggregateId, fromVersion], { prepare: true });
    
    return result.rows.map(row => ({
      id: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      eventData: JSON.parse(row.event_data),
      eventVersion: row.event_version,
      timestamp: row.timestamp,
      metadata: row.metadata
    }));
  }

  async saveSnapshot(aggregateId: string, aggregateType: string, version: number, data: any): Promise<void> {
    const query = `
      INSERT INTO ${this.config.keyspace}.${this.config.snapshotsTable}
      (aggregate_id, aggregate_type, snapshot_version, snapshot_data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.client.execute(query, [
      aggregateId,
      aggregateType,
      version,
      JSON.stringify(data),
      new Date()
    ], { prepare: true });
  }

  async getSnapshot(aggregateId: string): Promise<any | null> {
    const query = `
      SELECT * FROM ${this.config.keyspace}.${this.config.snapshotsTable}
      WHERE aggregate_id = ?
    `;

    const result = await this.client.execute(query, [aggregateId], { prepare: true });
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      version: row.snapshot_version,
      data: JSON.parse(row.snapshot_data),
      timestamp: row.timestamp
    };
  }
}

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

  protected addEvent(eventType: string, eventData: any, metadata?: Record<string, any>): void {
    const event: DomainEvent = {
      id: require('uuid').v4(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType,
      eventData,
      eventVersion: this.version + this.uncommittedEvents.length + 1,
      timestamp: new Date(),
      metadata
    };

    this.uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  applyEvent(event: DomainEvent): void {
    const methodName = `apply${event.eventType}`;
    if (typeof (this as any)[methodName] === 'function') {
      (this as any)[methodName](event.eventData);
    }
    this.version = event.eventVersion;
  }

  loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => this.applyEvent(event));
  }
}

export class AggregateRepository<T extends BaseAggregateRoot> {
  constructor(
    private eventStore: EventStore,
    private aggregateFactory: (id: string) => T
  ) {}

  async save(aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    if (uncommittedEvents.length === 0) {
      return;
    }

    await this.eventStore.saveEvents(
      aggregate.getId(),
      uncommittedEvents,
      aggregate.getVersion() - uncommittedEvents.length
    );

    aggregate.markEventsAsCommitted();
  }

  async getById(id: string): Promise<T | null> {
    // Try to load from snapshot first
    const snapshot = await this.eventStore.getSnapshot(id);
    let aggregate = this.aggregateFactory(id);
    let fromVersion = 0;

    if (snapshot) {
      // Load from snapshot
      Object.assign(aggregate, snapshot.data);
      (aggregate as any).version = snapshot.version;
      fromVersion = snapshot.version;
    }

    // Load events after snapshot
    const events = await this.eventStore.getEvents(id, fromVersion);
    if (events.length === 0 && !snapshot) {
      return null;
    }

    aggregate.loadFromHistory(events);
    return aggregate;
  }
}
