# Connection Management

## Overview
CassandraORM JS provides robust connection management with automatic failover, connection pooling, and health monitoring.

## Basic Connection

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1:9042'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  }
});

await client.connect();
```

## Connection Pool Configuration

```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['node1:9042', 'node2:9042', 'node3:9042'],
    localDataCenter: 'datacenter1',
    pooling: {
      coreConnectionsPerHost: {
        [distance.local]: 2,
        [distance.remote]: 1
      },
      maxConnectionsPerHost: {
        [distance.local]: 8,
        [distance.remote]: 2
      }
    }
  }
});
```

## Health Monitoring

```typescript
import { ConnectionMonitor } from 'cassandraorm-js';

const monitor = new ConnectionMonitor(client);

monitor.on('nodeDown', (address) => {
  console.log(`Node ${address} is down`);
});

monitor.on('nodeUp', (address) => {
  console.log(`Node ${address} is back up`);
});

// Get connection status
const status = await monitor.getStatus();
console.log(`Active connections: ${status.activeConnections}`);
```

## Automatic Failover

```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['primary:9042', 'secondary:9042'],
    policies: {
      loadBalancing: new RoundRobinPolicy(),
      retry: new RetryPolicy(),
      reconnection: new ExponentialReconnectionPolicy(1000, 10 * 60 * 1000)
    }
  }
});
```

## Connection Events

```typescript
client.on('connected', () => console.log('Connected to Cassandra'));
client.on('disconnected', () => console.log('Disconnected'));
client.on('error', (error) => console.error('Connection error:', error));
```
