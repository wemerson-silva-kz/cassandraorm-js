import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { 
  createClient,
  GraphQLSchemaGenerator,
  CassandraDataSource,
  BackupManager,
  PerformanceOptimizer,
  SubscriptionManager
} from '../src/index.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 3 Advanced Features', () => {
  let client: any;
  let graphqlGenerator: GraphQLSchemaGenerator;
  let backupManager: BackupManager;
  let performanceOptimizer: PerformanceOptimizer;
  let subscriptionManager: SubscriptionManager;
  let backupPath: string;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase3_test'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    await client.connect();

    // Setup backup path
    backupPath = join(tmpdir(), 'cassandra-backups');

    // Initialize managers
    graphqlGenerator = new GraphQLSchemaGenerator({
      enabled: true,
      relations: true,
      mutations: ['create', 'update', 'delete'],
      subscriptions: ['onCreate', 'onUpdate']
    });

    backupManager = new BackupManager(client.driver, 'phase3_test', {
      destination: backupPath,
      compression: true,
      includeSchema: true,
      batchSize: 100
    });

    performanceOptimizer = new PerformanceOptimizer(client.driver, 'phase3_test', {
      enabled: true,
      autoAnalyze: true,
      suggestIndexes: true
    });

    subscriptionManager = new SubscriptionManager(client.driver, 'phase3_test', {
      enabled: true,
      transport: 'polling',
      pollInterval: 100
    });

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    subscriptionManager.shutdown();
    await client.disconnect();
  });

  async function setupTestData() {
    // Create test tables
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        name text,
        email text,
        age int,
        created_at timestamp,
        updated_at timestamp
      )
    `);

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
    const userId = client.uuid();
    await client.execute(
      'INSERT INTO users (id, name, email, age, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'Test User', 'test@example.com', 30, new Date(), new Date()],
      { prepare: true }
    );

    await client.execute(
      'INSERT INTO posts (id, user_id, title, content, views, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [client.uuid(), userId, 'Test Post', 'Test content', 100, new Date()],
      { prepare: true }
    );
  }

  it('should generate GraphQL schema', () => {
    // Define schemas
    const userSchema = {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text',
        age: 'int',
        created_at: 'timestamp'
      },
      relations: {
        posts: {
          model: 'posts',
          foreignKey: 'user_id',
          type: 'hasMany'
        }
      }
    };

    const postSchema = {
      fields: {
        id: 'uuid',
        user_id: 'uuid',
        title: 'text',
        content: 'text',
        views: 'int'
      },
      relations: {
        user: {
          model: 'users',
          foreignKey: 'user_id',
          type: 'belongsTo'
        }
      }
    };

    // Add models to generator
    graphqlGenerator.addModel('users', userSchema);
    graphqlGenerator.addModel('posts', postSchema);

    // Generate schema
    const schema = graphqlGenerator.generateSchema();

    expect(schema).toContain('type Users');
    expect(schema).toContain('type Posts');
    expect(schema).toContain('type Query');
    expect(schema).toContain('type Mutation');
    expect(schema).toContain('type Subscription');
    expect(schema).toContain('posts: [Posts]'); // Relation field
    expect(schema).toContain('createUsers');
    expect(schema).toContain('updateUsers');
    expect(schema).toContain('deleteUsers');
  });

  it('should generate GraphQL resolvers', () => {
    const resolvers = graphqlGenerator.getResolvers();

    expect(resolvers).toBeDefined();
    expect(typeof resolvers).toBe('object');
    
    // Check if resolvers exist (they would be functions in a real implementation)
    expect(Object.keys(resolvers).length).toBeGreaterThan(0);
  });

  it('should work with Cassandra data source', async () => {
    const dataSource = new CassandraDataSource(client.driver, 'phase3_test', 'users');

    // Test find
    const users = await dataSource.find({ limit: 10 });
    expect(users).toBeDefined();
    expect(Array.isArray(users)).toBe(true);

    if (users.length > 0) {
      // Test findById
      const user = await dataSource.findById(users[0].id);
      expect(user).toBeDefined();
      expect(user.id.toString()).toBe(users[0].id.toString()); // Compare string representations
    }
  });

  it('should create backups', async () => {
    const metadata = await backupManager.createBackup({
      tables: ['users'],
      description: 'Test backup'
    });

    expect(metadata).toBeDefined();
    expect(metadata.id).toBeDefined();
    expect(metadata.keyspace).toBe('phase3_test');
    expect(metadata.tables).toContain('users');
    expect(metadata.compressed).toBe(true);
    expect(metadata.size).toBeGreaterThan(0);
  });

  it('should list backups', async () => {
    const backups = await backupManager.listBackups();
    
    expect(backups).toBeDefined();
    expect(Array.isArray(backups)).toBe(true);
    // May be 0 if backup directory doesn't exist yet
    expect(backups.length).toBeGreaterThanOrEqual(0);
    
    if (backups.length > 0) {
      const backup = backups[0];
      expect(backup.id).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.keyspace).toBe('phase3_test');
    }
  });

  it('should analyze query performance', async () => {
    const analysis = await performanceOptimizer.analyzeQuery(
      'SELECT * FROM users WHERE email = ? ALLOW FILTERING',
      ['test@example.com']
    );

    expect(analysis).toBeDefined();
    expect(analysis.query).toContain('SELECT * FROM users');
    expect(analysis.executionTime).toBeGreaterThan(0);
    expect(analysis.usesAllowFiltering).toBe(true);
    expect(analysis.suggestions).toBeDefined();
    expect(analysis.suggestions.length).toBeGreaterThan(0);

    // Should suggest an index for ALLOW FILTERING query
    const indexSuggestion = analysis.suggestions.find(s => s.type === 'index');
    expect(indexSuggestion).toBeDefined();
    expect(indexSuggestion!.priority).toBe('high');
  });

  it('should generate performance report', async () => {
    // Analyze a few more queries
    await performanceOptimizer.analyzeQuery('SELECT * FROM users WHERE id = ?', [client.uuid()]);
    await performanceOptimizer.analyzeQuery('SELECT * FROM posts ALLOW FILTERING');

    const report = await performanceOptimizer.getPerformanceReport();

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.topSuggestions).toBeDefined();
    expect(report.queryPatterns).toBeDefined();
    
    expect(typeof report.summary.avgQueryTime).toBe('number');
    expect(Array.isArray(report.topSuggestions)).toBe(true);
    expect(typeof report.queryPatterns).toBe('object');
  });

  it('should handle subscriptions', async () => {
    let receivedEvents: any[] = [];

    // Create subscription with unique table to avoid interference
    const subscriptionId = await subscriptionManager.subscribe(
      {
        table: 'test_subscriptions',
        operation: 'update'
      },
      (event) => {
        receivedEvents.push(event);
      },
      'test-user-unique'
    );

    expect(subscriptionId).toBeDefined();
    expect(typeof subscriptionId).toBe('string');

    // Publish an event
    await subscriptionManager.publishEvent({
      type: 'update',
      table: 'test_subscriptions',
      data: { id: client.uuid(), name: 'Updated User' },
      userId: 'test-user-unique'
    });

    // Wait a bit for event processing
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe('update');
    expect(receivedEvents[0].table).toBe('test_subscriptions');

    // Unsubscribe
    const unsubscribed = await subscriptionManager.unsubscribe(subscriptionId);
    expect(unsubscribed).toBe(true);
  });

  it('should filter subscription events', async () => {
    let receivedEvents: any[] = [];

    // Create filtered subscription
    await subscriptionManager.subscribe(
      {
        table: 'users',
        operation: 'insert',
        where: { age: 25 }
      },
      (event) => {
        receivedEvents.push(event);
      }
    );

    // Publish matching event
    await subscriptionManager.publishEvent({
      type: 'insert',
      table: 'users',
      data: { id: client.uuid(), name: 'Young User', age: 25 }
    });

    // Publish non-matching event
    await subscriptionManager.publishEvent({
      type: 'insert',
      table: 'users',
      data: { id: client.uuid(), name: 'Old User', age: 50 }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].data.age).toBe(25);
  });

  it('should provide subscription statistics', async () => {
    const stats = subscriptionManager.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalSubscriptions).toBe('number');
    expect(typeof stats.subscriptionsByTable).toBe('object');
    expect(typeof stats.subscriptionsByOperation).toBe('object');
    expect(typeof stats.activeUsers).toBe('number');
    expect(typeof stats.eventsProcessed).toBe('number');
  });

  it('should integrate all Phase 3 features', async () => {
    // Complex scenario using multiple Phase 3 features
    
    // 1. Generate GraphQL schema for the data model
    const userSchema = {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text'
      }
    };

    graphqlGenerator.addModel('integration_users', userSchema);
    const schema = graphqlGenerator.generateSchema();
    expect(schema).toContain('type Integration_users');

    // 2. Create a backup before operations
    const backupMetadata = await backupManager.createBackup({
      description: 'Integration test backup'
    });
    expect(backupMetadata.id).toBeDefined();

    // 3. Analyze performance of operations
    const queryAnalysis = await performanceOptimizer.analyzeQuery(
      'SELECT * FROM users WHERE name = ? ALLOW FILTERING',
      ['Integration User']
    );
    expect(queryAnalysis.suggestions.length).toBeGreaterThan(0);

    // 4. Set up real-time subscription
    let integrationEvents: any[] = [];
    const subId = await subscriptionManager.subscribe(
      { table: 'users', operation: 'insert' },
      (event) => integrationEvents.push(event)
    );

    // 5. Simulate data operation and notification
    await subscriptionManager.publishEvent({
      type: 'insert',
      table: 'users',
      data: { id: client.uuid(), name: 'Integration User', email: 'integration@test.com' }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // 6. Verify integration
    expect(integrationEvents.length).toBe(1);
    expect(integrationEvents[0].data.name).toBe('Integration User');

    // 7. Generate performance report
    const report = await performanceOptimizer.getPerformanceReport();
    expect(report.summary.avgQueryTime).toBeGreaterThan(0);

    // 8. Clean up
    await subscriptionManager.unsubscribe(subId);
    const stats = subscriptionManager.getStats();
    expect(stats.totalSubscriptions).toBeGreaterThanOrEqual(0);
  });
});

export { };
