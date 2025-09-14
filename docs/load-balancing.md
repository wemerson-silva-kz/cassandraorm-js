# Load Balancing

## Overview
Advanced load balancing strategies with health monitoring, automatic failover, and intelligent traffic distribution across Cassandra clusters.

## Load Balancer Setup

```typescript
import { LoadBalancer } from 'cassandraorm-js';

const loadBalancer = new LoadBalancer({
  nodes: [
    { host: 'cassandra-1', port: 9042, datacenter: 'dc1', rack: 'rack1' },
    { host: 'cassandra-2', port: 9042, datacenter: 'dc1', rack: 'rack2' },
    { host: 'cassandra-3', port: 9042, datacenter: 'dc2', rack: 'rack1' }
  ],
  strategy: 'token_aware_round_robin',
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000
  }
});

const client = createClient({
  loadBalancer,
  localDataCenter: 'dc1'
});
```

## Load Balancing Strategies

```typescript
// Round Robin
const roundRobinLB = new LoadBalancer({
  strategy: 'round_robin',
  nodes: cassandraNodes
});

// Weighted Round Robin
const weightedRoundRobinLB = new LoadBalancer({
  strategy: 'weighted_round_robin',
  nodes: [
    { host: 'cassandra-1', port: 9042, weight: 3 },
    { host: 'cassandra-2', port: 9042, weight: 2 },
    { host: 'cassandra-3', port: 9042, weight: 1 }
  ]
});

// Least Connections
const leastConnectionsLB = new LoadBalancer({
  strategy: 'least_connections',
  nodes: cassandraNodes,
  connectionTracking: true
});

// Token Aware
const tokenAwareLB = new LoadBalancer({
  strategy: 'token_aware',
  nodes: cassandraNodes,
  tokenMap: true // Automatically build token map
});
```

## Datacenter-Aware Load Balancing

```typescript
import { DatacenterAwareLoadBalancer } from 'cassandraorm-js';

const dcAwareLB = new DatacenterAwareLoadBalancer({
  localDatacenter: 'dc1',
  remoteDatacenters: ['dc2', 'dc3'],
  policy: {
    localOnly: false,
    remoteNodesPerDC: 1,
    allowRemoteOnLocalFailure: true
  },
  nodes: [
    { host: 'dc1-node1', datacenter: 'dc1', priority: 1 },
    { host: 'dc1-node2', datacenter: 'dc1', priority: 1 },
    { host: 'dc2-node1', datacenter: 'dc2', priority: 2 },
    { host: 'dc3-node1', datacenter: 'dc3', priority: 3 }
  ]
});

// Prefer local datacenter, fallback to remote
const client = createClient({
  loadBalancer: dcAwareLB,
  consistencyLevel: 'LOCAL_QUORUM'
});
```

## Health Monitoring

```typescript
import { HealthMonitor } from 'cassandraorm-js';

const healthMonitor = new HealthMonitor({
  checkInterval: 15000,
  unhealthyThreshold: 3,
  healthyThreshold: 2,
  checks: [
    {
      name: 'connection',
      check: async (node) => {
        try {
          await node.execute('SELECT now() FROM system.local');
          return { healthy: true };
        } catch (error) {
          return { healthy: false, error: error.message };
        }
      }
    },
    {
      name: 'latency',
      check: async (node) => {
        const start = Date.now();
        await node.execute('SELECT now() FROM system.local');
        const latency = Date.now() - start;
        
        return {
          healthy: latency < 100, // 100ms threshold
          metrics: { latency }
        };
      }
    },
    {
      name: 'load',
      check: async (node) => {
        const result = await node.execute('SELECT * FROM system.compaction_history LIMIT 1');
        const load = calculateNodeLoad(result);
        
        return {
          healthy: load < 0.8, // 80% threshold
          metrics: { load }
        };
      }
    }
  ]
});

loadBalancer.setHealthMonitor(healthMonitor);

// Handle health events
healthMonitor.on('nodeUnhealthy', (node) => {
  console.log(`Node ${node.host} marked as unhealthy`);
  loadBalancer.removeNode(node);
});

healthMonitor.on('nodeHealthy', (node) => {
  console.log(`Node ${node.host} marked as healthy`);
  loadBalancer.addNode(node);
});
```

## Adaptive Load Balancing

```typescript
import { AdaptiveLoadBalancer } from 'cassandraorm-js';

const adaptiveLB = new AdaptiveLoadBalancer({
  baseStrategy: 'round_robin',
  adaptationInterval: 60000,
  metrics: ['latency', 'throughput', 'error_rate'],
  thresholds: {
    latency: 50, // ms
    throughput: 1000, // ops/sec
    error_rate: 0.01 // 1%
  }
});

// Automatically adjust weights based on performance
adaptiveLB.on('adaptation', (changes) => {
  console.log('Load balancer adapted:', changes);
});

// Custom adaptation logic
adaptiveLB.setAdaptationStrategy((metrics, nodes) => {
  return nodes.map(node => {
    const nodeMetrics = metrics[node.id];
    let weight = 1;
    
    // Reduce weight for high latency nodes
    if (nodeMetrics.latency > 100) {
      weight *= 0.5;
    }
    
    // Increase weight for high throughput nodes
    if (nodeMetrics.throughput > 2000) {
      weight *= 1.5;
    }
    
    return { ...node, weight };
  });
});
```

## Connection Pooling with Load Balancing

```typescript
import { PooledLoadBalancer } from 'cassandraorm-js';

const pooledLB = new PooledLoadBalancer({
  nodes: cassandraNodes,
  poolConfig: {
    coreConnectionsPerHost: {
      local: 2,
      remote: 1
    },
    maxConnectionsPerHost: {
      local: 8,
      remote: 2
    },
    maxRequestsPerConnection: 32768
  },
  loadBalancing: {
    strategy: 'least_busy',
    considerPoolUtilization: true
  }
});

// Monitor pool utilization
pooledLB.on('poolUtilization', (stats) => {
  console.log('Pool utilization:', stats);
  
  // Scale pool if needed
  if (stats.avgUtilization > 0.8) {
    pooledLB.scalePool(1.2); // Increase by 20%
  }
});
```

## Query-Aware Load Balancing

```typescript
import { QueryAwareLoadBalancer } from 'cassandraorm-js';

const queryAwareLB = new QueryAwareLoadBalancer({
  nodes: cassandraNodes,
  routing: {
    readQueries: {
      strategy: 'least_latency',
      preferLocal: true
    },
    writeQueries: {
      strategy: 'token_aware',
      consistencyLevel: 'QUORUM'
    },
    analyticalQueries: {
      strategy: 'dedicated_nodes',
      nodes: ['analytics-node-1', 'analytics-node-2']
    }
  }
});

// Route based on query type
const readResult = await client.execute('SELECT * FROM users WHERE id = ?', [userId], {
  queryType: 'read'
});

const writeResult = await client.execute('INSERT INTO users (id, name) VALUES (?, ?)', [id, name], {
  queryType: 'write'
});
```

## Failover and Recovery

```typescript
import { FailoverManager } from 'cassandraorm-js';

const failoverManager = new FailoverManager(loadBalancer, {
  failoverTimeout: 30000,
  maxFailoverAttempts: 3,
  recoveryCheckInterval: 60000,
  autoRecovery: true
});

// Handle failover events
failoverManager.on('failover', (failedNode, activeNodes) => {
  console.log(`Failed over from ${failedNode.host} to ${activeNodes.length} nodes`);
  
  // Notify monitoring system
  alertingService.sendAlert('Node failover', {
    failedNode: failedNode.host,
    activeNodes: activeNodes.length
  });
});

failoverManager.on('recovery', (recoveredNode) => {
  console.log(`Node ${recoveredNode.host} recovered and added back to pool`);
});

// Manual failover
await failoverManager.failover('cassandra-1:9042');

// Check failover status
const status = await failoverManager.getStatus();
console.log('Failover status:', status);
```

## Load Balancing Metrics

```typescript
import { LoadBalancingMetrics } from 'cassandraorm-js';

const metrics = new LoadBalancingMetrics(loadBalancer);

// Real-time metrics
setInterval(async () => {
  const stats = await metrics.getStats();
  
  console.log('Load Balancing Stats:');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Requests per node:`, stats.requestsPerNode);
  console.log(`Average latency:`, stats.avgLatency);
  console.log(`Error rate: ${stats.errorRate}%`);
}, 30000);

// Export metrics to monitoring systems
metrics.exportToPrometheus({
  endpoint: '/lb-metrics',
  port: 9093
});

metrics.exportToGraphite({
  host: 'graphite.example.com',
  port: 2003,
  prefix: 'cassandra.loadbalancer'
});
```

## Custom Load Balancing Policies

```typescript
import { CustomLoadBalancingPolicy } from 'cassandraorm-js';

class GeographicLoadBalancingPolicy extends CustomLoadBalancingPolicy {
  constructor(userLocation) {
    super();
    this.userLocation = userLocation;
  }

  selectNode(availableNodes, query) {
    // Sort nodes by geographic distance
    const sortedNodes = availableNodes.sort((a, b) => {
      const distanceA = this.calculateDistance(this.userLocation, a.location);
      const distanceB = this.calculateDistance(this.userLocation, b.location);
      return distanceA - distanceB;
    });

    // Return closest healthy node
    return sortedNodes.find(node => node.isHealthy) || sortedNodes[0];
  }

  calculateDistance(loc1, loc2) {
    // Haversine formula for geographic distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLon = this.toRad(loc2.lon - loc1.lon);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
}

// Use custom policy
const geoLB = new LoadBalancer({
  policy: new GeographicLoadBalancingPolicy({ lat: 40.7128, lon: -74.0060 }),
  nodes: nodesWithLocations
});
```
