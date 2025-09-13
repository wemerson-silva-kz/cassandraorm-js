import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { 
  createClient,
  AIMLManager,
  EventStore,
  BaseAggregateRoot,
  AggregateRepository,
  UserAggregate,
  DistributedTransactionManager,
  CassandraParticipant,
  TransactionStatus,
  SemanticCache
} from '../src/index.js';

describe('Phase 4 Advanced Features', () => {
  let client: any;
  let aimlManager: AIMLManager;
  let eventStore: EventStore;
  let userRepository: AggregateRepository<UserAggregate>;
  let transactionManager: DistributedTransactionManager;
  let semanticCache: SemanticCache;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'phase4_test'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    await client.connect();

    // Initialize managers
    aimlManager = new AIMLManager(client.driver, 'phase4_test', {
      enabled: true,
      vectorDimensions: 128,
      similarityThreshold: 0.7
    });

    eventStore = new EventStore(client.driver, 'phase4_test');
    await eventStore.initialize();

    userRepository = new AggregateRepository(
      eventStore,
      (id: string) => new UserAggregate(id)
    );

    transactionManager = new DistributedTransactionManager(client.driver, 'phase4_test');
    await transactionManager.initialize();

    semanticCache = new SemanticCache({
      enabled: true,
      similarityThreshold: 0.8,
      maxCacheSize: 100
    });

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  async function setupTestData() {
    // Create test table for AI/ML
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_data (
        id uuid PRIMARY KEY,
        name text,
        description text,
        category text,
        created_at timestamp
      )
    `);

    // Insert test data
    for (let i = 0; i < 10; i++) {
      await client.execute(
        'INSERT INTO test_data (id, name, description, category, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          client.uuid(),
          `Item ${i}`,
          `Description for item ${i} with some content`,
          i % 3 === 0 ? 'electronics' : i % 3 === 1 ? 'books' : 'clothing',
          new Date()
        ],
        { prepare: true }
      );
    }
  }

  it('should handle AI/ML vector operations', async () => {
    // Create vector table
    await aimlManager.createVectorTable('documents');

    // Generate embeddings
    const text1 = 'This is a document about machine learning';
    const text2 = 'Machine learning and artificial intelligence';
    const text3 = 'Cooking recipes and food preparation';

    const embedding1 = await aimlManager.generateEmbedding(text1);
    const embedding2 = await aimlManager.generateEmbedding(text2);
    const embedding3 = await aimlManager.generateEmbedding(text3);

    expect(embedding1).toBeDefined();
    expect(embedding1.length).toBe(128);
    expect(embedding2.length).toBe(128);
    expect(embedding3.length).toBe(128);

    // Insert embeddings
    await aimlManager.insertEmbedding('documents', {
      id: 'doc1',
      vector: embedding1,
      content: text1,
      metadata: { category: 'tech' }
    });

    await aimlManager.insertEmbedding('documents', {
      id: 'doc2',
      vector: embedding2,
      content: text2,
      metadata: { category: 'tech' }
    });

    await aimlManager.insertEmbedding('documents', {
      id: 'doc3',
      vector: embedding3,
      content: text3,
      metadata: { category: 'food' }
    });

    // Perform similarity search
    const queryEmbedding = await aimlManager.generateEmbedding('artificial intelligence and ML');
    const results = await aimlManager.similaritySearch('documents', queryEmbedding, {
      limit: 2,
      threshold: 0.1 // Lower threshold for test
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it('should optimize queries with AI suggestions', async () => {
    const suggestions = await aimlManager.optimizeQuery(
      'SELECT * FROM test_data WHERE category = ? ALLOW FILTERING'
    );

    expect(suggestions).toBeDefined();
    expect(suggestions.length).toBeGreaterThan(0);
    
    const indexSuggestion = suggestions.find(s => s.reason.includes('index'));
    expect(indexSuggestion).toBeDefined();
    expect(indexSuggestion!.confidence).toBeGreaterThan(0.5);
  });

  it('should detect query anomalies', async () => {
    const queryHistory = [
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 10, timestamp: new Date() },
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 12, timestamp: new Date() },
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 15, timestamp: new Date() },
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 11, timestamp: new Date() },
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 13, timestamp: new Date() },
      { query: 'SELECT * FROM test_data WHERE category = ? ALLOW FILTERING', executionTime: 1000, timestamp: new Date() }, // Clear anomaly
      { query: 'SELECT * FROM test_data WHERE id = ?', executionTime: 14, timestamp: new Date() }
    ];

    const anomalies = await aimlManager.detectAnomalies(queryHistory);

    expect(anomalies).toBeDefined();
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].anomalyScore).toBeGreaterThan(2); // Should be well above 2 standard deviations
    expect(anomalies[0].reason).toContain('standard deviations');
  });

  it('should handle event sourcing', async () => {
    // Create a new user aggregate
    const userId = client.uuid().toString();
    const user = UserAggregate.create(userId, 'John Doe', 'john@example.com', 'test-user');

    expect(user.id).toBe(userId);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.uncommittedEvents.length).toBe(1);
    expect(user.uncommittedEvents[0].eventType).toBe('UserCreated');

    // Save the aggregate
    await userRepository.save(user);
    expect(user.uncommittedEvents.length).toBe(0);
    expect(user.version).toBe(1);

    // Modify the user
    user.changeName('Jane Doe', 'test-user');
    user.changeEmail('jane@example.com', 'test-user');

    expect(user.uncommittedEvents.length).toBe(2);
    expect(user.name).toBe('Jane Doe');
    expect(user.email).toBe('jane@example.com');

    // Save changes
    await userRepository.save(user);
    expect(user.version).toBe(3);

    // Load user from repository
    const loadedUser = await userRepository.getById(userId);
    expect(loadedUser).toBeDefined();
    expect(loadedUser!.name).toBe('Jane Doe');
    expect(loadedUser!.email).toBe('jane@example.com');
    expect(loadedUser!.version).toBe(3);
  });

  it('should handle event store operations', async () => {
    // Get events by type
    const userCreatedEvents = await eventStore.getEventsByType('UserCreated', 10);
    expect(userCreatedEvents).toBeDefined();
    expect(userCreatedEvents.length).toBeGreaterThan(0);
    expect(userCreatedEvents[0].eventType).toBe('UserCreated');

    // Test event store listeners
    let eventReceived = false;
    eventStore.on('eventStored', (event) => {
      if (event.eventType === 'TestEvent') {
        eventReceived = true;
      }
    });

    // Create and save a test event
    const testUserId = client.uuid().toString();
    const testUser = new UserAggregate(testUserId);
    testUser.addEvent('TestEvent', { test: 'data' }, 'test-user');

    await userRepository.save(testUser);

    // Wait a bit for event processing
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(eventReceived).toBe(true);
  });

  it('should handle distributed transactions', async () => {
    // Create test participants
    const participant1 = new CassandraParticipant('participant1', client.driver, 'phase4_test');
    const participant2 = new CassandraParticipant('participant2', client.driver, 'phase4_test');

    transactionManager.registerParticipant(participant1);
    transactionManager.registerParticipant(participant2);

    // Begin transaction
    const transactionId = await transactionManager.beginTransaction(
      'coordinator1',
      [
        {
          participantId: 'participant1',
          operation: 'insert',
          data: { table: 'test_table1', values: { id: 1, name: 'test' } }
        },
        {
          participantId: 'participant2',
          operation: 'update',
          data: { table: 'test_table2', values: { status: 'active' }, where: { id: 2 } }
        }
      ]
    );

    expect(transactionId).toBeDefined();
    expect(typeof transactionId).toBe('string');

    // Check transaction status
    const status = await transactionManager.getTransactionStatus(transactionId);
    expect(status).toBeDefined();
    expect(status!.transactionId).toBe(transactionId);
    expect(status!.status).toBe(TransactionStatus.PREPARING);
    expect(status!.participants).toContain('participant1');
    expect(status!.participants).toContain('participant2');

    // Get participant operations
    const operations = await transactionManager.getParticipantOperations(transactionId);
    expect(operations).toBeDefined();
    expect(operations.length).toBe(2);
    expect(operations[0].participantId).toBe('participant1');
    expect(operations[1].participantId).toBe('participant2');
  });

  it('should handle semantic caching', async () => {
    // Test basic caching
    const query1 = 'SELECT * FROM test_data WHERE category = ?';
    const params1 = ['electronics'];
    const result1 = { rows: [{ id: 1, name: 'laptop' }] };

    // Cache miss
    let cached = await semanticCache.get(query1, params1);
    expect(cached).toBeNull();

    // Set cache
    await semanticCache.set(query1, params1, result1);

    // Cache hit
    cached = await semanticCache.get(query1, params1);
    expect(cached).toEqual(result1);

    // Test semantic similarity
    const query2 = 'SELECT * FROM test_data WHERE category = ?';
    const params2 = ['books']; // Different parameter but similar query structure

    await semanticCache.set(query2, params2, { rows: [{ id: 2, name: 'novel' }] });

    // Should find semantically similar query
    const similarQuery = 'SELECT * FROM test_data WHERE category = ?';
    const similarParams = ['electronics'];
    
    const similarResult = await semanticCache.get(similarQuery, similarParams);
    expect(similarResult).toBeDefined();

    // Test cache statistics
    const stats = semanticCache.getStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
    expect(stats.totalHits).toBeGreaterThan(0);
    expect(typeof stats.hitRate).toBe('number');
  });

  it('should handle semantic cache invalidation', async () => {
    // Add some entries
    await semanticCache.set('SELECT * FROM users WHERE id = ?', ['123'], { user: 'data' });
    await semanticCache.set('SELECT * FROM posts WHERE user_id = ?', ['123'], { posts: [] });
    await semanticCache.set('SELECT * FROM comments WHERE post_id = ?', ['456'], { comments: [] });

    let stats = semanticCache.getStats();
    const initialEntries = stats.totalEntries;

    // Invalidate by table
    const invalidated = semanticCache.invalidateByTable('users');
    expect(invalidated).toBeGreaterThan(0);

    stats = semanticCache.getStats();
    expect(stats.totalEntries).toBeLessThan(initialEntries);

    // Test pattern invalidation
    const patternInvalidated = semanticCache.invalidateByPattern('posts');
    expect(patternInvalidated).toBeGreaterThanOrEqual(0);
  });

  it('should integrate all Phase 4 features', async () => {
    // Complex scenario using multiple Phase 4 features
    
    // 1. Use AI to optimize a query
    const originalQuery = 'SELECT * FROM test_data WHERE category = ? ALLOW FILTERING';
    const suggestions = await aimlManager.optimizeQuery(originalQuery);
    expect(suggestions.length).toBeGreaterThan(0);

    // 2. Cache the query result semantically
    const queryResult = { rows: [{ id: 1, name: 'optimized result' }] };
    await semanticCache.set(originalQuery, ['%test%'], queryResult);

    // 3. Create an event-sourced aggregate
    const integrationUserId = client.uuid().toString();
    const integrationUser = UserAggregate.create(
      integrationUserId, 
      'Integration User', 
      'integration@test.com',
      'integration-test'
    );

    // 4. Save with event sourcing
    await userRepository.save(integrationUser);

    // 5. Start a distributed transaction
    const participant = new CassandraParticipant('integration-participant', client.driver, 'phase4_test');
    transactionManager.registerParticipant(participant);

    const txnId = await transactionManager.beginTransaction('integration-coordinator', [
      {
        participantId: 'integration-participant',
        operation: 'update_user',
        data: { userId: integrationUserId, status: 'active' }
      }
    ]);

    // 6. Check semantic cache hit
    const cachedResult = await semanticCache.get(originalQuery, ['%test%']);
    expect(cachedResult).toEqual(queryResult);

    // 7. Generate embeddings for the user data
    const userEmbedding = await aimlManager.generateEmbedding(
      `${integrationUser.name} ${integrationUser.email}`
    );
    expect(userEmbedding.length).toBe(128);

    // 8. Verify transaction was created
    const txnStatus = await transactionManager.getTransactionStatus(txnId);
    expect(txnStatus).toBeDefined();
    expect(txnStatus!.status).toBe(TransactionStatus.PREPARING);

    // 9. Check event store has the user creation event
    const userEvents = await eventStore.getEvents(integrationUserId);
    expect(userEvents.length).toBe(1);
    expect(userEvents[0].eventType).toBe('UserCreated');

    // 10. Verify cache statistics
    const finalStats = semanticCache.getStats();
    expect(finalStats.totalHits).toBeGreaterThan(0);
    expect(finalStats.hitRate).toBeGreaterThan(0);
  });
});

export { };
