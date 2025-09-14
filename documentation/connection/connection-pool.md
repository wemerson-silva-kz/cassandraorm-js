# 🏊 Connection Pool Management

Advanced connection pooling and management for optimal performance and scalability.

## 🎯 Overview

CassandraORM JS provides sophisticated connection pooling:
- **Basic ConnectionPool** for simple scenarios
- **AdvancedConnectionPool** for enterprise needs
- **Load balancing** strategies
- **Health monitoring** and failover
- **Performance optimization**

## 🔧 Basic Connection Pool

### Simple Pool Configuration

```typescript
import { ConnectionPool } from 'cassandraorm-js';

const pool = new ConnectionPool({
  contactPoints: ['127.0.0.1', '127.0.0.2'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp',
  
  // Basic pool settings
  pooling: {
    coreConnectionsPerHost: { '0': 2, '1': 1 },
    maxConnectionsPerHost: { '0': 8, '1': 2 },
    maxRequestsPerConnection: 32768,
    heartBeatInterval: 30000
  }
});

await pool.connect();
```

### Pool Statistics

```typescript
const stats = pool.getStats();
console.log('Pool Statistics:', {
  activeConnections: stats.activeConnections,
  idleConnections: stats.idleConnections,
  totalConnections: stats.totalConnections,
  requestsInFlight: stats.requestsInFlight,
  connectionErrors: stats.connectionErrors
});
```

## 🚀 Advanced Connection Pool

### Enterprise Pool Configuration

```typescript
import { AdvancedConnectionPool } from 'cassandraorm-js';

const advancedPool = new AdvancedConnectionPool({
  // Basic connection settings
  contactPoints: ['node1.cassandra.com', 'node2.cassandra.com', 'node3.cassandra.com'],
  localDataCenter: 'datacenter1',
  keyspace: 'production_app',
  
  // Advanced pooling options
  pooling: {
    coreConnectionsPerHost: { '0': 4, '1': 2, '2': 1 },
    maxConnectionsPerHost: { '0': 16, '1': 8, '2': 4 },
    maxRequestsPerConnection: 32768,
    heartBeatInterval: 30000,
    
    // Pool warmup
    warmup: true,
    warmupTimeout: 10000,
    
    // Connection lifecycle
    idleTimeout: 120000,
    connectionTimeout: 5000,
    
    // Pool monitoring
    enableMetrics: true,
    metricsInterval: 5000
  },
  
  // Load balancing
  loadBalancing: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy',
    usedHostsPerRemoteDc: 1
  },
  
  // Retry and failover
  retry: {
    policy: 'DefaultRetryPolicy',
    maxRetries: 3,
    retryDelay: 1000
  },
  
  // Health monitoring
  healthCheck: {
    enabled: true,
    interval: 10000,
    timeout: 5000,
    query: 'SELECT release_version FROM system.local'
  }
});
```

### Pool Lifecycle Management

```typescript
// Initialize pool
await advancedPool.initialize();

// Warm up connections
await advancedPool.warmup();

// Monitor pool health
advancedPool.on('connectionAdded', (host) => {
  console.log(`Connection added to ${host}`);
});

advancedPool.on('connectionRemoved', (host) => {
  console.log(`Connection removed from ${host}`);
});

advancedPool.on('hostDown', (host) => {
  console.log(`Host ${host} is down`);
});

advancedPool.on('hostUp', (host) => {
  console.log(`Host ${host} is back up`);
});
```

## ⚖️ Load Balancing Strategies

### Round Robin Policy

```typescript
const roundRobinPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'RoundRobinPolicy'
  }
});
```

### DC-Aware Round Robin

```typescript
const dcAwarePool = new AdvancedConnectionPool({
  contactPoints: ['dc1-node1', 'dc1-node2', 'dc2-node1'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'DCAwareRoundRobinPolicy',
    usedHostsPerRemoteDc: 1, // Use 1 host from remote DC as fallback
    allowRemoteDCsForLocalConsistencyLevel: false
  }
});
```

### Token Aware Policy

```typescript
const tokenAwarePool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy', // Fallback policy
    shuffleReplicas: true
  }
});
```

## 📊 Connection Monitoring

### Real-time Metrics

```typescript
const metrics = await advancedPool.getMetrics();
console.log('Connection Metrics:', {
  // Per-host metrics
  hostsUp: metrics.hostsUp,
  hostsDown: metrics.hostsDown,
  
  // Connection metrics
  totalConnections: metrics.totalConnections,
  activeConnections: metrics.activeConnections,
  idleConnections: metrics.idleConnections,
  
  // Request metrics
  requestsPerSecond: metrics.requestsPerSecond,
  averageLatency: metrics.averageLatency,
  errorRate: metrics.errorRate,
  
  // Pool efficiency
  poolUtilization: metrics.poolUtilization,
  connectionTurnover: metrics.connectionTurnover
});
```

### Health Monitoring

```typescript
const healthStatus = await advancedPool.getHealthStatus();
console.log('Pool Health:', {
  status: healthStatus.overall, // 'healthy', 'degraded', 'unhealthy'
  
  hosts: healthStatus.hosts.map(host => ({
    address: host.address,
    status: host.status,
    connections: host.connections,
    latency: host.averageLatency,
    errorRate: host.errorRate
  })),
  
  recommendations: healthStatus.recommendations
});
```

## 🔧 Pool Optimization

### Dynamic Pool Sizing

```typescript
const adaptivePool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2'],
  localDataCenter: 'datacenter1',
  
  pooling: {
    // Dynamic sizing based on load
    adaptivePooling: {
      enabled: true,
      minConnections: 2,
      maxConnections: 20,
      targetUtilization: 0.7,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      evaluationInterval: 30000
    }
  }
});
```

### Connection Preallocation

```typescript
// Preallocate connections for predictable workloads
await advancedPool.preallocateConnections({
  'node1': 8,
  'node2': 8,
  'node3': 4
});
```

### Circuit Breaker Pattern

```typescript
const resilientPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2'],
  localDataCenter: 'datacenter1',
  
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    recoveryTimeout: 30000,
    halfOpenMaxCalls: 3
  }
});
```

## 🎯 Performance Tuning

### High-Throughput Configuration

```typescript
const highThroughputPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  pooling: {
    // Maximize connections for high throughput
    coreConnectionsPerHost: { '0': 8 },
    maxConnectionsPerHost: { '0': 32 },
    maxRequestsPerConnection: 65536,
    
    // Aggressive connection management
    heartBeatInterval: 10000,
    idleTimeout: 60000,
    
    // Batch operations
    enableBatching: true,
    batchSize: 100,
    batchTimeout: 10
  }
});
```

### Low-Latency Configuration

```typescript
const lowLatencyPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2'],
  localDataCenter: 'datacenter1',
  
  pooling: {
    // Optimize for low latency
    coreConnectionsPerHost: { '0': 4 },
    maxConnectionsPerHost: { '0': 8 },
    
    // Keep connections warm
    warmup: true,
    idleTimeout: 300000, // 5 minutes
    
    // Fast connection establishment
    connectionTimeout: 2000,
    enableTcpNoDelay: true,
    enableTcpKeepAlive: true
  }
});
```

## 🚨 Error Handling & Resilience

### Automatic Failover

```typescript
const resilientPool = new AdvancedConnectionPool({
  contactPoints: ['primary-node', 'backup-node1', 'backup-node2'],
  localDataCenter: 'datacenter1',
  
  failover: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    
    // Automatic host discovery
    autoDiscovery: true,
    discoveryInterval: 60000
  }
});

// Handle failover events
resilientPool.on('failover', (event) => {
  console.log(`Failover: ${event.from} -> ${event.to}`);
});
```

### Connection Recovery

```typescript
// Automatic connection recovery
resilientPool.on('connectionLost', async (host) => {
  console.log(`Connection lost to ${host}, attempting recovery...`);
  
  // Custom recovery logic
  await resilientPool.recoverConnection(host, {
    maxAttempts: 5,
    backoffDelay: 2000
  });
});
```

## 📈 Scaling Strategies

### Horizontal Scaling

```typescript
// Add nodes dynamically
await advancedPool.addNode('new-node.cassandra.com');

// Remove nodes gracefully
await advancedPool.removeNode('old-node.cassandra.com', {
  drainConnections: true,
  drainTimeout: 30000
});
```

### Multi-Region Setup

```typescript
const multiRegionPool = new AdvancedConnectionPool({
  contactPoints: [
    'us-east-1.cassandra.com',
    'us-west-2.cassandra.com',
    'eu-west-1.cassandra.com'
  ],
  localDataCenter: 'us-east-1',
  
  loadBalancing: {
    policy: 'DCAwareRoundRobinPolicy',
    usedHostsPerRemoteDc: 2
  },
  
  // Region-specific settings
  regionSettings: {
    'us-east-1': { maxConnections: 16, priority: 1 },
    'us-west-2': { maxConnections: 8, priority: 2 },
    'eu-west-1': { maxConnections: 4, priority: 3 }
  }
});
```

## 🔍 Debugging & Troubleshooting

### Connection Debugging

```typescript
// Enable detailed logging
const debugPool = new AdvancedConnectionPool({
  contactPoints: ['node1'],
  localDataCenter: 'datacenter1',
  
  logging: {
    level: 'debug',
    logConnections: true,
    logRequests: true,
    logErrors: true
  }
});

// Get detailed connection info
const connectionInfo = await debugPool.getConnectionDetails();
connectionInfo.forEach(conn => {
  console.log(`Connection ${conn.id}:`, {
    host: conn.host,
    state: conn.state,
    inFlight: conn.inFlightRequests,
    created: conn.createdAt,
    lastUsed: conn.lastUsedAt
  });
});
```

### Performance Analysis

```typescript
// Analyze pool performance
const analysis = await advancedPool.analyzePerformance();
console.log('Performance Analysis:', {
  bottlenecks: analysis.bottlenecks,
  recommendations: analysis.recommendations,
  metrics: {
    avgConnectionTime: analysis.avgConnectionTime,
    avgRequestTime: analysis.avgRequestTime,
    poolEfficiency: analysis.poolEfficiency
  }
});
```

## 🎯 Best Practices

### Production Configuration

```typescript
// ✅ Good: Production-ready pool
const productionPool = new AdvancedConnectionPool({
  contactPoints: process.env.CASSANDRA_HOSTS?.split(',') || ['localhost'],
  localDataCenter: process.env.CASSANDRA_DC || 'datacenter1',
  keyspace: process.env.CASSANDRA_KEYSPACE,
  
  pooling: {
    coreConnectionsPerHost: { '0': 4, '1': 2 },
    maxConnectionsPerHost: { '0': 16, '1': 8 },
    warmup: true,
    enableMetrics: true
  },
  
  loadBalancing: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy'
  },
  
  healthCheck: { enabled: true },
  circuitBreaker: { enabled: true }
});

// ❌ Avoid: Over-configured pool
const overConfiguredPool = new AdvancedConnectionPool({
  pooling: {
    maxConnectionsPerHost: { '0': 1000 }, // Too many connections
    heartBeatInterval: 1000, // Too frequent
    idleTimeout: 1000 // Too short
  }
});
```

## 🔗 Next Steps

- **[Load Balancing →](./load-balancing.md)** - Advanced load balancing strategies
- **[Monitoring →](../performance/monitoring.md)** - Monitor pool performance
- **[Performance →](../performance/optimization.md)** - Optimize connection performance

---

**Optimize connections for maximum performance and reliability! 🏊✨**
