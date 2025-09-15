import { createEnhancedClient } from '../src/index.js';

async function demonstrateDistributedSystems() {
  // Create enhanced client with distributed systems
  const client = createEnhancedClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'distributed_demo'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    },
    distributed: {
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'cassandraorm:',
        ttl: 3600
      },
      consul: {
        host: 'localhost',
        port: 8500,
        datacenter: 'dc1'
      },
      service: {
        name: 'cassandraorm-service',
        address: 'localhost',
        port: 3000,
        tags: ['cassandra', 'orm', 'distributed']
      }
    }
  });

  try {
    await client.connect();
    console.log('🚀 Enhanced client connected!');

    // Initialize distributed systems
    await client.initializeDistributedSystems();
    console.log('🌐 Distributed systems initialized!');

    // 1. Distributed Caching Demo
    console.log('\n💾 Distributed Caching:');
    
    // Execute query - will be cached in Redis
    const query = 'SELECT * FROM users WHERE active = ?';
    const params = [true];
    
    console.log('Executing query (first time - will cache in Redis)...');
    const result1 = await client.execute(query, params);
    console.log(`Query executed, ${result1?.rows?.length || 0} rows returned`);

    console.log('Executing same query (should hit Redis cache)...');
    const result2 = await client.execute(query, params);
    console.log(`Query executed from cache, ${result2?.rows?.length || 0} rows returned`);

    // 2. Distributed Locking Demo
    console.log('\n🔒 Distributed Locking:');
    
    const lockResource = 'user-update-123';
    console.log(`Acquiring distributed lock for: ${lockResource}`);
    
    await client.withDistributedLock(lockResource, async () => {
      console.log('✅ Lock acquired! Performing critical operation...');
      
      // Simulate critical operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Critical operation completed!');
    }, 10000); // 10 second lock timeout

    console.log('🔓 Lock released automatically');

    // 3. Service Discovery Demo
    console.log('\n🔍 Service Discovery:');
    
    try {
      const services = await client.discoverServices('cassandraorm-service');
      console.log('Discovered services:', services);
    } catch (error) {
      console.log('Service discovery not available (Consul not running?)');
    }

    // 4. Distributed Configuration Demo
    console.log('\n⚙️ Distributed Configuration:');
    
    try {
      // Set configuration
      await client.setDistributedConfig('cache_ttl', 7200);
      await client.setDistributedConfig('max_connections', 50);
      
      // Get configuration
      const cacheTtl = await client.getDistributedConfig('cache_ttl');
      const maxConnections = await client.getDistributedConfig('max_connections');
      
      console.log('Distributed config - cache_ttl:', cacheTtl);
      console.log('Distributed config - max_connections:', maxConnections);
    } catch (error) {
      console.log('Distributed config not available (Consul not running?)');
    }

    // 5. System Health Monitoring
    console.log('\n📊 System Health:');
    
    const health = await client.getSystemHealth();
    console.log('System Health:', JSON.stringify(health, null, 2));

    // 6. Manual Distributed Operations
    console.log('\n🛠️ Manual Distributed Operations:');
    
    // Manual lock operations
    const lockValue = await client.acquireDistributedLock('manual-lock', 5000);
    if (lockValue) {
      console.log('✅ Manual lock acquired:', lockValue);
      
      // Do some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const released = await client.releaseDistributedLock('manual-lock', lockValue);
      console.log('🔓 Manual lock released:', released);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.shutdownDistributedSystems();
    await client.shutdown();
    console.log('✅ Enhanced client and distributed systems shut down');
  }
}

// Production configuration example
export const productionDistributedConfig = {
  clientOptions: {
    contactPoints: ['cassandra-1.prod.com', 'cassandra-2.prod.com'],
    localDataCenter: 'datacenter1',
    keyspace: 'production_app'
  },
  distributed: {
    redis: {
      host: 'redis-cluster.prod.com',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'prod:cassandraorm:',
      ttl: 1800 // 30 minutes
    },
    consul: {
      host: 'consul.prod.com',
      port: 8500,
      secure: true,
      token: process.env.CONSUL_TOKEN,
      datacenter: 'prod-dc1'
    },
    service: {
      name: 'cassandraorm-api',
      address: process.env.SERVICE_ADDRESS,
      port: parseInt(process.env.PORT || '3000'),
      tags: ['api', 'cassandra', 'production']
    }
  }
};

// Development configuration example
export const developmentDistributedConfig = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'dev_app'
  },
  distributed: {
    redis: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'dev:cassandraorm:',
      ttl: 300 // 5 minutes
    },
    consul: {
      host: 'localhost',
      port: 8500
    },
    service: {
      name: 'cassandraorm-dev',
      address: 'localhost',
      port: 3000,
      tags: ['development', 'cassandra']
    }
  }
};

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateDistributedSystems().catch(console.error);
}
