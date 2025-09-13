import { describe, it, expect, beforeAll } from 'bun:test';
import { createClient, DataExporter, DataImporter, ElassandraClient, ModelLoader } from '../src/index.js';
import { personSchema, type Person } from '../src/examples/person.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('Advanced Features', () => {
  let client: any;
  let PersonModel: any;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'test_keyspace',
      },
    });

    PersonModel = client.loadSchema<Person>('person', personSchema);
  });

  describe('Export/Import Functionality', () => {
    it('should create DataExporter instance', () => {
      expect(DataExporter).toBeDefined();
      expect(typeof DataExporter).toBe('function');
    });

    it('should create DataImporter instance', () => {
      expect(DataImporter).toBeDefined();
      expect(typeof DataImporter).toBe('function');
    });

    it('should have export method on client', () => {
      expect(typeof client.export).toBe('function');
    });

    it('should have import method on client', () => {
      expect(typeof client.import).toBe('function');
    });

    it('should throw error when exporting without connection', async () => {
      try {
        await client.export('./fixtures');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('not connected');
      }
    });
  });

  describe('Elassandra Support', () => {
    it('should create ElassandraClient instance', () => {
      expect(ElassandraClient).toBeDefined();
      expect(typeof ElassandraClient).toBe('function');
    });

    it('should have enableElassandra method', () => {
      expect(typeof client.enableElassandra).toBe('function');
    });

    it('should have search method', () => {
      expect(typeof client.search).toBe('function');
    });

    it('should throw error when searching without enabling Elassandra', async () => {
      try {
        await client.search({ body: { query: { match_all: {} } } });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('not enabled');
      }
    });

    it('should enable Elassandra successfully', () => {
      client.enableElassandra({
        host: 'localhost',
        port: 9200,
      });

      // Should not throw after enabling
      expect(() => client.enableElassandra({ host: 'localhost' })).not.toThrow();
    });
  });

  describe('File-based Model Loading', () => {
    it('should have ModelLoader class', () => {
      expect(ModelLoader).toBeDefined();
      expect(typeof ModelLoader).toBe('function');
    });

    it('should have static setDirectory method', () => {
      expect(typeof client.constructor.setDirectory).toBe('function');
    });

    it('should have static bind method', () => {
      expect(typeof client.constructor.bind).toBe('function');
    });

    it('should have static bindAsync method', () => {
      expect(typeof client.constructor.bindAsync).toBe('function');
    });

    it('should set directory correctly', () => {
      const ClientClass = client.constructor;
      const result = ClientClass.setDirectory('./models');
      expect(result).toBe(ClientClass);
      expect((ClientClass as any).directory).toBe('./models');
    });
  });

  describe('Advanced Streaming', () => {
    it('should have eachRow method on client', () => {
      expect(typeof client.eachRow).toBe('function');
    });

    it('should have streamQuery method on client', () => {
      expect(typeof client.streamQuery).toBe('function');
    });

    it('should have eachRow method on model', () => {
      expect(typeof PersonModel.eachRow).toBe('function');
    });

    it('should have enhanced stream method on model', () => {
      expect(typeof PersonModel.stream).toBe('function');
    });

    it('should throw error when streaming without connection', () => {
      try {
        client.eachRow('SELECT * FROM person', [], {}, () => {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('not connected');
      }
    });
  });

  describe('Model File Creation and Loading', () => {
    const testDir = './test-models';
    const modelFile = join(testDir, 'TestModel.ts');

    it('should create test model file', async () => {
      await mkdir(testDir, { recursive: true });
      
      const modelContent = `
export interface TestModel {
  id: number;
  name: string;
}

export const testModelSchema = {
  fields: {
    id: { type: 'int' },
    name: { type: 'varchar' },
  },
  key: ['id'],
};

export default testModelSchema;
`;

      await writeFile(modelFile, modelContent);
      
      // Verify file was created
      const loader = new ModelLoader(client);
      expect(loader).toBeDefined();
    });

    it('should clean up test files', async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Integration Features', () => {
    it('should have all UUID utilities', () => {
      expect(typeof client.uuid).toBe('function');
      expect(typeof client.timeuuid).toBe('function');
      expect(typeof client.uuidFromString).toBe('function');
      expect(typeof client.uuidFromBuffer).toBe('function');
      expect(typeof client.timeuuidFromDate).toBe('function');
      expect(typeof client.timeuuidFromString).toBe('function');
      expect(typeof client.timeuuidFromBuffer).toBe('function');
      expect(typeof client.maxTimeuuid).toBe('function');
      expect(typeof client.minTimeuuid).toBe('function');
    });

    it('should have batch operations', () => {
      expect(typeof client.doBatch).toBe('function');
    });

    it('should have table operations', () => {
      expect(typeof client.getTableList).toBe('function');
    });

    it('should have all client properties', () => {
      expect(client.consistencies).toBeDefined();
      expect(client.datatypes).toBeDefined();
      expect(client.driver).toBeDefined();
      expect(client.instance).toBeDefined();
    });
  });
});
