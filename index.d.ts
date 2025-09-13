export interface ConnectionOptions {
  contactPoints?: string[];
  localDataCenter?: string;
  keyspace?: string;
  authProvider?: any;
  sslOptions?: any;
}

export interface Schema {
  [key: string]: string;
}

export interface ModelOptions {
  key?: string[];
  indexes?: string[];
  clustering_order?: { [key: string]: 'ASC' | 'DESC' };
}

export interface QueryOptions {
  limit?: number;
  allow_filtering?: boolean;
  consistency?: number;
}

export class CassandraORM {
  constructor(options: ConnectionOptions);
  connect(): Promise<void>;
  createKeyspace(): Promise<void>;
  model(name: string, schema: Schema, options?: ModelOptions): Model;
  uuid(): string;
  shutdown(): Promise<void>;
}

export class Model {
  constructor(client: any, name: string, schema: Schema, options: ModelOptions);
  createTable(): Promise<void>;
  create(data: any): Promise<any>;
  find(where?: any, options?: QueryOptions): Promise<any[]>;
  findOne(where?: any, options?: QueryOptions): Promise<any | null>;
  update(where: any, data: any): Promise<void>;
  delete(where: any): Promise<void>;
}
