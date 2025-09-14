# AI/ML Integration

## Overview
Native AI/ML capabilities with vector search, embeddings, anomaly detection, and intelligent query optimization.

## Vector Search Setup

```typescript
import { AIMLManager } from 'cassandraorm-js';

const aiml = new AIMLManager(client.driver, 'myapp');

// Create vector table
await aiml.createVectorTable('documents', {
  id: 'uuid',
  content: 'text',
  embedding: 'vector<float, 1536>', // OpenAI embedding size
  metadata: 'map<text, text>'
});

// Generate embeddings
const embedding = await aiml.generateEmbedding('search query text', {
  model: 'text-embedding-ada-002'
});

// Insert with vector
await aiml.insertVector('documents', {
  id: uuid(),
  content: 'Document content',
  embedding: embedding,
  metadata: { category: 'tech', author: 'john' }
});
```

## Similarity Search

```typescript
// Vector similarity search
const results = await aiml.similaritySearch('documents', embedding, {
  limit: 10,
  threshold: 0.8,
  filters: { category: 'tech' }
});

// Hybrid search (vector + text)
const hybridResults = await aiml.hybridSearch('documents', {
  query: 'machine learning algorithms',
  embedding: queryEmbedding,
  weights: { vector: 0.7, text: 0.3 },
  limit: 20
});

// Multi-vector search
const multiResults = await aiml.multiVectorSearch([
  { table: 'documents', embedding: docEmbedding, weight: 0.6 },
  { table: 'articles', embedding: articleEmbedding, weight: 0.4 }
]);
```

## Anomaly Detection

```typescript
import { AnomalyDetector } from 'cassandraorm-js';

const detector = new AnomalyDetector(client);

// Configure anomaly detection
await detector.configure('user_behavior', {
  features: ['login_frequency', 'session_duration', 'page_views'],
  algorithm: 'isolation_forest',
  threshold: 0.1
});

// Train model
await detector.train('user_behavior', {
  timeRange: { start: '2024-01-01', end: '2024-06-01' },
  sampleSize: 10000
});

// Detect anomalies
const anomalies = await detector.detect('user_behavior', {
  userId: '123',
  features: { login_frequency: 50, session_duration: 3600, page_views: 200 }
});

if (anomalies.isAnomaly) {
  console.log(`Anomaly score: ${anomalies.score}`);
  console.log(`Reasons: ${anomalies.reasons.join(', ')}`);
}
```

## Intelligent Query Optimization

```typescript
import { AIQueryOptimizer } from 'cassandraorm-js';

const optimizer = new AIQueryOptimizer(client);

// Train on query patterns
await optimizer.train({
  queryLog: 'system_traces.sessions',
  timeWindow: '30d',
  features: ['query_pattern', 'execution_time', 'resource_usage']
});

// Get AI-powered optimization suggestions
const suggestions = await optimizer.optimize(`
  SELECT * FROM users u 
  JOIN posts p ON u.id = p.user_id 
  WHERE u.created_at > ? AND p.status = 'published'
`, [new Date('2024-01-01')]);

console.log('AI Suggestions:');
suggestions.forEach(suggestion => {
  console.log(`- ${suggestion.type}: ${suggestion.description}`);
  console.log(`  Expected improvement: ${suggestion.improvement}%`);
});
```

## Predictive Analytics

```typescript
import { PredictiveAnalytics } from 'cassandraorm-js';

const analytics = new PredictiveAnalytics(client);

// User churn prediction
const churnModel = await analytics.createModel('user_churn', {
  features: ['last_login', 'session_count', 'purchase_history'],
  target: 'churned',
  algorithm: 'random_forest'
});

await churnModel.train({
  table: 'user_metrics',
  timeRange: '90d'
});

// Predict churn probability
const churnPrediction = await churnModel.predict({
  userId: '123',
  features: { last_login: 30, session_count: 5, purchase_history: 2 }
});

console.log(`Churn probability: ${churnPrediction.probability}`);
```

## Natural Language Queries

```typescript
import { NLQueryProcessor } from 'cassandraorm-js';

const nlProcessor = new NLQueryProcessor(client);

// Configure schema understanding
await nlProcessor.configureSchema({
  tables: ['users', 'posts', 'comments'],
  relationships: [
    { from: 'users', to: 'posts', key: 'user_id' },
    { from: 'posts', to: 'comments', key: 'post_id' }
  ]
});

// Process natural language query
const result = await nlProcessor.query(
  "Show me all active users who posted in the last week"
);

console.log('Generated CQL:', result.cql);
console.log('Parameters:', result.params);
console.log('Results:', result.data);
```

## Recommendation Engine

```typescript
import { RecommendationEngine } from 'cassandraorm-js';

const recommender = new RecommendationEngine(client);

// Collaborative filtering
await recommender.createModel('user_item_cf', {
  type: 'collaborative_filtering',
  userTable: 'users',
  itemTable: 'products',
  interactionTable: 'user_interactions'
});

// Content-based recommendations
await recommender.createModel('content_based', {
  type: 'content_based',
  itemTable: 'products',
  features: ['category', 'brand', 'price_range'],
  embeddings: 'product_embeddings'
});

// Get recommendations
const recommendations = await recommender.recommend('user_item_cf', {
  userId: '123',
  limit: 10,
  excludePurchased: true
});
```

## Real-time ML Inference

```typescript
import { MLInferenceEngine } from 'cassandraorm-js';

const inference = new MLInferenceEngine();

// Load pre-trained model
await inference.loadModel('fraud_detection', {
  modelPath: './models/fraud_model.pkl',
  framework: 'scikit-learn'
});

// Real-time inference
const fraudScore = await inference.predict('fraud_detection', {
  amount: 1000,
  merchant: 'online_store',
  time_of_day: 14,
  user_history: userFeatures
});

if (fraudScore > 0.8) {
  console.log('High fraud risk detected');
  // Trigger additional verification
}
```
