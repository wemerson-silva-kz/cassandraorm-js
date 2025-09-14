# Performance Example

## Overview
High-performance application example demonstrating optimization techniques, caching strategies, connection pooling, and monitoring.

## High-Performance E-commerce Backend

```typescript
// src/HighPerformanceEcommerce.ts
import { 
  createClient,
  PerformanceOptimizer,
  DistributedCacheManager,
  ConnectionPoolManager,
  QueryOptimizer,
  BatchProcessor
} from 'cassandraorm-js';

export class HighPerformanceEcommerce {
  private client: any;
  private performanceOptimizer: PerformanceOptimizer;
  private cacheManager: DistributedCacheManager;
  private poolManager: ConnectionPoolManager;
  private queryOptimizer: QueryOptimizer;
  private batchProcessor: BatchProcessor;

  constructor() {
    this.setupHighPerformanceClient();
    this.setupOptimizers();
    this.setupModels();
  }

  private setupHighPerformanceClient(): void {
    this.client = createClient({
      clientOptions: {
        contactPoints: process.env.CASSANDRA_HOSTS?.split(',') || ['localhost:9042'],
        localDataCenter: 'datacenter1',
        keyspace: 'ecommerce_hp',
        pooling: {
          coreConnectionsPerHost: {
            local: 8,
            remote: 2
          },
          maxConnectionsPerHost: {
            local: 32,
            remote: 8
          },
          maxRequestsPerConnection: 32768,
          heartBeatInterval: 30000
        },
        socketOptions: {
          connectTimeout: 5000,
          readTimeout: 12000,
          keepAlive: true,
          tcpNoDelay: true
        },
        queryOptions: {
          consistency: 'LOCAL_QUORUM',
          serialConsistency: 'LOCAL_SERIAL',
          fetchSize: 5000,
          autoPage: true
        }
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });
  }

  private setupOptimizers(): void {
    // Performance optimizer with AI suggestions
    this.performanceOptimizer = new PerformanceOptimizer(this.client, {
      enableAISuggestions: true,
      monitoringInterval: 60000,
      optimizationThreshold: 100 // ms
    });

    // Distributed caching with Redis cluster
    this.cacheManager = new DistributedCacheManager({
      nodes: [
        { host: 'redis-1', port: 6379 },
        { host: 'redis-2', port: 6379 },
        { host: 'redis-3', port: 6379 }
      ],
      strategy: 'consistent_hashing',
      replication: 2,
      compression: {
        enabled: true,
        threshold: 1024
      }
    });

    // Connection pool manager
    this.poolManager = new ConnectionPoolManager(this.client, {
      adaptiveScaling: true,
      minConnections: 5,
      maxConnections: 50,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    });

    // Query optimizer
    this.queryOptimizer = new QueryOptimizer(this.client, {
      enableQueryRewriting: true,
      enableIndexSuggestions: true,
      cacheOptimizedQueries: true
    });

    // Batch processor for bulk operations
    this.batchProcessor = new BatchProcessor(this.client, {
      batchSize: 1000,
      maxConcurrency: 10,
      retryPolicy: {
        maxRetries: 3,
        backoff: 'exponential'
      }
    });
  }

  private async setupModels(): Promise<void> {
    await this.client.connect();

    // Products with optimized schema
    this.Product = await this.client.loadSchema('products', {
      fields: {
        id: 'uuid',
        sku: 'text',
        name: 'text',
        description: 'text',
        category_id: 'uuid',
        brand_id: 'uuid',
        price: 'decimal',
        currency: 'text',
        inventory_count: 'int',
        attributes: 'map<text, text>',
        tags: 'set<text>',
        images: 'list<text>',
        search_vector: 'vector<float, 512>',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['sku', 'category_id', 'brand_id'],
      clustering_order: { created_at: 'desc' },
      caching: {
        enabled: true,
        ttl: 3600,
        strategy: 'write_through'
      }
    });

    // Orders with time-series optimization
    this.Order = await this.client.loadSchema('orders', {
      fields: {
        id: 'uuid',
        user_id: 'uuid',
        status: 'text',
        total_amount: 'decimal',
        currency: 'text',
        items: 'list<frozen<order_item>>',
        shipping_address: 'frozen<address>',
        payment_info: 'frozen<payment_info>',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: [['user_id'], 'created_at', 'id'],
      clustering_order: { created_at: 'desc', id: 'asc' },
      ttl: 31536000, // 1 year
      compaction: {
        class: 'TimeWindowCompactionStrategy',
        compaction_window_unit: 'DAYS',
        compaction_window_size: 1
      }
    });

    // User sessions for real-time analytics
    this.UserSession = await this.client.loadSchema('user_sessions', {
      fields: {
        session_id: 'uuid',
        user_id: 'uuid',
        start_time: 'timestamp',
        end_time: 'timestamp',
        page_views: 'list<frozen<page_view>>',
        events: 'list<frozen<user_event>>',
        device_info: 'frozen<device_info>'
      },
      key: [['user_id'], 'start_time', 'session_id'],
      clustering_order: { start_time: 'desc' },
      ttl: 2592000 // 30 days
    });
  }

  // High-performance product search
  async searchProducts(query: {
    text?: string;
    category?: string;
    priceRange?: { min: number; max: number };
    brands?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ products: any[]; total: number; facets: any }> {
    const cacheKey = `product_search:${JSON.stringify(query)}`;
    
    // Check cache first
    let result = await this.cacheManager.get(cacheKey);
    if (result) {
      return result;
    }

    // Build optimized query
    const optimizedQuery = await this.queryOptimizer.optimizeProductSearch(query);
    
    // Execute with performance monitoring
    const startTime = Date.now();
    const searchResult = await this.executeOptimizedSearch(optimizedQuery);
    const executionTime = Date.now() - startTime;

    // Log performance metrics
    await this.performanceOptimizer.recordMetric('product_search', {
      executionTime,
      resultCount: searchResult.products.length,
      cacheHit: false
    });

    // Cache result
    await this.cacheManager.set(cacheKey, searchResult, { ttl: 300 });

    return searchResult;
  }

  private async executeOptimizedSearch(query: any): Promise<any> {
    const products = [];
    let total = 0;
    const facets = {};

    // Use prepared statements for better performance
    const preparedQuery = await this.client.prepare(query.cql);
    
    // Execute with pagination
    let pageState = null;
    do {
      const result = await this.client.execute(preparedQuery, query.params, {
        pageState,
        fetchSize: 1000
      });

      products.push(...result.rows);
      total += result.rows.length;
      pageState = result.pageState;

    } while (pageState && products.length < (query.limit || 100));

    // Build facets in parallel
    const facetPromises = [
      this.buildCategoryFacets(query),
      this.buildBrandFacets(query),
      this.buildPriceFacets(query)
    ];

    const [categoryFacets, brandFacets, priceFacets] = await Promise.all(facetPromises);
    
    return {
      products: products.slice(0, query.limit || 100),
      total,
      facets: {
        categories: categoryFacets,
        brands: brandFacets,
        priceRanges: priceFacets
      }
    };
  }

  // High-throughput order processing
  async processOrderBatch(orders: any[]): Promise<{ processed: number; failed: number; errors: any[] }> {
    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    // Process in optimized batches
    const batches = this.chunkArray(orders, 100);
    
    await Promise.all(batches.map(async (batch, batchIndex) => {
      try {
        // Prepare batch operations
        const batchOps = await this.prepareBatchOperations(batch);
        
        // Execute batch with retry logic
        await this.batchProcessor.executeBatch(batchOps);
        
        results.processed += batch.length;
        
        // Update cache for processed orders
        await this.updateOrderCache(batch);
        
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batchIndex,
          error: error.message,
          orders: batch.map(o => o.id)
        });
      }
    }));

    return results;
  }

  private async prepareBatchOperations(orders: any[]): Promise<any[]> {
    const operations = [];
    
    for (const order of orders) {
      // Insert order
      operations.push({
        query: 'INSERT INTO orders (id, user_id, status, total_amount, currency, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [
          order.id,
          order.user_id,
          order.status,
          order.total_amount,
          order.currency,
          order.items,
          new Date()
        ]
      });

      // Update inventory
      for (const item of order.items) {
        operations.push({
          query: 'UPDATE products SET inventory_count = inventory_count - ? WHERE id = ?',
          params: [item.quantity, item.product_id]
        });
      }

      // Update user stats
      operations.push({
        query: 'UPDATE user_stats SET order_count = order_count + 1, total_spent = total_spent + ? WHERE user_id = ?',
        params: [order.total_amount, order.user_id]
      });
    }

    return operations;
  }

  // Real-time analytics with streaming
  async setupRealTimeAnalytics(): Promise<void> {
    const streamProcessor = new StreamProcessor(this.client, {
      batchSize: 1000,
      flushInterval: 5000
    });

    // Process user events in real-time
    streamProcessor.createIngestionStream('user_events', {
      schema: {
        user_id: 'uuid',
        event_type: 'text',
        product_id: 'uuid',
        timestamp: 'timestamp',
        metadata: 'map<text, text>'
      },
      partitionKey: ['user_id']
    });

    // Real-time aggregations
    streamProcessor.on('user_events', async (events) => {
      // Group by time windows
      const windowedEvents = this.groupByTimeWindow(events, '1m');
      
      // Process each window
      for (const [window, windowEvents] of windowedEvents) {
        await this.processEventWindow(window, windowEvents);
      }
    });

    // Performance monitoring
    streamProcessor.on('metrics', (metrics) => {
      console.log('Stream processing metrics:', {
        throughput: metrics.eventsPerSecond,
        latency: metrics.avgLatency,
        backlog: metrics.backlogSize
      });
    });
  }

  // Connection pool optimization
  async optimizeConnectionPool(): Promise<void> {
    // Monitor pool performance
    setInterval(async () => {
      const poolStats = await this.poolManager.getStats();
      
      if (poolStats.utilization > 0.8) {
        await this.poolManager.scaleUp();
      } else if (poolStats.utilization < 0.3) {
        await this.poolManager.scaleDown();
      }
      
      // Log pool metrics
      console.log('Connection pool stats:', {
        active: poolStats.activeConnections,
        idle: poolStats.idleConnections,
        utilization: poolStats.utilization,
        avgResponseTime: poolStats.avgResponseTime
      });
    }, 30000);
  }

  // Query performance monitoring
  async setupQueryMonitoring(): Promise<void> {
    this.client.on('queryComplete', async (query, duration, error) => {
      // Record query performance
      await this.performanceOptimizer.recordQuery({
        cql: query.query,
        params: query.params,
        duration,
        error: error?.message,
        timestamp: new Date()
      });

      // Alert on slow queries
      if (duration > 1000) {
        console.warn('Slow query detected:', {
          query: query.query,
          duration,
          params: query.params
        });
        
        // Get optimization suggestions
        const suggestions = await this.queryOptimizer.getSuggestions(query.query);
        if (suggestions.length > 0) {
          console.log('Optimization suggestions:', suggestions);
        }
      }
    });
  }

  // Memory optimization
  async optimizeMemoryUsage(): Promise<void> {
    // Enable compression for large objects
    this.client.setCompressionOptions({
      enabled: true,
      threshold: 1024,
      algorithm: 'lz4'
    });

    // Optimize result set handling
    this.client.setResultSetOptions({
      streamResults: true,
      maxBufferSize: 10000,
      autoPage: true
    });

    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      console.log('Memory usage:', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      });

      // Trigger garbage collection if needed
      if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        if (global.gc) {
          global.gc();
        }
      }
    }, 60000);
  }

  // Performance benchmarking
  async runPerformanceBenchmark(): Promise<any> {
    const benchmark = {
      productSearch: await this.benchmarkProductSearch(),
      orderProcessing: await this.benchmarkOrderProcessing(),
      userSessions: await this.benchmarkUserSessions(),
      cachePerformance: await this.benchmarkCachePerformance()
    };

    console.log('Performance benchmark results:', benchmark);
    return benchmark;
  }

  private async benchmarkProductSearch(): Promise<any> {
    const iterations = 1000;
    const startTime = Date.now();
    
    const promises = Array.from({ length: iterations }, (_, i) => 
      this.searchProducts({
        text: `product ${i % 100}`,
        limit: 20
      })
    );

    await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    
    return {
      iterations,
      totalTime,
      avgTime: totalTime / iterations,
      throughput: (iterations / totalTime) * 1000
    };
  }

  private async benchmarkOrderProcessing(): Promise<any> {
    const batchSize = 100;
    const batches = 10;
    const startTime = Date.now();
    
    for (let i = 0; i < batches; i++) {
      const orders = Array.from({ length: batchSize }, (_, j) => ({
        id: uuid(),
        user_id: uuid(),
        status: 'pending',
        total_amount: Math.random() * 1000,
        currency: 'USD',
        items: [
          { product_id: uuid(), quantity: 1, price: Math.random() * 100 }
        ]
      }));
      
      await this.processOrderBatch(orders);
    }
    
    const totalTime = Date.now() - startTime;
    const totalOrders = batchSize * batches;
    
    return {
      totalOrders,
      totalTime,
      avgTime: totalTime / totalOrders,
      throughput: (totalOrders / totalTime) * 1000
    };
  }

  // Utility methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private groupByTimeWindow(events: any[], windowSize: string): Map<string, any[]> {
    const windows = new Map();
    const windowMs = this.parseTimeWindow(windowSize);
    
    for (const event of events) {
      const windowStart = Math.floor(event.timestamp.getTime() / windowMs) * windowMs;
      const windowKey = new Date(windowStart).toISOString();
      
      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }
      windows.get(windowKey).push(event);
    }
    
    return windows;
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/(\d+)([smhd])/);
    if (!match) return 60000; // Default 1 minute
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60000;
    }
  }
}
```

## Usage Example

```typescript
// src/app.ts
import { HighPerformanceEcommerce } from './HighPerformanceEcommerce';

async function startHighPerformanceApp() {
  const app = new HighPerformanceEcommerce();
  
  // Setup optimizations
  await app.optimizeConnectionPool();
  await app.setupQueryMonitoring();
  await app.optimizeMemoryUsage();
  await app.setupRealTimeAnalytics();
  
  // Run performance benchmark
  const benchmark = await app.runPerformanceBenchmark();
  console.log('Initial benchmark:', benchmark);
  
  // Start monitoring
  setInterval(async () => {
    const currentBenchmark = await app.runPerformanceBenchmark();
    console.log('Current performance:', currentBenchmark);
  }, 300000); // Every 5 minutes
  
  console.log('High-performance e-commerce backend started');
}

startHighPerformanceApp().catch(console.error);
```
