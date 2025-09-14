# 🚀 First Steps Tutorial

Step-by-step tutorial to build your first application with CassandraORM JS.

## 🎯 What We'll Build

A simple **blog application** with:
- User management
- Blog posts with comments
- Real-time notifications
- Basic analytics

## 📋 Prerequisites

- CassandraORM JS installed
- Cassandra/ScyllaDB running
- Basic TypeScript knowledge

## 🏗️ Project Setup

### 1. Initialize Project
```bash
mkdir my-blog-app
cd my-blog-app
npm init -y
npm install cassandraorm-js
npm install -D typescript @types/node ts-node
```

### 2. Create Project Structure
```
my-blog-app/
├── src/
│   ├── models/
│   ├── services/
│   ├── routes/
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 3. Configure TypeScript
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## 🔌 Database Connection

### 1. Create Database Client
```typescript
// src/database.ts
import { createClient } from 'cassandraorm-js';

export const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'blog_app'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe'
  }
});

export async function connectDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to Cassandra');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
```

## 📊 Define Data Models

### 1. User Model
```typescript
// src/models/User.ts
import { client } from '../database.js';

export const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    username: {
      type: 'text',
      unique: true,
      validate: {
        required: true,
        minLength: 3,
        maxLength: 30
      }
    },
    email: {
      type: 'text',
      unique: true,
      validate: {
        required: true,
        isEmail: true
      }
    },
    password: {
      type: 'text',
      validate: {
        required: true,
        minLength: 8
      }
    },
    display_name: 'text',
    bio: 'text',
    avatar_url: 'text',
    is_active: {
      type: 'boolean',
      default: true
    },
    created_at: {
      type: 'timestamp',
      default: () => new Date()
    },
    updated_at: 'timestamp'
  },
  key: ['id']
});

export type UserType = {
  id: string;
  username: string;
  email: string;
  password: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at?: Date;
};
```

### 2. Post Model
```typescript
// src/models/Post.ts
import { client } from '../database.js';

export const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    title: {
      type: 'text',
      validate: {
        required: true,
        maxLength: 200
      }
    },
    content: {
      type: 'text',
      validate: {
        required: true
      }
    },
    slug: {
      type: 'text',
      unique: true
    },
    tags: 'set<text>',
    is_published: {
      type: 'boolean',
      default: false
    },
    published_at: 'timestamp',
    created_at: {
      type: 'timestamp',
      default: () => new Date()
    },
    updated_at: 'timestamp'
  },
  relations: {
    author: {
      model: 'users',
      foreignKey: 'user_id',
      type: 'belongsTo'
    }
  },
  key: ['id']
});

export type PostType = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  slug: string;
  tags?: Set<string>;
  is_published: boolean;
  published_at?: Date;
  created_at: Date;
  updated_at?: Date;
};
```

### 3. Comment Model
```typescript
// src/models/Comment.ts
import { client } from '../database.js';

export const Comment = await client.loadSchema('comments', {
  fields: {
    id: 'uuid',
    post_id: 'uuid',
    user_id: 'uuid',
    content: {
      type: 'text',
      validate: {
        required: true,
        maxLength: 1000
      }
    },
    is_approved: {
      type: 'boolean',
      default: true
    },
    created_at: {
      type: 'timestamp',
      default: () => new Date()
    }
  },
  relations: {
    post: {
      model: 'posts',
      foreignKey: 'post_id',
      type: 'belongsTo'
    },
    author: {
      model: 'users',
      foreignKey: 'user_id',
      type: 'belongsTo'
    }
  },
  key: ['post_id', 'created_at', 'id']
});
```

## 🛠️ Create Services

### 1. User Service
```typescript
// src/services/UserService.ts
import { User, UserType } from '../models/User.js';
import { client } from '../database.js';

export class UserService {
  static async createUser(userData: Omit<UserType, 'id' | 'created_at'>): Promise<UserType> {
    // Hash password (in real app, use bcrypt)
    const hashedPassword = Buffer.from(userData.password).toString('base64');
    
    const user = await User.create({
      ...userData,
      password: hashedPassword,
      created_at: new Date()
    });

    return user;
  }

  static async getUserById(id: string): Promise<UserType | null> {
    return await User.findOne({ id });
  }

  static async getUserByUsername(username: string): Promise<UserType | null> {
    return await User.findOne({ username });
  }

  static async getUserByEmail(email: string): Promise<UserType | null> {
    return await User.findOne({ email });
  }

  static async updateUser(id: string, updates: Partial<UserType>): Promise<void> {
    await User.update({ id }, {
      ...updates,
      updated_at: new Date()
    });
  }

  static async deleteUser(id: string): Promise<void> {
    await User.delete({ id });
  }

  static async listUsers(limit: number = 20): Promise<UserType[]> {
    return await User.find({}, { limit });
  }
}
```

### 2. Post Service
```typescript
// src/services/PostService.ts
import { Post, PostType } from '../models/Post.js';
import { client } from '../database.js';

export class PostService {
  static async createPost(postData: Omit<PostType, 'id' | 'created_at'>): Promise<PostType> {
    // Generate slug from title
    const slug = postData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const post = await Post.create({
      ...postData,
      slug: `${slug}-${Date.now()}`,
      created_at: new Date()
    });

    return post;
  }

  static async getPostById(id: string): Promise<PostType | null> {
    return await Post.findOne({ id });
  }

  static async getPostBySlug(slug: string): Promise<PostType | null> {
    return await Post.findOne({ slug });
  }

  static async getPostsByUser(userId: string, limit: number = 10): Promise<PostType[]> {
    return await Post.find({ user_id: userId }, { 
      limit,
      orderBy: { created_at: 'DESC' }
    });
  }

  static async getPublishedPosts(limit: number = 20): Promise<PostType[]> {
    return await Post.find({ is_published: true }, {
      limit,
      orderBy: { published_at: 'DESC' }
    });
  }

  static async publishPost(id: string): Promise<void> {
    await Post.update({ id }, {
      is_published: true,
      published_at: new Date(),
      updated_at: new Date()
    });
  }

  static async updatePost(id: string, updates: Partial<PostType>): Promise<void> {
    await Post.update({ id }, {
      ...updates,
      updated_at: new Date()
    });
  }

  static async deletePost(id: string): Promise<void> {
    await Post.delete({ id });
  }
}
```

## 🌐 Create API Routes

### 1. User Routes
```typescript
// src/routes/users.ts
import express from 'express';
import { UserService } from '../services/UserService.js';

const router = express.Router();

// Create user
router.post('/', async (req, res) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await UserService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List users
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const users = await UserService.listUsers(limit);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### 2. Post Routes
```typescript
// src/routes/posts.ts
import express from 'express';
import { PostService } from '../services/PostService.js';

const router = express.Router();

// Create post
router.post('/', async (req, res) => {
  try {
    const post = await PostService.createPost(req.body);
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get published posts
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const posts = await PostService.getPublishedPosts(limit);
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await PostService.getPostBySlug(req.params.slug);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish post
router.patch('/:id/publish', async (req, res) => {
  try {
    await PostService.publishPost(req.params.id);
    res.json({ success: true, message: 'Post published' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

## 🚀 Main Application

### 1. Express Server
```typescript
// src/index.ts
import express from 'express';
import { connectDatabase } from './database.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### 2. Package.json Scripts
```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "echo \"No tests yet\""
  }
}
```

## 🧪 Testing Your Application

### 1. Start the Application
```bash
npm run dev
```

### 2. Test User Creation
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "display_name": "John Doe"
  }'
```

### 3. Test Post Creation
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID_FROM_PREVIOUS_RESPONSE",
    "title": "My First Blog Post",
    "content": "This is the content of my first blog post using CassandraORM JS!",
    "tags": ["tutorial", "cassandra", "nodejs"]
  }'
```

### 4. Test Getting Posts
```bash
curl http://localhost:3000/api/posts
```

## 📊 Add Real-time Features

### 1. Real-time Notifications
```typescript
// src/services/NotificationService.ts
import { SubscriptionManager } from 'cassandraorm-js';
import { client } from '../database.js';

export class NotificationService {
  private subscriptions: SubscriptionManager;

  constructor() {
    this.subscriptions = new SubscriptionManager(client.driver, 'blog_app');
  }

  async initialize() {
    await this.subscriptions.initialize();
    
    // Subscribe to new posts
    await this.subscriptions.subscribe(
      { table: 'posts', operation: 'insert' },
      (event) => {
        console.log('📝 New post created:', event.data.title);
        // Send notification to subscribers
      }
    );

    // Subscribe to new comments
    await this.subscriptions.subscribe(
      { table: 'comments', operation: 'insert' },
      (event) => {
        console.log('💬 New comment added:', event.data.content);
        // Notify post author
      }
    );
  }
}
```

## 📈 Add Analytics

### 1. Simple Analytics
```typescript
// src/services/AnalyticsService.ts
import { AggregationsManager } from 'cassandraorm-js';
import { client } from '../database.js';

export class AnalyticsService {
  private aggregations: AggregationsManager;

  constructor() {
    this.aggregations = new AggregationsManager(client.driver, 'blog_app');
  }

  async getPostStats() {
    return await this.aggregations
      .createPipeline('posts')
      .where('is_published', '=', true)
      .groupBy('user_id')
      .count('post_count')
      .execute();
  }

  async getUserStats() {
    return await this.aggregations
      .createPipeline('users')
      .where('is_active', '=', true)
      .count('total_users')
      .execute();
  }
}
```

## 🎯 Next Steps

Congratulations! You've built a basic blog application. Now you can:

1. **[Add Authentication →](../examples/advanced.md)** - Secure your API
2. **[Implement Caching →](../core/cache-system.md)** - Improve performance
3. **[Add Real-time Features →](../real-time/subscriptions.md)** - Live updates
4. **[Optimize Queries →](../queries/query-builder.md)** - Better performance
5. **[Add AI Features →](../ai-ml/vector-search.md)** - Smart recommendations

## 📚 Learn More

- **[Models & Schemas →](../core/models-schemas.md)** - Advanced modeling
- **[CRUD Operations →](../core/crud-operations.md)** - Database operations
- **[Relationships →](../core/relationships.md)** - Model relationships
- **[Performance →](../performance/monitoring.md)** - Optimization

---

**You've successfully built your first CassandraORM JS application! 🎉**
