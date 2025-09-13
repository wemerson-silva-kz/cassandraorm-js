class Monitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logLevel = options.logLevel || 'info';
    this.metrics = {
      queries: { total: 0, success: 0, errors: 0 },
      connections: { active: 0, total: 0 },
      performance: { avgResponseTime: 0, slowQueries: [] }
    };
    this.queryTimes = [];
  }

  log(level, message, data = {}) {
    if (!this.enabled) return;
    
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] > levels[this.logLevel]) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...data
    };

    console.log(JSON.stringify(logEntry));
  }

  startQuery(query, params = []) {
    if (!this.enabled) return null;

    const queryId = Date.now() + Math.random();
    const startTime = process.hrtime.bigint();

    this.log('debug', 'Query started', { queryId, query, params });
    this.metrics.queries.total++;

    return { queryId, startTime, query };
  }

  endQuery(queryContext, error = null) {
    if (!this.enabled || !queryContext) return;

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - queryContext.startTime) / 1000000; // Convert to ms

    this.queryTimes.push(duration);
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift(); // Keep only last 100 queries
    }

    // Update metrics
    if (error) {
      this.metrics.queries.errors++;
      this.log('error', 'Query failed', {
        queryId: queryContext.queryId,
        query: queryContext.query,
        duration,
        error: error.message
      });
    } else {
      this.metrics.queries.success++;
      this.log('debug', 'Query completed', {
        queryId: queryContext.queryId,
        duration
      });
    }

    // Track slow queries (> 1000ms)
    if (duration > 1000) {
      this.metrics.performance.slowQueries.push({
        query: queryContext.query,
        duration,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 slow queries
      if (this.metrics.performance.slowQueries.length > 10) {
        this.metrics.performance.slowQueries.shift();
      }
    }

    // Update average response time
    this.metrics.performance.avgResponseTime = 
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  recordConnection(action) {
    if (!this.enabled) return;

    if (action === 'connect') {
      this.metrics.connections.active++;
      this.metrics.connections.total++;
      this.log('info', 'Connection established');
    } else if (action === 'disconnect') {
      this.metrics.connections.active--;
      this.log('info', 'Connection closed');
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  getHealthCheck() {
    const metrics = this.getMetrics();
    const errorRate = metrics.queries.total > 0 
      ? (metrics.queries.errors / metrics.queries.total) * 100 
      : 0;

    return {
      status: errorRate < 5 ? 'healthy' : 'unhealthy',
      errorRate: `${errorRate.toFixed(2)}%`,
      avgResponseTime: `${metrics.performance.avgResponseTime.toFixed(2)}ms`,
      activeConnections: metrics.connections.active,
      uptime: `${Math.floor(metrics.uptime)}s`
    };
  }

  reset() {
    this.metrics = {
      queries: { total: 0, success: 0, errors: 0 },
      connections: { active: 0, total: 0 },
      performance: { avgResponseTime: 0, slowQueries: [] }
    };
    this.queryTimes = [];
  }
}

module.exports = { Monitor };
