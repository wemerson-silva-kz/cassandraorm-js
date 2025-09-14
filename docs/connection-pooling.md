# Connection Pooling

## Overview
Advanced connection pooling with load balancing, failover, and adaptive scaling for optimal performance.

## Pool Configuration

```typescript
import { createClient, PoolingOptions } from 'cassandraorm-js';

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
      },
      maxRequestsPerConnection: 32768,
      heartBeatInterval: 30000
    }
  }
});
```

## Dynamic Pool Scaling

```typescript
import { AdaptivePoolManager } from 'cassandraorm-js';

const poolManager = new AdaptivePoolManager(client, {
  minConnections: 2,
  maxConnections: 20,
  scaleUpThreshold: 0.8,   // Scale up when 80% utilized
  scaleDownThreshold: 0.3, // Scale down when 30% utilized
  scaleUpBy: 2,
  scaleDownBy: 1,
  evaluationInterval: 10000 // 10 seconds
});

// Monitor pool scaling
poolManager.on('scaleUp', (newSize) => {
  console.log(`Pool scaled up to ${newSize} connections`);
});

poolManager.on('scaleDown', (newSize) => {
  console.log(`Pool scaled down to ${newSize} connections`);
});

await poolManager.start();
```

## Load Balancing Strategies

```typescript
import { LoadBalancingPolicy } from 'cassandraorm-js';

// Round Robin (default)
const roundRobinClient = createClient({
  clientOptions: {
    policies: {
      loadBalancing: new RoundRobinPolicy()
    }
  }
});

// Token Aware
const tokenAwareClient = createClient({
  clientOptions: {
    policies: {
      loadBalancing: new TokenAwarePolicy(new RoundRobinPolicy())
    }
  }
});

// DC Aware
const dcAwareClient = createClient({
  clientOptions: {
    policies: {
      loadBalancing: new DCAwareRoundRobinPolicy('datacenter1', 2)
    }
  }
});

// Custom load balancing
class CustomLoadBalancingPolicy extends LoadBalancingPolicy {
  newQueryPlan(keyspace, query, executionProfile) {
    // Custom logic to select hosts
    const hosts = this.getAvailableHosts();
    return hosts.sort((a, b) => a.getCpuUsage() - b.getCpuUsage());
  }
}
```

## Connection Health Monitoring

```typescript
import { ConnectionHealthMonitor } from 'cassandraorm-js';

const healthMonitor = new ConnectionHealthMonitor(client, {
  checkInterval: 5000,
  unhealthyThreshold: 3,
  healthyThreshold: 2
});

// Monitor connection health
healthMonitor.on('connectionUnhealthy', (host, connection) => {
  console.log(`Connection to ${host} is unhealthy`);
});

healthMonitor.on('connectionRecovered', (host, connection) => {
  console.log(`Connection to ${host} recovered`);
});

// Get health status
const healthStatus = await healthMonitor.getHealthStatus();
console.log('Healthy connections:', healthStatus.healthy);
console.log('Unhealthy connections:', healthStatus.unhealthy);
```

## Connection Retry Policies

```typescript
import { RetryPolicy, ExponentialReconnectionPolicy } from 'cassandraorm-js';

// Custom retry policy
class CustomRetryPolicy extends RetryPolicy {
  onReadTimeout(info) {
    if (info.receivedResponses >= info.requiredResponses) {
      return { decision: 'retry', consistency: info.consistency };
    }
    return { decision: 'rethrow' };
  }

  onWriteTimeout(info) {
    if (info.writeType === 'BATCH_LOG') {
      return { decision: 'retry', consistency: info.consistency };
    }
    return { decision: 'rethrow' };
  }

  onUnavailable(info) {
    return { decision: 'nextHost' };
  }
}

const clientWithRetry = createClient({
  clientOptions: {
    policies: {
      retry: new CustomRetryPolicy(),
      reconnection: new ExponentialReconnectionPolicy(1000, 10 * 60 * 1000, 2)
    }
  }
});
```

## Connection Metrics

```typescript
import { ConnectionMetrics } from 'cassandraorm-js';

const metrics = new ConnectionMetrics(client);

// Real-time metrics
setInterval(async () => {
  const stats = await metrics.getStats();
  
  console.log('Connection Pool Stats:');
  console.log(`Active connections: ${stats.activeConnections}`);
  console.log(`Idle connections: ${stats.idleConnections}`);
  console.log(`Requests in flight: ${stats.inFlightRequests}`);
  console.log(`Average response time: ${stats.avgResponseTime}ms`);
  console.log(`Connection errors: ${stats.connectionErrors}`);
}, 10000);

// Export metrics to monitoring system
metrics.exportToPrometheus({
  endpoint: '/metrics',
  port: 9090
});
```

## Multi-Datacenter Pooling

```typescript
const multiDcClient = createClient({
  clientOptions: {
    contactPoints: [
      'dc1-node1:9042', 'dc1-node2:9042',
      'dc2-node1:9042', 'dc2-node2:9042'
    ],
    pooling: {
      coreConnectionsPerHost: {
        [distance.local]: 4,
        [distance.remote]: 1
      },
      maxConnectionsPerHost: {
        [distance.local]: 10,
        [distance.remote]: 2
      }
    },
    policies: {
      loadBalancing: new DCAwareRoundRobinPolicy('dc1', 1, true)
    }
  }
});
```

## Connection Warmup

```typescript
import { ConnectionWarmer } from 'cassandraorm-js';

const warmer = new ConnectionWarmer(client, {
  warmupQueries: [
    'SELECT now() FROM system.local',
    'SELECT * FROM system.peers LIMIT 1'
  ],
  parallelConnections: 5,
  timeout: 5000
});

// Warm up connections on startup
await warmer.warmup();

// Periodic warmup
warmer.scheduleWarmup('0 */30 * * * *'); // Every 30 minutes
```

## Connection Pooling Best Practices

```typescript
// Production configuration
const productionClient = createClient({
  clientOptions: {
    contactPoints: process.env.CASSANDRA_HOSTS?.split(','),
    localDataCenter: process.env.CASSANDRA_DC,
    pooling: {
      coreConnectionsPerHost: {
        [distance.local]: 4,
        [distance.remote]: 1
      },
      maxConnectionsPerHost: {
        [distance.local]: 16,
        [distance.remote]: 4
      },
      maxRequestsPerConnection: 32768,
      heartBeatInterval: 30000
    },
    socketOptions: {
      connectTimeout: 5000,
      readTimeout: 12000,
      keepAlive: true,
      keepAliveDelay: 0,
      tcpNoDelay: true
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down connection pool...');
  await client.shutdown();
  process.exit(0);
});
```
