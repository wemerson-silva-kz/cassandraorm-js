import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
      const User = await client.loadSchema('blog_users', {
        fields: {
          id: 'uuid',
          email: 'text',
          name: 'text',
          password_hash: 'text',
          created_at: 'timestamp'
        },
        key: ['id'],
        indexes: ['email']
      });

      // Post model
      const Post = await client.loadSchema('blog_posts', {
        fields: {
          id: 'uuid',
          title: 'text',
          content: 'text',
          author_id: 'uuid',
          status: 'text',
          created_at: 'timestamp'
        },
        key: ['id'],
        indexes: ['author_id', 'status']
      });

      // Create user
      const user = await User.create({
        id: 'blog-user-1',
        email: 'blogger@example.com',
        name: 'Test Blogger',
        password_hash: 'hashed_password',
        created_at: new Date()
      });

      expect(user.email).toBe('blogger@example.com');

      // Create post
      const post = await Post.create({
        id: 'blog-post-1',
        title: 'My First Blog Post',
        content: 'This is the content of my first blog post.',
        author_id: user.id,
        status: 'published',
        created_at: new Date()
      });

      expect(post.title).toBe('My First Blog Post');
      expect(post.author_id).toBe(user.id);

      // Query posts by author
      const authorPosts = await Post.find({ author_id: user.id });
      expect(authorPosts).toHaveLength(1);
      expect(authorPosts[0].title).toBe('My First Blog Post');

      // Query published posts
      const publishedPosts = await Post.find({ status: 'published' });
      expect(publishedPosts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Advanced Example - E-commerce Platform', () => {
    it('should implement e-commerce functionality', async () => {
      // Product model
      const Product = await client.loadSchema('ecommerce_products', {
        fields: {
          id: 'uuid',
          name: 'text',
          description: 'text',
          price: 'decimal',
          category: 'text',
          inventory_count: 'int',
          tags: 'set<text>',
          created_at: 'timestamp'
        },
        key: ['id'],
        indexes: ['category']
      });

      // Order model
      const Order = await client.loadSchema('ecommerce_orders', {
        fields: {
          id: 'uuid',
          user_id: 'uuid',
          status: 'text',
          total_amount: 'decimal',
          items: 'list<text>', // Simplified - would be frozen<order_item> in real app
          created_at: 'timestamp'
        },
        key: ['id'],
        indexes: ['user_id', 'status']
      });

      // Create products
      const product1 = await Product.create({
        id: 'prod-1',
        name: 'Laptop',
        description: 'High-performance laptop',
        price: 999.99,
        category: 'electronics',
        inventory_count: 50,
        tags: new Set(['laptop', 'computer', 'electronics']),
        created_at: new Date()
      });

      const product2 = await Product.create({
        id: 'prod-2',
        name: 'Mouse',
        description: 'Wireless mouse',
        price: 29.99,
        category: 'electronics',
        inventory_count: 100,
        tags: new Set(['mouse', 'wireless', 'electronics']),
        created_at: new Date()
      });

      expect(product1.name).toBe('Laptop');
      expect(product2.category).toBe('electronics');

      // Create order
      const order = await Order.create({
        id: 'order-1',
        user_id: 'user-1',
        status: 'pending',
        total_amount: 1029.98,
        items: ['prod-1:1', 'prod-2:1'], // Simplified format
        created_at: new Date()
      });

      expect(order.status).toBe('pending');
      expect(order.total_amount).toBe(1029.98);

      // Query products by category
      const electronics = await Product.find({ category: 'electronics' });
      expect(electronics.length).toBeGreaterThanOrEqual(2);

      // Query orders by user
      const userOrders = await Order.find({ user_id: 'user-1' });
      expect(userOrders).toHaveLength(1);
      expect(userOrders[0].id).toBe('order-1');

      // Update order status
      const updatedOrder = await Order.update(
        { id: 'order-1' },
        { status: 'processing' }
      );
      expect(updatedOrder.status).toBe('processing');
    });
  });

  describe('Microservices Example', () => {
    it('should simulate microservices communication', async () => {
      // Service registry simulation
      class ServiceRegistry {
        private services = new Map();

        register(serviceName: string, config: any) {
          this.services.set(serviceName, {
            ...config,
            registeredAt: new Date(),
            status: 'healthy'
          });
        }

        discover(serviceName: string) {
          const service = this.services.get(serviceName);
          return service && service.status === 'healthy' ? service : null;
        }

        getAll() {
          return Array.from(this.services.entries()).map(([name, config]) => ({
            name,
            ...config
          }));
        }

        updateStatus(serviceName: string, status: string) {
          const service = this.services.get(serviceName);
          if (service) {
            service.status = status;
            service.lastUpdated = new Date();
          }
        }
      }

      // API Gateway simulation
      class APIGateway {
        constructor(private serviceRegistry: ServiceRegistry) {}

        async routeRequest(path: string, method: string, data?: any) {
          const serviceName = this.extractServiceName(path);
          const service = this.serviceRegistry.discover(serviceName);

          if (!service) {
            throw new Error(`Service ${serviceName} not available`);
          }

          // Simulate service call
          return {
            service: serviceName,
            path,
            method,
            data,
            response: `Response from ${serviceName}`,
            timestamp: new Date()
          };
        }

        private extractServiceName(path: string): string {
          const segments = path.split('/').filter(s => s);
          return segments[1] || 'unknown'; // /api/users -> users
        }
      }

      const serviceRegistry = new ServiceRegistry();
      const apiGateway = new APIGateway(serviceRegistry);

      // Register services
      serviceRegistry.register('users', {
        host: 'user-service',
        port: 3001,
        version: '1.0.0'
      });

      serviceRegistry.register('orders', {
        host: 'order-service',
        port: 3002,
        version: '1.0.0'
      });

      // Test service discovery
      const userService = serviceRegistry.discover('users');
      expect(userService).toBeDefined();
      expect(userService.host).toBe('user-service');

      // Test API routing
      const response = await apiGateway.routeRequest('/api/users/123', 'GET');
      expect(response.service).toBe('users');
      expect(response.response).toBe('Response from users');

      // Test service health
      serviceRegistry.updateStatus('users', 'unhealthy');
      const unhealthyService = serviceRegistry.discover('users');
      expect(unhealthyService).toBeNull();

      // Get all services
      const allServices = serviceRegistry.getAll();
      expect(allServices).toHaveLength(2);
    });
  });

  describe('Real-time Example - Chat Application', () => {
    it('should implement real-time chat functionality', async () => {
      // Chat room model
      const ChatRoom = await client.loadSchema('chat_rooms', {
        fields: {
          id: 'uuid',
          name: 'text',
          type: 'text',
          members: 'set<text>',
          created_at: 'timestamp'
        },
        key: ['id']
      });

      // Message model
      const Message = await client.loadSchema('chat_messages', {
        fields: {
          id: 'timeuuid',
          room_id: 'uuid',
          user_id: 'uuid',
          content: 'text',
          message_type: 'text',
          created_at: 'timestamp'
        },
        key: [['room_id'], 'id'],
        clustering_order: { id: 'desc' }
      });

      // WebSocket manager simulation
      class WebSocketManager {
        private connections = new Map();
        private rooms = new Map();

        connect(connectionId: string, userId: string) {
          this.connections.set(connectionId, {
            userId,
            connectedAt: new Date(),
            rooms: new Set()
          });
        }

        joinRoom(connectionId: string, roomId: string) {
          const connection = this.connections.get(connectionId);
          if (connection) {
            connection.rooms.add(roomId);
            
            if (!this.rooms.has(roomId)) {
              this.rooms.set(roomId, new Set());
            }
            this.rooms.get(roomId).add(connectionId);
          }
        }

        broadcastToRoom(roomId: string, message: any) {
          const room = this.rooms.get(roomId);
          if (room) {
            const broadcasts = [];
            for (const connectionId of room) {
              broadcasts.push({ connectionId, message });
            }
            return broadcasts;
          }
          return [];
        }

        disconnect(connectionId: string) {
          const connection = this.connections.get(connectionId);
          if (connection) {
            // Leave all rooms
            for (const roomId of connection.rooms) {
              const room = this.rooms.get(roomId);
              if (room) {
                room.delete(connectionId);
              }
            }
            this.connections.delete(connectionId);
          }
        }

        getStats() {
          return {
            totalConnections: this.connections.size,
            totalRooms: this.rooms.size
          };
        }
      }

      const wsManager = new WebSocketManager();

      // Create chat room
      const room = await ChatRoom.create({
        id: 'room-1',
        name: 'General Chat',
        type: 'public',
        members: new Set(['user1', 'user2']),
        created_at: new Date()
      });

      expect(room.name).toBe('General Chat');

      // Create message
      const message = await Message.create({
        id: 'msg-1',
        room_id: room.id,
        user_id: 'user1',
        content: 'Hello everyone!',
        message_type: 'text',
        created_at: new Date()
      });

      expect(message.content).toBe('Hello everyone!');

      // Test WebSocket functionality
      wsManager.connect('conn1', 'user1');
      wsManager.connect('conn2', 'user2');
      wsManager.joinRoom('conn1', room.id);
      wsManager.joinRoom('conn2', room.id);

      const broadcasts = wsManager.broadcastToRoom(room.id, {
        type: 'new_message',
        data: message
      });

      expect(broadcasts).toHaveLength(2);
      expect(wsManager.getStats().totalConnections).toBe(2);

      // Query room messages
      const roomMessages = await Message.find({ room_id: room.id });
      expect(roomMessages).toHaveLength(1);
      expect(roomMessages[0].content).toBe('Hello everyone!');
    });
  });

  describe('AI/ML Example - Content Platform', () => {
    it('should implement AI/ML content features', async () => {
      // Content model with vector simulation
      const Content = await client.loadSchema('ai_content', {
        fields: {
          id: 'uuid',
          title: 'text',
          content: 'text',
          category: 'text',
          embedding: 'text', // Simulated vector as JSON string
          metadata: 'map<text, text>',
          created_at: 'timestamp'
        },
        key: ['id'],
        indexes: ['category']
      });

      // User interaction model
      const UserInteraction = await client.loadSchema('user_interactions', {
        fields: {
          user_id: 'uuid',
          content_id: 'uuid',
          interaction_type: 'text',
          rating: 'int',
          timestamp: 'timestamp'
        },
        key: [['user_id'], 'timestamp', 'content_id'],
        clustering_order: { timestamp: 'desc' }
      });

      // AI/ML simulation classes
      class VectorSearchSimulator {
        static generateEmbedding(text: string): number[] {
          // Simple hash-based embedding simulation
          const hash = this.simpleHash(text);
          return Array.from({ length: 5 }, (_, i) => 
            ((hash >> (i * 8)) & 0xFF) / 255
          );
        }

        static cosineSimilarity(a: number[], b: number[]): number {
          const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
          const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
          const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
          return dotProduct / (magnitudeA * magnitudeB);
        }

        static findSimilar(queryEmbedding: number[], contentEmbeddings: Array<{id: string, embedding: number[]}>, threshold: number = 0.7) {
          return contentEmbeddings
            .map(item => ({
              ...item,
              similarity: this.cosineSimilarity(queryEmbedding, item.embedding)
            }))
            .filter(item => item.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity);
        }

        private static simpleHash(str: string): number {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return Math.abs(hash);
        }
      }

      class RecommendationEngine {
        static getCollaborativeRecommendations(userId: string, interactions: any[], allContent: any[]) {
          // Find users with similar interactions
          const userInteractions = interactions.filter(i => i.user_id === userId);
          const userContentIds = new Set(userInteractions.map(i => i.content_id));

          // Find similar users
          const otherUsers = interactions
            .filter(i => i.user_id !== userId && userContentIds.has(i.content_id))
            .map(i => i.user_id);

          const uniqueOtherUsers = [...new Set(otherUsers)];

          // Get content liked by similar users
          const recommendations = interactions
            .filter(i => uniqueOtherUsers.includes(i.user_id) && !userContentIds.has(i.content_id))
            .map(i => i.content_id);

          return [...new Set(recommendations)];
        }
      }

      // Create content with embeddings
      const content1 = await Content.create({
        id: 'content-1',
        title: 'Machine Learning Basics',
        content: 'Introduction to machine learning algorithms and concepts.',
        category: 'technology',
        embedding: JSON.stringify(VectorSearchSimulator.generateEmbedding('Machine Learning Basics')),
        metadata: new Map([['difficulty', 'beginner'], ['topic', 'ai']]),
        created_at: new Date()
      });

      const content2 = await Content.create({
        id: 'content-2',
        title: 'Deep Learning Advanced',
        content: 'Advanced concepts in deep learning and neural networks.',
        category: 'technology',
        embedding: JSON.stringify(VectorSearchSimulator.generateEmbedding('Deep Learning Advanced')),
        metadata: new Map([['difficulty', 'advanced'], ['topic', 'ai']]),
        created_at: new Date()
      });

      expect(content1.title).toBe('Machine Learning Basics');
      expect(content2.category).toBe('technology');

      // Create user interactions
      await UserInteraction.create({
        user_id: 'user1',
        content_id: content1.id,
        interaction_type: 'view',
        rating: 5,
        timestamp: new Date()
      });

      await UserInteraction.create({
        user_id: 'user2',
        content_id: content1.id,
        interaction_type: 'like',
        rating: 4,
        timestamp: new Date()
      });

      // Test vector similarity search
      const queryEmbedding = VectorSearchSimulator.generateEmbedding('Machine Learning Tutorial');
      const contentEmbeddings = [
        { id: content1.id, embedding: JSON.parse(content1.embedding) },
        { id: content2.id, embedding: JSON.parse(content2.embedding) }
      ];

      const similarContent = VectorSearchSimulator.findSimilar(queryEmbedding, contentEmbeddings, 0.5);
      expect(similarContent.length).toBeGreaterThan(0);
      expect(similarContent[0].similarity).toBeGreaterThan(0);

      // Test recommendation engine
      const interactions = await UserInteraction.find({});
      const allContent = await Content.find({});
      const recommendations = RecommendationEngine.getCollaborativeRecommendations('user2', interactions, allContent);
      
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Performance Example - High-throughput System', () => {
    it('should implement performance optimization patterns', async () => {
      // Performance monitoring simulation
      class PerformanceMonitor {
        private metrics: any[] = [];

        recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
          this.metrics.push({
            name,
            value,
            tags,
            timestamp: new Date()
          });
        }

        getMetrics(name?: string) {
          return name 
            ? this.metrics.filter(m => m.name === name)
            : this.metrics;
        }

        getAverageMetric(name: string, timeWindow: number = 60000) {
          const cutoff = new Date(Date.now() - timeWindow);
          const recentMetrics = this.metrics.filter(m => 
            m.name === name && m.timestamp > cutoff
          );

          if (recentMetrics.length === 0) return 0;

          const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
          return sum / recentMetrics.length;
        }

        getPercentile(name: string, percentile: number) {
          const values = this.metrics
            .filter(m => m.name === name)
            .map(m => m.value)
            .sort((a, b) => a - b);

          if (values.length === 0) return 0;

          const index = Math.ceil((percentile / 100) * values.length) - 1;
          return values[Math.max(0, index)];
        }
      }

      // Connection pool simulation
      class ConnectionPool {
        private connections: any[] = [];
        private activeConnections = 0;
        private maxConnections: number;

        constructor(maxConnections: number = 10) {
          this.maxConnections = maxConnections;
        }

        async getConnection() {
          if (this.activeConnections < this.maxConnections) {
            this.activeConnections++;
            const connection = {
              id: `conn-${this.activeConnections}`,
              createdAt: new Date(),
              inUse: true
            };
            this.connections.push(connection);
            return connection;
          }
          
          throw new Error('Connection pool exhausted');
        }

        releaseConnection(connectionId: string) {
          const connection = this.connections.find(c => c.id === connectionId);
          if (connection) {
            connection.inUse = false;
            this.activeConnections--;
          }
        }

        getStats() {
          return {
            totalConnections: this.connections.length,
            activeConnections: this.activeConnections,
            availableConnections: this.maxConnections - this.activeConnections,
            utilization: this.activeConnections / this.maxConnections
          };
        }
      }

      // Batch processor simulation
      class BatchProcessor {
        private batchSize: number;
        private batch: any[] = [];
        private processingFunction: Function;

        constructor(batchSize: number, processingFunction: Function) {
          this.batchSize = batchSize;
          this.processingFunction = processingFunction;
        }

        add(item: any) {
          this.batch.push(item);
          
          if (this.batch.length >= this.batchSize) {
            return this.flush();
          }
          
          return Promise.resolve();
        }

        async flush() {
          if (this.batch.length === 0) return;

          const currentBatch = this.batch.splice(0);
          await this.processingFunction(currentBatch);
        }

        getBatchSize() {
          return this.batch.length;
        }
      }

      const performanceMonitor = new PerformanceMonitor();
      const connectionPool = new ConnectionPool(5);

      // Test performance monitoring
      performanceMonitor.recordMetric('query_time', 150, { table: 'users' });
      performanceMonitor.recordMetric('query_time', 200, { table: 'posts' });
      performanceMonitor.recordMetric('query_time', 100, { table: 'users' });

      const avgQueryTime = performanceMonitor.getAverageMetric('query_time');
      expect(avgQueryTime).toBe(150); // (150 + 200 + 100) / 3

      const p95 = performanceMonitor.getPercentile('query_time', 95);
      expect(p95).toBeGreaterThan(0);

      // Test connection pool
      const conn1 = await connectionPool.getConnection();
      const conn2 = await connectionPool.getConnection();
      
      expect(conn1.id).toBeDefined();
      expect(conn2.id).toBeDefined();

      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(2);
      expect(stats.utilization).toBe(0.4); // 2/5

      connectionPool.releaseConnection(conn1.id);
      const updatedStats = connectionPool.getStats();
      expect(updatedStats.activeConnections).toBe(1);

      // Test batch processor
      let processedBatches = 0;
      const batchProcessor = new BatchProcessor(3, async (batch: any[]) => {
        processedBatches++;
        expect(batch.length).toBeLessThanOrEqual(3);
      });

      await batchProcessor.add({ id: 1 });
      await batchProcessor.add({ id: 2 });
      expect(batchProcessor.getBatchSize()).toBe(2);

      await batchProcessor.add({ id: 3 }); // Should trigger flush
      expect(processedBatches).toBe(1);
      expect(batchProcessor.getBatchSize()).toBe(0);
    });
  });
});
