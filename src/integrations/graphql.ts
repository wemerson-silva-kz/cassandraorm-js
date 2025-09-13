export interface GraphQLConfig {
  enabled?: boolean;
  introspection?: boolean;
  playground?: boolean;
  mutations?: ('create' | 'update' | 'delete')[];
  subscriptions?: ('onCreate' | 'onUpdate' | 'onDelete')[];
  relations?: boolean;
  pagination?: boolean;
}

export interface GraphQLField {
  name: string;
  type: string;
  nullable?: boolean;
  list?: boolean;
  description?: string;
  resolver?: (parent: any, args: any, context: any) => any;
}

export interface GraphQLType {
  name: string;
  fields: GraphQLField[];
  description?: string;
}

export class GraphQLSchemaGenerator {
  private config: Required<GraphQLConfig>;
  private types = new Map<string, GraphQLType>();
  private resolvers = new Map<string, any>();

  constructor(config: GraphQLConfig = {}) {
    this.config = {
      enabled: true,
      introspection: true,
      playground: true,
      mutations: ['create', 'update', 'delete'],
      subscriptions: ['onCreate', 'onUpdate', 'onDelete'],
      relations: true,
      pagination: true,
      ...config
    };
  }

  addModel(name: string, schema: any): this {
    if (!this.config.enabled) return this;

    const graphqlType = this.convertSchemaToGraphQL(name, schema);
    this.types.set(name, graphqlType);
    this.generateResolvers(name, schema);
    
    return this;
  }

  private convertSchemaToGraphQL(name: string, schema: any): GraphQLType {
    const fields: GraphQLField[] = [];

    // Convert schema fields
    Object.entries(schema.fields || {}).forEach(([fieldName, fieldDef]: [string, any]) => {
      const field = this.convertFieldToGraphQL(fieldName, fieldDef);
      if (field) fields.push(field);
    });

    // Add relation fields
    if (this.config.relations && schema.relations) {
      Object.entries(schema.relations).forEach(([relationName, relationDef]: [string, any]) => {
        const field = this.convertRelationToGraphQL(relationName, relationDef);
        if (field) fields.push(field);
      });
    }

    return {
      name: this.capitalize(name),
      fields,
      description: `Generated GraphQL type for ${name}`
    };
  }

  private convertFieldToGraphQL(name: string, fieldDef: any): GraphQLField | null {
    const type = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
    const graphqlType = this.mapCassandraTypeToGraphQL(type);
    
    if (!graphqlType) return null;

    return {
      name,
      type: graphqlType,
      nullable: !fieldDef.validate?.required,
      description: fieldDef.description
    };
  }

  private convertRelationToGraphQL(name: string, relationDef: any): GraphQLField | null {
    const relatedType = this.capitalize(relationDef.model);
    
    return {
      name,
      type: relatedType,
      list: relationDef.type === 'hasMany',
      nullable: relationDef.type !== 'hasMany',
      description: `${relationDef.type} relation to ${relatedType}`
    };
  }

  private mapCassandraTypeToGraphQL(cassandraType: string): string | null {
    const typeMap: Record<string, string> = {
      'text': 'String',
      'varchar': 'String',
      'ascii': 'String',
      'int': 'Int',
      'bigint': 'String', // GraphQL doesn't have BigInt
      'smallint': 'Int',
      'tinyint': 'Int',
      'float': 'Float',
      'double': 'Float',
      'decimal': 'Float',
      'boolean': 'Boolean',
      'uuid': 'ID',
      'timeuuid': 'ID',
      'timestamp': 'String', // ISO string
      'date': 'String',
      'time': 'String',
      'inet': 'String',
      'blob': 'String' // Base64 encoded
    };

    // Handle collections
    if (cassandraType.startsWith('list<')) {
      const innerType = cassandraType.match(/list<(.+)>/)?.[1];
      const graphqlInnerType = innerType ? this.mapCassandraTypeToGraphQL(innerType) : null;
      return graphqlInnerType ? `[${graphqlInnerType}]` : null;
    }

    if (cassandraType.startsWith('set<')) {
      const innerType = cassandraType.match(/set<(.+)>/)?.[1];
      const graphqlInnerType = innerType ? this.mapCassandraTypeToGraphQL(innerType) : null;
      return graphqlInnerType ? `[${graphqlInnerType}]` : null;
    }

    if (cassandraType.startsWith('map<')) {
      return 'JSON'; // Custom scalar for maps
    }

    return typeMap[cassandraType] || null;
  }

  private generateResolvers(name: string, schema: any): void {
    const typeName = this.capitalize(name);
    const resolvers: any = {};

    // Query resolvers
    resolvers[`${name}`] = async (parent: any, args: any, context: any) => {
      const { id } = args;
      // Implementation would use the actual data access layer
      return context.dataSources[name].findById(id);
    };

    resolvers[`${name}s`] = async (parent: any, args: any, context: any) => {
      const { where, limit, offset } = args;
      return context.dataSources[name].find({ where, limit, offset });
    };

    // Mutation resolvers
    if (this.config.mutations.includes('create')) {
      resolvers[`create${typeName}`] = async (parent: any, args: any, context: any) => {
        const { input } = args;
        return context.dataSources[name].create(input);
      };
    }

    if (this.config.mutations.includes('update')) {
      resolvers[`update${typeName}`] = async (parent: any, args: any, context: any) => {
        const { id, input } = args;
        return context.dataSources[name].update(id, input);
      };
    }

    if (this.config.mutations.includes('delete')) {
      resolvers[`delete${typeName}`] = async (parent: any, args: any, context: any) => {
        const { id } = args;
        return context.dataSources[name].delete(id);
      };
    }

    // Relation resolvers
    if (this.config.relations && schema.relations) {
      Object.entries(schema.relations).forEach(([relationName, relationDef]: [string, any]) => {
        resolvers[relationName] = async (parent: any, args: any, context: any) => {
          const relatedModel = relationDef.model;
          const foreignKey = relationDef.foreignKey;
          const localKey = relationDef.localKey || 'id';
          
          if (relationDef.type === 'hasMany') {
            return context.dataSources[relatedModel].findByForeignKey(foreignKey, parent[localKey]);
          } else {
            return context.dataSources[relatedModel].findById(parent[foreignKey]);
          }
        };
      });
    }

    this.resolvers.set(name, resolvers);
  }

  generateSchema(): string {
    if (!this.config.enabled) return '';

    const typeDefs: string[] = [];

    // Add custom scalars
    typeDefs.push('scalar JSON');
    typeDefs.push('scalar DateTime');

    // Generate types
    this.types.forEach(type => {
      typeDefs.push(this.generateTypeDefinition(type));
    });

    // Generate input types for mutations
    this.types.forEach(type => {
      typeDefs.push(this.generateInputType(type));
    });

    // Generate Query type
    typeDefs.push(this.generateQueryType());

    // Generate Mutation type
    if (this.config.mutations.length > 0) {
      typeDefs.push(this.generateMutationType());
    }

    // Generate Subscription type
    if (this.config.subscriptions.length > 0) {
      typeDefs.push(this.generateSubscriptionType());
    }

    return typeDefs.join('\n\n');
  }

  private generateTypeDefinition(type: GraphQLType): string {
    const fields = type.fields.map(field => {
      let fieldDef = `  ${field.name}: `;
      
      if (field.list) {
        fieldDef += `[${field.type}]`;
      } else {
        fieldDef += field.type;
      }
      
      if (!field.nullable) {
        fieldDef += '!';
      }

      return fieldDef;
    }).join('\n');

    return `type ${type.name} {\n${fields}\n}`;
  }

  private generateInputType(type: GraphQLType): string {
    const fields = type.fields
      .filter(field => !field.resolver) // Exclude computed fields
      .map(field => {
        let fieldDef = `  ${field.name}: `;
        
        if (field.list) {
          fieldDef += `[${field.type}]`;
        } else {
          fieldDef += field.type;
        }

        return fieldDef;
      }).join('\n');

    return `input ${type.name}Input {\n${fields}\n}`;
  }

  private generateQueryType(): string {
    const queries: string[] = [];

    this.types.forEach((type, name) => {
      queries.push(`  ${name}(id: ID!): ${type.name}`);
      
      if (this.config.pagination) {
        queries.push(`  ${name}s(where: JSON, limit: Int, offset: Int): [${type.name}]`);
      } else {
        queries.push(`  ${name}s(where: JSON): [${type.name}]`);
      }
    });

    return `type Query {\n${queries.join('\n')}\n}`;
  }

  private generateMutationType(): string {
    const mutations: string[] = [];

    this.types.forEach((type, name) => {
      const typeName = type.name;
      
      if (this.config.mutations.includes('create')) {
        mutations.push(`  create${typeName}(input: ${typeName}Input!): ${typeName}`);
      }
      
      if (this.config.mutations.includes('update')) {
        mutations.push(`  update${typeName}(id: ID!, input: ${typeName}Input!): ${typeName}`);
      }
      
      if (this.config.mutations.includes('delete')) {
        mutations.push(`  delete${typeName}(id: ID!): Boolean`);
      }
    });

    return `type Mutation {\n${mutations.join('\n')}\n}`;
  }

  private generateSubscriptionType(): string {
    const subscriptions: string[] = [];

    this.types.forEach((type, name) => {
      const typeName = type.name;
      
      if (this.config.subscriptions.includes('onCreate')) {
        subscriptions.push(`  ${name}Created: ${typeName}`);
      }
      
      if (this.config.subscriptions.includes('onUpdate')) {
        subscriptions.push(`  ${name}Updated: ${typeName}`);
      }
      
      if (this.config.subscriptions.includes('onDelete')) {
        subscriptions.push(`  ${name}Deleted: ID`);
      }
    });

    return `type Subscription {\n${subscriptions.join('\n')}\n}`;
  }

  getResolvers(): Record<string, any> {
    const allResolvers: Record<string, any> = {};

    this.resolvers.forEach((resolvers, name) => {
      Object.assign(allResolvers, resolvers);
    });

    return allResolvers;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// GraphQL Data Source for Cassandra
export class CassandraDataSource {
  private client: any;
  private keyspace: string;
  private tableName: string;

  constructor(client: any, keyspace: string, tableName: string) {
    this.client = client;
    this.keyspace = keyspace;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<any> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.tableName} WHERE id = ?`,
      [id],
      { prepare: true }
    );
    return result.rows[0] || null;
  }

  async find(options: { where?: any; limit?: number; offset?: number } = {}): Promise<any[]> {
    let query = `SELECT * FROM ${this.keyspace}.${this.tableName}`;
    const params: any[] = [];

    if (options.where) {
      const conditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    query += ' ALLOW FILTERING';

    const result = await this.client.execute(query, params, { prepare: true });
    return result.rows;
  }

  async create(input: any): Promise<any> {
    const fields = Object.keys(input);
    const values = Object.values(input);
    const placeholders = fields.map(() => '?').join(', ');

    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values,
      { prepare: true }
    );

    return input;
  }

  async update(id: string, input: any): Promise<any> {
    const fields = Object.keys(input);
    const values = Object.values(input);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await this.client.execute(
      `UPDATE ${this.keyspace}.${this.tableName} SET ${setClause} WHERE id = ?`,
      [...values, id],
      { prepare: true }
    );

    return { id, ...input };
  }

  async delete(id: string): Promise<boolean> {
    await this.client.execute(
      `DELETE FROM ${this.keyspace}.${this.tableName} WHERE id = ?`,
      [id],
      { prepare: true }
    );

    return true;
  }

  async findByForeignKey(foreignKey: string, value: any): Promise<any[]> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.tableName} WHERE ${foreignKey} = ? ALLOW FILTERING`,
      [value],
      { prepare: true }
    );
    return result.rows;
  }
}
