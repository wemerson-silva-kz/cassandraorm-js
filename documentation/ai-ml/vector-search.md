# 🧠 Vector Search & AI/ML Integration

CassandraORM JS provides native AI/ML capabilities including vector search, semantic caching, and intelligent query optimization.

## 📋 Table of Contents

- [Overview](#overview)
- [Vector Search](#vector-search)
- [Embedding Generation](#embedding-generation)
- [Similarity Search](#similarity-search)
- [Semantic Caching](#semantic-caching)
- [Query Optimization](#query-optimization)
- [Anomaly Detection](#anomaly-detection)
- [Real-world Examples](#real-world-examples)

## 🎯 Overview

The AI/ML integration in CassandraORM JS enables:

- **Vector Search** - Similarity search with embeddings
- **Semantic Caching** - Intelligent caching based on query similarity
- **Query Optimization** - AI-powered query performance suggestions
- **Anomaly Detection** - Performance anomaly detection
- **Recommendation Systems** - Content and user recommendations

## 🔍 Vector Search

### Setup Vector Tables

```typescript
import { AIMLManager } from 'cassandraorm-js';

const aiml = new AIMLManager(client.driver, 'myapp');

// Create vector table for documents
await aiml.createVectorTable('documents', {
  vectorDimension: 384, // OpenAI ada-002 dimension
  additionalFields: {
    title: 'text',
    content: 'text',
    category: 'text',
    author: 'text',
    created_at: 'timestamp'
  }
});

// Create vector table for products
await aiml.createVectorTable('products', {
  vectorDimension: 768, // Sentence-BERT dimension
  additionalFields: {
    name: 'text',
    description: 'text',
    price: 'decimal',
    category: 'text',
    tags: 'set<text>'
  }
});
```

### Vector Table Schema

The vector tables automatically include:

```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY,
  title text,
  content text,
  category text,
  author text,
  created_at timestamp,
  vector list<float>,
  vector_norm float,
  created_vector_at timestamp
);

CREATE INDEX ON documents (category);
CREATE INDEX ON documents (created_at);
```

## 🎯 Embedding Generation

### Text Embeddings

```typescript
// Generate embedding for text
const embedding = await aiml.generateEmbedding(
  'Machine learning tutorial for beginners'
);

console.log('Embedding dimensions:', embedding.length); // 384

// Generate embeddings for multiple texts
const texts = [
  'Python programming guide',
  'JavaScript frameworks comparison',
  'Database optimization techniques'
];

const embeddings = await aiml.generateEmbeddings(texts);
```

### Custom Embedding Models

```typescript
// Configure custom embedding model
const aiml = new AIMLManager(client.driver, 'myapp', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  embeddingDimension: 384,
  apiKey: process.env.OPENAI_API_KEY // For OpenAI models
});

// Use different models for different use cases
const documentEmbedding = await aiml.generateEmbedding(
  text,
  { model: 'text-embedding-ada-002' }
);

const codeEmbedding = await aiml.generateEmbedding(
  code,
  { model: 'code-search-ada-code-001' }
);
```

## 🔍 Similarity Search

### Basic Similarity Search

```typescript
// Insert documents with vectors
await aiml.insertVector('documents', {
  id: client.uuid(),
  title: 'Introduction to Machine Learning',
  content: 'Machine learning is a subset of artificial intelligence...',
  category: 'tutorial',
  author: 'John Doe',
  created_at: new Date(),
  vector: await aiml.generateEmbedding('Introduction to Machine Learning')
});

// Search for similar documents
const searchQuery = 'AI and machine learning basics';
const searchEmbedding = await aiml.generateEmbedding(searchQuery);

const results = await aiml.similaritySearch('documents', searchEmbedding, {
  limit: 10,
  threshold: 0.7,
  includeDistance: true
});

console.log('Found', results.length, 'similar documents');
results.forEach(doc => {
  console.log(`${doc.title} (similarity: ${doc.similarity})`);
});
```

### Advanced Search Options

```typescript
import { VectorSearchOptions } from 'cassandraorm-js';

const searchOptions: VectorSearchOptions = {
  limit: 20,
  threshold: 0.75,
  includeDistance: true,
  includeMetadata: true,
  filters: {
    category: 'tutorial',
    created_at: { $gte: new Date('2024-01-01') }
  },
  sortBy: 'similarity', // or 'created_at', 'relevance'
  sortOrder: 'desc'
};

const results = await aiml.similaritySearch(
  'documents', 
  searchEmbedding, 
  searchOptions
);
```

### Hybrid Search (Vector + Text)

```typescript
// Combine vector similarity with text search
const hybridResults = await aiml.hybridSearch('documents', {
  vectorQuery: searchEmbedding,
  textQuery: 'machine learning python',
  vectorWeight: 0.7,
  textWeight: 0.3,
  limit: 10
});
```

## 💾 Semantic Caching

### Setup Semantic Cache

```typescript
import { SemanticCache } from 'cassandraorm-js';

const cache = new SemanticCache({
  similarityThreshold: 0.85,
  maxSize: 10000,
  ttl: 3600, // 1 hour
  embeddingModel: 'text-embedding-ada-002'
});
```

### Cache Operations

```typescript
// Cache query results
const query = 'SELECT * FROM products WHERE category = ?';
const params = ['electronics'];
const results = await client.execute(query, params);

await cache.set(query, params, results);

// Retrieve from cache with semantic similarity
const similarQuery = 'Find all electronic products';
const similarParams = ['electronics'];

const cached = await cache.get(similarQuery, similarParams);
if (cached) {
  console.log('Cache hit! Using cached results.');
  return cached;
}

// Cache statistics
const stats = await cache.getStats();
console.log('Cache hit rate:', stats.hitRate);
console.log('Total queries:', stats.totalQueries);
```

### Smart Cache Invalidation

```typescript
// Invalidate cache based on semantic similarity
await cache.invalidateByPattern('product recommendations');

// This will invalidate caches for similar queries like:
// - "recommend products"
// - "product suggestions"
// - "similar items"

// Invalidate by category
await cache.invalidateByMetadata({ category: 'electronics' });
```

## ⚡ Query Optimization

### AI-Powered Query Analysis

```typescript
import { PerformanceOptimizer } from 'cassandraorm-js';

const optimizer = new PerformanceOptimizer(client.driver);

// Analyze query performance
const analysis = await optimizer.analyzeQuery(
  'SELECT * FROM users WHERE age > ? AND city = ?',
  [25, 'New York']
);

console.log('Execution time:', analysis.executionTime);
console.log('Rows examined:', analysis.rowsExamined);
console.log('Index usage:', analysis.indexUsage);
console.log('Optimization score:', analysis.optimizationScore);
```

### Get Optimization Suggestions

```typescript
const suggestions = await optimizer.getSuggestions('users');

suggestions.forEach(suggestion => {
  console.log(`${suggestion.type}: ${suggestion.description}`);
  console.log(`Impact: ${suggestion.impact}, Priority: ${suggestion.priority}`);
});

// Example suggestions:
// Index: Consider adding an index on (age, city) for better performance
// Query: Use prepared statements to reduce parsing overhead
// Schema: Consider denormalizing frequently joined data
```

### Automatic Query Optimization

```typescript
// Enable automatic query optimization
const optimizedClient = createClient({
  clientOptions: { /* ... */ },
  ormOptions: {
    enableQueryOptimization: true,
    optimizationLevel: 'aggressive', // 'conservative', 'moderate', 'aggressive'
    autoCreateIndexes: true
  }
});

// Queries will be automatically optimized
const users = await User.find({ age: { $gt: 25 }, city: 'New York' });
```

## 🚨 Anomaly Detection

### Performance Anomaly Detection

```typescript
import { AnomalyDetector } from 'cassandraorm-js';

const detector = aiml.getAnomalyDetector();

// Monitor query performance
const metrics = [
  { timestamp: new Date(), value: 100, metric: 'query_time' },
  { timestamp: new Date(), value: 95, metric: 'query_time' },
  { timestamp: new Date(), value: 500, metric: 'query_time' }, // Anomaly!
  { timestamp: new Date(), value: 98, metric: 'query_time' }
];

const anomalies = await detector.detectAnomalies(metrics);

anomalies.forEach(anomaly => {
  console.log(`Anomaly detected: ${anomaly.metric} = ${anomaly.value}`);
  console.log(`Severity: ${anomaly.severity}, Confidence: ${anomaly.confidence}`);
});
```

### Real-time Anomaly Monitoring

```typescript
// Setup real-time anomaly detection
await detector.startMonitoring({
  metrics: ['query_time', 'cpu_usage', 'memory_usage'],
  interval: 5000, // Check every 5 seconds
  alertThreshold: 0.8 // Alert if confidence > 80%
});

detector.on('anomaly', (anomaly) => {
  console.log('🚨 Anomaly detected:', anomaly);
  
  // Send alert, log to monitoring system, etc.
  if (anomaly.severity === 'critical') {
    sendAlert(anomaly);
  }
});
```

## 🛍️ Real-world Examples

### E-commerce Product Recommendations

```typescript
class ProductRecommendationService {
  private aiml: AIMLManager;

  constructor(client: CassandraClient) {
    this.aiml = new AIMLManager(client.driver, 'ecommerce');
  }

  async setupProductVectors() {
    await this.aiml.createVectorTable('product_embeddings', {
      vectorDimension: 384,
      additionalFields: {
        product_id: 'uuid',
        name: 'text',
        category: 'text',
        price: 'decimal',
        rating: 'float'
      }
    });
  }

  async indexProduct(product: any) {
    const description = `${product.name} ${product.description} ${product.category}`;
    const embedding = await this.aiml.generateEmbedding(description);

    await this.aiml.insertVector('product_embeddings', {
      id: client.uuid(),
      product_id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      rating: product.rating,
      vector: embedding
    });
  }

  async getRecommendations(userId: string, limit: number = 10) {
    // Get user's purchase history
    const purchases = await Purchase.find({ user_id: userId });
    
    // Generate user preference embedding
    const userPreferences = purchases.map(p => p.product_name).join(' ');
    const userEmbedding = await this.aiml.generateEmbedding(userPreferences);

    // Find similar products
    const recommendations = await this.aiml.similaritySearch(
      'product_embeddings',
      userEmbedding,
      {
        limit: limit * 2, // Get more to filter out already purchased
        threshold: 0.6,
        filters: {
          rating: { $gte: 4.0 } // Only recommend highly rated products
        }
      }
    );

    // Filter out already purchased products
    const purchasedIds = new Set(purchases.map(p => p.product_id));
    return recommendations
      .filter(rec => !purchasedIds.has(rec.product_id))
      .slice(0, limit);
  }
}
```

### Content Discovery System

```typescript
class ContentDiscoveryService {
  private aiml: AIMLManager;
  private cache: SemanticCache;

  constructor(client: CassandraClient) {
    this.aiml = new AIMLManager(client.driver, 'content');
    this.cache = new SemanticCache({ similarityThreshold: 0.8 });
  }

  async indexContent(article: any) {
    const content = `${article.title} ${article.summary} ${article.tags.join(' ')}`;
    const embedding = await this.aiml.generateEmbedding(content);

    await this.aiml.insertVector('content_embeddings', {
      id: client.uuid(),
      article_id: article.id,
      title: article.title,
      category: article.category,
      author: article.author,
      published_at: article.published_at,
      vector: embedding
    });
  }

  async discoverContent(userQuery: string, userPreferences: any) {
    // Check semantic cache first
    const cacheKey = `discover:${userQuery}`;
    const cached = await this.cache.get(cacheKey, userPreferences);
    if (cached) return cached;

    // Generate search embedding
    const searchEmbedding = await this.aiml.generateEmbedding(userQuery);

    // Search for relevant content
    const results = await this.aiml.similaritySearch(
      'content_embeddings',
      searchEmbedding,
      {
        limit: 20,
        threshold: 0.7,
        filters: {
          category: { $in: userPreferences.categories },
          published_at: { $gte: userPreferences.since }
        }
      }
    );

    // Cache results
    await this.cache.set(cacheKey, userPreferences, results);

    return results;
  }
}
```

### Intelligent Search with Filters

```typescript
class IntelligentSearchService {
  async search(query: string, filters: any = {}) {
    const embedding = await this.aiml.generateEmbedding(query);
    
    // Combine vector search with traditional filters
    const results = await this.aiml.hybridSearch('documents', {
      vectorQuery: embedding,
      textQuery: query,
      vectorWeight: 0.6,
      textWeight: 0.4,
      filters: {
        ...filters,
        status: 'published'
      },
      limit: 50
    });

    // Re-rank results based on user context
    return this.reRankResults(results, filters.userContext);
  }

  private async reRankResults(results: any[], userContext: any) {
    // Use ML model to re-rank based on user preferences
    const userEmbedding = await this.aiml.generateEmbedding(
      userContext.preferences.join(' ')
    );

    return results.map(result => ({
      ...result,
      personalizedScore: this.calculatePersonalizedScore(
        result.vector,
        userEmbedding,
        userContext
      )
    })).sort((a, b) => b.personalizedScore - a.personalizedScore);
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# OpenAI API Key (for OpenAI embeddings)
OPENAI_API_KEY=your_openai_api_key

# Hugging Face API Key (for Hugging Face models)
HUGGINGFACE_API_KEY=your_hf_api_key

# Custom embedding service
EMBEDDING_SERVICE_URL=http://localhost:8080/embeddings
```

### Advanced Configuration

```typescript
const aiml = new AIMLManager(client.driver, 'myapp', {
  // Embedding configuration
  embeddingModel: 'text-embedding-ada-002',
  embeddingDimension: 1536,
  embeddingBatchSize: 100,
  
  // Search configuration
  defaultSimilarityThreshold: 0.7,
  maxSearchResults: 1000,
  
  // Caching configuration
  enableEmbeddingCache: true,
  embeddingCacheTTL: 86400, // 24 hours
  
  // Performance configuration
  vectorIndexType: 'hnsw', // or 'ivf'
  indexParameters: {
    efConstruction: 200,
    M: 16
  }
});
```

## 📊 Performance Tips

### Optimize Vector Operations

```typescript
// Batch insert vectors for better performance
const vectors = await Promise.all(
  documents.map(async doc => ({
    ...doc,
    vector: await aiml.generateEmbedding(doc.content)
  }))
);

await aiml.batchInsertVectors('documents', vectors);

// Use approximate search for better performance
const results = await aiml.approximateSimilaritySearch(
  'documents',
  embedding,
  { limit: 10, approximationFactor: 0.9 }
);
```

### Index Optimization

```typescript
// Create optimized indexes for vector search
await client.execute(`
  CREATE CUSTOM INDEX ON documents (vector) 
  USING 'org.apache.cassandra.index.sai.StorageAttachedIndex'
  WITH OPTIONS = {
    'similarity_function': 'cosine',
    'index_type': 'hnsw'
  }
`);
```

## 🔗 Next Steps

- **[Semantic Caching →](./semantic-caching.md)** - Advanced caching strategies
- **[Query Optimization →](./query-optimization.md)** - AI-powered optimization
- **[Anomaly Detection →](./anomaly-detection.md)** - Performance monitoring
- **[Examples →](../examples/ai-recommendations.md)** - Complete AI/ML examples

---

**Ready to build intelligent applications? The AI/ML features in CassandraORM JS make it easy! 🧠✨**
