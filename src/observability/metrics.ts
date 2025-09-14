import { EventEmitter } from 'events';

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricsConfig {
  enabled?: boolean;
  prometheus?: {
    enabled?: boolean;
    port?: number;
    endpoint?: string;
  };
  customMetrics?: string[];
  retention?: number; // seconds
}

export interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

export class MetricsCollector extends EventEmitter {
  private config: Required<MetricsConfig>;
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private labels = new Map<string, Record<string, string>>();
  private startTime = Date.now();

  constructor(config: MetricsConfig = {}) {
    super();
    const defaultConfig = {
      enabled: true,
      prometheus: {
        enabled: false,
        port: 9090,
        endpoint: '/metrics'
      },
      customMetrics: [],
      retention: 3600 // 1 hour
    };

    this.config = {
      ...defaultConfig,
      ...config,
      prometheus: { ...defaultConfig.prometheus, ...config.prometheus }
    };
  }

  // Counter metrics (monotonically increasing)
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    if (labels) {
      this.labels.set(key, labels);
    }

    this.emit('counter', { name, value, labels, total: current + value });
  }

  // Gauge metrics (can go up or down)
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    if (labels) {
      this.labels.set(key, labels);
    }

    this.emit('gauge', { name, value, labels });
  }

  incrementGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.gauges.get(key) || 0;
    this.setGauge(name, current + value, labels);
  }

  decrementGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.incrementGauge(name, -value, labels);
  }

  // Histogram metrics (for timing and size distributions)
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    if (labels) {
      this.labels.set(key, labels);
    }

    this.emit('histogram', { name, value, labels });
  }

  // Timer utility
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration, labels);
    };
  }

  // Get metric values
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || 0;
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key);
    
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  // Get all metrics in Prometheus format
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    this.counters.forEach((value, key) => {
      const { name, labelsStr } = this.parseMetricKey(key);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${labelsStr} ${value}`);
    });

    // Gauges
    this.gauges.forEach((value, key) => {
      const { name, labelsStr } = this.parseMetricKey(key);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${labelsStr} ${value}`);
    });

    // Histograms
    this.histograms.forEach((values, key) => {
      const { name, labelsStr } = this.parseMetricKey(key);
      const stats = this.getHistogramStats(name);
      
      if (stats) {
        lines.push(`# TYPE ${name} histogram`);
        lines.push(`${name}_count${labelsStr} ${stats.count}`);
        lines.push(`${name}_sum${labelsStr} ${stats.sum}`);
        
        // Standard buckets
        const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
        buckets.forEach(bucket => {
          const count = values.filter(v => v <= bucket * 1000).length; // Convert to ms
          lines.push(`${name}_bucket{le="${bucket}"${labelsStr.slice(1, -1) ? ',' + labelsStr.slice(1, -1) : ''}} ${count}`);
        });
        lines.push(`${name}_bucket{le="+Inf"${labelsStr.slice(1, -1) ? ',' + labelsStr.slice(1, -1) : ''}} ${stats.count}`);
      }
    });

    // Add process metrics
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds ${(Date.now() - this.startTime) / 1000}`);

    return lines.join('\n') + '\n';
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();
    this.emit('reset');
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  private parseMetricKey(key: string): { name: string; labelsStr: string } {
    const braceIndex = key.indexOf('{');
    if (braceIndex === -1) {
      return { name: key, labelsStr: '' };
    }
    
    return {
      name: key.substring(0, braceIndex),
      labelsStr: key.substring(braceIndex)
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Built-in Cassandra metrics
export class CassandraMetrics {
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  recordQuery(duration: number, operation: string, table?: string): void {
    this.metrics.incrementCounter('cassandra_queries_total', 1, { 
      operation, 
      table: table || 'unknown' 
    });
    
    this.metrics.recordHistogram('cassandra_query_duration_ms', duration, { 
      operation, 
      table: table || 'unknown' 
    });
  }

  recordConnection(event: 'created' | 'closed' | 'error'): void {
    this.metrics.incrementCounter('cassandra_connections_total', 1, { event });
    
    if (event === 'created') {
      this.metrics.incrementGauge('cassandra_connections_active');
    } else if (event === 'closed') {
      this.metrics.decrementGauge('cassandra_connections_active');
    }
  }

  recordCacheHit(hit: boolean, type: string = 'query'): void {
    this.metrics.incrementCounter('cassandra_cache_requests_total', 1, { 
      type, 
      result: hit ? 'hit' : 'miss' 
    });
  }

  recordBulkOperation(operation: string, count: number, duration: number): void {
    this.metrics.incrementCounter('cassandra_bulk_operations_total', 1, { operation });
    this.metrics.incrementCounter('cassandra_bulk_items_total', count, { operation });
    this.metrics.recordHistogram('cassandra_bulk_duration_ms', duration, { operation });
  }

  setPoolStats(stats: { total: number; active: number; idle: number }): void {
    this.metrics.setGauge('cassandra_pool_connections_total', stats.total);
    this.metrics.setGauge('cassandra_pool_connections_active', stats.active);
    this.metrics.setGauge('cassandra_pool_connections_idle', stats.idle);
  }
}
