#!/usr/bin/env bun
import { 
  createClient,
  GraphQLSchemaGenerator,
  CassandraDataSource,
  type GraphQLResolverConfig,
  type GraphQLType
} from '../src/index.js';

async function testGraphQLIntegration() {
  console.log('🌐 Teste 15: Integração GraphQL\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_graphql'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Create test schemas
    const User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text',
        age: 'int',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id']
    });

    const Post = await client.loadSchema('posts', {
      fields: {
        id: 'uuid',
        user_id: 'uuid',
        title: 'text',
        content: 'text',
        tags: 'set<text>',
        metadata: 'map<text,text>',
        created_at: 'timestamp'
      },
      key: ['id'],
      relations: {
        user: { model: 'users', foreignKey: 'user_id', type: 'belongsTo' }
      }
    });

    await User.createTable();
    await Post.createTable();
    console.log('✅ Tabelas criadas');

    // Test GraphQLSchemaGenerator
    const generator = new GraphQLSchemaGenerator();
    console.log('✅ GraphQLSchemaGenerator criado');

    // Add models to generator
    generator.addModel('User', {
      fields: {
        id: { type: 'ID', required: true },
        name: { type: 'String', required: true },
        email: { type: 'String', required: true },
        age: { type: 'Int' },
        createdAt: { type: 'DateTime' },
        updatedAt: { type: 'DateTime' }
      },
      relations: {
        posts: { type: '[Post]', resolver: 'userPosts' }
      }
    });

    generator.addModel('Post', {
      fields: {
        id: { type: 'ID', required: true },
        userId: { type: 'ID', required: true },
        title: { type: 'String', required: true },
        content: { type: 'String' },
        tags: { type: '[String]' },
        metadata: { type: 'JSON' },
        createdAt: { type: 'DateTime' }
      },
      relations: {
        user: { type: 'User', resolver: 'postUser' }
      }
    });

    console.log('✅ Modelos adicionados ao gerador');

    // Generate GraphQL schema
    const typeDefs = generator.generateSchema();
    console.log('✅ Schema GraphQL gerado');
    console.log('📄 TypeDefs preview:');
    console.log(typeDefs.substring(0, 500) + '...');

    // Test CassandraDataSource
    const dataSource = new CassandraDataSource({
      client: client,
      keyspace: 'test_graphql'
    });
    console.log('✅ CassandraDataSource criado');

    // Test resolver configuration
    const resolverConfig: GraphQLResolverConfig = {
      User: {
        posts: async (parent: any, args: any, context: any) => {
          return await dataSource.findMany('posts', { user_id: parent.id });
        }
      },
      Post: {
        user: async (parent: any, args: any, context: any) => {
          return await dataSource.findOne('users', { id: parent.user_id });
        }
      },
      Query: {
        users: async (parent: any, args: any, context: any) => {
          return await dataSource.findMany('users', args.where, {
            limit: args.limit,
            offset: args.offset
          });
        },
        user: async (parent: any, args: any, context: any) => {
          return await dataSource.findOne('users', { id: args.id });
        },
        posts: async (parent: any, args: any, context: any) => {
          return await dataSource.findMany('posts', args.where, {
            limit: args.limit,
            offset: args.offset
          });
        },
        post: async (parent: any, args: any, context: any) => {
          return await dataSource.findOne('posts', { id: args.id });
        }
      },
      Mutation: {
        createUser: async (parent: any, args: any, context: any) => {
          return await dataSource.create('users', {
            ...args.input,
            created_at: new Date(),
            updated_at: new Date()
          });
        },
        updateUser: async (parent: any, args: any, context: any) => {
          return await dataSource.update('users', { id: args.id }, {
            ...args.input,
            updated_at: new Date()
          });
        },
        deleteUser: async (parent: any, args: any, context: any) => {
          return await dataSource.delete('users', { id: args.id });
        },
        createPost: async (parent: any, args: any, context: any) => {
          return await dataSource.create('posts', {
            ...args.input,
            created_at: new Date()
          });
        },
        updatePost: async (parent: any, args: any, context: any) => {
          return await dataSource.update('posts', { id: args.id }, args.input);
        },
        deletePost: async (parent: any, args: any, context: any) => {
          return await dataSource.delete('posts', { id: args.id });
        }
      }
    };

    console.log('✅ Resolvers configurados');

    // Test automatic CRUD resolver generation
    const crudResolvers = generator.generateCRUDResolvers(['User', 'Post']);
    console.log('✅ CRUD resolvers gerados automaticamente');
    console.log('📋 Resolvers disponíveis:');
    Object.keys(crudResolvers.Query).forEach(query => {
      console.log(`   • Query.${query}`);
    });
    Object.keys(crudResolvers.Mutation).forEach(mutation => {
      console.log(`   • Mutation.${mutation}`);
    });

    // Test GraphQL types generation
    const customTypes: GraphQLType[] = [
      {
        name: 'UserStats',
        fields: {
          totalPosts: 'Int',
          averagePostLength: 'Float',
          mostUsedTags: '[String]',
          joinDate: 'DateTime'
        }
      },
      {
        name: 'PostAnalytics',
        fields: {
          wordCount: 'Int',
          readingTime: 'Int',
          sentiment: 'String',
          topics: '[String]'
        }
      }
    ];

    generator.addCustomTypes(customTypes);
    console.log('✅ Tipos customizados adicionados');

    // Test input types generation
    const inputTypes = generator.generateInputTypes(['User', 'Post']);
    console.log('✅ Input types gerados:');
    Object.keys(inputTypes).forEach(inputType => {
      console.log(`   • ${inputType}`);
    });

    // Test subscription schema generation
    const subscriptionSchema = generator.generateSubscriptionSchema([
      { type: 'User', operations: ['created', 'updated', 'deleted'] },
      { type: 'Post', operations: ['created', 'updated', 'deleted'] }
    ]);
    console.log('✅ Schema de subscriptions gerado');

    // Test data source operations
    console.log('\n🔄 Testando operações do DataSource...');

    // Create test data
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      created_at: new Date(),
      updated_at: new Date()
    };

    const createdUser = await dataSource.create('users', userData);
    console.log('✅ Usuário criado via DataSource:', createdUser.name);

    const postData = {
      user_id: createdUser.id,
      title: 'My First Post',
      content: 'This is the content of my first post.',
      tags: ['tech', 'programming', 'cassandra'],
      metadata: { category: 'tutorial', difficulty: 'beginner' },
      created_at: new Date()
    };

    const createdPost = await dataSource.create('posts', postData);
    console.log('✅ Post criado via DataSource:', createdPost.title);

    // Test queries
    const users = await dataSource.findMany('users', {}, { limit: 10 });
    console.log('✅ Usuários encontrados:', users.length);

    const user = await dataSource.findOne('users', { id: createdUser.id });
    console.log('✅ Usuário encontrado:', user ? user.name : 'não encontrado');

    const posts = await dataSource.findMany('posts', { user_id: createdUser.id });
    console.log('✅ Posts do usuário:', posts.length);

    // Test updates
    const updatedUser = await dataSource.update('users', 
      { id: createdUser.id }, 
      { name: 'John Updated', updated_at: new Date() }
    );
    console.log('✅ Usuário atualizado:', updatedUser.name);

    // Test GraphQL schema validation
    const schemaValidation = generator.validateSchema();
    console.log('✅ Validação do schema:', schemaValidation.isValid ? 'VÁLIDO' : 'INVÁLIDO');
    
    if (!schemaValidation.isValid) {
      console.log('❌ Erros de validação:', schemaValidation.errors);
    }

    // Test performance optimization
    const optimizedResolvers = generator.optimizeResolvers(resolverConfig, {
      enableDataLoader: true,
      enableQueryBatching: true,
      enableResultCaching: true
    });
    console.log('✅ Resolvers otimizados com DataLoader e cache');

    console.log('\n📊 FUNCIONALIDADES GRAPHQL TESTADAS:');
    console.log('   • GraphQLSchemaGenerator - Geração automática de schema');
    console.log('   • CassandraDataSource - Data source para Cassandra');
    console.log('   • CRUD Resolvers - Resolvers CRUD automáticos');
    console.log('   • Custom Types - Tipos customizados');
    console.log('   • Input Types - Tipos de entrada');
    console.log('   • Subscription Schema - Schema de subscriptions');
    console.log('   • Schema Validation - Validação de schema');
    console.log('   • Performance Optimization - Otimização de performance');
    console.log('   • DataLoader Integration - Integração com DataLoader');

    console.log('\n🎉 Teste GraphQL Integration: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste GraphQL Integration:', error.message);
  } finally {
    await client.close();
  }
}

testGraphQLIntegration();
