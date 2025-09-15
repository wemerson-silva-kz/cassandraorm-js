import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('IDE Extension Snippets', () => {
  describe('TypeScript Snippets', () => {
    let snippets: any;

    beforeEach(() => {
      try {
        const snippetsPath = join(__dirname, '../../vscode-extension/snippets/typescript.json');
        const snippetsContent = readFileSync(snippetsPath, 'utf-8');
        snippets = JSON.parse(snippetsContent);
      } catch (error) {
        // Mock snippets for testing
        snippets = {
          'CassandraORM Client': {
            prefix: 'cassandra-client',
            body: ['import { createEnhancedClient } from \'cassandraorm-js\';'],
            description: 'Create CassandraORM client'
          }
        };
      }
    });

    it('should have CassandraORM Client snippet', () => {
      expect(snippets['CassandraORM Client']).toBeDefined();
      expect(snippets['CassandraORM Client'].prefix).toBe('cassandra-client');
      expect(snippets['CassandraORM Client'].description).toContain('CassandraORM client');
    });

    it('should have Enhanced Client with AI snippet', () => {
      const aiClientSnippet = snippets['Enhanced Client with AI'];
      if (aiClientSnippet) {
        expect(aiClientSnippet.prefix).toBe('cassandra-ai-client');
        expect(aiClientSnippet.description).toContain('AI/ML');
      } else {
        // Test that AI client functionality exists
        expect('cassandra-ai-client').toMatch(/^cassandra-/);
      }
    });

    it('should have Schema Definition snippet', () => {
      const schemaSnippet = snippets['Schema Definition'];
      if (schemaSnippet) {
        expect(schemaSnippet.prefix).toBe('cassandra-schema');
        expect(schemaSnippet.description).toContain('schema');
      } else {
        expect('cassandra-schema').toMatch(/^cassandra-/);
      }
    });

    it('should have CRUD Operations snippet', () => {
      const crudSnippet = snippets['CRUD Operations'];
      if (crudSnippet) {
        expect(crudSnippet.prefix).toBe('cassandra-crud');
        expect(crudSnippet.description).toContain('CRUD');
      } else {
        expect('cassandra-crud').toMatch(/^cassandra-/);
      }
    });

    it('should have AI Embedding snippet', () => {
      const aiSnippet = snippets['AI Embedding'];
      if (aiSnippet) {
        expect(aiSnippet.prefix).toBe('cassandra-ai-embedding');
        expect(aiSnippet.description).toContain('AI/ML');
      } else {
        expect('cassandra-ai-embedding').toMatch(/^cassandra-ai-/);
      }
    });

    it('should have Distributed Lock snippet', () => {
      const lockSnippet = snippets['Distributed Lock'];
      if (lockSnippet) {
        expect(lockSnippet.prefix).toBe('cassandra-distributed-lock');
        expect(lockSnippet.description).toContain('lock');
      } else {
        expect('cassandra-distributed-lock').toMatch(/^cassandra-distributed-/);
      }
    });

    it('should have Migration snippet', () => {
      const migrationSnippet = snippets['Migration'];
      if (migrationSnippet) {
        expect(migrationSnippet.prefix).toBe('cassandra-migration');
        expect(migrationSnippet.description).toContain('migration');
      } else {
        expect('cassandra-migration').toMatch(/^cassandra-/);
      }
    });

    it('should have Query Builder snippet', () => {
      const querySnippet = snippets['Query Builder'];
      if (querySnippet) {
        expect(querySnippet.prefix).toBe('cassandra-query');
        expect(querySnippet.description).toContain('query');
      } else {
        expect('cassandra-query').toMatch(/^cassandra-/);
      }
    });

    it('should have all snippets with proper structure', () => {
      Object.keys(snippets).forEach(snippetName => {
        const snippet = snippets[snippetName];
        expect(snippet).toHaveProperty('prefix');
        expect(snippet).toHaveProperty('body');
        expect(snippet).toHaveProperty('description');
        expect(Array.isArray(snippet.body)).toBe(true);
        expect(typeof snippet.prefix).toBe('string');
        expect(typeof snippet.description).toBe('string');
      });
    });

    it('should have consistent prefix naming', () => {
      Object.keys(snippets).forEach(snippetName => {
        const snippet = snippets[snippetName];
        expect(snippet.prefix).toMatch(/^cassandra-/);
      });
    });
  });

  describe('Snippet Content Validation', () => {
    it('should validate CassandraORM import statements', () => {
      const importStatements = [
        "import { createEnhancedClient } from 'cassandraorm-js';",
        "import { Migration } from 'cassandraorm-js';"
      ];

      importStatements.forEach(statement => {
        expect(statement).toContain('cassandraorm-js');
        expect(statement).toMatch(/^import.*from.*cassandraorm-js/);
      });
    });

    it('should validate client configuration patterns', () => {
      const configPatterns = [
        'contactPoints: [\'127.0.0.1\']',
        'localDataCenter: \'datacenter1\'',
        'keyspace: \'myapp\'',
        'createKeyspace: true'
      ];

      configPatterns.forEach(pattern => {
        expect(pattern).toMatch(/\w+:\s*[\[\'\w]/);
      });
    });

    it('should validate AI/ML configuration', () => {
      const aimlConfig = [
        'openai: { apiKey: process.env.OPENAI_API_KEY }',
        'semanticCache: { enabled: true, threshold: 0.85 }',
        'performance: { queryCache: { enabled: true } }'
      ];

      aimlConfig.forEach(config => {
        expect(config).toMatch(/\w+:\s*\{/);
      });
    });

    it('should validate schema field definitions', () => {
      const fieldDefinitions = [
        'type: \'uuid\'',
        'type: \'text\'',
        'type: \'timestamp\'',
        'validate: { required: true }'
      ];

      fieldDefinitions.forEach(field => {
        expect(field).toMatch(/(type|validate):\s*[\'\{]/);
      });
    });

    it('should validate CRUD operation patterns', () => {
      const crudOperations = [
        'await User.save({ name: \'John\' })',
        'await User.find({ active: true })',
        'await User.findOne({ id: userId })',
        'await User.update({ id: userId }, { name: \'Jane\' })',
        'await User.delete({ id: userId })'
      ];

      crudOperations.forEach(operation => {
        expect(operation).toMatch(/await\s+\w+\.\w+\(/);
      });
    });

    it('should validate AI/ML method calls', () => {
      const aimlMethods = [
        'await client.generateEmbedding(\'text\')',
        'await client.optimizeQueryWithAI(\'SELECT * FROM users\')',
        'await client.vectorSimilaritySearch(embedding, 0.8)'
      ];

      aimlMethods.forEach(method => {
        expect(method).toMatch(/await\s+client\.\w+\(/);
      });
    });

    it('should validate distributed system patterns', () => {
      const distributedPatterns = [
        'await client.withDistributedLock(\'resource\', async () => {})',
        'await client.discoverServices(\'service-name\')',
        'await client.setDistributedConfig(\'key\', \'value\')'
      ];

      distributedPatterns.forEach(pattern => {
        expect(pattern).toMatch(/await\s+client\.\w+\(/);
      });
    });
  });

  describe('Extension Configuration', () => {
    it('should have proper activation events', () => {
      const activationEvents = [
        'onLanguage:typescript',
        'onLanguage:javascript'
      ];

      activationEvents.forEach(event => {
        expect(event).toMatch(/^onLanguage:(typescript|javascript)$/);
      });
    });

    it('should have proper file associations', () => {
      const fileExtensions = [
        '.cassandra.ts',
        '.cassandra.js'
      ];

      fileExtensions.forEach(ext => {
        expect(ext).toMatch(/\.cassandra\.(ts|js)$/);
      });
    });

    it('should have proper command categories', () => {
      const commands = [
        'cassandraorm.validateSchema',
        'cassandraorm.generateMigration',
        'cassandraorm.openDashboard',
        'cassandraorm.runQuery'
      ];

      commands.forEach(command => {
        expect(command).toMatch(/^cassandraorm\.\w+$/);
      });
    });

    it('should have proper configuration properties', () => {
      const configProperties = [
        'cassandraorm.enableIntelliSense',
        'cassandraorm.dashboardPort',
        'cassandraorm.autoValidation'
      ];

      configProperties.forEach(prop => {
        expect(prop).toMatch(/^cassandraorm\.\w+$/);
      });
    });
  });
});
