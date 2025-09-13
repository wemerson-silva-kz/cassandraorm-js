import type { Client } from "cassandra-driver";

export interface AIConfig {
  enabled?: boolean;
  embeddingProvider?: 'openai' | 'huggingface' | 'local';
  embeddingModel?: string;
  vectorDimensions?: number;
  similarityThreshold?: number;
  maxResults?: number;
}

export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
  content?: string;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  metadata?: Record<string, any>;
  content?: string;
}

export interface QuerySuggestion {
  originalQuery: string;
  suggestedQuery: string;
  reason: string;
  confidence: number;
}

export class AIMLManager {
  private client: Client;
  private keyspace: String;
  private config: Required<AIConfig>;

  constructor(client: Client, keyspace: string, config: AIConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      embeddingProvider: 'local',
      embeddingModel: 'all-MiniLM-L6-v2',
      vectorDimensions: 384,
      similarityThreshold: 0.7,
      maxResults: 10,
      ...config
    };
  }

  async createVectorTable(tableName: string): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${tableName} (
        id text PRIMARY KEY,
        vector list<float>,
        content text,
        metadata map<text, text>,
        created_at timestamp
      )
    `);

    // Create index for metadata queries
    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS ${tableName}_metadata_idx 
      ON ${this.keyspace}.${tableName} (metadata)
    `);
  }

  async insertEmbedding(
    tableName: string,
    embedding: EmbeddingVector
  ): Promise<void> {
    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${tableName} 
       (id, vector, content, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        embedding.id,
        embedding.vector,
        embedding.content || '',
        embedding.metadata || {},
        new Date()
      ],
      { prepare: true }
    );
  }

  async similaritySearch(
    tableName: string,
    queryVector: number[],
    options: {
      threshold?: number;
      limit?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<SimilarityResult[]> {
    const threshold = options.threshold || this.config.similarityThreshold;
    const limit = options.limit || this.config.maxResults;

    // Get all vectors (in production, you'd use a vector database)
    let query = `SELECT * FROM ${this.keyspace}.${tableName}`;
    const params: any[] = [];

    if (options.metadata) {
      const conditions = Object.entries(options.metadata).map(([key, value]) => {
        params.push(value);
        return `metadata[?] = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
      
      // Add keys for metadata conditions
      Object.keys(options.metadata).forEach(key => {
        params.splice(-Object.keys(options.metadata).length, 0, key);
      });
      
      query += ' ALLOW FILTERING';
    }

    const result = await this.client.execute(query, params, { prepare: true });
    
    // Calculate similarities
    const similarities: SimilarityResult[] = [];
    
    for (const row of result.rows) {
      const similarity = this.cosineSimilarity(queryVector, row.vector);
      
      if (similarity >= threshold) {
        similarities.push({
          id: row.id,
          similarity,
          content: row.content,
          metadata: row.metadata
        });
      }
    }

    // Sort by similarity and limit results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Simple text embedding (mock implementation)
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.config.enabled) {
      return new Array(this.config.vectorDimensions).fill(0);
    }

    // Mock embedding generation (in production, use actual ML models)
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.config.vectorDimensions).fill(0);
    
    // Simple hash-based embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const index = (charCode + i + j) % this.config.vectorDimensions;
        embedding[index] += Math.sin(charCode * 0.1) * 0.1;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;
  }

  // Query optimization using AI
  async optimizeQuery(query: string): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];

    // Pattern-based optimization suggestions
    const patterns = [
      {
        pattern: /SELECT \* FROM (\w+) WHERE (\w+) = \? ALLOW FILTERING/i,
        suggestion: (match: RegExpMatchArray) => 
          `CREATE INDEX IF NOT EXISTS idx_${match[1]}_${match[2]} ON ${match[1]} (${match[2]}); ` +
          `SELECT * FROM ${match[1]} WHERE ${match[2]} = ?`,
        reason: 'Remove ALLOW FILTERING by creating an index',
        confidence: 0.9
      },
      {
        pattern: /SELECT \* FROM (\w+)$/i,
        suggestion: (match: RegExpMatchArray) => 
          `SELECT * FROM ${match[1]} LIMIT 1000`,
        reason: 'Add LIMIT to prevent full table scan',
        confidence: 0.8
      },
      {
        pattern: /WHERE (\w+) > \? AND \1 < \?/i,
        suggestion: (match: RegExpMatchArray) => 
          query.replace(match[0], `WHERE ${match[1]} >= ? AND ${match[1]} <= ?`),
        reason: 'Use inclusive range for better performance',
        confidence: 0.7
      }
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern.pattern);
      if (match) {
        suggestions.push({
          originalQuery: query,
          suggestedQuery: pattern.suggestion(match),
          reason: pattern.reason,
          confidence: pattern.confidence
        });
      }
    }

    return suggestions;
  }

  // Anomaly detection in query patterns
  async detectAnomalies(
    queryHistory: Array<{ query: string; executionTime: number; timestamp: Date }>
  ): Promise<Array<{ query: string; anomalyScore: number; reason: string }>> {
    const anomalies: Array<{ query: string; anomalyScore: number; reason: string }> = [];

    // Calculate average execution time
    const avgExecutionTime = queryHistory.reduce((sum, q) => sum + q.executionTime, 0) / queryHistory.length;
    const stdDev = Math.sqrt(
      queryHistory.reduce((sum, q) => sum + Math.pow(q.executionTime - avgExecutionTime, 2), 0) / queryHistory.length
    );

    // Detect slow queries
    queryHistory.forEach(queryData => {
      const zScore = (queryData.executionTime - avgExecutionTime) / stdDev;
      
      if (zScore > 2) { // More than 2 standard deviations
        anomalies.push({
          query: queryData.query,
          anomalyScore: zScore,
          reason: `Execution time (${queryData.executionTime}ms) is ${zScore.toFixed(2)} standard deviations above average`
        });
      }
    });

    // Detect unusual query patterns
    const queryPatterns = new Map<string, number>();
    queryHistory.forEach(q => {
      const pattern = this.normalizeQuery(q.query);
      queryPatterns.set(pattern, (queryPatterns.get(pattern) || 0) + 1);
    });

    const avgFrequency = Array.from(queryPatterns.values()).reduce((a, b) => a + b, 0) / queryPatterns.size;
    
    queryPatterns.forEach((frequency, pattern) => {
      if (frequency === 1 && queryHistory.length > 10) { // Unique queries in large datasets
        const originalQuery = queryHistory.find(q => this.normalizeQuery(q.query) === pattern)?.query || pattern;
        anomalies.push({
          query: originalQuery,
          anomalyScore: 1.0,
          reason: 'Unique query pattern - potential one-off or experimental query'
        });
      }
    });

    return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
  }

  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '?')
      .trim()
      .toUpperCase();
  }

  // Predictive caching based on query patterns
  async predictNextQueries(
    queryHistory: Array<{ query: string; timestamp: Date; userId?: string }>
  ): Promise<Array<{ query: string; probability: number; reason: string }>> {
    const predictions: Array<{ query: string; probability: number; reason: string }> = [];

    // Group queries by user
    const userPatterns = new Map<string, string[]>();
    queryHistory.forEach(q => {
      const userId = q.userId || 'anonymous';
      if (!userPatterns.has(userId)) {
        userPatterns.set(userId, []);
      }
      userPatterns.get(userId)!.push(this.normalizeQuery(q.query));
    });

    // Find sequential patterns
    userPatterns.forEach((queries, userId) => {
      for (let i = 0; i < queries.length - 1; i++) {
        const currentQuery = queries[i];
        const nextQuery = queries[i + 1];
        
        // Count how often this sequence occurs
        let sequenceCount = 0;
        let currentQueryCount = 0;
        
        for (let j = 0; j < queries.length - 1; j++) {
          if (queries[j] === currentQuery) {
            currentQueryCount++;
            if (queries[j + 1] === nextQuery) {
              sequenceCount++;
            }
          }
        }

        if (currentQueryCount > 0) {
          const probability = sequenceCount / currentQueryCount;
          if (probability > 0.3) { // 30% threshold
            predictions.push({
              query: nextQuery,
              probability,
              reason: `Query often follows pattern for user ${userId} (${sequenceCount}/${currentQueryCount} times)`
            });
          }
        }
      }
    });

    // Remove duplicates and sort by probability
    const uniquePredictions = new Map<string, { probability: number; reason: string }>();
    predictions.forEach(p => {
      const existing = uniquePredictions.get(p.query);
      if (!existing || p.probability > existing.probability) {
        uniquePredictions.set(p.query, { probability: p.probability, reason: p.reason });
      }
    });

    return Array.from(uniquePredictions.entries())
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10);
  }

  // Smart data partitioning suggestions
  async suggestPartitioning(
    tableName: string,
    queryPatterns: string[]
  ): Promise<Array<{ strategy: string; columns: string[]; benefit: string; confidence: number }>> {
    const suggestions: Array<{ strategy: string; columns: string[]; benefit: string; confidence: number }> = [];

    // Analyze WHERE clauses to find common partition key candidates
    const columnUsage = new Map<string, number>();
    const equalityColumns = new Set<string>();

    queryPatterns.forEach(query => {
      const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+ALLOW\s+FILTERING|$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1].split(/\s+AND\s+/i);
        conditions.forEach(condition => {
          const equalityMatch = condition.match(/(\w+)\s*=\s*\?/);
          if (equalityMatch) {
            const column = equalityMatch[1];
            columnUsage.set(column, (columnUsage.get(column) || 0) + 1);
            equalityColumns.add(column);
          }
        });
      }
    });

    // Suggest partition keys based on usage frequency
    const sortedColumns = Array.from(columnUsage.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedColumns.length > 0) {
      const topColumn = sortedColumns[0];
      suggestions.push({
        strategy: 'single_partition_key',
        columns: [topColumn[0]],
        benefit: `Optimize queries using ${topColumn[0]} (used in ${topColumn[1]} queries)`,
        confidence: Math.min(0.9, topColumn[1] / queryPatterns.length)
      });
    }

    // Suggest composite partition keys
    if (sortedColumns.length > 1) {
      const topTwo = sortedColumns.slice(0, 2);
      suggestions.push({
        strategy: 'composite_partition_key',
        columns: topTwo.map(c => c[0]),
        benefit: `Better distribution using composite key (${topTwo.map(c => `${c[0]}:${c[1]}`).join(', ')})`,
        confidence: 0.7
      });
    }

    return suggestions;
  }
}
