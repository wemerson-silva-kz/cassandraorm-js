#!/usr/bin/env bun
import { 
  createClient,
  Monitor,
  MetricsCollector,
  PerformanceProfiler,
  CassandraMetrics,
  Tracer,
  PerformanceOptimizer,
  type MetricsConfig,
  type TracingConfig
} from '../src/index.js';

async function testPerformanceMonitoring() {
  console.log('📊 Teste 16: Performance e Monitoramento\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_performance'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Test Monitor
    const monitor = new Monitor({
      interval: 1000,
      enableSystemMetrics: true,
      enableCassandraMetrics: true,
      enableCustomMetrics: true
    });

    await monitor.start();
    console.log('✅ Monitor iniciado');

    // Test MetricsCollector
    const metricsConfig: MetricsConfig = {
      collectInterval: 5000,
      retentionPeriod: 3600000, // 1 hour
      enableHistograms: true,
      enableCounters: true,
      enableGauges: true
    };

    const metricsCollector = new MetricsCollector(metricsConfig);
    await metricsCollector.start();
    console.log('✅ MetricsCollector iniciado');

    // Test CassandraMetrics
    const cassandraMetrics = new CassandraMetrics(client.driver);
    console.log('✅ CassandraMetrics criado');

    // Test PerformanceProfiler
    const profiler = new PerformanceProfiler({
      enableQueryProfiling: true,
      enableConnectionProfiling: true,
      enableMemoryProfiling: true,
      sampleRate: 0.1 // 10% sampling
    });

    await profiler.start();
    console.log('✅ PerformanceProfiler iniciado');

    // Test Tracer
    const tracingConfig: TracingConfig = {
      serviceName: 'cassandraorm-test',
      enableDistributedTracing: true,
      sampleRate: 1.0,
      exportInterval: 5000
    };

    const tracer = new Tracer(tracingConfig);
    console.log('✅ Tracer configurado');

    // Create test table for performance testing
    const TestModel = await client.loadSchema('performance_test', {
      fields: {
        id: 'uuid',
        name: 'text',
        value: 'int',
        data: 'text',
        created_at: 'timestamp'
      },
      key: ['id']
    });

    await TestModel.createTable();
    console.log('✅ Tabela de teste criada');

    // Test performance profiling with operations
    console.log('\n🔄 Executando operações para profiling...');

    const span = tracer.startSpan('bulk-insert-operation');
    
    // Bulk insert for performance testing
    const insertPromises = [];
    for (let i = 0; i < 100; i++) {
      insertPromises.push(
        TestModel.create({
          name: `Test Record ${i}`,
          value: Math.floor(Math.random() * 1000),
          data: `Sample data for record ${i}`.repeat(10),
          created_at: new Date()
        })
      );
    }

    const insertStart = Date.now();
    await Promise.all(insertPromises);
    const insertDuration = Date.now() - insertStart;
    
    span.setTag('records_inserted', 100);
    span.setTag('duration_ms', insertDuration);
    span.finish();

    console.log('✅ 100 registros inseridos em', insertDuration, 'ms');

    // Test query performance
    const querySpan = tracer.startSpan('query-performance-test');
    
    const queryStart = Date.now();
    const results = await TestModel.find({}, { limit: 50 });
    const queryDuration = Date.now() - queryStart;
    
    querySpan.setTag('records_found', results.length);
    querySpan.setTag('duration_ms', queryDuration);
    querySpan.finish();

    console.log('✅ Query executada em', queryDuration, 'ms, encontrados', results.length, 'registros');

    // Collect metrics
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test system metrics
    const systemMetrics = await monitor.getSystemMetrics();
    console.log('📊 Métricas do Sistema:');
    console.log('   • CPU Usage:', systemMetrics.cpuUsage + '%');
    console.log('   • Memory Usage:', systemMetrics.memoryUsage + '%');
    console.log('   • Disk Usage:', systemMetrics.diskUsage + '%');
    console.log('   • Network I/O:', systemMetrics.networkIO);

    // Test Cassandra metrics
    const dbMetrics = await cassandraMetrics.getMetrics();
    console.log('📊 Métricas do Cassandra:');
    console.log('   • Active Connections:', dbMetrics.activeConnections);
    console.log('   • Query Count:', dbMetrics.queryCount);
    console.log('   • Average Query Time:', dbMetrics.averageQueryTime + 'ms');
    console.log('   • Error Rate:', dbMetrics.errorRate + '%');

    // Test custom metrics
    metricsCollector.incrementCounter('custom.operations.insert', 100);
    metricsCollector.recordHistogram('custom.query.duration', queryDuration);
    metricsCollector.setGauge('custom.active.connections', dbMetrics.activeConnections);

    const customMetrics = await metricsCollector.getMetrics();
    console.log('📊 Métricas Customizadas:');
    console.log('   • Insert Operations:', customMetrics.counters['custom.operations.insert']);
    console.log('   • Query Duration Histogram:', customMetrics.histograms['custom.query.duration']);
    console.log('   • Active Connections Gauge:', customMetrics.gauges['custom.active.connections']);

    // Test performance profiling results
    const profilingResults = await profiler.getResults();
    console.log('📊 Resultados do Profiling:');
    console.log('   • Queries Profiled:', profilingResults.queriesProfiled);
    console.log('   • Average Query Time:', profilingResults.averageQueryTime + 'ms');
    console.log('   • Slowest Query Time:', profilingResults.slowestQueryTime + 'ms');
    console.log('   • Memory Peak Usage:', profilingResults.memoryPeakUsage + 'MB');

    // Test PerformanceOptimizer
    const optimizer = new PerformanceOptimizer(client.driver);
    console.log('✅ PerformanceOptimizer criado');

    // Analyze query performance
    const queryAnalysis = await optimizer.analyzeQuery(
      'SELECT * FROM performance_test WHERE value > ?',
      [500]
    );
    console.log('📊 Análise de Query:');
    console.log('   • Execution Time:', queryAnalysis.executionTime + 'ms');
    console.log('   • Rows Examined:', queryAnalysis.rowsExamined);
    console.log('   • Index Usage:', queryAnalysis.indexUsage);
    console.log('   • Optimization Score:', queryAnalysis.optimizationScore);

    // Get optimization suggestions
    const suggestions = await optimizer.getSuggestions('performance_test');
    console.log('💡 Sugestões de Otimização:');
    suggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.type}: ${suggestion.description}`);
      console.log(`      Impacto: ${suggestion.impact}, Prioridade: ${suggestion.priority}`);
    });

    // Test connection pool metrics
    const poolMetrics = await monitor.getConnectionPoolMetrics();
    console.log('📊 Métricas do Connection Pool:');
    console.log('   • Active Connections:', poolMetrics.activeConnections);
    console.log('   • Idle Connections:', poolMetrics.idleConnections);
    console.log('   • Total Connections:', poolMetrics.totalConnections);
    console.log('   • Connection Errors:', poolMetrics.connectionErrors);

    // Test alerting system
    const alertThresholds = {
      cpuUsage: 80,
      memoryUsage: 85,
      queryTime: 1000,
      errorRate: 5
    };

    monitor.setAlertThresholds(alertThresholds);
    console.log('✅ Thresholds de alerta configurados');

    const alerts = await monitor.checkAlerts();
    console.log('🚨 Alertas ativos:', alerts.length);
    alerts.forEach(alert => {
      console.log(`   • ${alert.type}: ${alert.message} (Severity: ${alert.severity})`);
    });

    // Test health check
    const healthCheck = await monitor.getHealthStatus();
    console.log('🏥 Status de Saúde:');
    console.log('   • Overall Status:', healthCheck.status);
    console.log('   • Database:', healthCheck.database);
    console.log('   • Connection Pool:', healthCheck.connectionPool);
    console.log('   • Memory:', healthCheck.memory);
    console.log('   • Disk:', healthCheck.disk);

    // Test trace export
    const traces = await tracer.exportTraces();
    console.log('📤 Traces exportados:', traces.length);

    // Test metrics export
    const exportedMetrics = await metricsCollector.exportMetrics('prometheus');
    console.log('📤 Métricas exportadas (formato Prometheus)');
    console.log('   Tamanho:', exportedMetrics.length, 'caracteres');

    console.log('\n📊 FUNCIONALIDADES DE PERFORMANCE TESTADAS:');
    console.log('   • Monitor - Monitoramento do sistema');
    console.log('   • MetricsCollector - Coleta de métricas');
    console.log('   • PerformanceProfiler - Profiling de performance');
    console.log('   • CassandraMetrics - Métricas específicas do Cassandra');
    console.log('   • Tracer - Rastreamento distribuído');
    console.log('   • PerformanceOptimizer - Otimização de performance');
    console.log('   • Health Monitoring - Monitoramento de saúde');
    console.log('   • Alerting System - Sistema de alertas');
    console.log('   • Metrics Export - Exportação de métricas');

    console.log('\n🎉 Teste Performance Monitoring: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste Performance Monitoring:', error.message);
  } finally {
    await client.close();
  }
}

testPerformanceMonitoring();
