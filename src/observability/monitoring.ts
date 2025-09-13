interface MonitoringOptions {
  enabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface QueryContext {
  query: string;
  params?: any[];
  startTime: number;
}

interface Metrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
  connections: {
    total: number;
    active: number;
  };
}

export class Monitor {
  private options: MonitoringOptions;
  private metrics: Metrics = {
    queries: { total: 0, successful: 0, failed: 0, avgDuration: 0 },
    connections: { total: 0, active: 0 }
  };
  private queryTimes: number[] = [];

  constructor(options: MonitoringOptions = {}) {
    this.options = {
      enabled: true,
      logLevel: 'info',
      ...options
    };
  }

  startQuery(query: string, params?: any[]): QueryContext {
    this.metrics.queries.total++;
    return {
      query,
      params,
      startTime: Date.now()
    };
  }

  endQuery(context: QueryContext, error?: Error): void {
    const duration = Date.now() - context.startTime;
    this.queryTimes.push(duration);
    
    if (error) {
      this.metrics.queries.failed++;
      this.log('error', 'Query failed', { query: context.query, error: error.message, duration });
    } else {
      this.metrics.queries.successful++;
      this.log('debug', 'Query executed', { query: context.query, duration });
    }
    
    // Update average duration
    this.metrics.queries.avgDuration = 
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  recordConnection(type: 'connect' | 'disconnect'): void {
    if (type === 'connect') {
      this.metrics.connections.total++;
      this.metrics.connections.active++;
    } else {
      this.metrics.connections.active--;
    }
  }

  log(level: string, message: string, meta?: any): void {
    if (!this.options.enabled) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    };
    
    console.log(JSON.stringify(logEntry));
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getHealthCheck(): { status: string; metrics: Metrics } {
    const errorRate = this.metrics.queries.failed / this.metrics.queries.total;
    const status = errorRate > 0.1 ? 'unhealthy' : 'healthy';
    
    return {
      status,
      metrics: this.getMetrics()
    };
  }
}
