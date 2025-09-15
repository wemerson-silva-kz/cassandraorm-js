export export interface PerformanceConfig {
  queryCache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
  connectionPool: {
    minConnections: number;
    maxConnections: number;
    acquireTimeout: number;
  };
  queryOptimization: {
    enabled: boolean;
    analyzeSlowQueries: boolean;
    slowQueryThreshold: number;
  };
}

export class AdvancedPerformanceOptimizer {
  private config: PerformanceConfig;
  private queryCache = new Map<string, { result: any, timestamp: number, hitCount: number }>();
  private queryStats = new Map<string, { count: number, totalTime: number, avgTime: number }>();
  private slowQueries: Array<{ query: string, time: number, timestamp: number }> = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  async optimizeQuery(query: string, params: any[]): Promise<{ query: string, params: any[], optimizations: string[] }> {
    const optimizations: string[] = [];
    let optimizedQuery = query;

    // Remove unnecessary whitespace
    optimizedQuery = optimizedQuery.replace(/\s+/g, ' ').trim();
    if (optimizedQuery !== query) {
      optimizations.push('Removed unnecessary whitespace');
    }

    // Suggest LIMIT if missing in SELECT
    if (optimizedQuery.toUpperCase().includes('SELECT') && 
        !optimizedQuery.toUpperCase().includes('LIMIT') &&
        !optimizedQuery.toUpperCase().includes('COUNT')) {
      optimizations.push('Consider adding LIMIT clause for better performance');
    }

    // Suggest using prepared statements
    if (params.length > 0) {
      optimizations.push('Using prepared statement with parameters');
    }

    // Check for potential full table scan
    if (optimizedQuery.toUpperCase().includes('SELECT') && 
        !optimizedQuery.toUpperCase().includes('WHERE')) {
      optimizations.push('WARNING: Query may cause full table scan');
    }

    return {
      query: optimizedQuery,
      params,
      optimizations
    };
  }

  async executeWithCache(query: string, params: any[], executor: Function): Promise<any> {
    const cacheKey = `${query}:${JSON.stringify(params)}`;
    
    // Check cache first
    if (this.config.queryCache.enabled) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.config.queryCache.ttl) {
        cached.hitCount++;
        return cached.result;
      }
    }

    // Execute query with timing
    const startTime = Date.now();
    const result = await executor(query, params);
    const executionTime = Date.now() - startTime;

    // Update statistics
    this.updateQueryStats(query, executionTime);

    // Cache result
    if (this.config.queryCache.enabled) {
      this.cacheResult(cacheKey, result);
    }

    // Track slow queries
    if (this.config.queryOptimization.analyzeSlowQueries && 
        executionTime > this.config.queryOptimization.slowQueryThreshold) {
      this.trackSlowQuery(query, executionTime);
    }

    return result;
  }

  private updateQueryStats(query: string, executionTime: number): void {
    const stats = this.queryStats.get(query) || { count: 0, totalTime: 0, avgTime: 0 };
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    this.queryStats.set(query, stats);
  }

  private cacheResult(key: string, result: any): void {
    if (this.queryCache.size >= this.config.queryCache.maxSize) {
      // Remove least recently used
      const oldestKey = Array.from(this.queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  private trackSlowQuery(query: string, time: number): void {
    this.slowQueries.push({
      query,
      time,
      timestamp: Date.now()
    });

    // Keep only last 50 slow queries
    if (this.slowQueries.length > 50) {
      this.slowQueries.shift();
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean expired cache entries
      for (const [key, cached] of this.queryCache.entries()) {
        if (now - cached.timestamp > this.config.queryCache.ttl) {
          this.queryCache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
    
    // Prevent Jest from hanging
    this.cleanupInterval.unref();
  }

  getPerformanceReport(): any {
    const cacheStats = {
      size: this.queryCache.size,
      hitRate: this.calculateCacheHitRate(),
      totalHits: Array.from(this.queryCache.values()).reduce((sum, cached) => sum + cached.hitCount, 0)
    };

    const queryStats = Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const recentSlowQueries = this.slowQueries
      .slice(-10)
      .sort((a, b) => b.time - a.time);

    return {
      cache: cacheStats,
      topSlowQueries: queryStats,
      recentSlowQueries,
      recommendations: this.generateRecommendations()
    };
  }

  private calculateCacheHitRate(): number {
    const totalRequests = Array.from(this.queryStats.values()).reduce((sum, stats) => sum + stats.count, 0);
    const totalHits = Array.from(this.queryCache.values()).reduce((sum, cached) => sum + cached.hitCount, 0);
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.calculateCacheHitRate() < 0.5) {
      recommendations.push('Consider increasing cache TTL or size for better hit rate');
    }

    if (this.slowQueries.length > 10) {
      recommendations.push('Multiple slow queries detected - review query patterns');
    }

    const avgQueryTime = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.avgTime, 0) / this.queryStats.size;

    if (avgQueryTime > 100) {
      recommendations.push('Average query time is high - consider query optimization');
    }

    return recommendations;
  }
}

export class ConnectionPoolOptimizer {
  private activeConnections = 0;
  private connectionQueue: Array<{ resolve: Function, reject: Function }> = [];
  private config: PerformanceConfig['connectionPool'];

  constructor(config: PerformanceConfig['connectionPool']) {
    this.config = config;
  }

  async acquireConnection(): Promise<any> {
    if (this.activeConnections < this.config.maxConnections) {
      this.activeConnections++;
      return { id: Date.now(), acquired: true };
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.connectionQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.connectionQueue.splice(index, 1);
          reject(new Error('Connection acquire timeout'));
        }
      }, this.config.acquireTimeout);

      this.connectionQueue.push({
        resolve: (connection: any) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject
      });
    });
  }

  releaseConnection(connection: any): void {
    this.activeConnections--;

    // Process queue
    if (this.connectionQueue.length > 0) {
      const next = this.connectionQueue.shift();
      if (next) {
        this.activeConnections++;
        next.resolve({ id: Date.now(), acquired: true });
      }
    }
  }

  getPoolStats() {
    return {
      active: this.activeConnections,
      queued: this.connectionQueue.length,
      max: this.config.maxConnections,
      utilization: this.activeConnections / this.config.maxConnections
    };
  }
}
