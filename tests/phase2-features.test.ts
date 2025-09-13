import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { 
  createClient,
  StreamingManager,
  MetricsCollector,
  CassandraMetrics,
  Tracer,
  CassandraTracing,
  MultiTenantManager,
  SchemaEvolution
} from '../src/index.js';

describe('Phase 2 Advanced Features', () => {
  let client: any;
  let streamingManager: StreamingManager;
  let metricsCollector: MetricsCollector;
  let cassandraMetrics: CassandraMetrics;
  let tracer: Tracer;
  let cassandraTracing: CassandraTracing;
  let multiTenantManager: MultiTenantManager;
  let schemaEvolution: SchemaEvolution;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase2_test'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    await client.connect();

    // Initialize managers
    streamingManager = new StreamingManager(client.driver, 'phase2_test');
    metricsCollector = new MetricsCollector({ enabled: true });
    cassandraMetrics = new CassandraMetrics(metricsCollector);
    tracer = new Tracer({ enabled: true, sampleRate: 1.0 });
    cassandraTracing = new CassandraTracing(tracer);
    
    multiTenantManager = new MultiTenantManager(client.driver, {
      strategy: 'column',
      tenantResolver: (context) => context.tenantId || 'default',
      isolation: 'strict'
    });

    schemaEvolution = new SchemaEvolution(client.driver, 'phase2_test');
    await schemaEvolution.initialize();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  async function setupTestData() {
    // Create test table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_data (
        id uuid PRIMARY KEY,
        name text,
        value int,
        tenant_id text,
        created_at timestamp
      )
    `);

    // Insert test data
    for (let i = 0; i < 100; i++) {
      await client.execute(
        'INSERT INTO test_data (id, name, value, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [client.uuid(), `Item ${i}`, i * 10, i % 3 === 0 ? 'tenant1' : 'tenant2', new Date()],
        { prepare: true }
      );
    }
  }

  it('should handle data streaming', async () => {
    const stream = streamingManager.createStream({
      batchSize: 10,
      transform: (item) => ({ ...item, processed: true }),
      filter: (item) => item.value > 50
    });

    const processedItems: any[] = [];
    let batchCount = 0;

    stream.on('data', (item) => {
      processedItems.push(item);
    });

    stream.on('batch', (info) => {
      batchCount++;
      expect(info.size).toBeLessThanOrEqual(10);
    });

    await stream.stream('SELECT * FROM test_data');

    expect(processedItems.length).toBeGreaterThan(0);
    expect(batchCount).toBeGreaterThan(0);
    
    // Check transformation
    expect(processedItems[0].processed).toBe(true);
    
    // Check filtering
    expect(processedItems.every(item => item.value > 50)).toBe(true);

    const stats = stream.getStats();
    expect(stats.processed).toBe(processedItems.length);
    expect(stats.filtered).toBeGreaterThan(0);
  });

  it('should collect metrics', () => {
    // Test counter
    metricsCollector.incrementCounter('test_counter', 5, { type: 'test' });
    expect(metricsCollector.getCounter('test_counter', { type: 'test' })).toBe(5);

    metricsCollector.incrementCounter('test_counter', 3, { type: 'test' });
    expect(metricsCollector.getCounter('test_counter', { type: 'test' })).toBe(8);

    // Test gauge
    metricsCollector.setGauge('test_gauge', 100);
    expect(metricsCollector.getGauge('test_gauge')).toBe(100);

    metricsCollector.incrementGauge('test_gauge', 50);
    expect(metricsCollector.getGauge('test_gauge')).toBe(150);

    // Test histogram
    metricsCollector.recordHistogram('test_histogram', 100);
    metricsCollector.recordHistogram('test_histogram', 200);
    metricsCollector.recordHistogram('test_histogram', 150);

    const histStats = metricsCollector.getHistogramStats('test_histogram');
    expect(histStats).toBeDefined();
    expect(histStats!.count).toBe(3);
    expect(histStats!.avg).toBe(150);
    expect(histStats!.min).toBe(100);
    expect(histStats!.max).toBe(200);
  });

  it('should generate Prometheus metrics', () => {
    const prometheusMetrics = metricsCollector.getPrometheusMetrics();
    
    expect(prometheusMetrics).toContain('test_counter');
    expect(prometheusMetrics).toContain('test_gauge');
    expect(prometheusMetrics).toContain('test_histogram');
    expect(prometheusMetrics).toContain('# TYPE');
  });

  it('should record Cassandra metrics', () => {
    // Reset metrics first
    metricsCollector.reset();
    
    cassandraMetrics.recordQuery(150, 'SELECT', 'test_data');
    cassandraMetrics.recordConnection('created');
    cassandraMetrics.recordCacheHit(true, 'query');
    cassandraMetrics.recordBulkOperation('insert', 100, 500);

    expect(metricsCollector.getCounter('cassandra_queries_total', { operation: 'SELECT', table: 'test_data' })).toBe(1);
    expect(metricsCollector.getGauge('cassandra_connections_active')).toBe(1);
    expect(metricsCollector.getCounter('cassandra_cache_requests_total', { type: 'query', result: 'hit' })).toBe(1);
    expect(metricsCollector.getCounter('cassandra_bulk_operations_total', { operation: 'insert' })).toBe(1);
  });

  it('should handle tracing', async () => {
    const span = tracer.startSpan('test_operation');
    
    span.setTag('test.key', 'test.value');
    span.log('Test log message', 'info');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    span.finish();

    const spanData = span.getData();
    expect(spanData.operationName).toBe('test_operation');
    expect(spanData.tags['test.key']).toBe('test.value');
    expect(spanData.logs.length).toBe(1);
    expect(spanData.duration).toBeGreaterThan(0);
  });

  it('should trace operations', async () => {
    const result = await tracer.trace('database_operation', async (span) => {
      span.setTag('db.table', 'test_data');
      
      // Simulate database operation
      await new Promise(resolve => setTimeout(resolve, 5));
      
      return { success: true };
    });

    expect(result.success).toBe(true);
    
    const traces = tracer.getTraces(10);
    expect(traces.length).toBeGreaterThan(0);
    
    const dbTrace = traces.find(t => t.operationName === 'database_operation');
    expect(dbTrace).toBeDefined();
    expect(dbTrace!.tags['db.table']).toBe('test_data');
  });

  it('should export Jaeger traces', () => {
    const jaegerTraces = tracer.exportJaegerTraces();
    
    expect(jaegerTraces).toBeDefined();
    expect(Array.isArray(jaegerTraces)).toBe(true);
    
    if (jaegerTraces.length > 0) {
      const trace = jaegerTraces[0];
      expect(trace.traceID).toBeDefined();
      expect(trace.spans).toBeDefined();
      expect(Array.isArray(trace.spans)).toBe(true);
    }
  });

  it('should handle multi-tenancy with column strategy', async () => {
    // Set tenant context
    await multiTenantManager.setTenantContext({ tenantId: 'tenant1' });
    
    const currentTenant = multiTenantManager.getCurrentTenant();
    expect(currentTenant).toBeDefined();
    expect(currentTenant!.tenantId).toBe('tenant1');

    // Transform query for column-based isolation
    const { query, params } = multiTenantManager.transformQuery(
      'SELECT * FROM test_data WHERE value > ?',
      [50]
    );

    expect(query).toContain('tenant_id = ?');
    expect(params[0]).toBe('tenant1');
    expect(params[1]).toBe(50);
  });

  it('should execute with specific tenant', async () => {
    const result = await multiTenantManager.executeWithTenant('tenant2', async (context) => {
      expect(context.tenantId).toBe('tenant2');
      
      // Simulate tenant-specific operation
      return { tenantId: context.tenantId, data: 'test' };
    });

    expect(result.tenantId).toBe('tenant2');
    expect(result.data).toBe('test');
  });

  it('should handle schema evolution', async () => {
    // Create a migration
    const migration = schemaEvolution
      .migration('001_add_description_column', 'Add description column to test_data')
      .addColumn('test_data', 'description', 'text')
      .build();

    // Check pending migrations
    const pending = await schemaEvolution.getPendingMigrations();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].id).toBe('001_add_description_column');

    // Run migration
    const results = await schemaEvolution.migrate();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('001_add_description_column');
    expect(results[0].execution_time_ms).toBeGreaterThan(0);

    // Check applied migrations
    const applied = await schemaEvolution.getAppliedMigrations();
    expect(applied.length).toBe(1);
    expect(applied[0].id).toBe('001_add_description_column');

    // Check status
    const status = await schemaEvolution.getStatus();
    expect(status.applied).toBe(1);
    expect(status.pending).toBe(0);
    expect(status.total).toBe(1);
  });

  it('should integrate Phase 2 features', async () => {
    // Complex scenario using multiple Phase 2 features
    
    // 1. Set up tracing
    const operationSpan = tracer.startSpan('complex_operation');
    
    // 2. Set tenant context
    await multiTenantManager.setTenantContext({ tenantId: 'tenant1' });
    
    // 3. Stream data with metrics
    const stream = streamingManager.createStream({
      batchSize: 5,
      transform: (item) => {
        // Record processing metric
        cassandraMetrics.recordQuery(10, 'TRANSFORM', 'test_data');
        return { ...item, processed_at: new Date() };
      }
    });

    const processedItems: any[] = [];
    
    stream.on('data', (item) => {
      processedItems.push(item);
    });

    // 4. Execute with tracing
    await cassandraTracing.traceQuery(
      'SELECT * FROM test_data LIMIT 10',
      [],
      async () => {
        await stream.stream('SELECT * FROM test_data LIMIT 10');
        return { rows: [] };
      },
      operationSpan.getContext()
    );

    operationSpan.finish();

    // 5. Verify integration
    expect(processedItems.length).toBeGreaterThan(0);
    expect(processedItems[0].processed_at).toBeDefined();
    
    // Check metrics were recorded (with specific labels)
    expect(metricsCollector.getCounter('cassandra_queries_total', { operation: 'TRANSFORM', table: 'test_data' })).toBeGreaterThan(0);
    
    // Check traces were created
    const traces = tracer.getTraces();
    const complexTrace = traces.find(t => t.operationName === 'complex_operation');
    expect(complexTrace).toBeDefined();
  });
});

export { };
