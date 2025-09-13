import { Client } from 'cassandra-driver';
import { EventEmitter } from 'events';

export interface AdvancedPoolOptions {
  size?: number;
  maxSize?: number;
  minSize?: number;
  loadBalancing?: 'round-robin' | 'least-connections' | 'random';
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    timeout?: number;
    retries?: number;
  };
  retryPolicy?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    baseDelay?: number;
    maxDelay?: number;
  };
  failover?: {
    enabled?: boolean;
    threshold?: number;
    cooldown?: number;
  };
}

export interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  failed: number;
  avgResponseTime: number;
  totalQueries: number;
}

export interface ConnectionInfo {
  id: string;
  client: Client;
  isHealthy: boolean;
  activeQueries: number;
  totalQueries: number;
  avgResponseTime: number;
  lastUsed: Date;
  created: Date;
}

export class AdvancedConnectionPool extends EventEmitter {
  private connections = new Map<string, ConnectionInfo>();
  private options: Required<AdvancedPoolOptions>;
  private healthCheckInterval?: NodeJS.Timeout;
  private currentIndex = 0;
  private isShuttingDown = false;

  constructor(
    private clientOptions: any,
    options: AdvancedPoolOptions = {}
  ) {
    super();
    
    this.options = {
      size: 5,
      maxSize: 20,
      minSize: 2,
      loadBalancing: 'round-robin',
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3
      },
      retryPolicy: {
        maxRetries: 3,
        backoff: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000
      },
      failover: {
        enabled: true,
        threshold: 3,
        cooldown: 60000
      },
      ...options,
      healthCheck: { ...options.healthCheck },
      retryPolicy: { ...options.retryPolicy },
      failover: { ...options.failover }
    };
  }

  async initialize(): Promise<void> {
    // Create initial connections
    for (let i = 0; i < this.options.size; i++) {
      await this.createConnection();
    }

    // Start health check
    if (this.options.healthCheck.enabled) {
      this.startHealthCheck();
    }

    this.emit('initialized', { poolSize: this.connections.size });
  }

  async getConnection(): Promise<Client> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const connection = await this.selectConnection();
    
    if (!connection) {
      throw new Error('No healthy connections available');
    }

    connection.activeQueries++;
    connection.lastUsed = new Date();
    
    return connection.client;
  }

  async releaseConnection(client: Client): Promise<void> {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.client === client);
    
    if (connection) {
      connection.activeQueries = Math.max(0, connection.activeQueries - 1);
    }
  }

  private async selectConnection(): Promise<ConnectionInfo | null> {
    const healthyConnections = Array.from(this.connections.values())
      .filter(conn => conn.isHealthy);

    if (healthyConnections.length === 0) {
      // Try to create new connection if under max size
      if (this.connections.size < this.options.maxSize) {
        try {
          return await this.createConnection();
        } catch (error) {
          this.emit('error', error);
          return null;
        }
      }
      return null;
    }

    switch (this.options.loadBalancing) {
      case 'round-robin':
        return this.selectRoundRobin(healthyConnections);
      case 'least-connections':
        return this.selectLeastConnections(healthyConnections);
      case 'random':
        return this.selectRandom(healthyConnections);
      default:
        return healthyConnections[0];
    }
  }

  private selectRoundRobin(connections: ConnectionInfo[]): ConnectionInfo {
    const connection = connections[this.currentIndex % connections.length];
    this.currentIndex++;
    return connection;
  }

  private selectLeastConnections(connections: ConnectionInfo[]): ConnectionInfo {
    return connections.reduce((min, conn) => 
      conn.activeQueries < min.activeQueries ? conn : min
    );
  }

  private selectRandom(connections: ConnectionInfo[]): ConnectionInfo {
    const index = Math.floor(Math.random() * connections.length);
    return connections[index];
  }

  private async createConnection(): Promise<ConnectionInfo> {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const client = new Client(this.clientOptions);
    
    try {
      await client.connect();
      
      const connectionInfo: ConnectionInfo = {
        id,
        client,
        isHealthy: true,
        activeQueries: 0,
        totalQueries: 0,
        avgResponseTime: 0,
        lastUsed: new Date(),
        created: new Date()
      };

      this.connections.set(id, connectionInfo);
      this.emit('connectionCreated', { id, total: this.connections.size });
      
      return connectionInfo;
    } catch (error) {
      this.emit('connectionFailed', { id, error });
      throw error;
    }
  }

  private async removeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) return;

    try {
      await connection.client.shutdown();
    } catch (error) {
      this.emit('error', error);
    }

    this.connections.delete(id);
    this.emit('connectionRemoved', { id, total: this.connections.size });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.options.healthCheck.interval
    );
  }

  private async performHealthCheck(): Promise<void> {
    const promises = Array.from(this.connections.entries()).map(
      ([id, connection]) => this.checkConnectionHealth(id, connection)
    );

    await Promise.allSettled(promises);

    // Remove unhealthy connections if we have enough healthy ones
    const healthyCount = Array.from(this.connections.values())
      .filter(conn => conn.isHealthy).length;

    if (healthyCount >= this.options.minSize) {
      const unhealthyConnections = Array.from(this.connections.entries())
        .filter(([, conn]) => !conn.isHealthy);

      for (const [id] of unhealthyConnections) {
        await this.removeConnection(id);
      }
    }

    // Create new connections if below minimum
    while (this.connections.size < this.options.minSize) {
      try {
        await this.createConnection();
      } catch (error) {
        this.emit('error', error);
        break;
      }
    }
  }

  private async checkConnectionHealth(id: string, connection: ConnectionInfo): Promise<void> {
    try {
      const startTime = Date.now();
      await connection.client.execute('SELECT now() FROM system.local');
      const responseTime = Date.now() - startTime;
      
      // Update response time average
      connection.avgResponseTime = connection.totalQueries > 0
        ? (connection.avgResponseTime * connection.totalQueries + responseTime) / (connection.totalQueries + 1)
        : responseTime;
      
      connection.totalQueries++;
      connection.isHealthy = true;
      
      this.emit('healthCheckPassed', { id, responseTime });
    } catch (error) {
      connection.isHealthy = false;
      this.emit('healthCheckFailed', { id, error });
    }
  }

  async executeWithRetry<T>(
    operation: (client: Client) => Promise<T>,
    retries: number = this.options.retryPolicy.maxRetries
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = await this.getConnection();
        const startTime = Date.now();
        
        try {
          const result = await operation(client);
          
          // Update connection stats
          const responseTime = Date.now() - startTime;
          const connection = Array.from(this.connections.values())
            .find(conn => conn.client === client);
          
          if (connection) {
            connection.totalQueries++;
            connection.avgResponseTime = connection.totalQueries > 1
              ? (connection.avgResponseTime * (connection.totalQueries - 1) + responseTime) / connection.totalQueries
              : responseTime;
          }
          
          return result;
        } finally {
          await this.releaseConnection(client);
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          this.emit('retryAttempt', { attempt: attempt + 1, delay, error });
        }
      }
    }

    throw lastError!;
  }

  private calculateRetryDelay(attempt: number): number {
    const { backoff, baseDelay, maxDelay } = this.options.retryPolicy;
    
    let delay = baseDelay;
    
    if (backoff === 'exponential') {
      delay = baseDelay * Math.pow(2, attempt);
    } else {
      delay = baseDelay * (attempt + 1);
    }
    
    return Math.min(delay, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(): ConnectionStats {
    const connections = Array.from(this.connections.values());
    const healthyConnections = connections.filter(conn => conn.isHealthy);
    
    const totalQueries = connections.reduce((sum, conn) => sum + conn.totalQueries, 0);
    const totalResponseTime = connections.reduce((sum, conn) => sum + (conn.avgResponseTime * conn.totalQueries), 0);
    
    return {
      total: connections.length,
      active: connections.reduce((sum, conn) => sum + conn.activeQueries, 0),
      idle: healthyConnections.length - connections.reduce((sum, conn) => sum + conn.activeQueries, 0),
      failed: connections.length - healthyConnections.length,
      avgResponseTime: totalQueries > 0 ? totalResponseTime / totalQueries : 0,
      totalQueries
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const shutdownPromises = Array.from(this.connections.keys()).map(
      id => this.removeConnection(id)
    );

    await Promise.allSettled(shutdownPromises);
    this.emit('shutdown');
  }
}
