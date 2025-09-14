# 🔒 Unique Constraints

Complete guide to unique field validation and constraint management in CassandraORM JS.

## 🎯 Overview

CassandraORM JS provides robust unique constraint handling:
- **Field-level uniqueness** validation
- **Composite unique constraints**
- **Automatic validation** on create/update
- **Custom unique logic**
- **Performance optimization**

## 🔧 Basic Unique Constraints

### Single Field Uniqueness

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      unique: true,
      validate: { required: true, isEmail: true }
    },
    username: {
      type: 'text', 
      unique: true,
      validate: { required: true, minLength: 3 }
    }
  },
  key: ['id']
});

// This will work
const user1 = await User.create({
  email: 'john@example.com',
  username: 'johndoe'
});

// This will fail - duplicate email
try {
  const user2 = await User.create({
    email: 'john@example.com', // Duplicate!
    username: 'johndoe2'
  });
} catch (error) {
  console.log(error.message); // "Unique constraint violation: Field 'email'..."
}
```

### Schema-Level Unique Fields

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    name: 'text',
    sku: 'text',
    barcode: 'text'
  },
  unique: ['sku', 'barcode'], // Multiple unique fields
  key: ['id']
});
```

## 🔗 Composite Unique Constraints

### Multiple Field Uniqueness

```typescript
const Enrollment = await client.loadSchema('enrollments', {
  fields: {
    id: 'uuid',
    student_id: 'uuid',
    course_id: 'uuid',
    semester: 'text',
    year: 'int'
  },
  unique: [
    ['student_id', 'course_id'], // Student can't enroll in same course twice
    ['student_id', 'semester', 'year'] // Student can't have duplicate semester enrollment
  ],
  key: ['id']
});
```

### Complex Unique Logic

```typescript
const BookingSlot = await client.loadSchema('booking_slots', {
  fields: {
    id: 'uuid',
    resource_id: 'uuid',
    start_time: 'timestamp',
    end_time: 'timestamp',
    user_id: 'uuid'
  },
  unique: [
    {
      fields: ['resource_id', 'start_time'],
      condition: 'is_active = true' // Only active bookings need to be unique
    }
  ],
  key: ['id']
});
```

## 🛠️ UniqueConstraintManager

### Manual Unique Validation

```typescript
import { UniqueConstraintManager } from 'cassandraorm-js';

const uniqueManager = new UniqueConstraintManager(client.driver, 'myapp');

// Check uniqueness manually
const isUnique = await uniqueManager.checkUnique('users', 'email', 'john@example.com');
if (!isUnique) {
  throw new Error('Email already exists');
}

// Check composite uniqueness
const isCompositeUnique = await uniqueManager.checkCompositeUnique(
  'enrollments',
  { student_id: studentId, course_id: courseId }
);
```

### Batch Unique Validation

```typescript
const users = [
  { email: 'user1@example.com', username: 'user1' },
  { email: 'user2@example.com', username: 'user2' },
  { email: 'user1@example.com', username: 'user3' } // Duplicate email
];

const validationResults = await uniqueManager.validateBatch('users', users, ['email', 'username']);

validationResults.forEach((result, index) => {
  if (!result.isValid) {
    console.log(`User ${index}: ${result.violations.join(', ')}`);
  }
});
```

## ⚡ Performance Optimization

### Unique Index Tables

```typescript
// CassandraORM automatically creates unique index tables
// For field 'email' in 'users' table, creates:
// CREATE TABLE users_email_unique (
//   email text PRIMARY KEY,
//   id uuid
// );

// Manual unique table management
await uniqueManager.createUniqueTable('users', 'email');
await uniqueManager.dropUniqueTable('users', 'email');
```

### Batch Unique Operations

```typescript
// Efficient batch unique checking
const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
const uniqueEmails = await uniqueManager.filterUnique('users', 'email', emails);
console.log('Available emails:', uniqueEmails);
```

## 🔄 Update Handling

### Unique Constraint on Updates

```typescript
// Update with unique validation
try {
  await User.update(
    { id: userId },
    { email: 'newemail@example.com' }
  );
} catch (error) {
  if (error.message.includes('Unique constraint violation')) {
    console.log('Email already taken by another user');
  }
}
```

### Conditional Updates

```typescript
// Only update if new value is unique
const newEmail = 'updated@example.com';
const isEmailAvailable = await uniqueManager.checkUnique('users', 'email', newEmail, userId);

if (isEmailAvailable) {
  await User.update({ id: userId }, { email: newEmail });
} else {
  throw new Error('Email already in use');
}
```

## 🎯 Advanced Patterns

### Soft Unique Constraints

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    is_deleted: { type: 'boolean', default: false }
  },
  unique: [
    {
      fields: ['email'],
      condition: 'is_deleted = false' // Only enforce uniqueness for active users
    }
  ],
  key: ['id']
});
```

### Time-based Uniqueness

```typescript
const Coupon = await client.loadSchema('coupons', {
  fields: {
    id: 'uuid',
    code: 'text',
    valid_from: 'timestamp',
    valid_until: 'timestamp'
  },
  unique: [
    {
      fields: ['code'],
      condition: 'valid_until > NOW()' // Only active coupons need unique codes
    }
  ],
  key: ['id']
});
```

### Custom Unique Validation

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    username: 'text'
  },
  unique: ['email'],
  
  // Custom unique validation
  before_save: async function(instance, options) {
    // Custom username uniqueness (case-insensitive)
    if (instance.isModified('username')) {
      const existing = await User.findOne({
        username: instance.username.toLowerCase()
      });
      
      if (existing && existing.id !== instance.id) {
        throw new Error('Username already exists (case-insensitive)');
      }
    }
    
    return true;
  },
  
  key: ['id']
});
```

## 🚨 Error Handling

### Unique Constraint Errors

```typescript
try {
  await User.create({
    email: 'duplicate@example.com',
    username: 'duplicate_user'
  });
} catch (error) {
  if (error.name === 'UniqueConstraintError') {
    console.log('Unique constraint violation:');
    console.log('Field:', error.field);
    console.log('Value:', error.value);
    console.log('Table:', error.table);
    
    // Handle specific fields
    if (error.field === 'email') {
      console.log('Email already registered');
    } else if (error.field === 'username') {
      console.log('Username already taken');
    }
  }
}
```

### Graceful Handling

```typescript
const createUserSafely = async (userData) => {
  try {
    return await User.create(userData);
  } catch (error) {
    if (error.name === 'UniqueConstraintError') {
      // Try with modified data
      if (error.field === 'username') {
        userData.username = `${userData.username}_${Date.now()}`;
        return await User.create(userData);
      }
    }
    throw error;
  }
};
```

## 🔧 Configuration

### Unique Constraint Options

```typescript
const uniqueOptions = {
  // Enable/disable unique constraints
  enabled: true,
  
  // Validation timing
  validateOnCreate: true,
  validateOnUpdate: true,
  
  // Performance options
  batchSize: 100,
  cacheResults: true,
  cacheTTL: 300,
  
  // Error handling
  throwOnViolation: true,
  collectAllViolations: false
};

const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { type: 'text', unique: true }
  },
  uniqueOptions,
  key: ['id']
});
```

### Global Unique Settings

```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  },
  ormOptions: {
    uniqueConstraints: {
      enabled: true,
      autoCreateTables: true,
      validateOnSave: true,
      batchValidation: true
    }
  }
});
```

## 📊 Monitoring & Debugging

### Unique Constraint Statistics

```typescript
const stats = await uniqueManager.getStatistics();
console.log('Unique constraint stats:', {
  totalChecks: stats.totalChecks,
  violations: stats.violations,
  cacheHits: stats.cacheHits,
  averageCheckTime: stats.averageCheckTime
});
```

### Debug Unique Issues

```typescript
// Enable debug logging
const uniqueManager = new UniqueConstraintManager(client.driver, 'myapp', {
  debug: true,
  logViolations: true
});

// Check what's causing uniqueness violation
const conflictInfo = await uniqueManager.getConflictInfo('users', 'email', 'john@example.com');
console.log('Conflicting record:', conflictInfo);
```

## 🎯 Best Practices

### Design Guidelines

```typescript
// ✅ Good: Use appropriate unique constraints
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { type: 'text', unique: true }, // Natural unique field
    username: { type: 'text', unique: true }, // User-facing unique field
    phone: { type: 'text', unique: true } // Contact unique field
  },
  key: ['id']
});

// ❌ Avoid: Too many unique constraints
const OverConstrained = await client.loadSchema('over_constrained', {
  fields: {
    id: 'uuid',
    field1: { type: 'text', unique: true },
    field2: { type: 'text', unique: true },
    field3: { type: 'text', unique: true },
    field4: { type: 'text', unique: true }, // Too many!
    field5: { type: 'text', unique: true }
  },
  key: ['id']
});
```

### Performance Considerations

```typescript
// ✅ Good: Batch operations for better performance
const users = await User.createMany([
  { email: 'user1@example.com', username: 'user1' },
  { email: 'user2@example.com', username: 'user2' }
], { 
  ignoreDuplicates: true, // Handle duplicates gracefully
  batchSize: 50 // Process in batches
});

// ✅ Good: Use upsert for idempotent operations
const user = await User.create({
  email: 'john@example.com',
  username: 'johndoe'
}, { 
  upsert: true // Update if exists, create if not
});
```

## 🔗 Next Steps

- **[Connection Pool →](../connection/connection-pool.md)** - Advanced connection management
- **[Performance →](../performance/monitoring.md)** - Monitor unique constraint performance
- **[Validation →](./validation.md)** - Combine with other validation rules

---

**Ensure data integrity with robust unique constraints in CassandraORM JS! 🔒✨**
