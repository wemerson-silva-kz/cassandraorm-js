const cassandra = require('cassandra-driver');

class ConnectionPool {
  constructor(options = {}) {
    this.pools = new Map();
    this.defaultOptions = {
      contactPoints: ['localhost'],
      localDataCenter: 'datacenter1',
      pooling: {
        coreConnectionsPerHost: { 
          [cassandra.types.distance.local]: 2, 
          [cassandra.types.distance.remote]: 1 
        },
        maxConnectionsPerHost: { 
          [cassandra.types.distance.local]: 8, 
          [cassandra.types.distance.remote]: 4 
        },
        maxRequestsPerConnection: 32768,
        heartBeatInterval: 30000
      },
      ...options
    };
  }

  async getConnection(keyspace = null) {
    const key = keyspace || 'default';
    
    if (this.pools.has(key)) {
      return this.pools.get(key);
    }

    const client = new cassandra.Client({
      ...this.defaultOptions,
      keyspace
    });

    await client.connect();
    this.pools.set(key, client);
    
    return client;
  }

  async closeAll() {
    for (const [key, client] of this.pools) {
      await client.shutdown();
      this.pools.delete(key);
    }
  }

  getPoolStats() {
    const stats = {};
    for (const [key, client] of this.pools) {
      try {
        const state = client.getState();
        const hosts = state.getConnectedHosts();
        stats[key] = {
          connected: hosts.length,
          totalConnections: hosts.reduce((total, host) => {
            try {
              return total + state.getInFlightQueries(host);
            } catch (e) {
              return total;
            }
          }, 0)
        };
      } catch (error) {
        stats[key] = {
          connected: 0,
          totalConnections: 0,
          error: error.message
        };
      }
    }
    return stats;
  }
}

module.exports = { ConnectionPool };
