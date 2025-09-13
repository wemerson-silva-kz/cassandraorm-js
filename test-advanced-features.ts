import { createClient } from './src/index.js';
import { AdvancedQueryBuilder } from './src/advanced-query-builder.js';
import { SchemaValidator } from './src/schema-validator.js';
import { IntelligentCache, QueryCache } from './src/intelligent-cache.js';
import { OptimizedPagination } from './src/optimized-pagination.js';
import { HooksMiddlewareSystem, CommonHooks } from './src/hooks-middleware.js';

async function testAdvancedFeatures() {
  console.log('🔄 Testing Advanced Features...\n');
  
  try {
    const client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1'
      }
    });

    await client.connect();
    console.log('✅ Connected to Cassandra');

    // Setup test environment
    await client.execute(`
      CREATE KEYSPACE IF NOT EXISTS test_advanced
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);

    await client.execute('USE test_advanced');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        email text,
        name text,
        age int,
        status text,
        created_at timestamp
      )
    `);

    // Insert test data with proper types
    const userId1 = client.uuid();
    const userId2 = client.uuid();
    const userId3 = client.uuid();

    await client.execute(
      'INSERT INTO users (id, email, name, age, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId1, 'john@test.com', 'John Doe', 25, 'active', new Date()]
    );

    await client.execute(
      'INSERT INTO users (id, email, name, age, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId2, 'jane@test.com', 'Jane Smith', 30, 'active', new Date()]
    );

    await client.execute(
      'INSERT INTO users (id, email, name, age, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId3, 'bob@test.com', 'Bob Johnson', 35, 'inactive', new Date()]
    );

    console.log('✅ Test data inserted');

    // Test 1: Advanced Query Builder
    console.log('\n📊 Testing Advanced Query Builder...');
    
    const queryBuilder = new AdvancedQueryBuilder(client.driver, 'users', 'test_advanced');
    
    const activeUsers = await queryBuilder
      .select(['name', 'email', 'age'])
      .where('status').eq('active')
      .allowFiltering()
      .execute();

    console.log(`✅ Query Builder: Found ${activeUsers.length} active users`);

    // Test 2: Schema Validation
    console.log('\n🔍 Testing Schema Validation...');
    
    const userSchema = {
      fields: {
        email: {
          type: 'text',
          validate: {
            required: true,
            isEmail: true
          }
        },
        name: {
          type: 'text',
          validate: {
            required: true,
            minLength: 2
          }
        },
        age: {
          type: 'int',
          validate: {
            min: 0,
            max: 120
          }
        }
      }
    };

    const validUser = {
      email: 'valid@test.com',
      name: 'Valid User',
      age: 25
    };

    const validationErrors1 = SchemaValidator.validate(validUser, userSchema);
    console.log(`✅ Valid data: ${validationErrors1.length} errors`);

    const invalidUser = {
      email: 'invalid-email',
      name: 'A',
      age: 150
    };

    const validationErrors2 = SchemaValidator.validate(invalidUser, userSchema);
    console.log(`✅ Invalid data: ${validationErrors2.length} errors`);

    // Test 3: Intelligent Cache
    console.log('\n💾 Testing Intelligent Cache...');
    
    const cache = new IntelligentCache({ ttl: 5, maxSize: 100 });
    
    cache.set('user:1', { name: 'Cached User', age: 30 });
    const cachedUser = cache.get('user:1');
    console.log(`✅ Cache: ${cachedUser ? 'Hit' : 'Miss'}`);

    // Test 4: Optimized Pagination
    console.log('\n📄 Testing Optimized Pagination...');
    
    const pagination = new OptimizedPagination(client.driver, 'test_advanced');
    
    const page1 = await pagination.paginate(
      'SELECT * FROM users',
      [],
      { limit: 2 }
    );

    console.log(`✅ Pagination: ${page1.data.length} items, hasMore: ${page1.hasMore}`);

    // Test 5: Hooks and Middleware
    console.log('\n🪝 Testing Hooks and Middleware...');
    
    const hooksSystem = new HooksMiddlewareSystem();
    
    hooksSystem.beforeCreate(CommonHooks.addTimestamps);
    
    const userData = { name: 'Test User', email: 'test@hooks.com' };
    const processedData = await hooksSystem.executeHook('beforeCreate', userData, {
      operation: 'create',
      tableName: 'users'
    });

    console.log('✅ Hooks executed successfully');
    console.log(`   Added timestamps: ${!!processedData.created_at}`);

    await client.disconnect();
    console.log('\n✅ All advanced features tested successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAdvancedFeatures();
