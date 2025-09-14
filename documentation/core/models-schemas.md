# 📋 Models & Schemas

Complete guide to defining data models and schemas in CassandraORM JS.

## 🎯 Overview

CassandraORM JS provides a powerful schema definition system that supports:
- **All Cassandra data types**
- **Field validation**
- **Unique constraints**
- **Relationships**
- **Indexes and materialized views**
- **TypeScript integration**

## 📊 Basic Schema Definition

### Simple Model

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    age: 'int',
    created_at: 'timestamp'
  },
  key: ['id']
});
```

### Advanced Model with Options

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    sku: { 
      type: 'text', 
      unique: true,
      validate: { required: true, minLength: 3 }
    },
    name: {
      type: 'text',
      validate: { required: true, maxLength: 100 }
    },
    price: {
      type: 'decimal',
      validate: { required: true, min: 0 }
    },
    category: 'text',
    tags: 'set<text>',
    metadata: 'map<text,text>',
    inventory_count: {
      type: 'int',
      default: 0
    },
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
  key: ['id'],
  unique: ['sku'],
  indexes: ['category', 'is_active'],
  table_name: 'products',
  options: {
    clustering_order: { created_at: 'DESC' },
    compaction: { class: 'LeveledCompactionStrategy' }
  }
});
```

## 🔑 Primary Keys

### Simple Primary Key

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  key: ['id'] // Simple primary key
});
```

### Composite Primary Key

```typescript
const UserSession = await client.loadSchema('user_sessions', {
  fields: {
    user_id: 'uuid',
    session_id: 'text',
    created_at: 'timestamp',
    expires_at: 'timestamp'
  },
  key: ['user_id', 'session_id'] // Composite key
});
```

### Partition Key + Clustering Key

```typescript
const TimeSeriesData = await client.loadSchema('sensor_data', {
  fields: {
    device_id: 'uuid',
    sensor_type: 'text',
    timestamp: 'timestamp',
    value: 'double',
    quality: 'int'
  },
  key: [['device_id'], 'timestamp'] // Partition key: device_id, Clustering: timestamp
});

// Multiple partition keys
const MultiPartition = await client.loadSchema('events', {
  fields: {
    tenant_id: 'text',
    user_id: 'uuid',
    event_type: 'text',
    timestamp: 'timestamp',
    data: 'text'
  },
  key: [['tenant_id', 'user_id'], 'timestamp', 'event_type']
});
```

## 🏷️ Field Types and Validation

### Basic Types

```typescript
const AllTypes = await client.loadSchema('all_types', {
  fields: {
    // Numeric types
    id: 'uuid',
    count: 'int',
    big_count: 'bigint',
    small_count: 'smallint',
    tiny_count: 'tinyint',
    price: 'decimal',
    rating: 'float',
    precise_rating: 'double',
    
    // Text types
    name: 'text',
    description: 'varchar',
    code: 'ascii',
    
    // Date/Time
    created_at: 'timestamp',
    birth_date: 'date',
    start_time: 'time',
    
    // Boolean
    is_active: 'boolean',
    
    // Binary
    avatar: 'blob',
    
    // Network
    ip_address: 'inet',
    
    // Collections
    tags: 'set<text>',
    categories: 'list<text>',
    metadata: 'map<text,text>',
    
    // Advanced types
    location: 'tuple<float,float>',
    time_id: 'timeuuid',
    json_data: 'text' // Store JSON as text
  },
  key: ['id']
});
```

### Field Validation

```typescript
const ValidatedUser = await client.loadSchema('validated_users', {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true,
        maxLength: 255
      }
    },
    username: {
      type: 'text',
      validate: {
        required: true,
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/,
        custom: (value) => {
          if (value.includes('admin')) {
            throw new Error('Username cannot contain "admin"');
          }
          return true;
        }
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 13,
        max: 120
      }
    },
    password: {
      type: 'text',
      validate: {
        required: true,
        minLength: 8,
        custom: (value) => {
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            throw new Error('Password must contain uppercase, lowercase, and number');
          }
          return true;
        }
      }
    }
  },
  key: ['id']
});
```

### Default Values

```typescript
const DefaultValues = await client.loadSchema('defaults', {
  fields: {
    id: {
      type: 'uuid',
      default: () => client.uuid() // Function default
    },
    status: {
      type: 'text',
      default: 'active' // Static default
    },
    created_at: {
      type: 'timestamp',
      default: () => new Date() // Dynamic default
    },
    counter: {
      type: 'int',
      default: 0
    },
    settings: {
      type: 'map<text,text>',
      default: {} // Object default
    }
  },
  key: ['id']
});
```

## 🔗 Relationships

### One-to-Many (hasMany)

```typescript
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

const Post = await client.loadSchema('posts', {
  fields: {
    id: 'uuid',
    user_id: 'uuid',
    title: 'text',
    content: 'text'
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
```

### Many-to-Many

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  relations: {
    roles: {
      model: 'roles',
      through: 'user_roles',
      type: 'hasMany'
    }
  },
  key: ['id']
});

const Role = await client.loadSchema('roles', {
  fields: {
    id: 'uuid',
    name: 'text'
  },
  relations: {
    users: {
      model: 'users',
      through: 'user_roles',
      type: 'hasMany'
    }
  },
  key: ['id']
});

const UserRole = await client.loadSchema('user_roles', {
  fields: {
    user_id: 'uuid',
    role_id: 'uuid',
    assigned_at: 'timestamp'
  },
  key: ['user_id', 'role_id']
});
```

## 🔍 Indexes and Materialized Views

### Secondary Indexes

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    name: 'text',
    category: 'text',
    price: 'decimal',
    is_active: 'boolean',
    created_at: 'timestamp'
  },
  key: ['id'],
  indexes: [
    'category',           // Simple index
    'is_active',         // Boolean index
    'price',             // Numeric index
    ['category', 'price'] // Composite index
  ]
});
```

### Materialized Views

```typescript
const Order = await client.loadSchema('orders', {
  fields: {
    id: 'uuid',
    customer_id: 'uuid',
    status: 'text',
    total: 'decimal',
    created_at: 'timestamp'
  },
  key: ['id'],
  materialized_views: {
    orders_by_customer: {
      select: ['id', 'status', 'total', 'created_at'],
      key: [['customer_id'], 'created_at', 'id'],
      clustering_order: { created_at: 'DESC' }
    },
    orders_by_status: {
      select: ['id', 'customer_id', 'total', 'created_at'],
      key: [['status'], 'created_at', 'id'],
      clustering_order: { created_at: 'DESC' }
    }
  }
});
```

## ⚡ Advanced Schema Options

### Table Options

```typescript
const HighPerformance = await client.loadSchema('high_performance', {
  fields: {
    id: 'uuid',
    data: 'text',
    timestamp: 'timestamp'
  },
  key: ['id'],
  options: {
    // Clustering order
    clustering_order: { timestamp: 'DESC' },
    
    // Compaction strategy
    compaction: {
      class: 'LeveledCompactionStrategy',
      sstable_size_in_mb: 160
    },
    
    // Compression
    compression: {
      algorithm: 'LZ4Compressor',
      chunk_length_in_kb: 64
    },
    
    // TTL
    default_time_to_live: 86400, // 24 hours
    
    // Caching
    caching: {
      keys: 'ALL',
      rows_per_partition: 'NONE'
    },
    
    // Bloom filter
    bloom_filter_fp_chance: 0.01,
    
    // Read repair
    read_repair_chance: 0.0,
    dclocal_read_repair_chance: 0.1
  }
});
```

### Virtual Fields

```typescript
const UserWithVirtuals = await client.loadSchema('users_virtual', {
  fields: {
    id: 'uuid',
    first_name: 'text',
    last_name: 'text',
    birth_date: 'date',
    
    // Virtual field - computed
    full_name: {
      type: 'text',
      virtual: {
        get: function() {
          return `${this.first_name} ${this.last_name}`;
        },
        set: function(value) {
          const parts = value.split(' ');
          this.first_name = parts[0];
          this.last_name = parts.slice(1).join(' ');
        }
      }
    },
    
    // Virtual field - age calculation
    age: {
      type: 'int',
      virtual: {
        get: function() {
          if (!this.birth_date) return null;
          const today = new Date();
          const birth = new Date(this.birth_date);
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          return age;
        }
      }
    }
  },
  key: ['id']
});
```

## 🔧 Schema Methods and Hooks

### Instance Methods

```typescript
const UserWithMethods = await client.loadSchema('users_methods', {
  fields: {
    id: 'uuid',
    email: 'text',
    password: 'text',
    last_login: 'timestamp'
  },
  key: ['id'],
  methods: {
    // Instance method
    updateLastLogin: function() {
      this.last_login = new Date();
      return this.save();
    },
    
    // Async instance method
    sendWelcomeEmail: async function() {
      // Email service integration
      console.log(`Sending welcome email to ${this.email}`);
      return true;
    },
    
    // Method with parameters
    changePassword: function(newPassword) {
      // Hash password logic here
      this.password = hashPassword(newPassword);
      return this.save();
    }
  }
});
```

### Lifecycle Hooks

```typescript
const UserWithHooks = await client.loadSchema('users_hooks', {
  fields: {
    id: 'uuid',
    email: 'text',
    password: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id'],
  
  // Before save hook
  before_save: function(instance, options) {
    // Hash password before saving
    if (instance.isModified('password')) {
      instance.password = hashPassword(instance.password);
    }
    
    // Update timestamps
    if (instance.isNew()) {
      instance.created_at = new Date();
    }
    instance.updated_at = new Date();
    
    return true; // Continue with save
  },
  
  // After save hook
  after_save: function(instance, options) {
    // Send welcome email for new users
    if (instance.isNew()) {
      instance.sendWelcomeEmail();
    }
    
    // Log activity
    console.log(`User ${instance.id} saved`);
    
    return true;
  },
  
  // Before delete hook
  before_delete: function(instance, options) {
    // Prevent deletion of admin users
    if (instance.email.includes('admin')) {
      throw new Error('Cannot delete admin user');
    }
    
    return true;
  },
  
  // After delete hook
  after_delete: function(instance, options) {
    // Cleanup related data
    console.log(`Cleaning up data for user ${instance.id}`);
    
    return true;
  }
});
```

## 📊 Schema Validation

### Custom Validators

```typescript
const CustomValidated = await client.loadSchema('custom_validated', {
  fields: {
    id: 'uuid',
    phone: {
      type: 'text',
      validate: {
        custom: (value) => {
          const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
          if (!phoneRegex.test(value)) {
            throw new Error('Invalid phone number format');
          }
          return true;
        }
      }
    },
    credit_card: {
      type: 'text',
      validate: {
        custom: (value) => {
          // Luhn algorithm validation
          const digits = value.replace(/\D/g, '');
          let sum = 0;
          let isEven = false;
          
          for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits[i]);
            
            if (isEven) {
              digit *= 2;
              if (digit > 9) digit -= 9;
            }
            
            sum += digit;
            isEven = !isEven;
          }
          
          if (sum % 10 !== 0) {
            throw new Error('Invalid credit card number');
          }
          
          return true;
        }
      }
    }
  },
  key: ['id']
});
```

## 🎯 Best Practices

### Schema Design Guidelines

```typescript
// ✅ Good: Denormalized for read performance
const OrderSummary = await client.loadSchema('order_summaries', {
  fields: {
    id: 'uuid',
    customer_id: 'uuid',
    customer_name: 'text',        // Denormalized
    customer_email: 'text',       // Denormalized
    total_amount: 'decimal',
    item_count: 'int',
    status: 'text',
    created_at: 'timestamp'
  },
  key: ['id']
});

// ✅ Good: Time-series partitioning
const Metrics = await client.loadSchema('metrics', {
  fields: {
    metric_name: 'text',
    bucket: 'text',              // e.g., '2024-01-15-14' (hour bucket)
    timestamp: 'timestamp',
    value: 'double'
  },
  key: [['metric_name', 'bucket'], 'timestamp']
});

// ❌ Avoid: Too many secondary indexes
const BadIndexes = await client.loadSchema('bad_indexes', {
  fields: {
    id: 'uuid',
    field1: 'text',
    field2: 'text',
    field3: 'text',
    field4: 'text'
  },
  key: ['id'],
  indexes: ['field1', 'field2', 'field3', 'field4'] // Too many!
});
```

### Performance Optimization

```typescript
// Use appropriate data types
const Optimized = await client.loadSchema('optimized', {
  fields: {
    id: 'uuid',
    status: 'tinyint',           // Use smallest appropriate type
    count: 'int',                // Not bigint if not needed
    price: 'decimal',            // Use decimal for money
    tags: 'set<text>',           // Use set for unique values
    metadata: 'map<text,text>'   // Use map for key-value pairs
  },
  key: ['id'],
  options: {
    compaction: {
      class: 'LeveledCompactionStrategy' // Good for read-heavy
    }
  }
});
```

---

**Master data modeling with CassandraORM JS for optimal performance and maintainability! 📋✨**
