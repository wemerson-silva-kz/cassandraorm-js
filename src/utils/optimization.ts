import type { Client } from "cassandra-driver";

export interface OptimizationConfig {
  enabled?: boolean;
  autoAnalyze?: boolean;
  suggestIndexes?: boolean;
  suggestMaterializedViews?: boolean;
  optimizeQueries?: boolean;
  monitorPerformance?: boolean;
}

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowsScanned: number;
  rowsReturned: number;
  usesAllowFiltering: boolean;
  suggestions: OptimizationSuggestion[];
}

export interface OptimizationSuggestion {
  type: 'index' | 'materialized_view' | 'query_rewrite' | 'partition_key' | 'clustering_key';
  priority: 'high' | 'medium' | 'low';
  description: string;
  implementation?: string;
  estimatedImprovement?: string;
}

export interface PerformanceMetrics {
  avgQueryTime: number;
  slowQueries: QueryAnalysis[];
  indexUsage: Record<string, number>;
  tableStats: Record<string, TableStats>;
}

export interface TableStats {
  rowCount: number;
  avgRowSize: number;
  readLatency: number;
  writeLatency: number;
  hotPartitions: string[];
}

export class PerformanceOptimizer {
  private client: Client;
  private keyspace: string;
  private config: Required<OptimizationConfig>;
  private queryHistory: QueryAnalysis[] = [];
  private performanceMetrics: PerformanceMetrics;

  constructor(client: Client, keyspace: string, config: OptimizationConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      autoAnalyze: true,
      suggestIndexes: true,
      suggestMaterializedViews: true,
      optimizeQueries: true,
      monitorPerformance: true,
      ...config
    };

    this.performanceMetrics = {
      avgQueryTime: 0,
      slowQueries: [],
      indexUsage: {},
      tableStats: {}
    };
  }

  async analyzeQuery(query: string, params: any[] = []): Promise<QueryAnalysis> {
    if (!this.config.enabled) {
      return {
        query,
        executionTime: 0,
        rowsScanned: 0,
        rowsReturned: 0,
        usesAllowFiltering: false,
        suggestions: []
      };
    }

    const startTime = Date.now();
    
    try {
      // Execute query to get actual performance data
      const result = await this.client.execute(query, params, { prepare: true });
      const executionTime = Date.now() - startTime;
      
      const analysis: QueryAnalysis = {
        query,
        executionTime,
        rowsScanned: this.estimateRowsScanned(query, result.rows.length),
        rowsReturned: result.rows.length,
        usesAllowFiltering: query.toUpperCase().includes('ALLOW FILTERING'),
        suggestions: []
      };

      // Generate suggestions
      if (this.config.autoAnalyze) {
        analysis.suggestions = await this.generateSuggestions(analysis);
      }

      // Store in history
      this.queryHistory.push(analysis);
      this.updatePerformanceMetrics(analysis);

      return analysis;

    } catch (error) {
      // Return basic analysis even if query fails
      return {
        query,
        executionTime: Date.now() - startTime,
        rowsScanned: 0,
        rowsReturned: 0,
        usesAllowFiltering: query.toUpperCase().includes('ALLOW FILTERING'),
        suggestions: [{
          type: 'query_rewrite',
          priority: 'high',
          description: `Query failed: ${error instanceof Error ? error.message : String(error)}`,
          implementation: 'Review query syntax and constraints'
        }]
      };
    }
  }

  private async generateSuggestions(analysis: QueryAnalysis): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Slow query suggestions
    if (analysis.executionTime > 1000) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'high',
        description: 'Query is slow (>1s). Consider optimizing WHERE clauses or adding indexes.',
        estimatedImprovement: '50-80% faster'
      });
    }

    // ALLOW FILTERING suggestions
    if (analysis.usesAllowFiltering) {
      suggestions.push({
        type: 'index',
        priority: 'high',
        description: 'Query uses ALLOW FILTERING. Consider creating an index on filtered columns.',
        implementation: await this.suggestIndexForQuery(analysis.query),
        estimatedImprovement: '70-90% faster'
      });
    }

    // High scan ratio suggestions
    const scanRatio = analysis.rowsScanned / Math.max(analysis.rowsReturned, 1);
    if (scanRatio > 10) {
      suggestions.push({
        type: 'materialized_view',
        priority: 'medium',
        description: `High scan ratio (${scanRatio.toFixed(1)}:1). Consider a materialized view.`,
        implementation: await this.suggestMaterializedView(analysis.query),
        estimatedImprovement: '60-80% faster'
      });
    }

    // Partition key suggestions
    if (this.isFullTableScan(analysis.query)) {
      suggestions.push({
        type: 'partition_key',
        priority: 'high',
        description: 'Full table scan detected. Add partition key to WHERE clause.',
        implementation: 'WHERE partition_key = ?'
      });
    }

    return suggestions;
  }

  private async suggestIndexForQuery(query: string): Promise<string> {
    // Parse WHERE clause to suggest indexes
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+ALLOW\s+FILTERING|$)/i);
    if (!whereMatch) return '';

    const whereClause = whereMatch[1];
    const conditions = whereClause.split(/\s+AND\s+/i);
    
    const indexColumns: string[] = [];
    for (const condition of conditions) {
      const columnMatch = condition.match(/(\w+)\s*[=<>]/);
      if (columnMatch) {
        indexColumns.push(columnMatch[1]);
      }
    }

    if (indexColumns.length > 0) {
      const tableName = this.extractTableName(query);
      return `CREATE INDEX IF NOT EXISTS idx_${tableName}_${indexColumns.join('_')} ON ${this.keyspace}.${tableName} (${indexColumns.join(', ')})`;
    }

    return '';
  }

  private async suggestMaterializedView(query: string): Promise<string> {
    const tableName = this.extractTableName(query);
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+ALLOW\s+FILTERING|$)/i);

    if (!selectMatch || !whereMatch) return '';

    const selectClause = selectMatch[1].trim() === '*' ? '*' : selectMatch[1];
    const whereClause = whereMatch[1];

    // Extract columns from WHERE clause for primary key
    const conditions = whereClause.split(/\s+AND\s+/i);
    const keyColumns: string[] = [];
    
    for (const condition of conditions) {
      const columnMatch = condition.match(/(\w+)\s*=/);
      if (columnMatch) {
        keyColumns.push(columnMatch[1]);
      }
    }

    if (keyColumns.length > 0) {
      return `CREATE MATERIALIZED VIEW IF NOT EXISTS ${tableName}_by_${keyColumns.join('_')} AS
        SELECT ${selectClause}
        FROM ${this.keyspace}.${tableName}
        WHERE ${keyColumns.map(col => `${col} IS NOT NULL`).join(' AND ')}
        PRIMARY KEY (${keyColumns.join(', ')})`;
    }

    return '';
  }

  private extractTableName(query: string): string {
    const match = query.match(/FROM\s+(?:\w+\.)?(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  private isFullTableScan(query: string): boolean {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+ALLOW\s+FILTERING|$)/i);
    if (!whereMatch) return true;

    const whereClause = whereMatch[1];
    // Check if partition key is used (simplified check)
    return !whereClause.includes('=') || whereClause.includes('ALLOW FILTERING');
  }

  private estimateRowsScanned(query: string, rowsReturned: number): number {
    // Simple estimation based on query patterns
    if (query.toUpperCase().includes('ALLOW FILTERING')) {
      return rowsReturned * 10; // Assume 10:1 scan ratio for filtered queries
    }
    
    if (this.isFullTableScan(query)) {
      return rowsReturned * 5; // Assume 5:1 for table scans
    }

    return rowsReturned; // 1:1 for efficient queries
  }

  private updatePerformanceMetrics(analysis: QueryAnalysis): void {
    // Update average query time
    const totalQueries = this.queryHistory.length;
    this.performanceMetrics.avgQueryTime = 
      (this.performanceMetrics.avgQueryTime * (totalQueries - 1) + analysis.executionTime) / totalQueries;

    // Track slow queries
    if (analysis.executionTime > 1000) {
      this.performanceMetrics.slowQueries.push(analysis);
      // Keep only last 100 slow queries
      if (this.performanceMetrics.slowQueries.length > 100) {
        this.performanceMetrics.slowQueries = this.performanceMetrics.slowQueries.slice(-100);
      }
    }
  }

  async getPerformanceReport(): Promise<{
    summary: PerformanceMetrics;
    topSuggestions: OptimizationSuggestion[];
    queryPatterns: Record<string, number>;
  }> {
    // Analyze query patterns
    const queryPatterns: Record<string, number> = {};
    this.queryHistory.forEach(analysis => {
      const pattern = this.normalizeQuery(analysis.query);
      queryPatterns[pattern] = (queryPatterns[pattern] || 0) + 1;
    });

    // Get top suggestions
    const allSuggestions = this.queryHistory.flatMap(q => q.suggestions);
    const suggestionCounts = new Map<string, { suggestion: OptimizationSuggestion; count: number }>();

    allSuggestions.forEach(suggestion => {
      const key = `${suggestion.type}:${suggestion.description}`;
      const existing = suggestionCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        suggestionCounts.set(key, { suggestion, count: 1 });
      }
    });

    const topSuggestions = Array.from(suggestionCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => item.suggestion);

    return {
      summary: this.performanceMetrics,
      topSuggestions,
      queryPatterns
    };
  }

  private normalizeQuery(query: string): string {
    // Normalize query for pattern analysis
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .trim()
      .toUpperCase();
  }

  async optimizeTable(tableName: string): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    try {
      // Get table statistics
      const stats = await this.getTableStats(tableName);
      
      // Analyze read/write patterns
      if (stats.readLatency > 100) {
        suggestions.push({
          type: 'index',
          priority: 'high',
          description: `High read latency (${stats.readLatency}ms) on table ${tableName}`,
          implementation: 'Consider adding indexes on frequently queried columns'
        });
      }

      if (stats.hotPartitions.length > 0) {
        suggestions.push({
          type: 'partition_key',
          priority: 'high',
          description: `Hot partitions detected: ${stats.hotPartitions.join(', ')}`,
          implementation: 'Consider redesigning partition key for better distribution'
        });
      }

      return suggestions;

    } catch (error) {
      return [{
        type: 'query_rewrite',
        priority: 'low',
        description: `Unable to analyze table ${tableName}: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async getTableStats(tableName: string): Promise<TableStats> {
    // This would integrate with Cassandra's system tables and metrics
    // For now, return mock data
    return {
      rowCount: 1000000,
      avgRowSize: 1024,
      readLatency: 50,
      writeLatency: 25,
      hotPartitions: []
    };
  }

  clearHistory(): void {
    this.queryHistory = [];
    this.performanceMetrics = {
      avgQueryTime: 0,
      slowQueries: [],
      indexUsage: {},
      tableStats: {}
    };
  }

  getQueryHistory(limit: number = 100): QueryAnalysis[] {
    return this.queryHistory.slice(-limit);
  }
}
