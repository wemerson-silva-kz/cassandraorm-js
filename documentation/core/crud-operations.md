# 📝 CRUD Operations

Complete guide to Create, Read, Update, and Delete operations in CassandraORM JS.

## 🎯 Overview

CassandraORM JS provides intuitive CRUD operations with:
- **Type safety** with TypeScript
- **Automatic validation**
- **Unique constraint handling**
- **Batch operations**
- **Upsert functionality**
- **Streaming support**

## ➕ Create Operations

### Basic Create

```typescript
// Simple create
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30
});

console.log('Created user:', user.id);
```

### Create with Validation

```typescript
try {
  const user = await User.create({
    email: 'invalid-email',  // Will fail validation
    name: 'Jo',              // Too short (minLength: 3)
    age: 150                 // Too old (max: 120)
  });
} catch (error) {
  console.log('Validation error:', error.message);
  // "Validation failed: email must be valid, name too short, age too high"
}
```

### Create with Unique Constraints

```typescript
// First user - success
const user1 = await User.create({
  email: 'john@example.com',
  name: 'John Doe'
});

// Second user with same email - will fail
try {
  const user2 = await User.create({
    email: 'john@example.com',  // Duplicate email
    name: 'Jane Doe'
  });
} catch (error) {
  console.log('Unique constraint error:', error.message);
  // "Unique constraint violation: Field 'email' with value 'john@example.com' already exists"
}
```

### Create with Options

```typescript
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe'
}, {
  ttl: 3600,        // Expire after 1 hour
  if_not_exist: true // Only create if doesn't exist
});
```

### Upsert (Insert or Update)

```typescript
// Create or update based on unique fields
const user = await User.create({
  id: existingUserId,
  email: 'john@example.com',
  name: 'John Updated',
  age: 31
}, { 
  upsert: true  // Will update if exists, create if not
});
```

## 📖 Read Operations

### Find All

```typescript
// Get all users
const allUsers = await User.find();

// With limit
const recentUsers = await User.find({}, { limit: 10 });
```

### Find with Conditions

```typescript
// Simple conditions
const activeUsers = await User.find({ is_active: true });

// Multiple conditions
const youngActiveUsers = await User.find({
  is_active: true,
  age: { $lt: 30 }
});

// Complex conditions
const users = await User.find({
  age: { $gte: 18, $lte: 65 },
  city: { $in: ['New York', 'San Francisco'] },
  name: { $like: 'John%' }
});
```

### Query Operators

```typescript
// Comparison operators
const users = await User.find({
  age: { $gt: 18 },           // Greater than
  score: { $gte: 80 },        // Greater than or equal
  rating: { $lt: 5 },         // Less than
  points: { $lte: 100 },      // Less than or equal
  status: { $ne: 'banned' },  // Not equal
  city: { $in: ['NYC', 'LA'] }, // In array
  role: { $nin: ['admin'] }   // Not in array
});

// Text operators
const textSearch = await User.find({
  name: { $like: 'John%' },      // Starts with
  email: { $contains: 'gmail' }, // Contains
  bio: { $token: 'developer' }   // Token match
});

// Collection operators
const collectionSearch = await User.find({
  tags: { $contains: 'developer' },     // Set/List contains
  skills: { $contains_key: 'python' },  // Map contains key
  metadata: { $contains_value: 'active' } // Map contains value
});
```

### Find One

```typescript
// Find single user
const user = await User.findOne({ email: 'john@example.com' });

if (user) {
  console.log('Found user:', user.name);
} else {
  console.log('User not found');
}
```

### Find with Ordering

```typescript
// Order by single field
const usersByAge = await User.find({}, {
  orderBy: { age: 'DESC' },
  limit: 10
});

// Order by multiple fields
const orderedUsers = await User.find({}, {
  orderBy: { 
    created_at: 'DESC',
    name: 'ASC'
  }
});

// Using $orderby in query
const users = await User.find({
  $orderby: { created_at: 'DESC' },
  $limit: 20
});
```

### Pagination

```typescript
// Offset-based pagination
const page1 = await User.find({}, { 
  limit: 10, 
  offset: 0 
});

const page2 = await User.find({}, { 
  limit: 10, 
  offset: 10 
});

// Token-based pagination (more efficient)
const firstPage = await User.find({}, { 
  limit: 10 
});

const lastUser = firstPage[firstPage.length - 1];
const nextPage = await User.find({
  created_at: { $lt: lastUser.created_at }
}, { 
  limit: 10,
  orderBy: { created_at: 'DESC' }
});
```

### Select Specific Fields

```typescript
// Select only specific fields
const users = await User.find({}, {
  select: ['id', 'name', 'email']
});

// Exclude fields (select all except)
const users = await User.find({}, {
  select: { 
    password: 0,  // Exclude password
    internal_notes: 0 // Exclude internal notes
  }
});
```

### Populate Relations

```typescript
// Populate single relation
const posts = await Post.find({}, {
  populate: ['author']
});

// Populate multiple relations
const posts = await Post.find({}, {
  populate: ['author', 'comments']
});

// Populate with conditions
const posts = await Post.find({}, {
  populate: {
    author: { select: ['name', 'email'] },
    comments: { 
      where: { is_approved: true },
      limit: 5 
    }
  }
});
```

## ✏️ Update Operations

### Update Single Record

```typescript
// Update by ID
await User.update(
  { id: userId },
  { 
    name: 'John Updated',
    age: 31,
    updated_at: new Date()
  }
);
```

### Update Multiple Records

```typescript
// Update all matching records
await User.update(
  { city: 'New York' },
  { 
    timezone: 'America/New_York',
    updated_at: new Date()
  }
);
```

### Update with Conditions

```typescript
// Update with complex conditions
await User.update(
  { 
    age: { $gte: 18 },
    is_verified: false 
  },
  { 
    can_vote: true,
    updated_at: new Date()
  }
);
```

### Atomic Updates

```typescript
// Counter operations
await User.update(
  { id: userId },
  { 
    login_count: { $incr: 1 },      // Increment
    points: { $decr: 10 }           // Decrement
  }
);

// Set operations
await User.update(
  { id: userId },
  {
    tags: { $add: ['premium'] },     // Add to set
    old_tags: { $remove: ['basic'] } // Remove from set
  }
);

// List operations
await User.update(
  { id: userId },
  {
    notifications: { 
      $append: ['New message'] 
    },
    old_notifications: { 
      $prepend: ['System update'] 
    }
  }
);

// Map operations
await User.update(
  { id: userId },
  {
    preferences: { 
      $set: { theme: 'dark', language: 'en' }
    },
    metadata: {
      $unset: ['temp_data']
    }
  }
);
```

### Update with TTL

```typescript
// Set TTL on update
await User.update(
  { id: userId },
  { 
    session_token: 'new_token',
    last_activity: new Date()
  },
  { 
    ttl: 3600  // Expire in 1 hour
  }
);
```

### Conditional Updates

```typescript
// Update only if condition is met
await User.update(
  { id: userId },
  { 
    status: 'premium',
    upgraded_at: new Date()
  },
  {
    if: { status: 'basic' }  // Only update if currently basic
  }
);

// Update with IF EXISTS
await User.update(
  { id: userId },
  { name: 'Updated Name' },
  { if_exists: true }
);
```

## 🗑️ Delete Operations

### Delete Single Record

```typescript
// Delete by ID
await User.delete({ id: userId });

// Delete by unique field
await User.delete({ email: 'john@example.com' });
```

### Delete Multiple Records

```typescript
// Delete all matching records
await User.delete({ 
  is_active: false,
  last_login: { $lt: new Date('2023-01-01') }
});
```

### Conditional Delete

```typescript
// Delete only if condition is met
await User.delete(
  { id: userId },
  { 
    if: { status: 'inactive' }
  }
);

// Delete with IF EXISTS
await User.delete(
  { id: userId },
  { if_exists: true }
);
```

### Soft Delete

```typescript
// Soft delete (mark as deleted instead of removing)
await User.update(
  { id: userId },
  { 
    is_deleted: true,
    deleted_at: new Date()
  }
);

// Find non-deleted records
const activeUsers = await User.find({ 
  is_deleted: { $ne: true }
});
```

## 📦 Batch Operations

### Create Many

```typescript
// Create multiple records
const users = await User.createMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  { email: 'user3@example.com', name: 'User 3' }
]);

console.log(`Created ${users.length} users`);
```

### Create Many with Duplicate Handling

```typescript
// Ignore duplicates
const users = await User.createMany([
  { email: 'existing@example.com', name: 'Existing' },
  { email: 'new@example.com', name: 'New User' }
], { 
  ignoreDuplicates: true 
});

// Only new users will be created
```

### Batch Updates

```typescript
// Update multiple records in batch
const updates = [
  { 
    where: { id: user1Id },
    data: { name: 'Updated User 1' }
  },
  { 
    where: { id: user2Id },
    data: { name: 'Updated User 2' }
  }
];

await User.batchUpdate(updates);
```

### Batch Mixed Operations

```typescript
// Mix of creates, updates, and deletes
const operations = [
  { 
    operation: 'create',
    data: { email: 'new@example.com', name: 'New User' }
  },
  { 
    operation: 'update',
    where: { id: existingId },
    data: { name: 'Updated Name' }
  },
  { 
    operation: 'delete',
    where: { id: deleteId }
  }
];

await User.batchExecute(operations);
```

## 🔄 Advanced Operations

### Streaming Large Datasets

```typescript
// Stream large result sets
const userStream = User.stream({ is_active: true });

userStream.on('data', (user) => {
  console.log('Processing user:', user.name);
  // Process each user individually
});

userStream.on('end', () => {
  console.log('Finished processing all users');
});

userStream.on('error', (error) => {
  console.error('Stream error:', error);
});
```

### Raw Queries

```typescript
// Execute raw CQL
const result = await client.execute(
  'SELECT * FROM users WHERE token(id) > token(?)',
  [lastUserId],
  { prepare: true }
);

// With parameters
const users = await client.execute(
  'SELECT * FROM users WHERE age > ? AND city = ? ALLOW FILTERING',
  [25, 'New York'],
  { prepare: true }
);
```

### Transactions (Lightweight Transactions)

```typescript
// Compare and swap
const success = await User.update(
  { id: userId },
  { 
    balance: newBalance,
    version: currentVersion + 1
  },
  {
    if: { 
      balance: currentBalance,
      version: currentVersion
    }
  }
);

if (!success) {
  throw new Error('Concurrent modification detected');
}
```

## 🎯 Best Practices

### Performance Optimization

```typescript
// ✅ Good: Use prepared statements
const users = await User.find({ city: cityName }, { prepare: true });

// ✅ Good: Limit results
const recentUsers = await User.find({}, { 
  limit: 100,
  orderBy: { created_at: 'DESC' }
});

// ✅ Good: Use appropriate indexes
const usersByEmail = await User.findOne({ email: userEmail }); // email is indexed

// ❌ Avoid: ALLOW FILTERING on large tables
const users = await User.find({ 
  random_field: 'value' 
}, { 
  allow_filtering: true  // Can be slow on large tables
});
```

### Error Handling

```typescript
try {
  const user = await User.create({
    email: 'john@example.com',
    name: 'John Doe'
  });
} catch (error) {
  if (error.message.includes('Unique constraint violation')) {
    // Handle duplicate
    console.log('User already exists');
  } else if (error.message.includes('Validation failed')) {
    // Handle validation error
    console.log('Invalid data:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Data Consistency

```typescript
// Use transactions for consistency
const updateUserAndLog = async (userId: string, changes: any) => {
  try {
    // Update user
    await User.update({ id: userId }, changes);
    
    // Log the change
    await AuditLog.create({
      user_id: userId,
      action: 'user_updated',
      changes: changes,
      timestamp: new Date()
    });
    
  } catch (error) {
    // Rollback logic if needed
    throw error;
  }
};
```

---

**Master CRUD operations for efficient data management with CassandraORM JS! 📝✨**
