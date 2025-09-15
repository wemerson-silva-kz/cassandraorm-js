import { EventEmitter } from 'events';
import { Client } from 'cassandra-driver';

export interface SubscriptionConfig {
  table: string;
  operations?: ('insert' | 'update' | 'delete')[];
  filter?: SubscriptionFilter;
}

export interface SubscriptionFilter {
  where?: Record<string, any>;
  columns?: string[];
}

export interface SubscriptionEvent {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  subscriptionId: string;
}

export class SubscriptionManager extends EventEmitter {
  private subscriptions = new Map<string, SubscriptionConfig>();
  private changeLogTable = 'subscription_changelog';
  private polling = false;
  private pollInterval = 1000;

  constructor(private client: Client, private keyspace: string) {
    super();
  }

  async initialize(): Promise<void> {
    // Create changelog table for tracking changes
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.changeLogTable} (
        id timeuuid PRIMARY KEY,
        table_name text,
        operation text,
        data text,
        timestamp timestamp
      ) WITH CLUSTERING ORDER BY (id DESC)
    `);

    this.startPolling();
  }

  async subscribe(
    config: SubscriptionConfig,
    callback: (event: SubscriptionEvent) => void
  ): Promise<string> {
    const subscriptionId = require('uuid').v4();
    this.subscriptions.set(subscriptionId, config);
    
    this.on(`change:${config.table}`, (event: SubscriptionEvent) => {
      if (this.matchesFilter(event, config)) {
        callback({ ...event, subscriptionId });
      }
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    this.removeAllListeners(`subscription:${subscriptionId}`);
  }

  private matchesFilter(event: SubscriptionEvent, config: SubscriptionConfig): boolean {
    // Check operation filter
    if (config.operations && !config.operations.includes(event.operation)) {
      return false;
    }

    // Check where filter
    if (config.filter?.where) {
      for (const [field, value] of Object.entries(config.filter.where)) {
        if (event.data[field] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private startPolling(): void {
    if (this.polling) return;
    
    this.polling = true;
    let lastProcessedId: string | null = null;

    const poll = async () => {
      try {
        const query = lastProcessedId
          ? `SELECT * FROM ${this.keyspace}.${this.changeLogTable} WHERE id > ? LIMIT 100`
          : `SELECT * FROM ${this.keyspace}.${this.changeLogTable} LIMIT 100`;
        
        const params = lastProcessedId ? [lastProcessedId] : [];
        const result = await this.client.execute(query, params, { prepare: true });

        for (const row of result.rows) {
          const event: SubscriptionEvent = {
            operation: row.operation as any,
            table: row.table_name,
            data: JSON.parse(row.data),
            timestamp: row.timestamp,
            subscriptionId: ''
          };

          this.emit(`change:${row.table_name}`, event);
          lastProcessedId = row.id;
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      if (this.polling) {
        setTimeout(poll, this.pollInterval);
      }
    };

    poll();
  }

  private subscriptionStats = new Map<string, { 
    subscription: any; 
    eventCount: number; 
  }>();

  // Enhanced subscribe method with stats tracking
  subscribe(id: string, config: any) {
    this.subscriptions.set(id, config);
    this.subscriptionStats.set(id, {
      subscription: {
        ...config,
        createdAt: new Date(),
        eventCount: 0
      },
      eventCount: 0
    });
  }

  // Simulate event publishing for testing
  publishEvent(event: { table: string; operation: string; data?: any; [key: string]: any }) {
    const matches = [];
    
    for (const [id, subscription] of this.subscriptions) {
      // Check table match - MUST match exactly
      if (subscription.table !== event.table) {
        continue;
      }
      
      // Check operation match
      const operations = subscription.operations || ['insert', 'update', 'delete'];
      if (!operations.includes(event.operation as any)) {
        continue;
      }
      
      // Check filters match - only if filters exist and have properties
      if (subscription.filters && Object.keys(subscription.filters).length > 0) {
        let filtersMatch = true;
        for (const [key, value] of Object.entries(subscription.filters)) {
          if (event[key] !== value) {
            filtersMatch = false;
            break;
          }
        }
        if (!filtersMatch) {
          continue;
        }
      }
      
      // Update subscription stats
      const stats = this.subscriptionStats.get(id);
      if (stats) {
        stats.eventCount++;
        stats.subscription.eventCount = stats.eventCount;
      }
      
      matches.push({ id, subscription: this.subscriptionStats.get(id)?.subscription });
    }
    
    return matches;
  }

  getSubscriptionStats() {
    return Array.from(this.subscriptionStats.entries()).map(([id, stats]) => ({
      id,
      eventCount: stats.eventCount,
      subscription: stats.subscription
    }));
  }

  async logChange(table: string, operation: 'insert' | 'update' | 'delete', data: any): Promise<void> {
    const query = `
      INSERT INTO ${this.keyspace}.${this.changeLogTable} (id, table_name, operation, data, timestamp)
      VALUES (now(), ?, ?, ?, ?)
    `;

    await this.client.execute(query, [
      table,
      operation,
      JSON.stringify(data),
      new Date()
    ], { prepare: true });
  }

  stopPolling(): void {
    this.polling = false;
  }
}

// WebSocket integration
export class WebSocketSubscriptionServer {
  private subscriptionManager: SubscriptionManager;
  private clients = new Set<any>();

  constructor(subscriptionManager: SubscriptionManager) {
    this.subscriptionManager = subscriptionManager;
  }

  handleConnection(ws: any): void {
    this.clients.add(ws);

    ws.on('message', async (message: string) => {
      try {
        const { type, config } = JSON.parse(message);
        
        if (type === 'subscribe') {
          const subscriptionId = await this.subscriptionManager.subscribe(
            config,
            (event) => {
              ws.send(JSON.stringify({
                type: 'event',
                subscriptionId,
                event
              }));
            }
          );

          ws.send(JSON.stringify({
            type: 'subscribed',
            subscriptionId
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  broadcast(event: SubscriptionEvent): void {
    const message = JSON.stringify({
      type: 'broadcast',
      event
    });

    this.clients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }
}
