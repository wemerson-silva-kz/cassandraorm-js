# 📱 Social Media Platform Example

Real-time social media platform with feeds, messaging, and content recommendations.

## 🎯 Overview

Features demonstrated:
- **Real-time feeds** and notifications
- **AI content recommendations** 
- **Event sourcing** for user interactions
- **GraphQL API** for mobile/web
- **Performance optimization** for scale

## 📊 Data Models

```typescript
// User model
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    username: { type: 'text', unique: true },
    email: { type: 'text', unique: true },
    display_name: 'text',
    bio: 'text',
    avatar_url: 'text',
    followers_count: 'counter',
    following_count: 'counter',
    posts_count: 'counter',
    created_at: 'timestamp'
  },
  key: ['id']
});

// Post model with AI features
const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    content: 'text',
    media_urls: 'list<text>',
    hashtags: 'set<text>',
    mentions: 'set<text>',
    likes_count: 'counter',
    comments_count: 'counter',
    shares_count: 'counter',
    vector_embedding: 'list<float>',
    created_at: 'timestamp'
  },
  key: ['id']
});

// Feed model for timeline
const Feed = await client.loadSchema('user_feeds', {
  fields: {
    user_id: 'uuid',
    post_id: 'uuid',
    author_id: 'uuid',
    score: 'float',
    created_at: 'timestamp'
  },
  key: ['user_id', 'created_at', 'post_id']
});
```

## 🔄 User Interaction Events

```typescript
class UserAggregate extends BaseAggregateRoot {
  private username: string = '';
  private followersCount: number = 0;
  private followingCount: number = 0;

  static create(id: string, username: string, email: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserRegistered', { username, email });
    return user;
  }

  followUser(targetUserId: string): void {
    this.addEvent('UserFollowed', { targetUserId });
  }

  unfollowUser(targetUserId: string): void {
    this.addEvent('UserUnfollowed', { targetUserId });
  }

  createPost(postId: string, content: string): void {
    this.addEvent('PostCreated', { postId, content });
  }

  likePost(postId: string): void {
    this.addEvent('PostLiked', { postId });
  }

  protected applyEvent(event: any): void {
    switch (event.eventType) {
      case 'UserRegistered':
        this.username = event.eventData.username;
        break;
      case 'UserFollowed':
        this.followingCount++;
        break;
      case 'UserUnfollowed':
        this.followingCount--;
        break;
    }
  }
}
```

## 📡 Real-time Feed Service

```typescript
class SocialFeedService {
  private subscriptions: SubscriptionManager;
  private aiml: AIMLManager;

  constructor(client: CassandraClient) {
    this.subscriptions = new SubscriptionManager(client.driver, 'social_media');
    this.aiml = new AIMLManager(client.driver, 'social_media');
  }

  async initialize(): Promise<void> {
    await this.subscriptions.initialize();
    await this.setupRealTimeFeeds();
  }

  private async setupRealTimeFeeds(): Promise<void> {
    // New post notifications
    await this.subscriptions.subscribe(
      { table: 'posts', operation: 'insert' },
      async (event) => {
        await this.distributePostToFollowers(event.data);
      }
    );

    // Like notifications
    await this.subscriptions.subscribe(
      { table: 'likes', operation: 'insert' },
      async (event) => {
        await this.notifyPostAuthor(event.data);
      }
    );
  }

  async getPersonalizedFeed(userId: string, limit: number = 20): Promise<any[]> {
    // Get user's interests from AI
    const userInterests = await this.getUserInterests(userId);
    
    // Get recent posts from followed users
    const followedPosts = await this.getFollowedUsersPosts(userId);
    
    // Get recommended posts based on AI
    const recommendedPosts = await this.getAIRecommendedPosts(userId, userInterests);
    
    // Combine and rank
    const allPosts = [...followedPosts, ...recommendedPosts];
    const rankedPosts = await this.rankPosts(allPosts, userInterests);
    
    return rankedPosts.slice(0, limit);
  }

  private async getUserInterests(userId: string): Promise<string[]> {
    // Analyze user's interaction history
    const interactions = await this.getUserInteractions(userId);
    const interestText = interactions.map(i => i.content).join(' ');
    
    // Generate embedding for user interests
    const embedding = await this.aiml.generateEmbedding(interestText);
    
    // Find similar content categories
    return await this.findSimilarTopics(embedding);
  }

  private async distributePostToFollowers(post: any): Promise<void> {
    // Get followers
    const followers = await this.getFollowers(post.user_id);
    
    // Add to each follower's feed
    for (const follower of followers) {
      await Feed.create({
        user_id: follower.id,
        post_id: post.id,
        author_id: post.user_id,
        score: 1.0,
        created_at: new Date()
      });
    }
    
    // Broadcast real-time notification
    await this.subscriptions.broadcast('new_post', {
      postId: post.id,
      authorId: post.user_id,
      followers: followers.map(f => f.id)
    });
  }
}
```

## 🧠 AI Content Recommendations

```typescript
class ContentRecommendationService {
  private aiml: AIMLManager;

  constructor(client: CassandraClient) {
    this.aiml = new AIMLManager(client.driver, 'social_media');
  }

  async initialize(): Promise<void> {
    await this.aiml.createVectorTable('content_embeddings', {
      vectorDimension: 384,
      additionalFields: {
        post_id: 'uuid',
        user_id: 'uuid',
        content_type: 'text',
        engagement_score: 'float',
        created_at: 'timestamp'
      }
    });
  }

  async indexPost(post: any): Promise<void> {
    const contentText = `${post.content} ${post.hashtags?.join(' ') || ''}`;
    const embedding = await this.aiml.generateEmbedding(contentText);

    await this.aiml.insertVector('content_embeddings', {
      id: client.uuid(),
      post_id: post.id,
      user_id: post.user_id,
      content_type: 'post',
      engagement_score: this.calculateEngagementScore(post),
      created_at: post.created_at,
      vector: embedding
    });
  }

  async getRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    // Get user's interaction history
    const userHistory = await this.getUserInteractionHistory(userId);
    
    // Generate user preference embedding
    const userPreferences = userHistory.map(h => h.content).join(' ');
    const userEmbedding = await this.aiml.generateEmbedding(userPreferences);

    // Find similar content
    const recommendations = await this.aiml.similaritySearch(
      'content_embeddings',
      userEmbedding,
      {
        limit: limit * 2,
        threshold: 0.6,
        filters: {
          user_id: { $ne: userId }, // Exclude user's own posts
          engagement_score: { $gte: 0.5 }
        }
      }
    );

    return recommendations.slice(0, limit);
  }

  private calculateEngagementScore(post: any): number {
    const likes = post.likes_count || 0;
    const comments = post.comments_count || 0;
    const shares = post.shares_count || 0;
    
    return (likes * 1 + comments * 2 + shares * 3) / 100;
  }
}
```

## 🌐 GraphQL API

```typescript
class SocialMediaGraphQLAPI {
  private generator: GraphQLSchemaGenerator;
  private dataSource: CassandraDataSource;

  constructor(client: CassandraClient) {
    this.generator = new GraphQLSchemaGenerator();
    this.dataSource = new CassandraDataSource({ client, keyspace: 'social_media' });
  }

  generateSchema(): string {
    this.generator.addModel('User', {
      fields: {
        id: { type: 'ID', required: true },
        username: { type: 'String', required: true },
        displayName: { type: 'String' },
        bio: { type: 'String' },
        followersCount: { type: 'Int' },
        followingCount: { type: 'Int' }
      },
      relations: {
        posts: { type: '[Post]', resolver: 'userPosts' },
        followers: { type: '[User]', resolver: 'userFollowers' }
      }
    });

    this.generator.addModel('Post', {
      fields: {
        id: { type: 'ID', required: true },
        content: { type: 'String', required: true },
        mediaUrls: { type: '[String]' },
        hashtags: { type: '[String]' },
        likesCount: { type: 'Int' },
        commentsCount: { type: 'Int' },
        createdAt: { type: 'DateTime' }
      },
      relations: {
        author: { type: 'User', resolver: 'postAuthor' }
      }
    });

    return this.generator.generateSchema();
  }

  getResolvers(): any {
    return {
      Query: {
        me: async (parent: any, args: any, context: any) => {
          return await this.dataSource.findOne('users', { id: context.userId });
        },
        
        feed: async (parent: any, args: any, context: any) => {
          const feedService = new SocialFeedService(this.dataSource.client);
          return await feedService.getPersonalizedFeed(context.userId, args.limit);
        },

        recommendations: async (parent: any, args: any, context: any) => {
          const recommendationService = new ContentRecommendationService(this.dataSource.client);
          return await recommendationService.getRecommendations(context.userId, args.limit);
        }
      },

      Mutation: {
        createPost: async (parent: any, args: any, context: any) => {
          const post = await this.dataSource.create('posts', {
            ...args.input,
            user_id: context.userId,
            created_at: new Date()
          });

          // Index for recommendations
          const recommendationService = new ContentRecommendationService(this.dataSource.client);
          await recommendationService.indexPost(post);

          return post;
        },

        followUser: async (parent: any, args: any, context: any) => {
          // Use event sourcing
          const userRepository = new AggregateRepository(eventStore, (id) => new UserAggregate(id));
          const user = await userRepository.getById(context.userId);
          
          user.followUser(args.userId);
          await userRepository.save(user);

          return { success: true };
        }
      },

      Subscription: {
        newPost: {
          subscribe: async (parent: any, args: any, context: any) => {
            // WebSocket subscription for real-time posts
            return pubsub.asyncIterator(['NEW_POST']);
          }
        }
      }
    };
  }
}
```

This social media example demonstrates real-time features, AI recommendations, and scalable architecture with CassandraORM JS! 📱✨
