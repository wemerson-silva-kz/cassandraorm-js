# 🗃️ Data Types & CassandraTypes

Complete guide to Cassandra data types and the CassandraTypes helper system.

## 🎯 Overview

CassandraORM JS provides comprehensive support for all Cassandra data types through the `CassandraTypes` helper system, offering:
- **Type safety** with TypeScript
- **IntelliSense support** in IDEs
- **Validation helpers**
- **Collection types**
- **Custom type definitions**

## 📊 CassandraTypes Helper

### Basic Usage

```typescript
import { CassandraTypes } from 'cassandraorm-js';

const User = await client.loadSchema('users', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    age: CassandraTypes.INT,
    email: CassandraTypes.TEXT,
    created_at: CassandraTypes.TIMESTAMP
  },
  key: ['id']
});
```

### All Available Types

```typescript
// Numeric Types
const numericSchema = {
  tiny_number: CassandraTypes.TINYINT,     // -128 to 127
  small_number: CassandraTypes.SMALLINT,   // -32,768 to 32,767
  regular_number: CassandraTypes.INT,      // -2^31 to 2^31-1
  big_number: CassandraTypes.BIGINT,       // -2^63 to 2^63-1
  decimal_price: CassandraTypes.DECIMAL,   // Arbitrary precision
  float_rating: CassandraTypes.FLOAT,      // 32-bit IEEE 754
  double_precise: CassandraTypes.DOUBLE,   // 64-bit IEEE 754
  variable_int: CassandraTypes.VARINT      // Variable precision integer
};

// Text Types
const textSchema = {
  name: CassandraTypes.TEXT,               // UTF-8 text
  description: CassandraTypes.VARCHAR,     // Alias for TEXT
  code: CassandraTypes.ASCII              // ASCII characters only
};

// Date/Time Types
const dateTimeSchema = {
  created_at: CassandraTypes.TIMESTAMP,    // Date and time
  birth_date: CassandraTypes.DATE,         // Date only
  start_time: CassandraTypes.TIME,         // Time only
  event_id: CassandraTypes.TIMEUUID       // Time-based UUID
};

// Boolean and Binary
const otherSchema = {
  is_active: CassandraTypes.BOOLEAN,       // true/false
  avatar: CassandraTypes.BLOB,             // Binary data
  ip_address: CassandraTypes.INET          // IP address
};

// UUID Types
const uuidSchema = {
  id: CassandraTypes.UUID,                 // Random UUID
  time_id: CassandraTypes.TIMEUUID        // Time-based UUID
};
```

## 📦 Collection Types

### Set Types

```typescript
// Set of primitive types
const setSchema = {
  tags: CassandraTypes.set(CassandraTypes.TEXT),
  categories: CassandraTypes.set(CassandraTypes.TEXT),
  user_ids: CassandraTypes.set(CassandraTypes.UUID),
  scores: CassandraTypes.set(CassandraTypes.INT)
};

// Usage example
const Product = await client.loadSchema('products', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    tags: CassandraTypes.set(CassandraTypes.TEXT),
    category_ids: CassandraTypes.set(CassandraTypes.UUID)
  },
  key: ['id']
});

// Create with set data
const product = await Product.create({
  name: 'Laptop',
  tags: ['electronics', 'computers', 'portable'],
  category_ids: [categoryId1, categoryId2]
});
```

### List Types

```typescript
// List of primitive types
const listSchema = {
  comments: CassandraTypes.list(CassandraTypes.TEXT),
  ratings: CassandraTypes.list(CassandraTypes.FLOAT),
  timestamps: CassandraTypes.list(CassandraTypes.TIMESTAMP),
  user_history: CassandraTypes.list(CassandraTypes.UUID)
};

// Usage example
const Post = await client.loadSchema('posts', {
  fields: {
    id: CassandraTypes.UUID,
    title: CassandraTypes.TEXT,
    comments: CassandraTypes.list(CassandraTypes.TEXT),
    view_timestamps: CassandraTypes.list(CassandraTypes.TIMESTAMP)
  },
  key: ['id']
});

// Create with list data
const post = await Post.create({
  title: 'My Blog Post',
  comments: ['Great post!', 'Thanks for sharing', 'Very helpful'],
  view_timestamps: [new Date(), new Date()]
});
```

### Map Types

```typescript
// Map types with key-value pairs
const mapSchema = {
  metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
  settings: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
  scores_by_user: CassandraTypes.map(CassandraTypes.UUID, CassandraTypes.INT),
  attributes: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.FLOAT)
};

// Usage example
const User = await client.loadSchema('users', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    preferences: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
    scores: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.INT)
  },
  key: ['id']
});

// Create with map data
const user = await User.create({
  name: 'John Doe',
  preferences: {
    theme: 'dark',
    language: 'en',
    timezone: 'UTC'
  },
  scores: {
    math: 95,
    science: 87,
    english: 92
  }
});
```

## 🔧 Advanced Collection Types

### Nested Collections

```typescript
// List of sets
const nestedSchema = {
  tag_groups: CassandraTypes.list(CassandraTypes.set(CassandraTypes.TEXT)),
  user_groups: CassandraTypes.list(CassandraTypes.set(CassandraTypes.UUID))
};

// Map with complex values
const complexMapSchema = {
  user_tags: CassandraTypes.map(
    CassandraTypes.UUID, 
    CassandraTypes.set(CassandraTypes.TEXT)
  ),
  category_scores: CassandraTypes.map(
    CassandraTypes.TEXT,
    CassandraTypes.list(CassandraTypes.FLOAT)
  )
};
```

### Frozen Collections

```typescript
// Frozen collections (immutable)
const frozenSchema = {
  address: CassandraTypes.frozen(
    CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
  ),
  coordinates: CassandraTypes.frozen(
    CassandraTypes.list(CassandraTypes.FLOAT)
  )
};

// Usage
const Location = await client.loadSchema('locations', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    address: CassandraTypes.frozen(
      CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
    ),
    coordinates: CassandraTypes.frozen(
      CassandraTypes.list(CassandraTypes.FLOAT)
    )
  },
  key: ['id']
});
```

## 🎯 Tuple Types

### Basic Tuples

```typescript
// Tuple types for structured data
const tupleSchema = {
  coordinates: CassandraTypes.tuple(CassandraTypes.FLOAT, CassandraTypes.FLOAT),
  name_age: CassandraTypes.tuple(CassandraTypes.TEXT, CassandraTypes.INT),
  rgb_color: CassandraTypes.tuple(
    CassandraTypes.INT, 
    CassandraTypes.INT, 
    CassandraTypes.INT
  )
};

// Usage example
const GeoPoint = await client.loadSchema('geo_points', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    location: CassandraTypes.tuple(CassandraTypes.FLOAT, CassandraTypes.FLOAT),
    elevation: CassandraTypes.FLOAT
  },
  key: ['id']
});

// Create with tuple data
const point = await GeoPoint.create({
  name: 'Mount Everest',
  location: [27.9881, 86.9250], // [latitude, longitude]
  elevation: 8848.86
});
```

## 🔍 Type Validation and Conversion

### Automatic Type Conversion

```typescript
// CassandraTypes provides automatic conversion
const TypedModel = await client.loadSchema('typed_model', {
  fields: {
    id: CassandraTypes.UUID,
    count: CassandraTypes.INT,
    price: CassandraTypes.DECIMAL,
    is_active: CassandraTypes.BOOLEAN,
    created_at: CassandraTypes.TIMESTAMP
  },
  key: ['id']
});

// Automatic conversion happens
const record = await TypedModel.create({
  count: '42',           // String converted to INT
  price: '99.99',        // String converted to DECIMAL
  is_active: 'true',     // String converted to BOOLEAN
  created_at: '2024-01-15T10:30:00Z' // String converted to TIMESTAMP
});
```

### Type Validation

```typescript
// Type validation with CassandraTypes
const ValidatedModel = await client.loadSchema('validated', {
  fields: {
    id: CassandraTypes.UUID,
    email: {
      type: CassandraTypes.TEXT,
      validate: {
        required: true,
        isEmail: true
      }
    },
    age: {
      type: CassandraTypes.INT,
      validate: {
        min: 0,
        max: 150
      }
    },
    tags: {
      type: CassandraTypes.set(CassandraTypes.TEXT),
      validate: {
        maxItems: 10,
        itemValidation: {
          minLength: 2,
          maxLength: 50
        }
      }
    }
  },
  key: ['id']
});
```

## 🛠️ Custom Type Helpers

### Type Aliases

```typescript
// Create custom type aliases
const CustomTypes = {
  Email: CassandraTypes.TEXT,
  UserId: CassandraTypes.UUID,
  Price: CassandraTypes.DECIMAL,
  Tags: CassandraTypes.set(CassandraTypes.TEXT),
  Metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
  Coordinates: CassandraTypes.tuple(CassandraTypes.FLOAT, CassandraTypes.FLOAT)
};

// Use custom aliases
const User = await client.loadSchema('users', {
  fields: {
    id: CustomTypes.UserId,
    email: CustomTypes.Email,
    tags: CustomTypes.Tags,
    metadata: CustomTypes.Metadata,
    location: CustomTypes.Coordinates
  },
  key: ['id']
});
```

### Type Factories

```typescript
// Create type factories for common patterns
const TypeFactories = {
  // Address type factory
  Address: () => CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
  
  // User reference factory
  UserRef: () => CassandraTypes.UUID,
  
  // Timestamp list factory
  TimestampList: () => CassandraTypes.list(CassandraTypes.TIMESTAMP),
  
  // Score map factory
  ScoreMap: () => CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.FLOAT)
};

// Usage
const Order = await client.loadSchema('orders', {
  fields: {
    id: CassandraTypes.UUID,
    customer_id: TypeFactories.UserRef(),
    shipping_address: TypeFactories.Address(),
    status_history: TypeFactories.TimestampList(),
    item_scores: TypeFactories.ScoreMap()
  },
  key: ['id']
});
```

## 📊 Type Introspection

### Getting Type Information

```typescript
// Get type information
const typeInfo = CassandraTypes.getTypeInfo(CassandraTypes.TEXT);
console.log(typeInfo); // { name: 'text', category: 'primitive', nullable: true }

const setTypeInfo = CassandraTypes.getTypeInfo(
  CassandraTypes.set(CassandraTypes.TEXT)
);
console.log(setTypeInfo); 
// { name: 'set<text>', category: 'collection', elementType: 'text' }

const mapTypeInfo = CassandraTypes.getTypeInfo(
  CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.INT)
);
console.log(mapTypeInfo);
// { name: 'map<text,int>', category: 'collection', keyType: 'text', valueType: 'int' }
```

### Type Validation Helpers

```typescript
// Type validation helpers
const isValidType = CassandraTypes.isValidType('text'); // true
const isCollectionType = CassandraTypes.isCollectionType('set<text>'); // true
const isPrimitiveType = CassandraTypes.isPrimitiveType('uuid'); // true

// Parse complex types
const parsedType = CassandraTypes.parseType('map<text,list<int>>');
console.log(parsedType);
// { 
//   type: 'map', 
//   keyType: 'text', 
//   valueType: { type: 'list', elementType: 'int' } 
// }
```

## 🎯 Best Practices

### Type Selection Guidelines

```typescript
// ✅ Good: Use appropriate types for data
const OptimalTypes = {
  // Use TINYINT for small numbers
  status_code: CassandraTypes.TINYINT,     // 0-255
  
  // Use DECIMAL for money
  price: CassandraTypes.DECIMAL,           // Exact precision
  
  // Use SET for unique collections
  tags: CassandraTypes.set(CassandraTypes.TEXT),
  
  // Use LIST for ordered collections
  comments: CassandraTypes.list(CassandraTypes.TEXT),
  
  // Use MAP for key-value data
  metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
};

// ❌ Avoid: Wrong types for data
const PoorTypes = {
  // Don't use TEXT for numbers
  age: CassandraTypes.TEXT,                // Should be INT
  
  // Don't use BIGINT for small numbers
  count: CassandraTypes.BIGINT,            // Should be INT or SMALLINT
  
  // Don't use LIST for unique items
  unique_tags: CassandraTypes.list(CassandraTypes.TEXT) // Should be SET
};
```

### Performance Considerations

```typescript
// Optimize for query patterns
const PerformanceOptimized = await client.loadSchema('optimized', {
  fields: {
    // Partition key - use appropriate type
    user_id: CassandraTypes.UUID,
    
    // Clustering key - use sortable type
    created_at: CassandraTypes.TIMESTAMP,
    
    // Small collections for better performance
    recent_tags: CassandraTypes.set(CassandraTypes.TEXT), // Limit to ~100 items
    
    // Use frozen for complex nested types
    address: CassandraTypes.frozen(
      CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
    )
  },
  key: [['user_id'], 'created_at']
});
```

### Type Safety with TypeScript

```typescript
// Define TypeScript interfaces matching Cassandra types
interface UserData {
  id: string;                    // UUID
  name: string;                  // TEXT
  age: number;                   // INT
  tags: Set<string>;             // SET<TEXT>
  metadata: Map<string, string>; // MAP<TEXT,TEXT>
  coordinates: [number, number]; // TUPLE<FLOAT,FLOAT>
}

// Use with type safety
const TypeSafeUser = await client.loadSchema<UserData>('users', {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    age: CassandraTypes.INT,
    tags: CassandraTypes.set(CassandraTypes.TEXT),
    metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
    coordinates: CassandraTypes.tuple(CassandraTypes.FLOAT, CassandraTypes.FLOAT)
  },
  key: ['id']
});

// TypeScript will enforce correct types
const user: UserData = await TypeSafeUser.create({
  name: 'John Doe',
  age: 30,
  tags: new Set(['developer', 'typescript']),
  metadata: new Map([['theme', 'dark'], ['lang', 'en']]),
  coordinates: [40.7128, -74.0060]
});
```

## 📚 Complete Type Reference

```typescript
// All CassandraTypes in one place
const AllTypes = {
  // Primitive types
  ASCII: CassandraTypes.ASCII,
  BIGINT: CassandraTypes.BIGINT,
  BLOB: CassandraTypes.BLOB,
  BOOLEAN: CassandraTypes.BOOLEAN,
  DATE: CassandraTypes.DATE,
  DECIMAL: CassandraTypes.DECIMAL,
  DOUBLE: CassandraTypes.DOUBLE,
  FLOAT: CassandraTypes.FLOAT,
  INET: CassandraTypes.INET,
  INT: CassandraTypes.INT,
  SMALLINT: CassandraTypes.SMALLINT,
  TEXT: CassandraTypes.TEXT,
  TIME: CassandraTypes.TIME,
  TIMESTAMP: CassandraTypes.TIMESTAMP,
  TIMEUUID: CassandraTypes.TIMEUUID,
  TINYINT: CassandraTypes.TINYINT,
  UUID: CassandraTypes.UUID,
  VARCHAR: CassandraTypes.VARCHAR,
  VARINT: CassandraTypes.VARINT,
  
  // Collection factory functions
  set: CassandraTypes.set,
  list: CassandraTypes.list,
  map: CassandraTypes.map,
  tuple: CassandraTypes.tuple,
  frozen: CassandraTypes.frozen
};
```

---

**Master Cassandra data types with the powerful CassandraTypes system for type-safe, efficient data modeling! 🗃️✨**
