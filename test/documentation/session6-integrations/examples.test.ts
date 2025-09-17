import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 6: Examples Validation', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Basic Example - Blog Application', () => {
    it('should implement basic blog functionality', async () => {
      // User model
      const User = await client.loadSchema('blog_users_simple', {
        fields: {
          id: 'uuid',
          email: 'text',
          name: 'text',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Post model
      const Post = await client.loadSchema('blog_posts_simple', {
        fields: {
          id: 'uuid',
          title: 'text',
          content: 'text',
          author_id: 'uuid',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Create user
      const user = await User.create({
        email: 'blogger@example.com',
        name: 'Test Blogger',
        created_at: new Date()
      });

      expect(user.email).toBe('blogger@example.com');
      expect(user.id).toBeDefined();

      // Create post
      const post = await Post.create({
        title: 'My First Blog Post',
        content: 'This is the content of my first blog post.',
        author_id: user.id,
        created_at: new Date()
      });

      expect(post.title).toBe('My First Blog Post');
      expect(post.author_id).toBe(user.id);

      // Find post by ID (using primary key)
      const foundPost = await Post.findOne({ id: post.id });
      expect(foundPost).toBeDefined();
      expect(foundPost.title).toBe('My First Blog Post');
    });
  });

  describe('Advanced Example - E-commerce Platform', () => {
    it('should implement e-commerce functionality', async () => {
      // Product model
      const Product = await client.loadSchema('ecommerce_products', {
        fields: {
          id: 'uuid',
          name: 'text',
          price: 'decimal',
          category: 'text',
          stock: 'int',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Order model
      const Order = await client.loadSchema('ecommerce_orders', {
        fields: {
          id: 'uuid',
          customer_id: 'uuid',
          total: 'decimal',
          status: 'text',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Create product
      const product = await Product.create({
        name: 'Laptop Computer',
        price: 999.99,
        category: 'Electronics',
        stock: 10,
        created_at: new Date()
      });

      expect(product.name).toBe('Laptop Computer');
      expect(parseFloat(product.price)).toBe(999.99);

      // Create order
      const order = await Order.create({
        customer_id: client.constructor.uuid(),
        total: 999.99,
        status: 'pending',
        created_at: new Date()
      });

      expect(order.status).toBe('pending');
      expect(parseFloat(order.total)).toBe(999.99);

      // Find order by ID
      const foundOrder = await Order.findOne({ id: order.id });
      expect(foundOrder).toBeDefined();
      expect(foundOrder.status).toBe('pending');
    });
  });

  describe('AI/ML Example - Content Platform', () => {
    it('should implement AI/ML content features', async () => {
      // Content model with AI features
      const Content = await client.loadSchema('ai_content', {
        fields: {
          id: 'uuid',
          title: 'text',
          body: 'text',
          embedding: 'text', // Simulated vector embedding
          sentiment: 'text',
          category: 'text',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Create content with AI features
      const content = await Content.create({
        title: 'AI and Machine Learning',
        body: 'This article discusses the latest trends in AI and ML.',
        embedding: '[0.1, 0.2, 0.3, 0.4, 0.5]', // Simulated embedding
        sentiment: 'positive',
        category: 'technology',
        created_at: new Date()
      });

      expect(content.title).toBe('AI and Machine Learning');
      expect(content.sentiment).toBe('positive');
      expect(content.embedding).toBeDefined();

      // Find content by ID
      const foundContent = await Content.findOne({ id: content.id });
      expect(foundContent).toBeDefined();
      expect(foundContent.category).toBe('technology');

      // Simulate AI operations
      const allContent = await Content.find();
      expect(Array.isArray(allContent)).toBe(true);
      expect(allContent.length).toBeGreaterThan(0);
    });
  });
});
