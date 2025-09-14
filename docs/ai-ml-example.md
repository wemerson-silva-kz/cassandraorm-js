# AI/ML Example

## Overview
Comprehensive AI/ML integration example showcasing vector search, recommendation systems, anomaly detection, and intelligent query optimization.

## Intelligent Content Platform

```typescript
// src/IntelligentContentPlatform.ts
import { 
  AIMLManager, 
  SemanticCache, 
  RecommendationEngine, 
  AnomalyDetector,
  NLQueryProcessor 
} from 'cassandraorm-js';

export class IntelligentContentPlatform {
  private aiml: AIMLManager;
  private semanticCache: SemanticCache;
  private recommender: RecommendationEngine;
  private anomalyDetector: AnomalyDetector;
  private nlProcessor: NLQueryProcessor;

  constructor(client: any) {
    this.aiml = new AIMLManager(client.driver, 'content_platform', {
      openaiApiKey: process.env.OPENAI_API_KEY,
      embeddingModel: 'text-embedding-ada-002',
      completionModel: 'gpt-4'
    });

    this.semanticCache = new SemanticCache({
      similarityThreshold: 0.85,
      embeddingModel: 'text-embedding-ada-002',
      maxCacheSize: 10000,
      ttl: 3600
    });

    this.recommender = new RecommendationEngine(client);
    this.anomalyDetector = new AnomalyDetector(client);
    this.nlProcessor = new NLQueryProcessor(client);
    
    this.setupModels();
    this.setupAIFeatures();
  }

  private async setupModels(): Promise<void> {
    // Content with vector embeddings
    await this.aiml.createVectorTable('content_embeddings', {
      content_id: 'uuid',
      title: 'text',
      content: 'text',
      category: 'text',
      author_id: 'uuid',
      embedding: 'vector<float, 1536>',
      metadata: 'map<text, text>',
      created_at: 'timestamp'
    });

    // User interactions for recommendations
    this.UserInteraction = await client.loadSchema('user_interactions', {
      fields: {
        user_id: 'uuid',
        content_id: 'uuid',
        interaction_type: 'text', // 'view', 'like', 'share', 'comment'
        duration: 'int', // seconds spent
        rating: 'int', // 1-5 stars
        timestamp: 'timestamp'
      },
      key: [['user_id'], 'timestamp', 'content_id'],
      clustering_order: { timestamp: 'desc' }
    });

    // User profiles with preferences
    this.UserProfile = await client.loadSchema('user_profiles', {
      fields: {
        user_id: 'uuid',
        interests: 'set<text>',
        preferred_categories: 'list<text>',
        reading_level: 'text',
        language: 'text',
        behavior_vector: 'vector<float, 128>',
        updated_at: 'timestamp'
      },
      key: ['user_id']
    });
  }

  private async setupAIFeatures(): Promise<void> {
    // Configure recommendation engine
    await this.recommender.createModel('content_collaborative', {
      type: 'collaborative_filtering',
      userTable: 'user_profiles',
      itemTable: 'content_embeddings',
      interactionTable: 'user_interactions',
      factors: 50,
      regularization: 0.01
    });

    await this.recommender.createModel('content_based', {
      type: 'content_based',
      itemTable: 'content_embeddings',
      features: ['category', 'author_id'],
      embeddings: 'embedding'
    });

    // Configure anomaly detection
    await this.anomalyDetector.configure('user_behavior', {
      features: ['reading_time', 'interaction_frequency', 'category_diversity'],
      algorithm: 'isolation_forest',
      threshold: 0.1
    });

    // Configure natural language processing
    await this.nlProcessor.configureSchema({
      tables: ['content_embeddings', 'user_profiles', 'user_interactions'],
      relationships: [
        { from: 'content_embeddings', to: 'user_interactions', key: 'content_id' },
        { from: 'user_profiles', to: 'user_interactions', key: 'user_id' }
      ]
    });
  }

  // Intelligent content ingestion with automatic embedding generation
  async ingestContent(contentData: {
    title: string;
    content: string;
    category: string;
    author_id: string;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const contentId = uuid();
    
    // Generate embedding for the content
    const text = `${contentData.title} ${contentData.content}`;
    const embedding = await this.aiml.generateEmbedding(text);
    
    // Extract key topics using AI
    const topics = await this.extractTopics(contentData.content);
    
    // Analyze content sentiment
    const sentiment = await this.analyzeSentiment(contentData.content);
    
    // Determine reading difficulty
    const readingLevel = await this.analyzeReadingLevel(contentData.content);
    
    // Store content with embeddings
    await this.aiml.insertVector('content_embeddings', {
      content_id: contentId,
      title: contentData.title,
      content: contentData.content,
      category: contentData.category,
      author_id: contentData.author_id,
      embedding: embedding,
      metadata: {
        ...contentData.metadata,
        topics: JSON.stringify(topics),
        sentiment: sentiment.label,
        sentiment_score: sentiment.score.toString(),
        reading_level: readingLevel
      },
      created_at: new Date()
    });

    return contentId;
  }

  // Semantic content search
  async searchContent(query: string, options: {
    userId?: string;
    category?: string;
    limit?: number;
    includeRecommendations?: boolean;
  } = {}): Promise<any[]> {
    const { userId, category, limit = 20, includeRecommendations = false } = options;
    
    // Check semantic cache first
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    let results = await this.semanticCache.get(cacheKey);
    
    if (!results) {
      // Generate query embedding
      const queryEmbedding = await this.aiml.generateEmbedding(query);
      
      // Perform vector similarity search
      const searchResults = await this.aiml.similaritySearch('content_embeddings', queryEmbedding, {
        limit: limit * 2, // Get more for filtering
        threshold: 0.7,
        filters: category ? { category } : undefined
      });

      // Enhance results with AI insights
      results = await Promise.all(searchResults.map(async (result) => {
        const enhanced = {
          ...result,
          relevance_score: result.similarity,
          explanation: await this.explainRelevance(query, result),
          reading_time: this.estimateReadingTime(result.content)
        };

        // Personalize if user provided
        if (userId) {
          enhanced.personalization_score = await this.calculatePersonalizationScore(userId, result);
        }

        return enhanced;
      }));

      // Sort by combined relevance and personalization
      results.sort((a, b) => {
        const scoreA = a.relevance_score + (a.personalization_score || 0);
        const scoreB = b.relevance_score + (b.personalization_score || 0);
        return scoreB - scoreA;
      });

      results = results.slice(0, limit);
      
      // Cache results
      await this.semanticCache.set(cacheKey, results);
    }

    // Add recommendations if requested
    if (includeRecommendations && userId) {
      const recommendations = await this.getPersonalizedRecommendations(userId, 5);
      results = [...results, ...recommendations];
    }

    return results;
  }

  // Personalized content recommendations
  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    // Get user profile and interaction history
    const userProfile = await this.UserProfile.findOne({ user_id: userId });
    const recentInteractions = await this.UserInteraction.find(
      { user_id: userId },
      { limit: 50, orderBy: { timestamp: 'desc' } }
    );

    // Collaborative filtering recommendations
    const cfRecommendations = await this.recommender.recommend('content_collaborative', {
      userId,
      limit: limit * 2,
      excludeInteracted: true
    });

    // Content-based recommendations
    const contentBasedRecs = await this.getContentBasedRecommendations(
      userId, 
      recentInteractions, 
      limit
    );

    // Hybrid approach: combine both methods
    const hybridRecommendations = this.combineRecommendations(
      cfRecommendations,
      contentBasedRecs,
      { cfWeight: 0.6, contentWeight: 0.4 }
    );

    // Apply diversity and novelty filters
    const diverseRecommendations = await this.applyDiversityFilter(
      hybridRecommendations,
      userProfile,
      limit
    );

    return diverseRecommendations;
  }

  private async getContentBasedRecommendations(
    userId: string, 
    interactions: any[], 
    limit: number
  ): Promise<any[]> {
    const recommendations = [];
    
    // Get embeddings of recently interacted content
    const recentContentIds = interactions.slice(0, 10).map(i => i.content_id);
    const recentContent = await this.aiml.getVectors('content_embeddings', recentContentIds);
    
    // Calculate average embedding of user's interests
    const avgEmbedding = this.calculateAverageEmbedding(
      recentContent.map(c => c.embedding)
    );

    // Find similar content
    const similar = await this.aiml.similaritySearch('content_embeddings', avgEmbedding, {
      limit: limit * 2,
      threshold: 0.6,
      excludeIds: recentContentIds
    });

    return similar.slice(0, limit);
  }

  // Anomaly detection for user behavior
  async detectUserAnomalies(userId: string): Promise<any[]> {
    // Get user's recent behavior
    const interactions = await this.UserInteraction.find(
      { user_id: userId },
      { limit: 100, orderBy: { timestamp: 'desc' } }
    );

    if (interactions.length < 10) {
      return []; // Not enough data
    }

    // Calculate behavior features
    const features = this.calculateBehaviorFeatures(interactions);
    
    // Detect anomalies
    const anomalies = await this.anomalyDetector.detect('user_behavior', {
      userId,
      features
    });

    // Analyze anomalies for insights
    const analyzedAnomalies = await Promise.all(
      anomalies.map(async (anomaly) => ({
        ...anomaly,
        explanation: await this.explainAnomaly(anomaly, interactions),
        recommendations: await this.getAnomalyRecommendations(anomaly)
      }))
    );

    return analyzedAnomalies;
  }

  // Natural language query interface
  async processNaturalLanguageQuery(query: string, userId?: string): Promise<any> {
    // Process the natural language query
    const processedQuery = await this.nlProcessor.query(query);
    
    // Execute the generated query
    const results = await client.execute(processedQuery.cql, processedQuery.params);
    
    // Generate natural language explanation
    const explanation = await this.aiml.generateCompletion({
      prompt: `Explain these query results in simple terms: ${JSON.stringify(results.rows.slice(0, 3))}`,
      maxTokens: 150
    });

    return {
      query: processedQuery.cql,
      results: results.rows,
      explanation: explanation.text,
      confidence: processedQuery.confidence
    };
  }

  // AI-powered content summarization
  async summarizeContent(contentId: string, summaryType: 'short' | 'detailed' = 'short'): Promise<string> {
    const content = await this.aiml.getVector('content_embeddings', contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const maxTokens = summaryType === 'short' ? 100 : 300;
    const prompt = `Summarize the following content in ${summaryType} form:\n\nTitle: ${content.title}\n\nContent: ${content.content}`;

    const summary = await this.aiml.generateCompletion({
      prompt,
      maxTokens,
      temperature: 0.3
    });

    return summary.text;
  }

  // Intelligent content tagging
  async generateContentTags(contentId: string): Promise<string[]> {
    const content = await this.aiml.getVector('content_embeddings', contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const prompt = `Generate 5-10 relevant tags for this content:\n\nTitle: ${content.title}\n\nContent: ${content.content.substring(0, 500)}...\n\nTags:`;

    const response = await this.aiml.generateCompletion({
      prompt,
      maxTokens: 100,
      temperature: 0.5
    });

    // Parse tags from response
    const tags = response.text
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    return tags;
  }

  // Content quality assessment
  async assessContentQuality(contentId: string): Promise<{
    score: number;
    factors: Record<string, number>;
    suggestions: string[];
  }> {
    const content = await this.aiml.getVector('content_embeddings', contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Analyze various quality factors
    const factors = {
      readability: await this.analyzeReadability(content.content),
      engagement: await this.predictEngagement(content),
      originality: await this.checkOriginality(content),
      structure: await this.analyzeStructure(content.content),
      sentiment: await this.analyzeSentiment(content.content)
    };

    // Calculate overall score
    const score = Object.values(factors).reduce((sum, factor) => sum + factor, 0) / Object.keys(factors).length;

    // Generate improvement suggestions
    const suggestions = await this.generateImprovementSuggestions(factors, content);

    return { score, factors, suggestions };
  }

  // Helper methods
  private async extractTopics(content: string): Promise<string[]> {
    const prompt = `Extract the main topics from this content:\n\n${content.substring(0, 1000)}\n\nTopics:`;
    const response = await this.aiml.generateCompletion({
      prompt,
      maxTokens: 50,
      temperature: 0.3
    });
    
    return response.text.split(',').map(topic => topic.trim());
  }

  private async analyzeSentiment(content: string): Promise<{ label: string; score: number }> {
    // Use AI to analyze sentiment
    const prompt = `Analyze the sentiment of this content and respond with just "positive", "negative", or "neutral":\n\n${content.substring(0, 500)}`;
    const response = await this.aiml.generateCompletion({
      prompt,
      maxTokens: 10,
      temperature: 0.1
    });
    
    const label = response.text.trim().toLowerCase();
    const score = label === 'positive' ? 0.8 : label === 'negative' ? 0.2 : 0.5;
    
    return { label, score };
  }

  private async analyzeReadingLevel(content: string): Promise<string> {
    // Simple reading level analysis
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence < 15) return 'easy';
    if (avgWordsPerSentence < 20) return 'medium';
    return 'hard';
  }

  private estimateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  private calculateAverageEmbedding(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dimensions = embeddings[0].length;
    const avgEmbedding = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      avgEmbedding[i] /= embeddings.length;
    }
    
    return avgEmbedding;
  }

  private calculateBehaviorFeatures(interactions: any[]): Record<string, number> {
    const totalTime = interactions.reduce((sum, i) => sum + (i.duration || 0), 0);
    const avgRating = interactions
      .filter(i => i.rating)
      .reduce((sum, i, _, arr) => sum + i.rating / arr.length, 0);
    
    const categories = new Set(interactions.map(i => i.category));
    
    return {
      reading_time: totalTime,
      interaction_frequency: interactions.length,
      category_diversity: categories.size,
      avg_rating: avgRating || 0
    };
  }
}
```

## Usage Example

```typescript
// src/app.ts
import { IntelligentContentPlatform } from './IntelligentContentPlatform';

async function demonstrateAIFeatures() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['localhost:9042'],
      localDataCenter: 'datacenter1',
      keyspace: 'ai_content_platform'
    },
    ormOptions: {
      createKeyspace: true
    }
  });

  await client.connect();
  
  const platform = new IntelligentContentPlatform(client);
  
  // Ingest content with AI processing
  const contentId = await platform.ingestContent({
    title: 'The Future of Artificial Intelligence',
    content: 'Artificial intelligence is rapidly transforming industries...',
    category: 'technology',
    author_id: 'author-123'
  });
  
  console.log('Content ingested with ID:', contentId);
  
  // Semantic search
  const searchResults = await platform.searchContent('AI and machine learning', {
    userId: 'user-456',
    limit: 10,
    includeRecommendations: true
  });
  
  console.log('Search results:', searchResults.length);
  
  // Get personalized recommendations
  const recommendations = await platform.getPersonalizedRecommendations('user-456', 5);
  console.log('Recommendations:', recommendations.length);
  
  // Natural language query
  const nlResult = await platform.processNaturalLanguageQuery(
    'Show me popular technology articles from last week'
  );
  console.log('NL Query result:', nlResult.explanation);
  
  // Content quality assessment
  const quality = await platform.assessContentQuality(contentId);
  console.log('Content quality score:', quality.score);
  console.log('Improvement suggestions:', quality.suggestions);
  
  // Detect user behavior anomalies
  const anomalies = await platform.detectUserAnomalies('user-456');
  console.log('Detected anomalies:', anomalies.length);
}

demonstrateAIFeatures().catch(console.error);
```

## AI-Powered Analytics Dashboard

```typescript
// src/AIAnalyticsDashboard.ts
export class AIAnalyticsDashboard {
  private platform: IntelligentContentPlatform;
  private wsManager: WebSocketManager;

  constructor(platform: IntelligentContentPlatform) {
    this.platform = platform;
    this.wsManager = new WebSocketManager(client, { port: 3004 });
    
    this.setupDashboard();
  }

  private setupDashboard(): void {
    // Real-time AI insights
    setInterval(async () => {
      const insights = await this.generateAIInsights();
      
      this.wsManager.broadcast({
        type: 'ai_insights',
        data: insights,
        timestamp: new Date()
      });
    }, 30000); // Every 30 seconds

    // Handle dashboard requests
    this.wsManager.on('message', async (ws, message) => {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'get_content_trends':
          const trends = await this.analyzeContentTrends();
          ws.send(JSON.stringify({ type: 'content_trends', data: trends }));
          break;
          
        case 'get_user_insights':
          const userInsights = await this.analyzeUserBehavior(data.userId);
          ws.send(JSON.stringify({ type: 'user_insights', data: userInsights }));
          break;
          
        case 'predict_engagement':
          const prediction = await this.predictContentEngagement(data.contentId);
          ws.send(JSON.stringify({ type: 'engagement_prediction', data: prediction }));
          break;
      }
    });
  }

  private async generateAIInsights(): Promise<any> {
    return {
      trending_topics: await this.identifyTrendingTopics(),
      content_performance: await this.analyzeContentPerformance(),
      user_segments: await this.identifyUserSegments(),
      anomalies: await this.detectSystemAnomalies(),
      recommendations: await this.generateSystemRecommendations()
    };
  }

  async start(): Promise<void> {
    await this.wsManager.start();
    console.log('AI Analytics Dashboard started on port 3004');
  }
}
```
