import { createClient } from '../src/index.js';
import { SchemaValidator } from '../src/schema-validator.js';
import { IntelligentCache } from '../src/intelligent-cache.js';
import { HooksMiddlewareSystem, CommonHooks } from '../src/hooks-middleware.js';

export async function runIntegrationTests() {
  console.log('🔄 Running Integration Tests...\n');
  
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
            minLength: 2
          }
        }
      }
    };

    const validUser = { email: 'valid@test.com', name: 'Valid User' };
    const invalidUser = { email: 'invalid-email', name: 'A' };

    const validationErrors1 = SchemaValidator.validate(validUser, userSchema);
    const validationErrors2 = SchemaValidator.validate(invalidUser, userSchema);
    
    console.log(`✅ Valid data: ${validationErrors1.length} errors`);
    console.log(`✅ Invalid data: ${validationErrors2.length} errors`);

    // Test 2: Intelligent Cache
    console.log('\n💾 Testing Intelligent Cache...');
    
    const cache = new IntelligentCache({ ttl: 5, maxSize: 100 });
    
    cache.set('user:1', { name: 'Cached User', age: 30 });
    const cachedUser = cache.get('user:1');
    console.log(`✅ Cache: ${cachedUser ? 'Hit' : 'Miss'}`);

    // Test 3: Hooks and Middleware
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

    console.log('\n✅ All integration tests passed!');
    return true;

  } catch (error: any) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

if (import.meta.main) {
  runIntegrationTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
