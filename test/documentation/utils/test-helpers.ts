import { createClient } from '../../../src';

export class TestHelpers {
  static client: any;

  static async setupTestClient() {
    if (!this.client) {
      this.client = createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1:9042'],
          localDataCenter: 'datacenter1',
          keyspace: 'test_docs'
        },
        ormOptions: {
          createKeyspace: true,
          migration: 'safe'
        }
      });
      await this.client.connect();
    }
    return this.client;
  }

  static async cleanup() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  static generateTestData(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-${i}`,
      name: `Test Item ${i}`,
      value: Math.random() * 100,
      created_at: new Date()
    }));
  }

  static async waitFor(condition: () => Promise<boolean>, timeout: number = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
}

export const mockData = {
  users: [
    { id: 'user1', email: 'user1@test.com', name: 'User One' },
    { id: 'user2', email: 'user2@test.com', name: 'User Two' }
  ],
  posts: [
    { id: 'post1', title: 'Test Post 1', content: 'Content 1', user_id: 'user1' },
    { id: 'post2', title: 'Test Post 2', content: 'Content 2', user_id: 'user2' }
  ]
};
