# GraphQL Integration

## Overview
Automatic GraphQL schema generation with resolvers, subscriptions, and advanced query optimization for Cassandra data models.

## Schema Generation

```typescript
import { GraphQLSchemaGenerator } from 'cassandraorm-js';

const generator = new GraphQLSchemaGenerator();

// Add models to schema
generator.addModel('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    created_at: 'timestamp'
  },
  relations: {
    posts: { model: 'posts', foreignKey: 'user_id', type: 'hasMany' }
  }
});

generator.addModel('posts', {
  fields: {
    id: 'uuid',
    title: 'text',
    content: 'text',
    user_id: 'uuid'
  },
  relations: {
    author: { model: 'users', foreignKey: 'user_id', type: 'belongsTo' }
  }
});

// Generate schema
const typeDefs = generator.generateSchema();
const resolvers = generator.generateResolvers();
```

## GraphQL Server Setup

```typescript
import { ApolloServer } from 'apollo-server-express';
import { GraphQLCassandraConnector } from 'cassandraorm-js';

const connector = new GraphQLCassandraConnector(client);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    cassandra: connector,
    user: req.user
  }),
  plugins: [
    connector.createCachingPlugin(),
    connector.createTracingPlugin()
  ]
});

await server.start();
app.use('/graphql', server.getMiddleware());
```

## Custom Resolvers

```typescript
const customResolvers = {
  Query: {
    searchUsers: async (parent, { query, limit }, { cassandra }) => {
      return await cassandra.searchUsers(query, { limit });
    },
    
    userStats: async (parent, { userId }, { cassandra }) => {
      const [user, postCount, commentCount] = await Promise.all([
        cassandra.getUser(userId),
        cassandra.getUserPostCount(userId),
        cassandra.getUserCommentCount(userId)
      ]);
      
      return { user, postCount, commentCount };
    }
  },
  
  Mutation: {
    createUser: async (parent, { input }, { cassandra }) => {
      return await cassandra.createUser(input);
    },
    
    updateUser: async (parent, { id, input }, { cassandra }) => {
      return await cassandra.updateUser(id, input);
    }
  },
  
  User: {
    posts: async (user, { limit, offset }, { cassandra }) => {
      return await cassandra.getUserPosts(user.id, { limit, offset });
    },
    
    followerCount: async (user, args, { cassandra }) => {
      return await cassandra.getFollowerCount(user.id);
    }
  }
};

// Merge with generated resolvers
const finalResolvers = generator.mergeResolvers(customResolvers);
```

## GraphQL Subscriptions

```typescript
import { GraphQLSubscriptionManager } from 'cassandraorm-js';

const subscriptionManager = new GraphQLSubscriptionManager(client);

const subscriptionResolvers = {
  Subscription: {
    userCreated: {
      subscribe: () => subscriptionManager.subscribe('user_created')
    },
    
    postUpdated: {
      subscribe: (parent, { postId }) => 
        subscriptionManager.subscribe('post_updated', { postId })
    },
    
    liveUserCount: {
      subscribe: () => subscriptionManager.subscribe('user_count_changed'),
      resolve: (payload) => payload.count
    }
  }
};

// Trigger subscriptions from mutations
const mutationResolvers = {
  Mutation: {
    createUser: async (parent, { input }, { cassandra, pubsub }) => {
      const user = await cassandra.createUser(input);
      
      // Trigger subscription
      await subscriptionManager.publish('user_created', { user });
      
      return user;
    }
  }
};
```

## Query Optimization

```typescript
import { GraphQLQueryOptimizer } from 'cassandraorm-js';

const optimizer = new GraphQLQueryOptimizer({
  batchLoading: true,
  caching: true,
  queryComplexityLimit: 1000
});

// DataLoader for N+1 problem
const userLoader = optimizer.createDataLoader(
  async (userIds) => {
    const users = await User.find({ id: { $in: userIds } });
    return userIds.map(id => users.find(u => u.id === id));
  }
);

const resolvers = {
  Post: {
    author: async (post) => {
      return await userLoader.load(post.user_id);
    }
  }
};

// Query complexity analysis
server.addPlugin({
  requestDidStart() {
    return {
      didResolveOperation({ request, document }) {
        const complexity = optimizer.calculateComplexity(document);
        if (complexity > 1000) {
          throw new Error('Query too complex');
        }
      }
    };
  }
});
```

## Federation Support

```typescript
import { buildFederatedSchema } from '@apollo/federation';
import { GraphQLFederationConnector } from 'cassandraorm-js';

const federationConnector = new GraphQLFederationConnector(client);

const typeDefs = gql`
  extend type User @key(fields: "id") {
    id: ID! @external
    posts: [Post!]!
    profile: UserProfile
  }
  
  type Post @key(fields: "id") {
    id: ID!
    title: String!
    content: String!
    author: User!
  }
`;

const resolvers = {
  User: {
    __resolveReference: async (user) => {
      return await federationConnector.getUser(user.id);
    },
    
    posts: async (user) => {
      return await federationConnector.getUserPosts(user.id);
    }
  },
  
  Post: {
    __resolveReference: async (post) => {
      return await federationConnector.getPost(post.id);
    }
  }
};

const schema = buildFederatedSchema([{ typeDefs, resolvers }]);
```
