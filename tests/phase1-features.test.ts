import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { 
  createClient,
  RelationsManager,
  AggregationsManager,
  AdvancedConnectionPool,
  TimeSeriesManager
} from '../src/index.js';

describe('Phase 1 Advanced Features', () => {
  let client: any;
  let relationsManager: RelationsManager;
  let aggregationsManager: AggregationsManager;
  let timeSeriesManager: TimeSeriesManager;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase1_test'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    await client.connect();

    // Initialize managers
    relationsManager = new RelationsManager(client.driver, 'phase1_test');
    aggregationsManager = new AggregationsManager(client.driver, 'phase1_test');
    timeSeriesManager = new TimeSeriesManager(client.driver, 'phase1_test');

    // Setup test tables
    await setupTestTables();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  async function setupTestTables() {
    // Users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        name text,
        email text,
        age int,
        status text,
        created_at timestamp
      )
    `);

    // Posts table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id uuid PRIMARY KEY,
        user_id uuid,
        title text,
        content text,
        views int,
        created_at timestamp
      )
    `);

    // Insert test data
    const userId1 = client.uuid();
    const userId2 = client.uuid();

    await client.execute(
      'INSERT INTO users (id, name, email, age, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId1, 'John Doe', 'john@test.com', 30, 'active', new Date()],
      { prepare: true }
    );

    await client.execute(
      'INSERT INTO users (id, name, email, age, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId2, 'Jane Smith', 'jane@test.com', 25, 'active', new Date()],
      { prepare: true }
    );

    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, views, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [client.uuid(), userId1, 'First Post', 'Content 1', 100, new Date()],
      { prepare: true }
    );

    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, views, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [client.uuid(), userId1, 'Second Post', 'Content 2', 150, new Date()],
      { prepare: true }
    );
  }

  it('should handle relations and populate', async () => {
    // Register models with relations
    const userSchema = {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text'
      },
      relations: {
        posts: {
          model: 'posts',
          foreignKey: 'user_id',
          type: 'hasMany' as const
        }
      }
    };

    relationsManager.registerModel('users', userSchema);

    // Get users
    const users = await client.execute('SELECT * FROM users LIMIT 2');
    
    // Populate relations
    const populatedUsers = await relationsManager.populate(
      'users',
      users.rows,
      'posts'
    );

    expect(populatedUsers).toBeDefined();
    expect(populatedUsers.length).toBeGreaterThan(0);
    
    // Check if posts were populated
    const userWithPosts = populatedUsers.find((user: any) => user.posts && user.posts.length > 0);
    if (userWithPosts) {
      expect(userWithPosts.posts).toBeDefined();
      expect(Array.isArray(userWithPosts.posts)).toBe(true);
    }
  });

  it('should perform aggregations', async () => {
    // Test basic aggregations
    const pipeline = aggregationsManager.createPipeline('users');
    
    const results = await pipeline
      .count('total_users')
      .avg('age', 'average_age')
      .where('status', '=', 'active')
      .execute();

    expect(results).toBeDefined();
    expect(results.length).toBe(1);
    
    // Handle Cassandra Long objects
    const totalUsers = results[0].total_users;
    const avgAge = results[0].average_age;
    
    expect(totalUsers).toBeDefined();
    expect(avgAge).toBeDefined();
    
    // Convert to number if it's a Long object
    const totalUsersNum = typeof totalUsers === 'object' && totalUsers.toNumber ? totalUsers.toNumber() : totalUsers;
    const avgAgeNum = typeof avgAge === 'object' && avgAge.toNumber ? avgAge.toNumber() : avgAge;
    
    expect(totalUsersNum).toBeGreaterThan(0);
    expect(avgAgeNum).toBeGreaterThan(0);
  });

  it('should perform grouped aggregations', async () => {
    // Test grouped aggregations
    const pipeline = aggregationsManager.createPipeline('users');
    
    const results = await pipeline
      .count('user_count')
      .avg('age', 'avg_age')
      .groupBy('status')
      .execute();

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    
    const activeGroup = results.find((r: any) => r.status === 'active');
    if (activeGroup) {
      expect(activeGroup.user_count).toBeGreaterThan(0);
      expect(activeGroup.avg_age).toBeGreaterThan(0);
    }
  });

  it('should handle advanced connection pool', async () => {
    const pool = new AdvancedConnectionPool(
      {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase1_test'
      },
      {
        size: 2,
        maxSize: 3,
        loadBalancing: 'round-robin',
        healthCheck: {
          enabled: false // Disable for testing
        }
      }
    );

    try {
      await pool.initialize();

      // Test connection retrieval
      const connection = await pool.getConnection();
      expect(connection).toBeDefined();

      // Test stats
      const stats = pool.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);

      // Test simple operation
      const result = await connection.execute('SELECT now() FROM system.local');
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();

      await pool.releaseConnection(connection);
    } finally {
      await pool.shutdown();
    }
  });

  it('should handle time series data', async () => {
    // Create time series table
    await timeSeriesManager.createTimeSeriesTable('metrics', {
      value: 'double'
    });

    // Insert time series points
    const now = new Date();
    const points = [
      {
        timestamp: new Date(now.getTime() - 3600000), // 1 hour ago
        value: 100,
        tags: { metric: 'cpu', host: 'server1' }
      },
      {
        timestamp: new Date(now.getTime() - 1800000), // 30 minutes ago
        value: 150,
        tags: { metric: 'cpu', host: 'server1' }
      },
      {
        timestamp: now,
        value: 120,
        tags: { metric: 'cpu', host: 'server1' }
      }
    ];

    await timeSeriesManager.insert('metrics', points);

    // Query time series data
    const results = await timeSeriesManager.query('metrics', {
      start: new Date(now.getTime() - 7200000), // 2 hours ago
      end: now,
      tags: { metric: 'cpu' }
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].timestamp).toBeDefined();
    expect(results[0].value).toBeDefined();
  });

  it('should aggregate time series data', async () => {
    const now = new Date();
    
    // Query with aggregation
    const aggregatedResults = await timeSeriesManager.query('metrics', {
      start: new Date(now.getTime() - 7200000), // 2 hours ago
      end: now,
      tags: { metric: 'cpu' },
      aggregation: 'avg',
      interval: '1h'
    });

    expect(aggregatedResults).toBeDefined();
    expect(aggregatedResults.length).toBeGreaterThan(0);
    
    // Check if aggregation worked
    const firstResult = aggregatedResults[0];
    expect(firstResult.timestamp).toBeDefined();
    expect(typeof firstResult.value).toBe('number');
  });

  it('should get time series metrics', async () => {
    const metrics = await timeSeriesManager.getMetrics('metrics');
    
    expect(metrics).toBeDefined();
    expect(metrics.totalPoints).toBeDefined();
    expect(metrics.bucketsCount).toBeDefined();
    
    // Handle Cassandra Long objects
    const totalPoints = typeof metrics.totalPoints === 'object' && metrics.totalPoints.toNumber 
      ? metrics.totalPoints.toNumber() 
      : metrics.totalPoints;
      
    expect(typeof totalPoints).toBe('number');
  });

  it('should integrate all Phase 1 features', async () => {
    // Complex scenario using multiple features
    
    // 1. Use relations to get users with posts
    const users = await client.execute('SELECT * FROM users LIMIT 1');
    const populatedUsers = await relationsManager.populate(
      'users',
      users.rows,
      'posts'
    );

    expect(populatedUsers.length).toBeGreaterThan(0);

    // 2. Aggregate post views by user
    const postStats = await aggregationsManager.createPipeline('posts')
      .sum('views', 'total_views')
      .count('post_count')
      .groupBy('user_id')
      .execute();

    expect(postStats).toBeDefined();

    // 3. Store aggregated data as time series (simplified)
    if (postStats.length > 0) {
      const timeSeriesPoints = postStats.map(stat => ({
        timestamp: new Date(),
        value: stat.total_views,
        tags: { 
          metric: 'user_post_views',
          user_id: stat.user_id.toString() // Convert UUID to string
        }
      }));

      await timeSeriesManager.insert('metrics', timeSeriesPoints);
    }

    // 4. Query the stored metrics
    const metricsResults = await timeSeriesManager.query('metrics', {
      start: new Date(Date.now() - 3600000), // 1 hour ago
      end: new Date(),
      tags: { metric: 'user_post_views' }
    });

    expect(metricsResults).toBeDefined();
  });
});

export { };
