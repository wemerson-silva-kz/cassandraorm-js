# ⚙️ Configuration Guide

Complete configuration options for CassandraORM JS client and ORM settings.

## 🎯 Basic Configuration

```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe'
  }
});
```

## 🔌 Client Options

### Connection Settings
```typescript
const clientOptions = {
  // Required: Cassandra nodes
  contactPoints: ['127.0.0.1', '127.0.0.2', '127.0.0.3'],
  
  // Required: Data center name
  localDataCenter: 'datacenter1',
  
  // Optional: Default keyspace
  keyspace: 'myapp',
  
  // Optional: Port (default: 9042)
  port: 9042,
  
  // Optional: Connection timeout
  connectTimeout: 5000,
  
  // Optional: Read timeout
  readTimeout: 12000
};
```

### Authentication
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  // Username/Password authentication
  credentials: {
    username: 'cassandra',
    password: 'cassandra'
  }
};
```

### SSL/TLS Configuration
```typescript
import fs from 'fs';

const clientOptions = {
  contactPoints: ['secure-cluster.example.com'],
  localDataCenter: 'datacenter1',
  
  sslOptions: {
    // Certificate Authority
    ca: [fs.readFileSync('ca-cert.pem')],
    
    // Client certificate (mutual TLS)
    cert: fs.readFileSync('client-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
    
    // Verify server certificate
    rejectUnauthorized: true,
    
    // Server hostname
    servername: 'cassandra.example.com',
    
    // TLS version
    secureProtocol: 'TLSv1_2_method'
  }
};
```

## 🏊 Connection Pooling

### Basic Pooling
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  pooling: {
    // Core connections per host
    coreConnectionsPerHost: {
      '0': 1,  // Local DC
      '1': 1   // Remote DC
    },
    
    // Max connections per host
    maxConnectionsPerHost: {
      '0': 2,  // Local DC
      '1': 1   // Remote DC
    },
    
    // Max requests per connection
    maxRequestsPerConnection: 32768,
    
    // Connection heartbeat interval
    heartBeatInterval: 30000
  }
};
```

### Advanced Pooling
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  pooling: {
    coreConnectionsPerHost: { '0': 2, '1': 1 },
    maxConnectionsPerHost: { '0': 8, '1': 2 },
    maxRequestsPerConnection: 32768,
    heartBeatInterval: 30000,
    
    // Pool warmup
    warmup: true,
    
    // Connection idle timeout
    idleTimeout: 120000,
    
    // Pool size monitoring
    poolSizePerHost: { '0': 4, '1': 2 }
  }
};
```

## 🎛️ Load Balancing

### Round Robin (Default)
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1', '127.0.0.2'],
  localDataCenter: 'datacenter1',
  
  policies: {
    loadBalancing: 'RoundRobinPolicy'
  }
};
```

### DC-Aware Round Robin
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1', '127.0.0.2'],
  localDataCenter: 'datacenter1',
  
  policies: {
    loadBalancing: 'DCAwareRoundRobinPolicy',
    localDataCenter: 'datacenter1',
    usedHostsPerRemoteDc: 1
  }
};
```

### Token Aware
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1', '127.0.0.2'],
  localDataCenter: 'datacenter1',
  
  policies: {
    loadBalancing: 'TokenAwarePolicy',
    childPolicy: 'DCAwareRoundRobinPolicy'
  }
};
```

## 🔄 Retry Policies

### Default Retry Policy
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  policies: {
    retry: 'RetryPolicy'
  }
};
```

### Fallthrough Retry Policy
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  policies: {
    retry: 'FallthroughRetryPolicy'
  }
};
```

### Custom Retry Policy
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  policies: {
    retry: {
      onReadTimeout: 'retry',
      onWriteTimeout: 'ignore',
      onUnavailable: 'nextHost',
      maxRetries: 3
    }
  }
};
```

## 🎯 Consistency Levels

### Default Consistency
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  // Default consistency for all queries
  consistency: 'LOCAL_QUORUM'
};
```

### Per-Query Consistency
```typescript
// Override per query
const result = await client.execute(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { 
    consistency: 'ONE',
    prepare: true 
  }
);
```

### Available Consistency Levels
```typescript
const consistencyLevels = [
  'ANY',          // Weakest
  'ONE',
  'TWO', 
  'THREE',
  'QUORUM',
  'ALL',          // Strongest
  'LOCAL_QUORUM', // Recommended for multi-DC
  'EACH_QUORUM',
  'SERIAL',       // For lightweight transactions
  'LOCAL_SERIAL',
  'LOCAL_ONE'
];
```

## 🛠️ ORM Options

### Basic ORM Configuration
```typescript
const ormOptions = {
  // Auto-create keyspace
  createKeyspace: true,
  
  // Migration strategy
  migration: 'safe', // 'safe' | 'alter' | 'drop'
  
  // Enable query optimization
  enableQueryOptimization: true,
  
  // Enable metrics collection
  enableMetrics: true,
  
  // Default TTL for records
  defaultTTL: null,
  
  // Timezone for timestamps
  timezone: 'UTC'
};
```

### Advanced ORM Options
```typescript
const ormOptions = {
  createKeyspace: true,
  migration: 'safe',
  
  // Keyspace options
  keyspaceOptions: {
    replication: {
      class: 'SimpleStrategy',
      replication_factor: 3
    },
    durableWrites: true
  },
  
  // Model options
  modelOptions: {
    timestamps: true,
    paranoid: false,
    underscored: true,
    freezeTableName: true
  },
  
  // Validation options
  validation: {
    enabled: true,
    throwOnValidationError: true,
    validateOnSave: true
  },
  
  // Cache options
  cache: {
    enabled: true,
    ttl: 300,
    maxSize: 1000
  }
};
```

## 🔐 Security Configuration

### Authentication Providers
```typescript
// Plain text authenticator
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  authProvider: 'PlainTextAuthProvider',
  credentials: {
    username: 'cassandra',
    password: 'cassandra'
  }
};

// LDAP authenticator
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  authProvider: 'LdapAuthenticator',
  credentials: {
    username: 'user@domain.com',
    password: 'password'
  }
};
```

### Encryption at Rest
```typescript
const ormOptions = {
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY,
    
    // Fields to encrypt
    encryptedFields: ['email', 'phone', 'ssn'],
    
    // Key rotation
    keyRotation: {
      enabled: true,
      interval: '30d'
    }
  }
};
```

## 📊 Monitoring Configuration

### Metrics Collection
```typescript
const ormOptions = {
  metrics: {
    enabled: true,
    
    // Collection interval
    interval: 5000,
    
    // Metrics to collect
    collect: [
      'queries',
      'connections',
      'latency',
      'errors'
    ],
    
    // Export options
    export: {
      prometheus: {
        enabled: true,
        port: 9090,
        path: '/metrics'
      },
      
      cloudWatch: {
        enabled: false,
        region: 'us-east-1',
        namespace: 'CassandraORM'
      }
    }
  }
};
```

### Logging Configuration
```typescript
const clientOptions = {
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  
  // Logging options
  logging: {
    level: 'info', // 'error' | 'warn' | 'info' | 'debug'
    
    // Log queries
    logQueries: true,
    
    // Log slow queries
    slowQueryThreshold: 1000,
    
    // Custom logger
    logger: console,
    
    // Log format
    format: 'json'
  }
};
```

## 🌍 Environment-Specific Configs

### Development
```typescript
const developmentConfig = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp_dev'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'alter',
    enableQueryOptimization: false,
    logging: { level: 'debug' }
  }
};
```

### Testing
```typescript
const testConfig = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp_test'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'drop',
    enableMetrics: false,
    logging: { level: 'error' }
  }
};
```

### Production
```typescript
const productionConfig = {
  clientOptions: {
    contactPoints: process.env.CASSANDRA_HOSTS?.split(',') || ['127.0.0.1'],
    localDataCenter: process.env.CASSANDRA_DC || 'datacenter1',
    keyspace: process.env.CASSANDRA_KEYSPACE,
    
    credentials: {
      username: process.env.CASSANDRA_USERNAME,
      password: process.env.CASSANDRA_PASSWORD
    },
    
    sslOptions: process.env.CASSANDRA_SSL_ENABLED === 'true' ? {
      ca: [fs.readFileSync(process.env.CASSANDRA_CA_CERT!)],
      rejectUnauthorized: true
    } : undefined,
    
    pooling: {
      coreConnectionsPerHost: { '0': 4, '1': 2 },
      maxConnectionsPerHost: { '0': 10, '1': 4 }
    }
  },
  
  ormOptions: {
    createKeyspace: false,
    migration: 'safe',
    enableQueryOptimization: true,
    enableMetrics: true,
    
    metrics: {
      export: {
        prometheus: { enabled: true }
      }
    }
  }
};
```

## 📋 Configuration Validation

### Validate Configuration
```typescript
import { validateConfig } from 'cassandraorm-js';

const config = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1'
  }
};

try {
  const validatedConfig = validateConfig(config);
  console.log('✅ Configuration is valid');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
}
```

### Configuration Schema
```typescript
const configSchema = {
  clientOptions: {
    contactPoints: { type: 'array', required: true },
    localDataCenter: { type: 'string', required: true },
    keyspace: { type: 'string', optional: true },
    port: { type: 'number', default: 9042 },
    credentials: {
      username: { type: 'string' },
      password: { type: 'string' }
    }
  },
  
  ormOptions: {
    createKeyspace: { type: 'boolean', default: false },
    migration: { 
      type: 'string', 
      enum: ['safe', 'alter', 'drop'],
      default: 'safe'
    }
  }
};
```

## 🔗 Next Steps

- **[First Steps →](./first-steps.md)** - Build your first application
- **[Models & Schemas →](../core/models-schemas.md)** - Define your data models
- **[Connection Pool →](../core/connection-pool.md)** - Advanced connection management

---

**Configure CassandraORM JS for optimal performance and security! ⚙️✨**
