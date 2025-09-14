# 🔍 Query Builder

Advanced query building capabilities for complex database operations.

## 🎯 Overview

CassandraORM JS provides a powerful query builder that supports:
- **Fluent interface** for readable queries
- **Complex conditions** and joins
- **Aggregations** and grouping
- **Subqueries** and CTEs
- **Performance optimization**

## 🏗️ Basic Query Builder

### Simple Queries

```typescript
import { QueryBuilder } from 'cassandraorm-js';

const queryBuilder = new QueryBuilder(client.driver, 'myapp');

// Basic select
const users = await queryBuilder
  .table('users')
  .select(['id', 'name', 'email'])
  .where('is_active', '=', true)
  .limit(10)
  .execute();

// Method chaining
const products = await queryBuilder
  .table('products')
  .select('*')
  .where('category', '=', 'electronics')
  .where('price', '>', 100)
  .orderBy('price', 'DESC')
  .execute();
```

### Advanced Where Conditions

```typescript
// Multiple conditions
const query = queryBuilder
  .table('orders')
  .where('status', '=', 'pending')
  .where('created_at', '>', new Date('2024-01-01'))
  .where('total_amount', 'BETWEEN', [100, 1000]);

// OR conditions
const users = await queryBuilder
  .table('users')
  .where('city', '=', 'New York')
  .orWhere('city', '=', 'San Francisco')
  .execute();

// Grouped conditions
const complexQuery = await queryBuilder
  .table('products')
  .where(function(query) {
    query.where('category', '=', 'electronics')
         .where('price', '<', 500);
  })
  .orWhere(function(query) {
    query.where('category', '=', 'books')
         .where('rating', '>', 4.5);
  })
  .execute();
```

### IN and NOT IN Queries

```typescript
// IN query
const users = await queryBuilder
  .table('users')
  .whereIn('id', [id1, id2, id3])
  .execute();

// NOT IN query
const products = await queryBuilder
  .table('products')
  .whereNotIn('status', ['discontinued', 'out_of_stock'])
  .execute();

// Subquery IN
const activeUsers = await queryBuilder
  .table('users')
  .whereIn('id', function(subquery) {
    subquery.table('user_sessions')
            .select('user_id')
            .where('last_activity', '>', new Date(Date.now() - 86400000));
  })
  .execute();
```

## 🔗 Advanced Query Builder

### Joins and Relations

```typescript
import { AdvancedQueryBuilder } from 'cassandraorm-js';

const advancedBuilder = new AdvancedQueryBuilder(client.driver, 'myapp');

// Inner join
const usersWithPosts = await advancedBuilder
  .table('users')
  .select(['users.name', 'posts.title', 'posts.created_at'])
  .join('posts', 'users.id', '=', 'posts.user_id')
  .where('posts.published', '=', true)
  .execute();

// Left join
const allUsersWithPostCount = await advancedBuilder
  .table('users')
  .select(['users.name', 'COUNT(posts.id) as post_count'])
  .leftJoin('posts', 'users.id', '=', 'posts.user_id')
  .groupBy('users.id', 'users.name')
  .execute();

// Multiple joins
const orderDetails = await advancedBuilder
  .table('orders')
  .select([
    'orders.id',
    'users.name as customer_name',
    'products.name as product_name',
    'order_items.quantity'
  ])
  .join('users', 'orders.user_id', '=', 'users.id')
  .join('order_items', 'orders.id', '=', 'order_items.order_id')
  .join('products', 'order_items.product_id', '=', 'products.id')
  .where('orders.status', '=', 'completed')
  .execute();
```

### Aggregations

```typescript
// Basic aggregations
const stats = await advancedBuilder
  .table('orders')
  .select([
    'COUNT(*) as total_orders',
    'SUM(total_amount) as total_revenue',
    'AVG(total_amount) as avg_order_value',
    'MAX(total_amount) as largest_order',
    'MIN(total_amount) as smallest_order'
  ])
  .where('status', '=', 'completed')
  .execute();

// Group by aggregations
const salesByCategory = await advancedBuilder
  .table('products')
  .select([
    'category',
    'COUNT(*) as product_count',
    'AVG(price) as avg_price',
    'SUM(inventory_count) as total_inventory'
  ])
  .groupBy('category')
  .having('COUNT(*)', '>', 5)
  .orderBy('total_inventory', 'DESC')
  .execute();

// Time-based aggregations
const dailySales = await advancedBuilder
  .table('orders')
  .select([
    'DATE(created_at) as order_date',
    'COUNT(*) as order_count',
    'SUM(total_amount) as daily_revenue'
  ])
  .where('created_at', '>=', new Date('2024-01-01'))
  .groupBy('DATE(created_at)')
  .orderBy('order_date', 'ASC')
  .execute();
```

### Window Functions

```typescript
// Ranking functions
const topCustomers = await advancedBuilder
  .table('orders')
  .select([
    'user_id',
    'total_amount',
    'ROW_NUMBER() OVER (ORDER BY total_amount DESC) as rank',
    'DENSE_RANK() OVER (ORDER BY total_amount DESC) as dense_rank'
  ])
  .execute();

// Partition by
const salesRanking = await advancedBuilder
  .table('sales')
  .select([
    'salesperson_id',
    'region',
    'sales_amount',
    'RANK() OVER (PARTITION BY region ORDER BY sales_amount DESC) as region_rank'
  ])
  .execute();

// Running totals
const runningTotals = await advancedBuilder
  .table('transactions')
  .select([
    'date',
    'amount',
    'SUM(amount) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as running_total'
  ])
  .orderBy('date')
  .execute();
```

## 📊 Aggregation Manager

### MongoDB-style Aggregations

```typescript
import { AggregationsManager } from 'cassandraorm-js';

const aggregations = new AggregationsManager(client.driver, 'myapp');

// Basic pipeline
const userStats = await aggregations
  .createPipeline('users')
  .where('is_active', '=', true)
  .groupBy('city')
  .count('user_count')
  .avg('age', 'avg_age')
  .execute();

// Complex pipeline
const salesAnalysis = await aggregations
  .createPipeline('orders')
  .where('status', '=', 'completed')
  .where('created_at', '>=', new Date('2024-01-01'))
  .groupBy('customer_id')
  .sum('total_amount', 'total_spent')
  .count('order_count')
  .avg('total_amount', 'avg_order_value')
  .having('total_spent', '>', 1000)
  .sort('total_spent', 'DESC')
  .limit(100)
  .execute();
```

### Advanced Aggregation Operations

```typescript
// Multiple grouping levels
const hierarchicalStats = await aggregations
  .createPipeline('sales')
  .groupBy(['region', 'category'])
  .sum('amount', 'total_sales')
  .count('transaction_count')
  .avg('amount', 'avg_transaction')
  .execute();

// Conditional aggregations
const conditionalStats = await aggregations
  .createPipeline('orders')
  .groupBy('customer_type')
  .sum('CASE WHEN status = "completed" THEN total_amount ELSE 0 END', 'completed_revenue')
  .sum('CASE WHEN status = "cancelled" THEN total_amount ELSE 0 END', 'cancelled_revenue')
  .count('CASE WHEN status = "completed" THEN 1 END', 'completed_orders')
  .execute();

// Date-based aggregations
const timeSeriesData = await aggregations
  .createPipeline('events')
  .groupBy('DATE_TRUNC("hour", timestamp)')
  .count('event_count')
  .countDistinct('user_id', 'unique_users')
  .execute();
```

## 🔍 Scopes Manager

### Reusable Query Scopes

```typescript
import { ScopesManager } from 'cassandraorm-js';

const scopes = new ScopesManager();

// Define reusable scopes
scopes.define('active', (query) => {
  return query.where('is_active', '=', true);
});

scopes.define('recent', (query, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return query.where('created_at', '>=', since);
});

scopes.define('byCategory', (query, category) => {
  return query.where('category', '=', category);
});

scopes.define('expensive', (query, minPrice = 100) => {
  return query.where('price', '>=', minPrice);
});

// Use scopes
const activeUsers = await queryBuilder
  .table('users')
  .scope('active')
  .scope('recent', 7) // Last 7 days
  .execute();

const expensiveElectronics = await queryBuilder
  .table('products')
  .scope('byCategory', 'electronics')
  .scope('expensive', 500)
  .execute();
```

### Dynamic Scopes

```typescript
// Dynamic scope with parameters
scopes.define('priceRange', (query, min, max) => {
  return query.where('price', '>=', min).where('price', '<=', max);
});

scopes.define('searchByName', (query, searchTerm) => {
  return query.where('name', 'LIKE', `%${searchTerm}%`);
});

// Conditional scopes
scopes.define('conditionalFilter', (query, filters) => {
  if (filters.category) {
    query = query.where('category', '=', filters.category);
  }
  if (filters.minPrice) {
    query = query.where('price', '>=', filters.minPrice);
  }
  if (filters.inStock) {
    query = query.where('inventory_count', '>', 0);
  }
  return query;
});

// Usage
const filteredProducts = await queryBuilder
  .table('products')
  .scope('conditionalFilter', {
    category: 'electronics',
    minPrice: 50,
    inStock: true
  })
  .execute();
```

## ⚡ Performance Optimization

### Query Optimization

```typescript
// Use indexes effectively
const optimizedQuery = await queryBuilder
  .table('users')
  .select(['id', 'name', 'email'])
  .where('email', '=', userEmail) // email is indexed
  .limit(1)
  .execute();

// Avoid ALLOW FILTERING when possible
const efficientQuery = await queryBuilder
  .table('orders')
  .where('customer_id', '=', customerId) // Partition key
  .where('created_at', '>=', startDate)  // Clustering key
  .execute();

// Use prepared statements
const preparedQuery = await queryBuilder
  .table('products')
  .where('category', '=', '?')
  .prepare()
  .execute(['electronics']);
```

### Batch Queries

```typescript
// Execute multiple queries in batch
const batchQueries = [
  queryBuilder.table('users').where('id', '=', userId1).toSQL(),
  queryBuilder.table('orders').where('user_id', '=', userId1).toSQL(),
  queryBuilder.table('preferences').where('user_id', '=', userId1).toSQL()
];

const results = await client.batch(batchQueries);
```

### Streaming Large Results

```typescript
// Stream large result sets
const largeResultStream = queryBuilder
  .table('events')
  .where('created_at', '>=', new Date('2024-01-01'))
  .stream();

largeResultStream.on('data', (row) => {
  // Process each row
  processEvent(row);
});

largeResultStream.on('end', () => {
  console.log('Finished processing all events');
});
```

## 🔧 Raw Query Builder

### Custom CQL Queries

```typescript
// Raw CQL with parameter binding
const customQuery = await queryBuilder
  .raw(`
    SELECT user_id, COUNT(*) as order_count, SUM(total_amount) as total_spent
    FROM orders 
    WHERE status = ? AND created_at >= ?
    GROUP BY user_id
    HAVING COUNT(*) > ?
    ORDER BY total_spent DESC
    LIMIT ?
  `, ['completed', new Date('2024-01-01'), 5, 100])
  .execute();

// Complex analytical queries
const analyticsQuery = await queryBuilder
  .raw(`
    SELECT 
      DATE_TRUNC('day', created_at) as day,
      COUNT(*) as orders,
      COUNT(DISTINCT user_id) as unique_customers,
      AVG(total_amount) as avg_order_value,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_amount) as median_order_value
    FROM orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY day
  `, [startDate, endDate])
  .execute();
```

### Query Fragments

```typescript
// Reusable query fragments
const commonFilters = `
  WHERE is_active = true 
  AND created_at >= ?
  AND deleted_at IS NULL
`;

const userQuery = await queryBuilder
  .raw(`SELECT * FROM users ${commonFilters}`, [thirtyDaysAgo])
  .execute();

const productQuery = await queryBuilder
  .raw(`SELECT * FROM products ${commonFilters}`, [thirtyDaysAgo])
  .execute();
```

## 🎯 Best Practices

### Query Design Guidelines

```typescript
// ✅ Good: Use partition keys in WHERE clause
const efficientQuery = await queryBuilder
  .table('user_events')
  .where('user_id', '=', userId)        // Partition key
  .where('event_date', '=', today)      // Clustering key
  .execute();

// ✅ Good: Limit result sets
const limitedResults = await queryBuilder
  .table('products')
  .limit(100)
  .execute();

// ✅ Good: Use appropriate data types
const typedQuery = await queryBuilder
  .table('orders')
  .where('created_at', '>=', new Date()) // Use Date objects
  .where('total_amount', '>=', 100.50)   // Use numbers
  .execute();

// ❌ Avoid: Full table scans
const inefficientQuery = await queryBuilder
  .table('large_table')
  .where('random_field', '=', 'value')   // No index
  .allowFiltering(true)                  // Expensive!
  .execute();
```

### Error Handling

```typescript
try {
  const results = await queryBuilder
    .table('users')
    .where('email', '=', userEmail)
    .execute();
} catch (error) {
  if (error.code === 8704) { // Invalid query
    console.log('Query syntax error:', error.message);
  } else if (error.code === 8448) { // Timeout
    console.log('Query timeout, try with smaller result set');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

**Build powerful, efficient queries with the advanced query builder in CassandraORM JS! 🔍✨**
