# Serialization

## Overview
Advanced serialization and deserialization with custom transformers, type conversion, and format support.

## Basic Serialization

```typescript
import { Serializer } from 'cassandraorm-js';

const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    created_at: 'timestamp',
    profile: 'frozen<user_profile>'
  },
  serialize: {
    id: (value) => value.toString(),
    created_at: (value) => value.toISOString(),
    profile: (value) => JSON.stringify(value)
  }
});

// Serialize instance
const user = await User.findOne({ id: userId });
const serialized = user.serialize();
console.log(serialized);
// { id: "123e4567-e89b-12d3-a456-426614174000", email: "user@example.com", ... }
```

## Custom Serializers

```typescript
// Register global serializer
Serializer.register('uuid', {
  serialize: (value) => value.toString(),
  deserialize: (value) => UUID.fromString(value)
});

Serializer.register('timestamp', {
  serialize: (value) => value.toISOString(),
  deserialize: (value) => new Date(value)
});

// Field-specific serialization
const Product = await client.loadSchema('products', {
  fields: {
    price: {
      type: 'decimal',
      serialize: (value) => parseFloat(value.toFixed(2)),
      deserialize: (value) => new Decimal(value)
    },
    tags: {
      type: 'set<text>',
      serialize: (value) => Array.from(value),
      deserialize: (value) => new Set(value)
    }
  }
});
```

## Format-specific Serialization

```typescript
// JSON serialization
const jsonSerializer = new Serializer({
  format: 'json',
  transforms: {
    dates: 'iso',
    decimals: 'string',
    uuids: 'string'
  }
});

// XML serialization
const xmlSerializer = new Serializer({
  format: 'xml',
  rootElement: 'user',
  transforms: {
    arrays: 'elements',
    objects: 'attributes'
  }
});

// CSV serialization
const csvSerializer = new Serializer({
  format: 'csv',
  headers: true,
  delimiter: ',',
  transforms: {
    nested: 'flatten'
  }
});

const users = await User.find({});
const jsonData = jsonSerializer.serialize(users);
const xmlData = xmlSerializer.serialize(users);
const csvData = csvSerializer.serialize(users);
```

## Nested Object Serialization

```typescript
const Order = await client.loadSchema('orders', {
  fields: {
    id: 'uuid',
    customer: 'frozen<customer>',
    items: 'list<frozen<order_item>>',
    shipping_address: 'frozen<address>'
  },
  serialize: {
    customer: {
      id: (value) => value.toString(),
      name: (value) => value.trim()
    },
    items: {
      '*': { // Apply to all array items
        price: (value) => parseFloat(value.toFixed(2)),
        product_id: (value) => value.toString()
      }
    },
    shipping_address: {
      coordinates: (value) => `${value.lat},${value.lng}`
    }
  }
});
```

## Conditional Serialization

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    password_hash: 'text',
    role: 'text'
  },
  serialize: {
    // Conditional field inclusion
    password_hash: {
      condition: (instance, context) => context.user?.role === 'admin',
      transform: () => '[HIDDEN]'
    },
    // Role-based serialization
    email: {
      condition: (instance, context) => {
        return context.user?.id === instance.id || context.user?.role === 'admin';
      }
    }
  }
});

// Serialize with context
const serialized = user.serialize({ 
  context: { user: currentUser } 
});
```

## Serialization Groups

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    password_hash: 'text',
    profile: 'frozen<user_profile>',
    internal_notes: 'text'
  },
  serializationGroups: {
    public: ['id', 'email', 'profile'],
    private: ['id', 'email', 'profile', 'password_hash'],
    admin: ['id', 'email', 'profile', 'internal_notes']
  }
});

// Serialize specific group
const publicData = user.serialize({ group: 'public' });
const adminData = user.serialize({ group: 'admin' });
```

## Virtual Fields

```typescript
const User = await client.loadSchema('users', {
  fields: {
    first_name: 'text',
    last_name: 'text',
    created_at: 'timestamp'
  },
  virtuals: {
    full_name: {
      get: function() {
        return `${this.first_name} ${this.last_name}`;
      },
      serialize: true
    },
    age: {
      get: function() {
        return Math.floor((Date.now() - this.created_at) / (365.25 * 24 * 60 * 60 * 1000));
      },
      serialize: { groups: ['detailed'] }
    }
  }
});
```

## Bulk Serialization

```typescript
import { BulkSerializer } from 'cassandraorm-js';

const bulkSerializer = new BulkSerializer({
  batchSize: 1000,
  parallel: true,
  format: 'json'
});

// Serialize large datasets
const users = await User.find({});
const serializedData = await bulkSerializer.serialize(users, {
  group: 'public',
  stream: true // Stream for memory efficiency
});

// Export to file
await bulkSerializer.exportToFile(users, 'users.json', {
  format: 'json',
  compress: true
});
```

## Deserialization

```typescript
// Deserialize from JSON
const userData = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "user@example.com",
  created_at: "2024-01-15T10:30:00.000Z"
};

const user = User.deserialize(userData);

// Bulk deserialization
const usersData = [/* array of user objects */];
const users = User.deserializeBulk(usersData);

// Validate during deserialization
const validatedUser = User.deserialize(userData, {
  validate: true,
  groups: ['registration']
});
```
