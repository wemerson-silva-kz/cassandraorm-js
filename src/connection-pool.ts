import { Client } from 'cassandra-driver';

interface ConnectionPoolOptions {
  contactPoints?: string[];
  localDataCenter?: string;
  maxConnections?: number;
}

export class ConnectionPool {
  private connections = new Map<string, Client>();
  private options: ConnectionPoolOptions;

  constructor(options: ConnectionPoolOptions = {}) {
    this.options = {
      maxConnections: 10,
      ...options
    };
  }

  async getConnection(keyspace?: string): Promise<Client> {
    const key = keyspace || 'default';
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    const client = new Client({
      contactPoints: this.options.contactPoints || ['127.0.0.1'],
      localDataCenter: this.options.localDataCenter || 'datacenter1',
      keyspace
    });

    await client.connect();
    this.connections.set(key, client);
    return client;
  }

  async closeAll(): Promise<void> {
    for (const client of this.connections.values()) {
      await client.shutdown();
    }
    this.connections.clear();
  }

  getPoolStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.options.maxConnections
    };
  }
}
