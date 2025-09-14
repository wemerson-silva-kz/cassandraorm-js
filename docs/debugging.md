# Debugging Tools

## Overview
Advanced debugging tools for troubleshooting queries, connections, and performance issues.

## Query Debugger

```typescript
import { QueryDebugger } from 'cassandraorm-js';

const debugger = new QueryDebugger(client);

// Enable query debugging
debugger.enable({
  logQueries: true,
  logParams: true,
  logResults: true,
  logTiming: true
});

// Debug specific query
const result = await debugger.debug(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

console.log('Query plan:', result.queryPlan);
console.log('Execution time:', result.executionTime);
console.log('Rows returned:', result.rowCount);
```

## Connection Debugger

```typescript
import { ConnectionDebugger } from 'cassandraorm-js';

const connDebugger = new ConnectionDebugger(client);

// Monitor connection events
connDebugger.on('connectionCreated', (host, id) => {
  console.log(`Connection ${id} created to ${host}`);
});

connDebugger.on('connectionClosed', (host, id, reason) => {
  console.log(`Connection ${id} to ${host} closed: ${reason}`);
});

// Get connection details
const connections = await connDebugger.getActiveConnections();
console.log('Active connections:', connections);
```

## Performance Profiler

```typescript
import { PerformanceProfiler } from 'cassandraorm-js';

const profiler = new PerformanceProfiler();

// Profile a function
const profiledResult = await profiler.profile('userQuery', async () => {
  return await User.findOne({ id: userId });
});

console.log('Profile results:', profiledResult.profile);
// Output: { duration: 150, memoryUsage: 1024, cpuUsage: 0.5 }
```

## Schema Debugger

```typescript
import { SchemaDebugger } from 'cassandraorm-js';

const schemaDebugger = new SchemaDebugger(client);

// Validate schema
const validation = await schemaDebugger.validateSchema('users');
if (!validation.valid) {
  console.log('Schema issues:', validation.issues);
}

// Compare schemas
const diff = await schemaDebugger.compareSchemas('users', 'users_backup');
console.log('Schema differences:', diff);
```

## Debug Console

```typescript
import { DebugConsole } from 'cassandraorm-js';

const debugConsole = new DebugConsole(client);

// Start interactive debug session
debugConsole.start({
  port: 3002,
  allowRemote: false
});

// Access at http://localhost:3002/debug
// Features:
// - Execute queries interactively
// - View connection status
// - Monitor performance metrics
// - Inspect schema
```
