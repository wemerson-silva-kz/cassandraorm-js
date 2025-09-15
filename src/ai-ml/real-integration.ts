import OpenAI from 'openai';

export interface AIMLConfig {
  openai?: {
    apiKey: string;
    model?: string;
  };
  vectorDb?: {
    provider: 'pinecone' | 'weaviate' | 'cassandra';
    apiKey?: string;
    environment?: string;
  };
  semanticCache?: {
    enabled: boolean;
    threshold: number;
  };
}

export class RealAIMLManager {
  private openai?: OpenAI;
  private config: AIMLConfig;

  constructor(config: AIMLConfig) {
    this.config = config;
    
    if (config.openai?.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI not configured. Provide apiKey in config.');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.openai?.model || 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateQueryOptimization(query: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a Cassandra CQL optimization expert. Analyze and suggest optimizations for CQL queries.'
          },
          {
            role: 'user',
            content: `Optimize this CQL query: ${query}`
          }
        ],
        max_tokens: 200
      });

      return response.choices[0].message.content || 'No optimization suggestions';
    } catch (error) {
      console.error('Query optimization error:', error);
      return 'Optimization service unavailable';
    }
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

export class ProductionSemanticCache {
  private cache = new Map<string, { embedding: number[], result: any, timestamp: number }>();
  private aiml: RealAIMLManager;
  private threshold: number;

  constructor(aiml: RealAIMLManager, threshold = 0.85) {
    this.aiml = aiml;
    this.threshold = threshold;
  }

  async get(query: string, params: any[]): Promise<any | null> {
    const queryKey = `${query}:${JSON.stringify(params)}`;
    const queryEmbedding = await this.aiml.generateEmbedding(queryKey);

    for (const [key, cached] of this.cache.entries()) {
      const similarity = this.aiml.calculateSimilarity(queryEmbedding, cached.embedding);
      
      if (similarity >= this.threshold) {
        console.log(`Semantic cache hit: ${similarity.toFixed(3)} similarity`);
        return cached.result;
      }
    }

    return null;
  }

  async set(query: string, params: any[], result: any): Promise<void> {
    const queryKey = `${query}:${JSON.stringify(params)}`;
    const embedding = await this.aiml.generateEmbedding(queryKey);

    this.cache.set(queryKey, {
      embedding,
      result,
      timestamp: Date.now()
    });

    // Cleanup old entries (keep last 100)
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      this.cache.clear();
      entries.slice(0, 100).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      threshold: this.threshold,
      oldestEntry: Math.min(...Array.from(this.cache.values()).map(v => v.timestamp))
    };
  }
}
