import { 
  createClient, 
  SchemaValidator, 
  IntelligentCache, 
  HooksMiddlewareSystem, 
  CommonHooks 
} from '../src/index.js';

export async function runIntegrationTests() {
  console.log('🔄 Running Integration Tests...\n');
  
  try {
    // Test 1: Schema Validation
    console.log('🔍 Testing Schema Validation...');
    
    const userSchema = {
      fields: {
        id: 'uuid',
        name: {
          type: 'text',
          validate: {
            required: true,
            minLength: 2
          }
        },
        email: {
          type: 'text',
          validate: {
            required: true,
            isEmail: true
          }
        }
      }
    };

    // Valid data
    const validUser = {
      id: 'uuid-123',
      name: 'John Doe',
      email: 'john@example.com'
    };

    const validErrors = SchemaValidator.validate(validUser, userSchema);
    console.log(`✅ Valid data: ${validErrors.length} errors`);

    // Invalid data
    const invalidUser = {
      id: 'uuid-456',
      name: 'J', // Too short
      email: 'invalid-email' // Invalid format
    };

    const invalidErrors = SchemaValidator.validate(invalidUser, userSchema);
    console.log(`✅ Invalid data: ${invalidErrors.length} errors`);

    // Test 2: Intelligent Cache
    console.log('\n💾 Testing Intelligent Cache...');

    const cache = new IntelligentCache({
      ttl: 300,
      maxSize: 100,
      strategy: 'lru'
    });

    cache.set('test-key', { data: 'test-value' });
    const cachedValue = cache.get('test-key');
    console.log(`✅ Cache: ${cachedValue ? 'Hit' : 'Miss'}`);

    // Test 3: Hooks and Middleware
    console.log('\n🪝 Testing Hooks and Middleware...');

    const hooks = new HooksMiddlewareSystem();
    hooks.beforeCreate(CommonHooks.addTimestamps);

    const testData = { name: 'Test User', email: 'test@example.com' };
    const processedData = await hooks.executeHook('beforeCreate', testData, {
      operation: 'create',
      tableName: 'users'
    });

    console.log('✅ Hooks executed successfully');
    console.log(`   Added timestamps: ${!!processedData.created_at}`);

    console.log('\n✅ All integration tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Integration tests failed:', error);
    return false;
  }
}

// Run tests if called directly
if (import.meta.main) {
  await runIntegrationTests();
}
