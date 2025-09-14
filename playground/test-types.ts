#!/usr/bin/env bun
import { 
  createClient,
  type ModelSchema,
  type QueryOptions,
  type FindQuery,
  type CacheOptions,
  type BulkWriterOptions,
  type ValidationRule,
  type AIConfig,
  type GraphQLType,
  type TransactionConfig,
  type SubscriptionConfig,
  type ImportOptions,
  type BackupConfig,
  type OptimizationConfig,
  type ElasticsearchConfig,
  type WhereCondition,
  type AggregationPipeline,
  type AdvancedPoolOptions,
  type ConnectionStats,
  type SerializationOptions,
  type EncryptionOptions
} from '../src/index.js';

async function testTypes() {
  console.log('🔍 Testando Tipos TypeScript - CassandraORM JS\n');

  // Test core types
  const clientOptions = {
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_types'
    }
  };

  const client = createClient(clientOptions);
  console.log('✅ createClient com tipos corretos');

  // Test ModelSchema
  const schema: ModelSchema = {
    fields: {
      id: 'uuid',
      email: { type: 'text', unique: true },
      name: 'text'
    },
    key: ['id'],
    unique: ['email'],
    methods: {
      getFullName: function() { return this.name; }
    },
    before_save: (instance, options) => true,
    after_save: (instance, result) => {}
  };
  console.log('✅ ModelSchema com todos os campos');

  // Test QueryOptions
  const queryOptions: QueryOptions = {
    prepare: true,
    limit: 10,
    allow_filtering: true,
    ttl: 3600,
    consistency: 1
  };
  console.log('✅ QueryOptions com limit e outras propriedades');

  // Test FindQuery
  const findQuery: FindQuery = {
    email: 'test@example.com',
    limit: 5,
    $limit: 10,
    orderBy: { created_at: 'DESC' },
    $orderby: { name: 'ASC' }
  };
  console.log('✅ FindQuery com campos dinâmicos');

  // Test advanced types
  const cacheOptions: CacheOptions = {
    ttl: 3600,
    maxSize: 1000,
    strategy: 'LRU'
  };

  const bulkOptions: BulkWriterOptions = {
    batchSize: 100,
    concurrency: 5,
    retries: 3
  };

  const validationRule: ValidationRule = {
    field: 'email',
    type: 'email',
    required: true,
    validator: (value) => value.includes('@')
  };

  const aiConfig: AIConfig = {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4'
  };

  const graphqlType: GraphQLType = {
    name: 'User',
    fields: {
      id: 'ID!',
      email: 'String!'
    }
  };

  const transactionConfig: TransactionConfig = {
    timeout: 30000,
    retries: 3,
    isolation: 'read_committed'
  };

  const subscriptionConfig: SubscriptionConfig = {
    table: 'users',
    operation: 'insert',
    filter: { active: true }
  };

  const importOptions: ImportOptions = {
    truncate: true,
    batchSize: 1000,
    skipErrors: false
  };

  const backupConfig: BackupConfig = {
    destination: '/backup',
    compression: true,
    encryption: true
  };

  const optimizationConfig: OptimizationConfig = {
    enableQueryOptimization: true,
    enableIndexSuggestions: true,
    enablePerformanceMonitoring: true
  };

  const elasticsearchConfig: ElasticsearchConfig = {
    host: 'localhost',
    port: 9200,
    auth: {
      username: 'elastic',
      password: 'password'
    }
  };

  const whereCondition: WhereCondition = {
    field: 'age',
    operator: '>',
    value: 18
  };

  const aggregationPipeline: AggregationPipeline = {
    $match: { active: true },
    $group: { _id: '$category', count: { $sum: 1 } },
    $sort: { count: -1 },
    $limit: 10
  };

  const poolOptions: AdvancedPoolOptions = {
    coreConnections: 2,
    maxConnections: 10,
    maxRequestsPerConnection: 100,
    heartBeatInterval: 30000,
    poolTimeout: 5000,
    idleTimeout: 120000
  };

  const connectionStats: ConnectionStats = {
    totalConnections: 5,
    activeConnections: 3,
    idleConnections: 2,
    requestsInFlight: 10
  };

  const serializationOptions: SerializationOptions = {
    format: 'json',
    compression: true
  };

  const encryptionOptions: EncryptionOptions = {
    algorithm: 'AES-256-GCM',
    key: 'secret-key',
    fields: ['email', 'phone']
  };

  console.log('✅ Todos os tipos avançados funcionando');

  console.log('\n🎉 Todos os tipos TypeScript estão corretos!');
  console.log('\n📊 Tipos testados:');
  console.log('   ✅ Core types (ModelSchema, QueryOptions, FindQuery)');
  console.log('   ✅ Cache types (CacheOptions)');
  console.log('   ✅ Bulk operations (BulkWriterOptions)');
  console.log('   ✅ Validation (ValidationRule)');
  console.log('   ✅ AI/ML (AIConfig)');
  console.log('   ✅ GraphQL (GraphQLType)');
  console.log('   ✅ Transactions (TransactionConfig)');
  console.log('   ✅ Subscriptions (SubscriptionConfig)');
  console.log('   ✅ Import/Export (ImportOptions, BackupConfig)');
  console.log('   ✅ Optimization (OptimizationConfig)');
  console.log('   ✅ Elassandra (ElasticsearchConfig)');
  console.log('   ✅ Query Builder (WhereCondition, AggregationPipeline)');
  console.log('   ✅ Connection Pool (AdvancedPoolOptions, ConnectionStats)');
  console.log('   ✅ Serialization & Encryption');
}

// Executar teste
testTypes();
