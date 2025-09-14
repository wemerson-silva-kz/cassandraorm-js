import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 2: Data Modeling', () => {
  let client: any;
  let User: any;
  let Post: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
    
    // Setup User model
    User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        email: 'text',
        name: 'text',
        created_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['email']
    });

    // Setup Post model with relations
    Post = await client.loadSchema('posts', {
      fields: {
        id: 'uuid',
        title: 'text',
        content: 'text',
        author_id: 'uuid',
        tags: 'set<text>',
        created_at: 'timestamp'
      },
      key: ['id'],
      indexes: ['author_id'],
      relations: {
        author: { model: 'users', foreignKey: 'author_id', type: 'belongsTo' }
      }
    });
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Schema Definition', () => {
    it('should create schema with fields and keys', () => {
      expect(User).toBeDefined();
      expect(Post).toBeDefined();
    });

    it('should support collection types', async () => {
      const post = await Post.create({
        id: client.constructor.uuid(),
        title: 'Test Post',
        content: 'Test content',
        author_id: client.constructor.uuid(),
        tags: new Set(['test', 'demo']),
        created_at: new Date()
      });

      expect(post.tags).toBeInstanceOf(Set);
      expect(post.tags.has('test')).toBe(true);
    });
  });

  describe('Partition Strategy', () => {
    it('should handle time-series partitioning', async () => {
      const Metrics = await client.loadSchema('metrics', {
        fields: {
          metric_name: 'text',
          bucket: 'text',
          timestamp: 'timestamp',
          value: 'double'
        },
        key: [['metric_name', 'bucket'], 'timestamp'],
        clustering_order: { timestamp: 'desc' }
      });

      const metric = await Metrics.create({
        metric_name: 'cpu_usage',
        bucket: '2024-01-15-10',
        timestamp: new Date(),
        value: 85.5
      });

      expect(metric.metric_name).toBe('cpu_usage');
      expect(metric.value).toBe(85.5);
    });
  });

  describe('Relationships', () => {
    it('should support model relationships', async () => {
      // Create user first
      const userId = client.constructor.uuid();
      const user = await User.create({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date()
      });

      // Create post with relationship
      const post = await Post.create({
        id: client.constructor.uuid(),
        title: 'Related Post',
        content: 'Content with relation',
        author_id: userId,
        tags: new Set(['relation']),
        created_at: new Date()
      });

      expect(post.author_id).toBe(user.id);
    });
  });
});
