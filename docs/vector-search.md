# Vector Search

## Overview
High-performance vector similarity search with multiple distance metrics, indexing strategies, and hybrid search capabilities.

## Vector Table Setup

```typescript
import { VectorManager } from 'cassandraorm-js';

const vectorManager = new VectorManager(client);

// Create vector-enabled table
await vectorManager.createTable('embeddings', {
  id: 'uuid PRIMARY KEY',
  content: 'text',
  vector: 'vector<float, 1536>',
  metadata: 'map<text, text>',
  created_at: 'timestamp'
});

// Create vector index
await vectorManager.createVectorIndex('embeddings', 'vector', {
  metric: 'cosine',
  indexType: 'hnsw',
  parameters: {
    m: 16,
    efConstruction: 200
  }
});
```

## Embedding Generation

```typescript
// OpenAI embeddings
const openaiEmbedding = await vectorManager.generateEmbedding('text content', {
  provider: 'openai',
  model: 'text-embedding-ada-002'
});

// Hugging Face embeddings
const hfEmbedding = await vectorManager.generateEmbedding('text content', {
  provider: 'huggingface',
  model: 'sentence-transformers/all-MiniLM-L6-v2'
});

// Custom embedding service
const customEmbedding = await vectorManager.generateEmbedding('text content', {
  provider: 'custom',
  endpoint: 'https://api.myservice.com/embeddings'
});
```

## Vector Operations

```typescript
// Insert vectors
await vectorManager.insert('embeddings', {
  id: uuid(),
  content: 'Machine learning algorithms',
  vector: embedding,
  metadata: { category: 'ai', difficulty: 'advanced' }
});

// Batch insert
await vectorManager.insertBatch('embeddings', [
  { id: uuid1, content: 'Text 1', vector: vector1 },
  { id: uuid2, content: 'Text 2', vector: vector2 }
]);

// Update vector
await vectorManager.updateVector('embeddings', id, {
  vector: newEmbedding,
  metadata: { updated: true }
});
```

## Similarity Search

```typescript
// Basic similarity search
const results = await vectorManager.search('embeddings', queryVector, {
  limit: 10,
  metric: 'cosine'
});

// Search with filters
const filteredResults = await vectorManager.search('embeddings', queryVector, {
  limit: 20,
  filters: {
    'metadata.category': 'ai',
    'created_at': { $gte: new Date('2024-01-01') }
  },
  threshold: 0.8
});

// Multi-metric search
const multiResults = await vectorManager.multiMetricSearch('embeddings', queryVector, {
  metrics: ['cosine', 'euclidean', 'dot_product'],
  weights: [0.5, 0.3, 0.2],
  limit: 15
});
```

## Advanced Search Patterns

```typescript
// Approximate nearest neighbors
const annResults = await vectorManager.approximateSearch('embeddings', queryVector, {
  algorithm: 'hnsw',
  efSearch: 100,
  limit: 50
});

// Range search
const rangeResults = await vectorManager.rangeSearch('embeddings', queryVector, {
  minSimilarity: 0.7,
  maxSimilarity: 0.95,
  metric: 'cosine'
});

// K-means clustering search
const clusterResults = await vectorManager.clusterSearch('embeddings', {
  k: 5,
  queryVector: queryVector,
  returnCentroids: true
});
```

## Hybrid Search

```typescript
// Vector + text search
const hybridResults = await vectorManager.hybridSearch('embeddings', {
  vector: queryVector,
  text: 'machine learning',
  vectorWeight: 0.7,
  textWeight: 0.3,
  textFields: ['content'],
  limit: 25
});

// Vector + metadata search
const metadataHybrid = await vectorManager.hybridSearch('embeddings', {
  vector: queryVector,
  metadata: { category: 'ai', difficulty: 'beginner' },
  vectorWeight: 0.6,
  metadataWeight: 0.4
});
```

## Vector Analytics

```typescript
// Vector statistics
const stats = await vectorManager.getVectorStats('embeddings');
console.log(`Total vectors: ${stats.count}`);
console.log(`Average similarity: ${stats.avgSimilarity}`);
console.log(`Dimension: ${stats.dimension}`);

// Similarity distribution
const distribution = await vectorManager.getSimilarityDistribution('embeddings', queryVector);
console.log('Similarity distribution:', distribution);

// Vector clustering analysis
const clusters = await vectorManager.analyzeClusters('embeddings', {
  algorithm: 'kmeans',
  k: 10
});
```

## Performance Optimization

```typescript
// Optimize vector index
await vectorManager.optimizeIndex('embeddings', 'vector', {
  rebuildThreshold: 0.1,
  compactionStrategy: 'size_tiered'
});

// Batch vector operations
const batchProcessor = vectorManager.createBatchProcessor({
  batchSize: 1000,
  parallelism: 4
});

await batchProcessor.process(vectors, async (batch) => {
  return await vectorManager.insertBatch('embeddings', batch);
});

// Vector caching
await vectorManager.enableVectorCache({
  maxSize: 10000,
  ttl: 3600,
  strategy: 'lru'
});
```

## Multi-table Vector Search

```typescript
// Search across multiple tables
const multiTableResults = await vectorManager.searchMultipleTables([
  { table: 'documents', vectorField: 'doc_vector', weight: 0.6 },
  { table: 'articles', vectorField: 'article_vector', weight: 0.4 }
], queryVector, {
  limit: 30,
  aggregation: 'weighted_average'
});

// Federated vector search
const federatedResults = await vectorManager.federatedSearch({
  sources: [
    { name: 'local', table: 'embeddings' },
    { name: 'remote', endpoint: 'https://api.vectordb.com/search' }
  ],
  vector: queryVector,
  limit: 20
});
```

## Vector Versioning

```typescript
// Version vectors
await vectorManager.createVersionedTable('versioned_embeddings', {
  id: 'uuid',
  version: 'int',
  vector: 'vector<float, 1536>',
  PRIMARY_KEY: '(id, version)'
});

// Insert new version
await vectorManager.insertVersion('versioned_embeddings', {
  id: documentId,
  version: 2,
  vector: updatedEmbedding
});

// Search specific version
const versionResults = await vectorManager.searchVersion('versioned_embeddings', queryVector, {
  version: 2,
  limit: 10
});
```
