import { createEnhancedClient } from '../src/index.js';

async function demonstrateEnhancedFeatures() {
  // Create enhanced client with AI/ML and Performance optimization
  const client = createEnhancedClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'enhanced_demo'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    },
    aiml: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
        model: 'text-embedding-3-small'
      },
      semanticCache: {
        enabled: true,
        threshold: 0.85
      }
    },
    performance: {
      queryCache: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000 // 5 minutes
      },
      connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        acquireTimeout: 5000
      },
      queryOptimization: {
        enabled: true,
        analyzeSlowQueries: true,
        slowQueryThreshold: 100 // 100ms
      }
    }
  });

  try {
    await client.connect();
    console.log('🚀 Enhanced client connected!');

    // 1. AI/ML Features Demo
    console.log('\n🧠 AI/ML Features:');
    
    // Generate embeddings
    const embedding = await client.generateEmbedding('Hello world, this is a test document');
    console.log(`Generated embedding with ${embedding.length} dimensions`);

    // AI-powered query optimization
    const optimization = await client.optimizeQueryWithAI('SELECT * FROM users');
    console.log('AI Query Optimization:', optimization);

    // Vector similarity search
    const similarDocs = await client.vectorSimilaritySearch(embedding, 0.8);
    console.log('Similar documents found:', similarDocs.length);

    // 2. Performance Features Demo
    console.log('\n⚡ Performance Features:');

    // Execute queries with automatic optimization and caching
    const query = 'SELECT * FROM users WHERE id = ?';
    const params = ['123e4567-e89b-12d3-a456-426614174000'];

    // First execution - will be cached
    console.log('Executing query (first time)...');
    await client.execute(query, params);

    // Second execution - should hit cache
    console.log('Executing same query (should hit cache)...');
    await client.execute(query, params);

    // 3. Performance Reports
    console.log('\n📊 Performance Reports:');
    
    const perfReport = client.getPerformanceReport();
    console.log('Performance Report:', JSON.stringify(perfReport, null, 2));

    const poolStats = client.getConnectionPoolStats();
    console.log('Connection Pool Stats:', poolStats);

    const cacheStats = client.getSemanticCacheStats();
    console.log('Semantic Cache Stats:', cacheStats);

    // 4. Semantic Caching Demo
    console.log('\n🎯 Semantic Caching Demo:');
    
    // These queries are semantically similar and should hit cache
    await client.execute('SELECT name, email FROM users WHERE active = true');
    await client.execute('SELECT name, email FROM users WHERE active = ?', [true]);
    await client.execute('SELECT name,email FROM users WHERE active=true'); // Different formatting

    console.log('Semantic cache stats after similar queries:', client.getSemanticCacheStats());

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.shutdown();
    console.log('✅ Enhanced client disconnected');
  }
}

// Configuration examples
export const productionConfig = {
  clientOptions: {
    contactPoints: ['cassandra-1.prod.com', 'cassandra-2.prod.com'],
    localDataCenter: 'datacenter1',
    keyspace: 'production_app'
  },
  aiml: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small'
    },
    vectorDb: {
      provider: 'pinecone' as const,
      apiKey: process.env.PINECONE_API_KEY,
      environment: 'production'
    },
    semanticCache: {
      enabled: true,
      threshold: 0.9 // Higher threshold for production
    }
  },
  performance: {
    queryCache: {
      enabled: true,
      maxSize: 10000,
      ttl: 600000 // 10 minutes
    },
    connectionPool: {
      minConnections: 5,
      maxConnections: 50,
      acquireTimeout: 10000
    },
    queryOptimization: {
      enabled: true,
      analyzeSlowQueries: true,
      slowQueryThreshold: 50 // 50ms for production
    }
  }
};

export const developmentConfig = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'dev_app'
  },
  aiml: {
    semanticCache: {
      enabled: true,
      threshold: 0.8
    }
  },
  performance: {
    queryCache: {
      enabled: true,
      maxSize: 100,
      ttl: 60000 // 1 minute
    },
    connectionPool: {
      minConnections: 1,
      maxConnections: 5,
      acquireTimeout: 3000
    },
    queryOptimization: {
      enabled: true,
      analyzeSlowQueries: true,
      slowQueryThreshold: 200 // 200ms for development
    }
  }
};

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateEnhancedFeatures().catch(console.error);
}
