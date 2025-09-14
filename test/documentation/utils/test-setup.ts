import { TestHelpers } from './test-helpers';

// Global test setup for documentation tests
beforeAll(async () => {
  console.log('🔧 Setting up documentation tests...');
  
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.CASSANDRA_KEYSPACE = 'test_docs';
  
  // Initialize test client
  await TestHelpers.setupTestClient();
}, 30000);

afterAll(async () => {
  console.log('🧹 Cleaning up documentation tests...');
  
  // Cleanup test environment
  await TestHelpers.cleanup();
}, 10000);

// Global error handler for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Test utilities
global.testTimeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
