# Basic Example

## Overview
Complete basic example demonstrating core CassandraORM features with a simple blog application.

## Project Setup

```bash
# Create new project
mkdir blog-app && cd blog-app
npm init -y

# Install CassandraORM
npm install cassandraorm-js

# Install additional dependencies
npm install express cors helmet morgan
npm install -D nodemon typescript @types/node
```

## Database Connection

```typescript
// src/database.ts
import { createClient } from 'cassandraorm-js';

export const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1:9042'],
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
    console.log('Connected to Cassandra');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}
```

## Model Definitions

```typescript
// src/models/User.ts
import { client } from '../database';

export const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    password_hash: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id'],
  indexes: ['email'],
  validate: {
    email: { required: true, isEmail: true, unique: true },
    name: { required: true, minLength: 2, maxLength: 50 },
    password_hash: { required: true }
  },
  hooks: {
    beforeSave: (instance) => {
      instance.updated_at = new Date();
      if (!instance.created_at) {
        instance.created_at = new Date();
      }
    }
  }
});

export interface UserModel {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}
```

```typescript
// src/models/Post.ts
import { client } from '../database';

export const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    title: 'text',
    content: 'text',
    author_id: 'uuid',
    status: 'text',
    tags: 'set<text>',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id'],
  indexes: ['author_id', 'status'],
  validate: {
    title: { required: true, minLength: 5, maxLength: 200 },
    content: { required: true, minLength: 10 },
    author_id: { required: true },
    status: { required: true, isIn: ['draft', 'published', 'archived'] }
  },
  relations: {
    author: { model: 'users', foreignKey: 'author_id', type: 'belongsTo' }
  },
  hooks: {
    beforeSave: (instance) => {
      instance.updated_at = new Date();
      if (!instance.created_at) {
        instance.created_at = new Date();
      }
      if (!instance.status) {
        instance.status = 'draft';
      }
    }
  }
});

export interface PostModel {
  id: string;
  title: string;
  content: string;
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  tags: Set<string>;
  created_at: Date;
  updated_at: Date;
}
```

## Service Layer

```typescript
// src/services/UserService.ts
import { User, UserModel } from '../models/User';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

export class UserService {
  async createUser(userData: {
    email: string;
    name: string;
    password: string;
  }): Promise<UserModel> {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    const user = await User.create({
      id: uuid(),
      email: userData.email,
      name: userData.name,
      password_hash: passwordHash
    });
    
    return user;
  }

  async getUserById(id: string): Promise<UserModel | null> {
    return await User.findOne({ id });
  }

  async getUserByEmail(email: string): Promise<UserModel | null> {
    return await User.findOne({ email });
  }

  async updateUser(id: string, updates: Partial<UserModel>): Promise<UserModel> {
    const user = await User.findOne({ id });
    if (!user) {
      throw new Error('User not found');
    }

    return await User.update({ id }, updates);
  }

  async deleteUser(id: string): Promise<void> {
    await User.delete({ id });
  }

  async validatePassword(user: UserModel, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password_hash);
  }
}
```

```typescript
// src/services/PostService.ts
import { Post, PostModel } from '../models/Post';
import { v4 as uuid } from 'uuid';

export class PostService {
  async createPost(postData: {
    title: string;
    content: string;
    author_id: string;
    tags?: string[];
  }): Promise<PostModel> {
    const post = await Post.create({
      id: uuid(),
      title: postData.title,
      content: postData.content,
      author_id: postData.author_id,
      tags: new Set(postData.tags || []),
      status: 'draft'
    });
    
    return post;
  }

  async getPostById(id: string): Promise<PostModel | null> {
    return await Post.findOne({ id });
  }

  async getPostsByAuthor(authorId: string): Promise<PostModel[]> {
    return await Post.find({ author_id: authorId });
  }

  async getPublishedPosts(limit: number = 10): Promise<PostModel[]> {
    return await Post.find(
      { status: 'published' },
      { limit, orderBy: { created_at: 'desc' } }
    );
  }

  async updatePost(id: string, updates: Partial<PostModel>): Promise<PostModel> {
    const post = await Post.findOne({ id });
    if (!post) {
      throw new Error('Post not found');
    }

    return await Post.update({ id }, updates);
  }

  async publishPost(id: string): Promise<PostModel> {
    return await this.updatePost(id, { status: 'published' });
  }

  async deletePost(id: string): Promise<void> {
    await Post.delete({ id });
  }

  async searchPosts(query: string): Promise<PostModel[]> {
    // Simple text search (in production, use full-text search)
    return await Post.find({
      title: { $like: `%${query}%` }
    });
  }
}
```

## API Controllers

```typescript
// src/controllers/UserController.ts
import { Request, Response } from 'express';
import { UserService } from '../services/UserService';

export class UserController {
  private userService = new UserService();

  async createUser(req: Request, res: Response) {
    try {
      const { email, name, password } = req.body;
      
      const user = await this.userService.createUser({
        email,
        name,
        password
      });

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await this.userService.updateUser(id, updates);
      
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}
```

## Express Application

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDatabase } from './database';
import { UserController } from './controllers/UserController';
import { PostController } from './controllers/PostController';

const app = express();
const userController = new UserController();
const postController = new PostController();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// User routes
app.post('/api/users', userController.createUser.bind(userController));
app.get('/api/users/:id', userController.getUser.bind(userController));
app.put('/api/users/:id', userController.updateUser.bind(userController));
app.delete('/api/users/:id', userController.deleteUser.bind(userController));

// Post routes
app.post('/api/posts', postController.createPost.bind(postController));
app.get('/api/posts/:id', postController.getPost.bind(postController));
app.get('/api/posts', postController.getPosts.bind(postController));
app.put('/api/posts/:id', postController.updatePost.bind(postController));
app.delete('/api/posts/:id', postController.deletePost.bind(postController));
app.post('/api/posts/:id/publish', postController.publishPost.bind(postController));

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

export default app;
```

## Server Entry Point

```typescript
// src/index.ts
import app from './app';
import { connectDatabase } from './database';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
```

## Package.json Scripts

```json
{
  "name": "blog-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "cassandraorm-js": "^1.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0",
    "morgan": "^1.10.0",
    "bcrypt": "^5.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "typescript": "^4.9.0",
    "@types/node": "^18.11.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/bcrypt": "^5.0.0",
    "@types/uuid": "^9.0.0"
  }
}
```

## Usage Examples

```bash
# Start development server
npm run dev

# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","name":"John Doe","password":"password123"}'

# Create a post
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","content":"This is my first blog post","author_id":"user-id-here","tags":["tech","blog"]}'

# Get published posts
curl http://localhost:3000/api/posts

# Publish a post
curl -X POST http://localhost:3000/api/posts/post-id-here/publish
```
