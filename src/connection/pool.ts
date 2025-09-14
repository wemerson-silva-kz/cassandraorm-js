import { Client } from "cassandra-driver";

export interface ConnectionPoolOptions {
  size?: number;
  maxSize?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    timeout?: number;
  };
}

export class ConnectionPool {
  private connections: Client[] = [];
  private available: Client[] = [];
  private options: Required<ConnectionPoolOptions>;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private clientOptions: any,
    options: ConnectionPoolOptions = {}
  ) {
    this.options = {
      size: 5,
      maxSize: 20,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000
      },
      ...options
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
  }

  private async createConnection(): Promise<Client> {
    const client = new Client(this.clientOptions);
    await client.connect();
    this.connections.push(client);
    this.available.push(client);
    return client;
  }

  async getConnection(keyspace?: string): Promise<Client> {
    if (this.available.length === 0 && this.connections.length < this.options.maxSize) {
      await this.createConnection();
    }

    const client = this.available.pop();
    if (!client) {
      throw new Error('No connections available');
    }

    return client;
  }

  releaseConnection(client: Client): void {
    if (this.connections.includes(client)) {
      this.available.push(client);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const client of this.connections) {
        try {
          await client.execute('SELECT now() FROM system.local', [], { 
            timeout: this.options.healthCheck.timeout 
          });
        } catch (error) {
          console.warn('Health check failed for connection:', error);
          await this.replaceConnection(client);
        }
      }
    }, this.options.healthCheck.interval);
  }

  private async replaceConnection(failedClient: Client): Promise<void> {
    const index = this.connections.indexOf(failedClient);
    if (index > -1) {
      this.connections.splice(index, 1);
      const availableIndex = this.available.indexOf(failedClient);
      if (availableIndex > -1) {
        this.available.splice(availableIndex, 1);
      }
      
      try {
        await failedClient.shutdown();
      } catch (error) {
        console.warn('Error shutting down failed connection:', error);
      }
      
      await this.createConnection();
    }
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await Promise.all(
      this.connections.map(client => client.shutdown().catch(console.warn))
    );
    
    this.connections = [];
    this.available = [];
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.available.length,
      inUse: this.connections.length - this.available.length
    };
  }
}
