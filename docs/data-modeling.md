# Data Modeling

## Overview
Design efficient Cassandra data models with denormalization, partition strategies, and query-driven design.

## Schema Definition

```typescript
import { createClient } from 'cassandraorm-js';

const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: { type: 'text', unique: true },
    name: 'text',
    created_at: 'timestamp',
    profile: {
      type: 'frozen<user_profile>',
      typeDef: {
        bio: 'text',
        avatar_url: 'text',
        preferences: 'map<text, text>'
      }
    }
  },
  key: ['id'],
  clustering_order: { created_at: 'desc' }
});
```

## Partition Strategy

```typescript
// Time-series partitioning
const Metrics = await client.loadSchema('metrics', {
  fields: {
    metric_name: 'text',
    bucket: 'text', // YYYY-MM-DD-HH
    timestamp: 'timestamp',
    value: 'double',
    tags: 'map<text, text>'
  },
  key: [['metric_name', 'bucket'], 'timestamp'],
  clustering_order: { timestamp: 'desc' }
});

// User-based partitioning
const UserPosts = await client.loadSchema('user_posts', {
  fields: {
    user_id: 'uuid',
    post_id: 'timeuuid',
    title: 'text',
    content: 'text',
    created_at: 'timestamp'
  },
  key: ['user_id', 'post_id'],
  clustering_order: { post_id: 'desc' }
});
```

## Denormalization Patterns

```typescript
// Materialized views
const PostsByTag = await client.loadSchema('posts_by_tag', {
  fields: {
    tag: 'text',
    post_id: 'timeuuid',
    title: 'text',
    author_id: 'uuid',
    created_at: 'timestamp'
  },
  key: ['tag', 'post_id'],
  materialized_view: {
    base_table: 'posts',
    where: 'tag IS NOT NULL'
  }
});

// Lookup tables
const EmailToUser = await client.loadSchema('email_to_user', {
  fields: {
    email: 'text',
    user_id: 'uuid'
  },
  key: ['email']
});
```

## Collection Types

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    name: 'text',
    tags: 'set<text>',
    attributes: 'map<text, text>',
    reviews: 'list<frozen<review>>',
    coordinates: 'tuple<double, double>'
  },
  key: ['id']
});

// Working with collections
await Product.create({
  id: uuid(),
  name: 'Laptop',
  tags: new Set(['electronics', 'computers']),
  attributes: new Map([['brand', 'Dell'], ['color', 'black']]),
  reviews: [{ rating: 5, comment: 'Great!' }],
  coordinates: [40.7128, -74.0060]
});
```
