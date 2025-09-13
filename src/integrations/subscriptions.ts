import { EventEmitter } from 'events';
import type { Client } from "cassandra-driver";

export interface SubscriptionConfig {
  enabled?: boolean;
  transport?: 'websocket' | 'sse' | 'polling';
  pollInterval?: number;
  maxSubscriptions?: number;
  authentication?: (token: string) => Promise<boolean>;
}

export interface SubscriptionFilter {
  table?: string;
  operation?: 'insert' | 'update' | 'delete';
  where?: Record<string, any>;
  fields?: string[];
}

export interface SubscriptionEvent {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  oldData?: any;
  timestamp: Date;
  userId?: string;
}

export interface Subscription {
  id: string;
  userId?: string;
  filter: SubscriptionFilter;
  callback: (event: SubscriptionEvent) => void;
  createdAt: Date;
  lastActivity: Date;
}

export class SubscriptionManager extends EventEmitter {
  private client: Client;
  private keyspace: string;
  private config: Required<SubscriptionConfig>;
  private subscriptions = new Map<string, Subscription>();
  private changeLog = new Map<string, SubscriptionEvent[]>();
  private pollingInterval?: NodeJS.Timeout;

  constructor(client: Client, keyspace: string, config: SubscriptionConfig = {}) {
    super();
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      transport: 'websocket',
      pollInterval: 1000,
      maxSubscriptions: 1000,
      authentication: async () => true,
      ...config
    };

    if (this.config.enabled && this.config.transport === 'polling') {
      this.startPolling();
    }
  }

  async subscribe(
    filter: SubscriptionFilter,
    callback: (event: SubscriptionEvent) => void,
    userId?: string
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Subscriptions are disabled');
    }

    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscriptions reached');
    }

    const subscriptionId = this.generateSubscriptionId();
    const subscription: Subscription = {
      id: subscriptionId,
      userId,
      filter,
      callback,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emit('subscriptionCreated', { subscriptionId, filter, userId });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.subscriptions.delete(subscriptionId);
    this.emit('subscriptionRemoved', { subscriptionId });

    return true;
  }

  // Manually trigger an event (for testing or external triggers)
  async publishEvent(event: Omit<SubscriptionEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: SubscriptionEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    // Store in change log
    const tableLog = this.changeLog.get(event.table) || [];
    tableLog.push(fullEvent);
    
    // Keep only last 1000 events per table
    if (tableLog.length > 1000) {
      tableLog.splice(0, tableLog.length - 1000);
    }
    
    this.changeLog.set(event.table, tableLog);

    // Notify matching subscriptions
    await this.notifySubscriptions(fullEvent);
  }

  private async notifySubscriptions(event: SubscriptionEvent): Promise<void> {
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => this.matchesFilter(event, sub.filter));

    for (const subscription of matchingSubscriptions) {
      try {
        subscription.callback(event);
        subscription.lastActivity = new Date();
      } catch (error) {
        this.emit('subscriptionError', { 
          subscriptionId: subscription.id, 
          error,
          event 
        });
      }
    }

    if (matchingSubscriptions.length > 0) {
      this.emit('eventNotified', { 
        event, 
        notifiedSubscriptions: matchingSubscriptions.length 
      });
    }
  }

  private matchesFilter(event: SubscriptionEvent, filter: SubscriptionFilter): boolean {
    // Check table filter
    if (filter.table && filter.table !== event.table) {
      return false;
    }

    // Check operation filter
    if (filter.operation && filter.operation !== event.type) {
      return false;
    }

    // Check where conditions
    if (filter.where && event.data) {
      for (const [key, value] of Object.entries(filter.where)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  // Polling-based change detection
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      await this.pollForChanges();
    }, this.config.pollInterval);
  }

  private async pollForChanges(): Promise<void> {
    // This is a simplified implementation
    // In a real scenario, you'd need to track changes using timestamps or change logs
    
    const tables = new Set(
      Array.from(this.subscriptions.values())
        .map(sub => sub.filter.table)
        .filter(Boolean) as string[]
    );

    for (const table of tables) {
      try {
        await this.pollTableChanges(table);
      } catch (error) {
        this.emit('pollingError', { table, error });
      }
    }
  }

  private async pollTableChanges(table: string): Promise<void> {
    // Get recent changes (this would need a timestamp column in practice)
    const cutoffTime = new Date(Date.now() - this.config.pollInterval * 2);
    
    try {
      const result = await this.client.execute(
        `SELECT * FROM ${this.keyspace}.${table} WHERE updated_at > ? ALLOW FILTERING`,
        [cutoffTime],
        { prepare: true }
      );

      for (const row of result.rows) {
        const event: SubscriptionEvent = {
          id: this.generateEventId(),
          type: 'update', // In practice, you'd need to determine the actual operation
          table,
          data: row,
          timestamp: row.updated_at || new Date()
        };

        await this.notifySubscriptions(event);
      }
    } catch (error) {
      // Table might not have updated_at column, skip silently
    }
  }

  // WebSocket integration helpers
  createWebSocketHandler(): (ws: any) => void {
    return (ws: any) => {
      const subscriptions = new Set<string>();

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          
          switch (data.type) {
            case 'subscribe':
              const subscriptionId = await this.subscribe(
                data.filter,
                (event) => {
                  ws.send(JSON.stringify({
                    type: 'event',
                    subscriptionId,
                    event
                  }));
                },
                data.userId
              );
              
              subscriptions.add(subscriptionId);
              
              ws.send(JSON.stringify({
                type: 'subscribed',
                subscriptionId
              }));
              break;

            case 'unsubscribe':
              await this.unsubscribe(data.subscriptionId);
              subscriptions.delete(data.subscriptionId);
              
              ws.send(JSON.stringify({
                type: 'unsubscribed',
                subscriptionId: data.subscriptionId
              }));
              break;
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
          }));
        }
      });

      ws.on('close', () => {
        // Clean up subscriptions
        subscriptions.forEach(subscriptionId => {
          this.unsubscribe(subscriptionId);
        });
      });
    };
  }

  // Server-Sent Events integration
  createSSEHandler(): (req: any, res: any) => void {
    return (req: any, res: any) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const subscriptions = new Set<string>();

      // Handle subscription requests via query parameters
      const filter: SubscriptionFilter = {
        table: req.query.table,
        operation: req.query.operation,
        where: req.query.where ? JSON.parse(req.query.where) : undefined
      };

      this.subscribe(filter, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }, req.query.userId).then(subscriptionId => {
        subscriptions.add(subscriptionId);
        res.write(`data: ${JSON.stringify({ type: 'subscribed', subscriptionId })}\n\n`);
      });

      req.on('close', () => {
        subscriptions.forEach(subscriptionId => {
          this.unsubscribe(subscriptionId);
        });
      });
    };
  }

  // Get subscription statistics
  getStats(): {
    totalSubscriptions: number;
    subscriptionsByTable: Record<string, number>;
    subscriptionsByOperation: Record<string, number>;
    activeUsers: number;
    eventsProcessed: number;
  } {
    const subscriptionsByTable: Record<string, number> = {};
    const subscriptionsByOperation: Record<string, number> = {};
    const activeUsers = new Set<string>();

    this.subscriptions.forEach(sub => {
      if (sub.filter.table) {
        subscriptionsByTable[sub.filter.table] = (subscriptionsByTable[sub.filter.table] || 0) + 1;
      }
      
      if (sub.filter.operation) {
        subscriptionsByOperation[sub.filter.operation] = (subscriptionsByOperation[sub.filter.operation] || 0) + 1;
      }
      
      if (sub.userId) {
        activeUsers.add(sub.userId);
      }
    });

    const eventsProcessed = Array.from(this.changeLog.values())
      .reduce((total, events) => total + events.length, 0);

    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByTable,
      subscriptionsByOperation,
      activeUsers: activeUsers.size,
      eventsProcessed
    };
  }

  // Clean up inactive subscriptions
  cleanupInactiveSubscriptions(maxInactiveTime: number = 300000): number { // 5 minutes
    const cutoffTime = new Date(Date.now() - maxInactiveTime);
    let cleaned = 0;

    this.subscriptions.forEach((subscription, id) => {
      if (subscription.lastActivity < cutoffTime) {
        this.subscriptions.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.emit('subscriptionsCleanedUp', { count: cleaned });
    }

    return cleaned;
  }

  shutdown(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.subscriptions.clear();
    this.changeLog.clear();
    this.emit('shutdown');
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
