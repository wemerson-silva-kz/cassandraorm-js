export interface SemanticCacheConfig {
  enabled?: boolean;
  similarityThreshold?: number;
  maxCacheSize?: number;
  ttl?: number;
  embeddingDimensions?: number;
  invalidationStrategy?: 'smart' | 'time' | 'manual';
}

export interface CacheEntry {
  key: string;
  query: string;
  queryEmbedding: number[];
  result: any;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  avgSimilarity: number;
  memoryUsage: number;
}

export class SemanticCache {
  private config: Required<SemanticCacheConfig>;
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats;

  constructor(config: SemanticCacheConfig = {}) {
    this.config = {
      enabled: true,
      similarityThreshold: 0.85,
      maxCacheSize: 1000,
      ttl: 300000, // 5 minutes
      embeddingDimensions: 384,
      invalidationStrategy: 'smart',
      ...config
    };

    this.stats = {
      totalEntries: 0,
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0,
      avgSimilarity: 0,
      memoryUsage: 0
    };
  }

  async get(query: string, params: any[] = []): Promise<any | null> {
    if (!this.config.enabled) return null;

    const queryEmbedding = await this.generateQueryEmbedding(query, params);
    const similarEntry = this.findSimilarEntry(queryEmbedding);

    if (similarEntry) {
      // Check if entry is still valid
      if (this.isEntryValid(similarEntry)) {
        similarEntry.accessCount++;
        similarEntry.lastAccessed = new Date();
        
        this.stats.totalHits++;
        this.updateHitRate();
        
        return similarEntry.result;
      } else {
        // Remove expired entry
        this.cache.delete(similarEntry.key);
        this.stats.totalEntries--;
      }
    }

    this.stats.totalMisses++;
    this.updateHitRate();
    
    return null;
  }

  async set(
    query: string, 
    params: any[], 
    result: any, 
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled) return;

    const queryEmbedding = await this.generateQueryEmbedding(query, params);
    const key = this.generateCacheKey(query, params);

    // Check cache size and evict if necessary
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry = {
      key,
      query: this.normalizeQuery(query, params),
      queryEmbedding,
      result,
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      metadata
    };

    this.cache.set(key, entry);
    this.stats.totalEntries++;
    this.updateMemoryUsage();
  }

  private findSimilarEntry(queryEmbedding: number[]): CacheEntry | null {
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.cache.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.queryEmbedding);
      
      if (similarity > bestSimilarity && similarity >= this.config.similarityThreshold) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    if (bestMatch) {
      this.updateAvgSimilarity(bestSimilarity);
    }

    return bestMatch;
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

  private async generateQueryEmbedding(query: string, params: any[]): Promise<number[]> {
    // Normalize query with parameters
    const normalizedQuery = this.normalizeQuery(query, params);
    
    // Simple embedding generation (in production, use actual ML models)
    const words = normalizedQuery.toLowerCase().split(/\s+/);
    const embedding = new Array(this.config.embeddingDimensions).fill(0);
    
    // Hash-based embedding with semantic awareness
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWeight = this.getWordWeight(word);
      
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const index = (charCode + i + j) % this.config.embeddingDimensions;
        embedding[index] += Math.sin(charCode * 0.1) * wordWeight;
      }
    }

    // Add query structure information
    this.addStructuralFeatures(embedding, query);

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;
  }

  private getWordWeight(word: string): number {
    // Give higher weights to important SQL keywords and operations
    const importantWords = {
      'select': 2.0,
      'from': 2.0,
      'where': 2.0,
      'join': 1.8,
      'group': 1.5,
      'order': 1.5,
      'having': 1.5,
      'limit': 1.3,
      'count': 1.4,
      'sum': 1.4,
      'avg': 1.4,
      'max': 1.4,
      'min': 1.4
    };

    return importantWords[word.toLowerCase()] || 1.0;
  }

  private addStructuralFeatures(embedding: number[], query: string): void {
    const structure = this.analyzeQueryStructure(query);
    
    // Add structural features to embedding
    const structuralOffset = Math.floor(this.config.embeddingDimensions * 0.9);
    
    if (structure.hasJoin) embedding[structuralOffset] += 0.5;
    if (structure.hasGroupBy) embedding[structuralOffset + 1] += 0.5;
    if (structure.hasOrderBy) embedding[structuralOffset + 2] += 0.5;
    if (structure.hasLimit) embedding[structuralOffset + 3] += 0.5;
    if (structure.hasAggregation) embedding[structuralOffset + 4] += 0.5;
    
    embedding[structuralOffset + 5] += structure.tableCount * 0.1;
    embedding[structuralOffset + 6] += structure.conditionCount * 0.1;
  }

  private analyzeQueryStructure(query: string): {
    hasJoin: boolean;
    hasGroupBy: boolean;
    hasOrderBy: boolean;
    hasLimit: boolean;
    hasAggregation: boolean;
    tableCount: number;
    conditionCount: number;
  } {
    const upperQuery = query.toUpperCase();
    
    return {
      hasJoin: /\bJOIN\b/.test(upperQuery),
      hasGroupBy: /\bGROUP\s+BY\b/.test(upperQuery),
      hasOrderBy: /\bORDER\s+BY\b/.test(upperQuery),
      hasLimit: /\bLIMIT\b/.test(upperQuery),
      hasAggregation: /\b(COUNT|SUM|AVG|MIN|MAX)\b/.test(upperQuery),
      tableCount: (upperQuery.match(/\bFROM\s+\w+/g) || []).length,
      conditionCount: (upperQuery.match(/\bWHERE\b|\bAND\b|\bOR\b/g) || []).length
    };
  }

  private normalizeQuery(query: string, params: any[]): string {
    let normalized = query
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    // Replace parameters with normalized placeholders
    params.forEach((param, index) => {
      const placeholder = this.normalizeParameter(param);
      normalized = normalized.replace('?', placeholder);
    });

    return normalized;
  }

  private normalizeParameter(param: any): string {
    if (typeof param === 'string') {
      // Normalize string patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(param)) return 'DATE_PARAM';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)) return 'UUID_PARAM';
      if (param.includes('@')) return 'EMAIL_PARAM';
      return 'STRING_PARAM';
    }
    
    if (typeof param === 'number') {
      if (Number.isInteger(param)) return 'INT_PARAM';
      return 'FLOAT_PARAM';
    }
    
    if (typeof param === 'boolean') return 'BOOL_PARAM';
    if (Array.isArray(param)) return 'ARRAY_PARAM';
    
    return 'OBJECT_PARAM';
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const now = new Date();
    const age = now.getTime() - entry.timestamp.getTime();
    
    if (age > this.config.ttl) return false;

    // Smart invalidation based on access patterns
    if (this.config.invalidationStrategy === 'smart') {
      const timeSinceLastAccess = now.getTime() - entry.lastAccessed.getTime();
      const adaptiveTtl = this.config.ttl * Math.log(entry.accessCount + 1);
      
      return timeSinceLastAccess < adaptiveTtl;
    }

    return true;
  }

  private evictLeastUsed(): void {
    let leastUsedEntry: CacheEntry | null = null;
    let leastUsedKey: string | null = null;
    let minScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Calculate eviction score (lower is more likely to be evicted)
      const timeSinceAccess = Date.now() - entry.lastAccessed.getTime();
      const score = entry.accessCount / (timeSinceAccess / 1000); // Access frequency per second
      
      if (score < minScore) {
        minScore = score;
        leastUsedEntry = entry;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.stats.totalEntries--;
    }
  }

  private generateCacheKey(query: string, params: any[]): string {
    const normalizedQuery = this.normalizeQuery(query, params);
    return `semantic_${this.hashString(normalizedQuery)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  private updateAvgSimilarity(similarity: number): void {
    const totalSimilarityMeasurements = this.stats.totalHits;
    this.stats.avgSimilarity = totalSimilarityMeasurements > 0
      ? (this.stats.avgSimilarity * (totalSimilarityMeasurements - 1) + similarity) / totalSimilarityMeasurements
      : similarity;
  }

  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2; // Rough estimate
    }
    this.stats.memoryUsage = totalSize;
  }

  // Smart invalidation based on data changes
  invalidateByPattern(pattern: string): number {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.query.includes(pattern.toUpperCase())) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.stats.totalEntries -= invalidated;
    return invalidated;
  }

  // Invalidate entries related to specific tables
  invalidateByTable(tableName: string): number {
    return this.invalidateByPattern(`FROM ${tableName.toUpperCase()}`);
  }

  // Get cache statistics
  getStats(): CacheStats {
    this.updateMemoryUsage();
    return { ...this.stats };
  }

  // Clear all cache entries
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalEntries: 0,
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0,
      avgSimilarity: 0,
      memoryUsage: 0
    };
  }

  // Get cache entries for debugging
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  // Optimize cache by removing low-value entries
  optimize(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      const accessRate = entry.accessCount / (age / 1000); // accesses per second
      
      // Remove entries with very low access rate and old age
      if (accessRate < 0.001 && age > this.config.ttl * 0.5) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.stats.totalEntries -= removed;
    return removed;
  }
}
