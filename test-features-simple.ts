import { SchemaValidator } from './src/schema-validator.js';
import { IntelligentCache } from './src/intelligent-cache.js';
import { HooksMiddlewareSystem, CommonHooks } from './src/hooks-middleware.js';

async function testFeaturesSimple() {
  console.log('🔄 Testing Advanced Features (Simple)...\n');
  
  try {
    // Test 1: Schema Validation
    console.log('🔍 Testing Schema Validation...');
    
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
            minLength: 2,
            maxLength: 50
          }
        },
        age: {
          type: 'int',
          validate: {
            min: 0,
            max: 120
          }
        },
        status: {
          type: 'text',
          validate: {
            enum: ['active', 'inactive', 'pending']
          }
        }
      }
    };

    // Valid data
    const validUser = {
      email: 'valid@test.com',
      name: 'Valid User',
      age: 25,
      status: 'active'
    };

    const validationErrors1 = SchemaValidator.validate(validUser, userSchema);
    console.log(`✅ Valid data: ${validationErrors1.length} errors`);

    // Invalid data
    const invalidUser = {
      email: 'invalid-email',
      name: 'A', // Too short
      age: 150, // Too high
      status: 'unknown' // Not in enum
    };

    const validationErrors2 = SchemaValidator.validate(invalidUser, userSchema);
    console.log(`✅ Invalid data: ${validationErrors2.length} errors`);
    validationErrors2.forEach(error => {
      console.log(`   - ${error.message}`);
    });

    // Test 2: Intelligent Cache
    console.log('\n💾 Testing Intelligent Cache...');
    
    const cache = new IntelligentCache({ ttl: 5, maxSize: 100, strategy: 'lru' });
    
    // Set and get
    cache.set('user:1', { name: 'Cached User', age: 30 });
    cache.set('user:2', { name: 'Another User', age: 25 });
    cache.set('user:3', { name: 'Third User', age: 35 });
    
    const cachedUser1 = cache.get('user:1');
    const cachedUser2 = cache.get('user:2');
    const nonExistent = cache.get('user:999');
    
    console.log(`✅ Cache get user:1: ${cachedUser1 ? 'Hit' : 'Miss'}`);
    console.log(`✅ Cache get user:2: ${cachedUser2 ? 'Hit' : 'Miss'}`);
    console.log(`✅ Cache get user:999: ${nonExistent ? 'Hit' : 'Miss'}`);
    
    // Cache stats
    const stats = cache.stats();
    console.log(`✅ Cache stats: ${stats.size} items, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);
    
    // Test cache eviction
    for (let i = 0; i < 105; i++) {
      cache.set(`test:${i}`, { data: `value${i}` });
    }
    
    console.log(`✅ After adding 105 items: ${cache.size()} items (max: 100)`);

    // Test 3: Hooks and Middleware
    console.log('\n🪝 Testing Hooks and Middleware...');
    
    const hooksSystem = new HooksMiddlewareSystem();
    
    // Register hooks
    hooksSystem.beforeCreate(CommonHooks.addTimestamps);
    hooksSystem.beforeUpdate(CommonHooks.updateTimestamp);
    hooksSystem.afterFind(CommonHooks.sanitize);
    
    // Test beforeCreate hook
    const userData = { name: 'Test User', email: 'test@hooks.com', password: 'secret123' };
    const processedData = await hooksSystem.executeHook('beforeCreate', userData, {
      operation: 'create',
      tableName: 'users'
    });
    
    console.log('✅ beforeCreate hook executed');
    console.log(`   Added created_at: ${!!processedData.created_at}`);
    console.log(`   Added updated_at: ${!!processedData.updated_at}`);
    
    // Test afterFind hook (sanitization)
    const foundData = { 
      name: 'Found User', 
      email: 'found@test.com', 
      password: 'secret456',
      token: 'jwt-token-here'
    };
    
    const sanitizedData = await hooksSystem.executeHook('afterFind', foundData, {
      operation: 'find',
      tableName: 'users'
    });
    
    console.log('✅ afterFind hook executed (sanitization)');
    console.log(`   Password removed: ${!sanitizedData.password}`);
    console.log(`   Token removed: ${!sanitizedData.token}`);
    console.log(`   Name preserved: ${!!sanitizedData.name}`);

    // Test middleware
    hooksSystem.use(async (data, next) => {
      console.log('   🔄 Middleware 1: Processing...');
      const result = await next();
      console.log('   ✅ Middleware 1: Completed');
      return result;
    });

    hooksSystem.use(async (data, next) => {
      console.log('   🔄 Middleware 2: Adding metadata...');
      const result = await next();
      return { ...result, processed_by: 'middleware' };
    });

    const middlewareData = { test: 'data' };
    const middlewareResult = await hooksSystem.executeMiddleware(middlewareData);
    
    console.log('✅ Middleware chain executed');
    console.log(`   Added metadata: ${!!middlewareResult.processed_by}`);

    // Test 4: Query Builder (without database)
    console.log('\n📊 Testing Query Builder Logic...');
    
    // We'll test the query building logic without executing
    const { AdvancedQueryBuilder } = await import('./src/advanced-query-builder.js');
    
    // Mock client for testing
    const mockClient = {} as any;
    const queryBuilder = new AdvancedQueryBuilder(mockClient, 'users', 'test_keyspace');
    
    const { query, params } = queryBuilder
      .select(['name', 'email', 'age'])
      .where('status').eq('active')
      .and('age').gte(25)
      .orderBy('created_at', 'DESC')
      .limit(10)
      .allowFiltering()
      .build();
    
    console.log('✅ Query built successfully');
    console.log(`   Query: ${query}`);
    console.log(`   Params: [${params.join(', ')}]`);
    
    // Test different operators
    const complexQuery = new AdvancedQueryBuilder(mockClient, 'products', 'store')
      .select('*')
      .where('category').in(['electronics', 'books'])
      .and('price').lte(100)
      .and('tags').contains('featured')
      .build();
    
    console.log('✅ Complex query built');
    console.log(`   Query: ${complexQuery.query}`);

    console.log('\n✅ All features tested successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testFeaturesSimple();
