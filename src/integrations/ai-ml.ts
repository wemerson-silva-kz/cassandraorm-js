import { Client } from "cassandra-driver";

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  includeDistance?: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'huggingface' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export class AIMLManager {
  constructor(
    private client: Client,
    private keyspace: string,
    private config: AIConfig = { provider: 'custom' }
  ) {}

  async createVectorTable(tableName: string, dimensions: number = 1536): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${tableName} (
        id uuid PRIMARY KEY,
        content text,
        embedding vector<float, ${dimensions}>,
        metadata map<text, text>,
        created_at timestamp
      )
    `;
    await this.client.execute(query);

    // Create vector index for similarity search
    const indexQuery = `
      CREATE CUSTOM INDEX IF NOT EXISTS ${tableName}_vector_idx 
      ON ${this.keyspace}.${tableName} (embedding) 
      USING 'org.apache.cassandra.index.sai.StorageAttachedIndex'
    `;
    try {
      await this.client.execute(indexQuery);
    } catch (error) {
      console.warn('Vector index creation failed (may not be supported):', error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Simplified embedding generation (in real implementation, call AI service)
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    // Simple hash-based embedding for demo
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        embedding[charCode % 384] += 1 / (i + 1);
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  async detectAnomalies(data: any[], options: { threshold?: number; method?: 'statistical' | 'isolation' } = {}): Promise<any[]> {
    const threshold = options.threshold || 2.0; // Standard deviations
    const method = options.method || 'statistical';
    
    if (method === 'statistical') {
      return this.statisticalAnomalyDetection(data, threshold);
    }
    
    return this.isolationForestAnomalyDetection(data, threshold);
  }

  private statisticalAnomalyDetection(data: any[], threshold: number): any[] {
    if (data.length === 0) return [];
    
    // Extract numeric features for analysis
    const features = this.extractNumericFeatures(data);
    const anomalies: any[] = [];
    
    for (const feature of Object.keys(features)) {
      const values = features[feature];
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      values.forEach((value, index) => {
        const zScore = Math.abs((value - mean) / stdDev);
        if (zScore > threshold) {
          const anomaly = {
            index,
            data: data[index],
            feature,
            value,
            zScore,
            anomalyType: 'statistical_outlier',
            confidence: Math.min(zScore / threshold, 1.0)
          };
          
          // Avoid duplicates
          if (!anomalies.some(a => a.index === index)) {
            anomalies.push(anomaly);
          }
        }
      });
    }
    
    return anomalies;
  }

  private isolationForestAnomalyDetection(data: any[], threshold: number): any[] {
    // Simplified isolation forest implementation
    const features = this.extractNumericFeatures(data);
    const anomalies: any[] = [];
    
    // Calculate isolation scores for each data point
    data.forEach((item, index) => {
      let isolationScore = 0;
      let featureCount = 0;
      
      for (const feature of Object.keys(features)) {
        const values = features[feature];
        const value = values[index];
        
        // Simple isolation score based on how far the value is from median
        const sortedValues = [...values].sort((a, b) => a - b);
        const median = sortedValues[Math.floor(sortedValues.length / 2)];
        const mad = this.calculateMAD(sortedValues, median);
        
        if (mad > 0) {
          const score = Math.abs(value - median) / mad;
          isolationScore += score;
          featureCount++;
        }
      }
      
      if (featureCount > 0) {
        const avgScore = isolationScore / featureCount;
        if (avgScore > threshold) {
          anomalies.push({
            index,
            data: item,
            isolationScore: avgScore,
            anomalyType: 'isolation_outlier',
            confidence: Math.min(avgScore / threshold, 1.0)
          });
        }
      }
    });
    
    return anomalies;
  }

  private extractNumericFeatures(data: any[]): Record<string, number[]> {
    const features: Record<string, number[]> = {};
    
    data.forEach(item => {
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'number' && !isNaN(value)) {
          if (!features[key]) {
            features[key] = [];
          }
          features[key].push(value);
        }
      }
    });
    
    return features;
  }

  private calculateMAD(sortedValues: number[], median: number): number {
    const deviations = sortedValues.map(val => Math.abs(val - median));
    deviations.sort((a, b) => a - b);
    return deviations[Math.floor(deviations.length / 2)];
  }

  async similaritySearch(table: string, embedding: number[], options: VectorSearchOptions = {}): Promise<any[]> {
    const limit = options.limit || 10;
    const query = `SELECT * FROM ${this.keyspace}.${table} LIMIT ?`;
    const result = await this.client.execute(query, [limit]);
    return result.rows || [];
  }

  async insertVector(
    tableName: string,
    content: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    const id = crypto.randomUUID();
    const embedding = await this.generateEmbedding(content);
    
    const query = `
      INSERT INTO ${this.keyspace}.${tableName} (id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.client.execute(query, [
      id,
      content,
      embedding,
      metadata,
      new Date()
    ], { prepare: true });
    
    return id;
  }

  

  async semanticSearch(tableName: string, query: string, options: VectorSearchOptions = {}): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    return this.similaritySearch(tableName, queryEmbedding, options);
  }
}

export class SemanticCache {
  private cache = new Map<string, { result: any; embedding: number[]; timestamp: Date }>();
  
  constructor(private options: { similarityThreshold?: number } = {}) {}

  async set(query: string, params: any[], result: any): Promise<void> {
    const aiml = new AIMLManager(null as any, '');
    const embedding = await aiml.generateEmbedding(query + JSON.stringify(params));
    const key = this.generateKey(query, params);
    
    this.cache.set(key, {
      result,
      embedding,
      timestamp: new Date()
    });
  }

  async get(query: string, params: any[]): Promise<any | null> {
    const aiml = new AIMLManager(null as any, '');
    const queryEmbedding = await aiml.generateEmbedding(query + JSON.stringify(params));
    const threshold = this.options.similarityThreshold || 0.85;
    
    for (const [key, cached] of this.cache.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, cached.embedding);
      if (similarity >= threshold) {
        return cached.result;
      }
    }
    
    return null;
  }

  private generateKey(query: string, params: any[]): string {
    return `${query}:${JSON.stringify(params)}`;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
