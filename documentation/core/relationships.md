# 🔗 Relationships

Complete guide to defining and working with model relationships in CassandraORM JS.

## 🎯 Overview

CassandraORM JS supports various relationship types:
- **belongsTo** - Many-to-one relationships
- **hasOne** - One-to-one relationships  
- **hasMany** - One-to-many relationships
- **belongsToMany** - Many-to-many relationships
- **through** - Junction table relationships

## 🔗 Basic Relationships

### belongsTo (Many-to-One)

```typescript
// Post belongs to User
const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    title: 'text',
    content: 'text',
    created_at: 'timestamp'
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

// Usage
const post = await Post.findOne({ id: postId });
const author = await post.populate('author');
console.log('Post author:', author.name);
```

### hasOne (One-to-One)

```typescript
// User has one Profile
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text'
  },
  relations: {
    profile: {
      model: 'profiles',
      foreignKey: 'user_id',
      type: 'hasOne'
    }
  },
  key: ['id']
});

const Profile = await client.loadSchema('profiles', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    bio: 'text',
    avatar_url: 'text'
  },
  relations: {
    user: {
      model: 'users',
      foreignKey: 'user_id',
      type: 'belongsTo'
    }
  },
  key: ['id']
});
```

### hasMany (One-to-Many)

```typescript
// User has many Posts
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text',
    email: 'text'
  },
  relations: {
    posts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany'
    },
    comments: {
      model: 'comments',
      foreignKey: 'user_id',
      type: 'hasMany'
    }
  },
  key: ['id']
});

// Usage
const user = await User.findOne({ id: userId });
const posts = await user.populate('posts');
console.log(`User has ${posts.length} posts`);
```

## 🔄 Many-to-Many Relationships

### Direct Many-to-Many

```typescript
// User belongs to many Roles
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text',
    email: 'text'
  },
  relations: {
    roles: {
      model: 'roles',
      through: 'user_roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      type: 'belongsToMany'
    }
  },
  key: ['id']
});

const Role = await client.loadSchema('roles', {
  fields: {
    id: 'uuid',
    name: 'text',
    permissions: 'set<text>'
  },
  relations: {
    users: {
      model: 'users',
      through: 'user_roles',
      foreignKey: 'role_id',
      otherKey: 'user_id',
      type: 'belongsToMany'
    }
  },
  key: ['id']
});

// Junction table
const UserRole = await client.loadSchema('user_roles', {
  fields: {
    user_id: 'uuid',
    role_id: 'uuid',
    assigned_at: 'timestamp',
    assigned_by: 'uuid'
  },
  key: ['user_id', 'role_id']
});
```

### Through Relationships with Pivot Data

```typescript
// Post belongs to many Categories through PostCategory
const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    title: 'text',
    content: 'text'
  },
  relations: {
    categories: {
      model: 'categories',
      through: 'post_categories',
      foreignKey: 'post_id',
      otherKey: 'category_id',
      type: 'belongsToMany',
      pivotFields: ['priority', 'created_at'] // Include pivot data
    }
  },
  key: ['id']
});

const PostCategory = await client.loadSchema('post_categories', {
  fields: {
    post_id: 'uuid',
    category_id: 'uuid',
    priority: 'int',
    created_at: 'timestamp'
  },
  key: ['post_id', 'category_id']
});
```

## 📊 Advanced Relationship Options

### Relationship with Conditions

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  relations: {
    // Only published posts
    publishedPosts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany',
      conditions: {
        is_published: true
      }
    },
    
    // Recent posts (last 30 days)
    recentPosts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany',
      conditions: {
        created_at: {
          $gte: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }
  },
  key: ['id']
});
```

### Relationship with Ordering

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  relations: {
    posts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany',
      orderBy: {
        created_at: 'DESC'
      },
      limit: 10
    }
  },
  key: ['id']
});
```

### Nested Relationships

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  relations: {
    posts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany',
      include: {
        comments: {
          model: 'comments',
          foreignKey: 'post_id',
          type: 'hasMany',
          include: {
            author: {
              model: 'users',
              foreignKey: 'user_id',
              type: 'belongsTo'
            }
          }
        }
      }
    }
  },
  key: ['id']
});
```

## 🔍 Querying Relationships

### Populate Single Relationship

```typescript
// Load post with author
const post = await Post.findOne({ id: postId });
await post.populate('author');

console.log('Author:', post.author.name);
```

### Populate Multiple Relationships

```typescript
// Load post with author and comments
const post = await Post.findOne({ id: postId });
await post.populate(['author', 'comments']);

console.log('Author:', post.author.name);
console.log('Comments:', post.comments.length);
```

### Populate with Options

```typescript
// Populate with conditions and limits
const user = await User.findOne({ id: userId });
await user.populate('posts', {
  where: { is_published: true },
  limit: 5,
  orderBy: { created_at: 'DESC' }
});
```

### Populate Nested Relationships

```typescript
// Load user with posts and their comments
const user = await User.findOne({ id: userId });
await user.populate({
  posts: {
    include: ['comments']
  }
});

user.posts.forEach(post => {
  console.log(`Post: ${post.title} (${post.comments.length} comments)`);
});
```

## 🚀 Eager Loading

### Load with Relationships

```typescript
// Find posts with authors in single query
const posts = await Post.find({}, {
  populate: ['author']
});

posts.forEach(post => {
  console.log(`${post.title} by ${post.author.name}`);
});
```

### Multiple Relationships

```typescript
// Load posts with authors and comments
const posts = await Post.find({}, {
  populate: ['author', 'comments']
});
```

### Nested Eager Loading

```typescript
// Load users with posts and comments
const users = await User.find({}, {
  populate: {
    posts: {
      include: ['comments']
    }
  }
});
```

## 🔧 Relationship Operations

### Create with Relationships

```typescript
// Create user and profile together
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

const profile = await Profile.create({
  user_id: user.id,
  bio: 'Software developer',
  avatar_url: 'https://example.com/avatar.jpg'
});

// Associate relationship
await user.associate('profile', profile);
```

### Add to Many-to-Many

```typescript
// Add role to user
const user = await User.findOne({ id: userId });
const role = await Role.findOne({ name: 'admin' });

await user.addRole(role);

// Add multiple roles
const roles = await Role.find({ name: { $in: ['admin', 'editor'] } });
await user.addRoles(roles);
```

### Remove from Many-to-Many

```typescript
// Remove role from user
await user.removeRole(role);

// Remove all roles
await user.removeRoles();
```

### Update Pivot Data

```typescript
// Update pivot table data
await user.updateRole(role, {
  assigned_at: new Date(),
  assigned_by: currentUserId
});
```

## 📊 Relationship Queries

### Query Through Relationships

```typescript
// Find posts by users in specific city
const posts = await Post.find({}, {
  populate: {
    author: {
      where: { city: 'New York' }
    }
  }
});

// Find users who have published posts
const activeAuthors = await User.find({}, {
  populate: {
    posts: {
      where: { is_published: true },
      having: 'COUNT(*) > 0'
    }
  }
});
```

### Aggregations with Relationships

```typescript
import { AggregationsManager } from 'cassandraorm-js';

const aggregations = new AggregationsManager(client.driver, 'blog_app');

// Count posts per user
const postCounts = await aggregations
  .createPipeline('posts')
  .groupBy('user_id')
  .count('post_count')
  .execute();

// Average comments per post
const commentStats = await aggregations
  .createPipeline('comments')
  .groupBy('post_id')
  .count('comment_count')
  .avg('comment_count', 'avg_comments')
  .execute();
```

## 🔄 Relationship Hooks

### Before/After Relationship Operations

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text',
    posts_count: 'counter'
  },
  relations: {
    posts: {
      model: 'posts',
      foreignKey: 'user_id',
      type: 'hasMany'
    }
  },
  
  // Hooks for relationship operations
  hooks: {
    beforeAddPost: async function(post) {
      console.log(`Adding post "${post.title}" to user ${this.name}`);
    },
    
    afterAddPost: async function(post) {
      // Update posts counter
      await this.increment('posts_count', 1);
    },
    
    afterRemovePost: async function(post) {
      // Decrement posts counter
      await this.increment('posts_count', -1);
    }
  },
  
  key: ['id']
});
```

## 🎯 Best Practices

### Relationship Design

```typescript
// ✅ Good: Use appropriate foreign keys
const Comment = await client.loadSchema('comments', {
  fields: {
    id: 'uuid',
    post_id: 'uuid',    // Foreign key
    user_id: 'uuid',    // Foreign key
    content: 'text'
  },
  relations: {
    post: {
      model: 'posts',
      foreignKey: 'post_id',
      type: 'belongsTo'
    }
  },
  key: ['post_id', 'created_at', 'id'] // Partition by post_id
});

// ❌ Avoid: Too many relationships in single query
const user = await User.findOne({ id: userId });
await user.populate([
  'posts', 'comments', 'likes', 'followers', 
  'following', 'notifications', 'settings'
]); // Too many at once
```

### Performance Optimization

```typescript
// ✅ Good: Limit relationship data
const users = await User.find({}, {
  populate: {
    posts: {
      limit: 5,
      select: ['id', 'title', 'created_at']
    }
  }
});

// ✅ Good: Use conditions to filter
const activeUsers = await User.find({}, {
  populate: {
    posts: {
      where: { is_published: true },
      limit: 3
    }
  }
});
```

### Denormalization Strategy

```typescript
// Sometimes denormalize for performance
const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    author_name: 'text',    // Denormalized
    author_avatar: 'text',  // Denormalized
    title: 'text',
    content: 'text'
  },
  key: ['id']
});

// Update denormalized data when user changes
const updateUserPosts = async (userId: string, userData: any) => {
  await Post.update(
    { user_id: userId },
    {
      author_name: userData.name,
      author_avatar: userData.avatar_url
    }
  );
};
```

## 🔗 Next Steps

- **[Validation →](./validation.md)** - Data validation rules
- **[Advanced Queries →](../queries/query-builder.md)** - Complex relationship queries
- **[Performance →](../performance/optimization.md)** - Optimize relationship queries

---

**Master relationships for powerful data modeling with CassandraORM JS! 🔗✨**
