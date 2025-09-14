# REST API

## Overview
Automatic REST API generation with CRUD operations, filtering, pagination, and OpenAPI documentation.

## API Generator

```typescript
import { RESTAPIGenerator } from 'cassandraorm-js';

const apiGenerator = new RESTAPIGenerator(client, {
  basePath: '/api/v1',
  authentication: true,
  rateLimit: {
    windowMs: 60000,
    max: 1000
  },
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true
  }
});

// Generate CRUD endpoints
apiGenerator.generateCRUD('users', {
  endpoints: ['create', 'read', 'update', 'delete', 'list'],
  middleware: ['auth', 'validation'],
  permissions: {
    create: ['admin', 'user'],
    read: ['admin', 'user', 'guest'],
    update: ['admin', 'owner'],
    delete: ['admin']
  }
});

const app = apiGenerator.getExpressApp();
```

## Custom Endpoints

```typescript
// Add custom endpoints
apiGenerator.addEndpoint('GET', '/users/:id/posts', {
  handler: async (req, res) => {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const posts = await Post.find(
      { user_id: id },
      { limit: parseInt(limit), skip: parseInt(offset) }
    );
    
    res.json({
      data: posts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: await Post.count({ user_id: id })
      }
    });
  },
  middleware: ['auth'],
  validation: {
    params: {
      id: { type: 'uuid', required: true }
    },
    query: {
      limit: { type: 'number', min: 1, max: 100 },
      offset: { type: 'number', min: 0 }
    }
  }
});

// Bulk operations
apiGenerator.addEndpoint('POST', '/users/bulk', {
  handler: async (req, res) => {
    const { users } = req.body;
    const results = await User.insertMany(users);
    res.json({ created: results.length });
  },
  validation: {
    body: {
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1 }
          }
        }
      }
    }
  }
});
```

## Advanced Filtering

```typescript
import { QueryBuilder } from 'cassandraorm-js';

apiGenerator.addEndpoint('GET', '/users/search', {
  handler: async (req, res) => {
    const queryBuilder = new QueryBuilder(User);
    
    // Dynamic filtering
    if (req.query.name) {
      queryBuilder.where('name', 'LIKE', `%${req.query.name}%`);
    }
    
    if (req.query.status) {
      queryBuilder.where('status', '=', req.query.status);
    }
    
    if (req.query.created_after) {
      queryBuilder.where('created_at', '>', new Date(req.query.created_after));
    }
    
    // Sorting
    if (req.query.sort) {
      const [field, direction] = req.query.sort.split(':');
      queryBuilder.orderBy(field, direction || 'asc');
    }
    
    // Pagination
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const results = await queryBuilder
      .limit(limit)
      .offset(offset)
      .execute();
    
    res.json({
      data: results,
      pagination: {
        limit,
        offset,
        total: await queryBuilder.count()
      }
    });
  }
});
```

## API Versioning

```typescript
import { APIVersionManager } from 'cassandraorm-js';

const versionManager = new APIVersionManager({
  versions: ['v1', 'v2'],
  defaultVersion: 'v2',
  deprecationWarnings: true
});

// Version-specific endpoints
versionManager.addVersionedEndpoint('GET', '/users/:id', {
  v1: {
    handler: async (req, res) => {
      const user = await User.findOne({ id: req.params.id });
      res.json(user); // Simple response
    }
  },
  v2: {
    handler: async (req, res) => {
      const user = await User.findOne({ id: req.params.id });
      const profile = await UserProfile.findOne({ user_id: user.id });
      
      res.json({
        ...user,
        profile,
        _links: {
          self: `/api/v2/users/${user.id}`,
          posts: `/api/v2/users/${user.id}/posts`
        }
      });
    }
  }
});

app.use('/api', versionManager.getRouter());
```

## OpenAPI Documentation

```typescript
import { OpenAPIGenerator } from 'cassandraorm-js';

const openApiGenerator = new OpenAPIGenerator({
  title: 'CassandraORM API',
  version: '1.0.0',
  description: 'REST API for CassandraORM application',
  servers: [
    { url: 'http://localhost:3000/api/v1', description: 'Development' },
    { url: 'https://api.example.com/v1', description: 'Production' }
  ]
});

// Generate OpenAPI spec from models
const spec = openApiGenerator.generateFromModels([User, Post, Comment]);

// Serve documentation
app.get('/api/docs/openapi.json', (req, res) => {
  res.json(spec);
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
```

## Response Formatting

```typescript
import { ResponseFormatter } from 'cassandraorm-js';

const formatter = new ResponseFormatter({
  envelope: true,
  includeMetadata: true,
  errorFormat: 'detailed'
});

// Success response format
app.use((req, res, next) => {
  res.success = (data, meta = {}) => {
    res.json(formatter.success(data, meta));
  };
  
  res.error = (error, statusCode = 500) => {
    res.status(statusCode).json(formatter.error(error));
  };
  
  next();
});

// Usage in handlers
apiGenerator.addEndpoint('GET', '/users', {
  handler: async (req, res) => {
    const users = await User.find({});
    
    res.success(users, {
      total: users.length,
      timestamp: new Date().toISOString()
    });
  }
});
```

## API Security

```typescript
import { APISecurityManager } from 'cassandraorm-js';

const securityManager = new APISecurityManager({
  authentication: {
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '24h'
    },
    apiKey: {
      header: 'X-API-Key',
      validate: async (key) => {
        return await APIKey.findOne({ key, active: true });
      }
    }
  },
  authorization: {
    rbac: true,
    permissions: {
      'users:read': ['user', 'admin'],
      'users:write': ['admin'],
      'posts:read': ['user', 'admin'],
      'posts:write': ['user', 'admin']
    }
  },
  rateLimiting: {
    global: { requests: 1000, window: '1h' },
    perUser: { requests: 100, window: '1h' },
    perEndpoint: {
      '/users': { requests: 50, window: '1h' }
    }
  }
});

app.use(securityManager.middleware());
```

## API Testing

```typescript
import { APITestSuite } from 'cassandraorm-js';

const testSuite = new APITestSuite(app);

// Generate tests from OpenAPI spec
const tests = testSuite.generateFromOpenAPI(spec);

// Custom test cases
testSuite.addTest('POST /users', {
  description: 'Create user with valid data',
  request: {
    body: {
      email: 'test@example.com',
      name: 'Test User'
    }
  },
  expect: {
    status: 201,
    body: {
      id: expect.any(String),
      email: 'test@example.com',
      name: 'Test User'
    }
  }
});

testSuite.addTest('GET /users/:id', {
  description: 'Get user by ID',
  setup: async () => {
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test User'
    });
    return { userId: user.id };
  },
  request: (context) => ({
    url: `/users/${context.userId}`
  }),
  expect: {
    status: 200,
    body: {
      id: expect.any(String),
      email: 'test@example.com'
    }
  }
});

// Run tests
await testSuite.run();
```

## API Monitoring

```typescript
import { APIMonitor } from 'cassandraorm-js';

const monitor = new APIMonitor({
  metrics: ['response_time', 'status_codes', 'throughput'],
  alerting: {
    responseTime: { threshold: 1000, window: '5m' },
    errorRate: { threshold: 0.05, window: '5m' }
  }
});

app.use(monitor.middleware());

// Real-time metrics
setInterval(async () => {
  const metrics = await monitor.getMetrics();
  console.log('API Metrics:', metrics);
}, 60000);

// Export to monitoring systems
monitor.exportToPrometheus('/metrics');
```
