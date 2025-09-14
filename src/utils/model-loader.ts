import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import type { ModelSchema } from '../core/types.js';
import type { CassandraClient } from '../core/client.js';

export interface ModelFile {
  name: string;
  path: string;
  schema: ModelSchema;
}

export class ModelLoader {
  constructor(private client: CassandraClient) {}

  async loadModelsFromDirectory(directory: string): Promise<Map<string, any>> {
    const models = new Map();
    const files = await this.scanDirectory(directory);

    for (const file of files) {
      if (this.isModelFile(file.name)) {
        const modelName = this.extractModelName(file.name);
        const modelModule = await import(file.path);
        const schema = modelModule.default || modelModule[`${modelName}Schema`] || modelModule.schema;
        
        if (schema) {
          const ModelClass = this.client.loadSchema(modelName, schema);
          models.set(modelName, ModelClass);
        }
      }
    }

    return models;
  }

  async syncModelsFromDirectory(directory: string): Promise<void> {
    const models = await this.loadModelsFromDirectory(directory);
    
    // Sync all models to database
    const syncPromises = Array.from(models.values()).map(Model => 
      new Promise<void>((resolve, reject) => {
        if (Model.syncDB) {
          Model.syncDB((err?: Error) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      })
    );

    await Promise.all(syncPromises);
  }

  private async scanDirectory(directory: string): Promise<{ name: string; path: string }[]> {
    const files: { name: string; path: string }[] = [];
    
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push({ name: entry.name, path: fullPath });
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  private isModelFile(fileName: string): boolean {
    const validExtensions = ['.js', '.ts', '.mjs', '.cjs'];
    const hasValidExtension = validExtensions.includes(extname(fileName));
    const isModelFile = fileName.toLowerCase().includes('model');
    
    return hasValidExtension && isModelFile;
  }

  private extractModelName(fileName: string): string {
    // Remove extension
    let name = fileName.replace(/\.[^/.]+$/, '');
    
    // Remove 'Model' suffix if present
    name = name.replace(/Model$/i, '');
    
    // Convert to lowercase for consistency
    return name.toLowerCase();
  }

  static async bind(client: CassandraClient, directory: string): Promise<Map<string, any>> {
    const loader = new ModelLoader(client);
    await client.connect();
    const models = await loader.loadModelsFromDirectory(directory);
    await loader.syncModelsFromDirectory(directory);
    return models;
  }
}
