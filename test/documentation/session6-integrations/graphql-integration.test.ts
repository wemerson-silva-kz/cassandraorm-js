import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';
import { GraphQLSchemaGenerator } from '../../../src/integrations/graphql.js';

describe('Session 6: GraphQL Integration', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    if (client) {
      await TestHelpers.cleanup(client);
    }
  });

  describe('Schema Generation', () => {
    it('should generate GraphQL schema from models', () => {
      const generator = new GraphQLSchemaGenerator();
      
      generator.addModel('users', {
        fields: {
          id: 'uuid',
          name: 'text',
          email: 'text'
        },
        key: ['id']
      });

      const schema = generator.generateSchema();
      expect(schema).toContain('type User');
      expect(schema).toContain('id: ID!');
      expect(schema).toContain('name: String');
      expect(schema).toContain('email: String');
    });

    it('should generate resolvers', () => {
      const generator = new GraphQLSchemaGenerator();
      generator.addModel('users', {
        fields: { id: 'uuid', name: 'text' },
        key: ['id']
      });

      const resolvers = generator.generateResolvers();
      expect(resolvers.Query).toBeDefined();
      expect(resolvers.Query.users).toBeDefined();
      expect(resolvers.Query.user).toBeDefined();
    });
  });
});
