# ⚖️ Load Balancing

Advanced load balancing strategies for optimal request distribution across Cassandra nodes.

## 🎯 Overview

CassandraORM JS supports multiple load balancing policies:
- **RoundRobinPolicy** - Simple round-robin distribution
- **DCAwareRoundRobinPolicy** - Data center aware routing
- **TokenAwarePolicy** - Route to optimal replica nodes
- **Custom policies** for specific needs

## 🔄 Round Robin Policy

### Basic Round Robin

```typescript
import { AdvancedConnectionPool } from 'cassandraorm-js';

const roundRobinPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'RoundRobinPolicy'
  }
});

// Requests distributed evenly: node1 -> node2 -> node3 -> node1...
```

### Round Robin with Weights

```typescript
const weightedRoundRobinPool = new AdvancedConnectionPool({
  contactPoints: ['powerful-node', 'medium-node', 'small-node'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'WeightedRoundRobinPolicy',
    weights: {
      'powerful-node': 3, // Gets 3x more requests
      'medium-node': 2,   // Gets 2x more requests  
      'small-node': 1     // Gets 1x requests
    }
  }
});
```

## 🌐 DC-Aware Load Balancing

### Basic DC-Aware Policy

```typescript
const dcAwarePool = new AdvancedConnectionPool({
  contactPoints: [
    'dc1-node1', 'dc1-node2', 'dc1-node3',
    'dc2-node1', 'dc2-node2'
  ],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'DCAwareRoundRobinPolicy',
    
    // Use remote DC nodes as fallback
    usedHostsPerRemoteDc: 1,
    
    // Don't use remote DC for LOCAL_* consistency levels
    allowRemoteDCsForLocalConsistencyLevel: false
  }
});
```

### Multi-DC Configuration

```typescript
const multiDCPool = new AdvancedConnectionPool({
  contactPoints: [
    'us-east-1a.cassandra.com',
    'us-east-1b.cassandra.com', 
    'us-west-2a.cassandra.com',
    'eu-west-1a.cassandra.com'
  ],
  localDataCenter: 'us-east-1',
  
  loadBalancing: {
    policy: 'DCAwareRoundRobinPolicy',
    usedHostsPerRemoteDc: 2,
    
    // DC priorities
    dcPriorities: {
      'us-east-1': 1,  // Primary
      'us-west-2': 2,  // Secondary
      'eu-west-1': 3   // Tertiary
    }
  }
});
```

## 🎯 Token Aware Policy

### Basic Token Awareness

```typescript
const tokenAwarePool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy', // Fallback when token not available
    shuffleReplicas: true // Randomize replica selection
  }
});

// Queries with partition keys automatically routed to optimal nodes
const user = await User.findOne({ id: userId }); // Routes to node owning this token
```

### Token Aware with Replica Awareness

```typescript
const replicaAwarePool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2', 'node3'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy',
    
    // Replica selection strategy
    replicaOrdering: 'TOPOLOGICAL', // or 'RANDOM'
    
    // Prefer local replicas
    preferLocalReplicas: true,
    
    // Shuffle replicas for load distribution
    shuffleReplicas: true
  }
});
```

## 🔧 Custom Load Balancing

### Custom Policy Implementation

```typescript
class CustomLoadBalancingPolicy {
  private hosts: string[] = [];
  private currentIndex: number = 0;
  private hostMetrics: Map<string, any> = new Map();

  init(hosts: string[]): void {
    this.hosts = [...hosts];
  }

  nextHost(query?: any): string {
    // Custom logic: prefer hosts with lower latency
    const sortedHosts = this.hosts.sort((a, b) => {
      const latencyA = this.hostMetrics.get(a)?.latency || 0;
      const latencyB = this.hostMetrics.get(b)?.latency || 0;
      return latencyA - latencyB;
    });

    // Return host with lowest latency
    return sortedHosts[0];
  }

  onHostUp(host: string): void {
    if (!this.hosts.includes(host)) {
      this.hosts.push(host);
    }
  }

  onHostDown(host: string): void {
    this.hosts = this.hosts.filter(h => h !== host);
  }

  updateMetrics(host: string, metrics: any): void {
    this.hostMetrics.set(host, metrics);
  }
}

// Use custom policy
const customPool = new AdvancedConnectionPool({
  contactPoints: ['node1', 'node2'],
  localDataCenter: 'datacenter1',
  
  loadBalancing: {
    policy: new CustomLoadBalancingPolicy()
  }
});
```

### Workload-Specific Policies

```typescript
// Read-heavy workload
const readHeavyPolicy = {
  policy: 'TokenAwarePolicy',
  childPolicy: 'DCAwareRoundRobinPolicy',
  preferLocalReplicas: true,
  readRepairChance: 0.1
};

// Write-heavy workload  
const writeHeavyPolicy = {
  policy: 'DCAwareRoundRobinPolicy',
  usedHostsPerRemoteDc: 0, // Local DC only for writes
  consistencyLevel: 'LOCAL_QUORUM'
};

// Analytics workload
const analyticsPolicy = {
  policy: 'RoundRobinPolicy', // Distribute load evenly
  allowRemoteDCs: true,
  consistencyLevel: 'ONE' // Eventual consistency OK
};
```

## 📊 Load Balancing Metrics

### Policy Performance

```typescript
const policyMetrics = await pool.getLoadBalancingMetrics();
console.log('Load Balancing Metrics:', {
  // Request distribution
  requestsPerHost: policyMetrics.requestsPerHost,
  
  // Performance per host
  latencyPerHost: policyMetrics.latencyPerHost,
  errorRatePerHost: policyMetrics.errorRatePerHost,
  
  // Policy efficiency
  loadDistribution: policyMetrics.loadDistribution,
  hotspots: policyMetrics.hotspots,
  
  // Recommendations
  recommendations: policyMetrics.recommendations
});
```

### Real-time Monitoring

```typescript
// Monitor load balancing in real-time
pool.on('requestRouted', (event) => {
  console.log(`Request routed to ${event.host} (policy: ${event.policy})`);
});

pool.on('loadImbalance', (event) => {
  console.log(`Load imbalance detected: ${event.details}`);
});
```

## 🎯 Best Practices

### Policy Selection Guidelines

```typescript
// ✅ Good: Choose policy based on workload
const workloadPolicies = {
  // OLTP applications
  oltp: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy',
    preferLocalReplicas: true
  },
  
  // Analytics applications
  analytics: {
    policy: 'RoundRobinPolicy',
    allowRemoteDCs: true,
    consistencyLevel: 'ONE'
  },
  
  // Real-time applications
  realtime: {
    policy: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy',
    usedHostsPerRemoteDc: 0 // Local DC only
  }
};

// ❌ Avoid: Wrong policy for workload
const badConfig = {
  // Don't use RoundRobin for partition-key queries
  policy: 'RoundRobinPolicy' // Should use TokenAware
};
```

### Monitoring and Alerting

```typescript
// Set up load balancing alerts
pool.setAlerts({
  loadImbalanceThreshold: 0.3, // Alert if 30% imbalance
  hostDownThreshold: 2, // Alert if 2+ hosts down
  latencyThreshold: 100, // Alert if latency > 100ms
  errorRateThreshold: 0.05 // Alert if error rate > 5%
});

pool.on('alert', (alert) => {
  console.log(`🚨 Load Balancing Alert: ${alert.type} - ${alert.message}`);
  
  // Send to monitoring system
  sendAlert(alert);
});
```

## 🔗 Next Steps

- **[Connection Pool →](./connection-pool.md)** - Pool configuration and management
- **[Monitoring →](../performance/monitoring.md)** - Monitor load balancing performance
- **[Performance →](../performance/optimization.md)** - Optimize load distribution

---

**Distribute load efficiently across your Cassandra cluster! ⚖️✨**
