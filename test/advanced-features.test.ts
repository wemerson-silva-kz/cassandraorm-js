import { describe, it, expect } from '@jest/globals';
import { DataExporter, DataImporter, ElassandraClient, ModelLoader } from '../src/index.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('Advanced Features', () => {
  describe('Export/Import Functionality', () => {
    it('should create DataExporter instance', () => {
      expect(DataExporter).toBeDefined();
      expect(typeof DataExporter).toBe('function');
    });

    it('should create DataImporter instance', () => {
      expect(DataImporter).toBeDefined();
      expect(typeof DataImporter).toBe('function');
    });
  });

  describe('Elassandra Support', () => {
    it('should create ElassandraClient instance', () => {
      expect(ElassandraClient).toBeDefined();
      expect(typeof ElassandraClient).toBe('function');
    });
  });

  describe('File-based Model Loading', () => {
    it('should have ModelLoader class', () => {
      expect(ModelLoader).toBeDefined();
      expect(typeof ModelLoader).toBe('function');
    });

    it('should have static methods', () => {
      expect(typeof ModelLoader.setDirectory).toBe('function');
      expect(typeof ModelLoader.bind).toBe('function');
      expect(typeof ModelLoader.bindAsync).toBe('function');
    });
  });

  describe('Model File Creation', () => {
    const testDir = './test-models';
    const modelFile = join(testDir, 'TestModel.ts');

    it('should create test model file', async () => {
      await mkdir(testDir, { recursive: true });
      
      const modelContent = `export const testModelSchema = { fields: { id: 'int' }, key: ['id'] };`;
      await writeFile(modelFile, modelContent);
      
      const fs = await import('fs/promises');
      const stats = await fs.stat(modelFile);
      expect(stats.isFile()).toBe(true);
    });

    it('should clean up test files', async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });
});
