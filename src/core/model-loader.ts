export class ModelLoader {
  private static directory: string = './models';

  static setDirectory(dir: string): void {
    this.directory = dir;
  }

  static bind(client: any, modelName: string, schema: any): any {
    // Synchronous binding
    return client.loadSchema(modelName, schema);
  }

  static async bindAsync(client: any, modelName: string, schema: any): Promise<any> {
    // Asynchronous binding
    return await client.loadSchema(modelName, schema);
  }

  static getDirectory(): string {
    return this.directory;
  }
}
