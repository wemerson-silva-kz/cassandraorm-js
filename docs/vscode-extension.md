# VS Code Extension

## Overview
Comprehensive VS Code extension with IntelliSense, snippets, debugging, and integrated development tools for CassandraORM.

## Installation

```bash
# Install from VS Code Marketplace
code --install-extension cassandraorm.cassandraorm-vscode

# Or search "CassandraORM" in VS Code Extensions
```

## Features

### IntelliSense and Auto-completion

```typescript
// Automatic model detection and completion
const user = await User.| // Shows: findOne, find, create, update, delete, etc.

// Field completion
const user = await User.findOne({ | }); // Shows: id, email, name, created_at

// Method signature help
User.findOne(| // Shows parameter types and descriptions

// Type checking
const user: UserModel = await User.findOne({ id: 'invalid' }); // Error: id should be UUID
```

### Code Snippets

```typescript
// Trigger: "cassandra-model"
const ${1:ModelName} = await client.loadSchema('${2:table_name}', {
  fields: {
    ${3:id}: '${4:uuid}',
    ${5:name}: '${6:text}'
  },
  key: ['${7:id}']
});

// Trigger: "cassandra-query"
const ${1:result} = await ${2:Model}.${3:findOne}({
  ${4:field}: ${5:value}
});

// Trigger: "cassandra-migration"
export default class ${1:MigrationName} extends Migration {
  async up() {
    await this.createTable('${2:table_name}', {
      ${3:id}: '${4:uuid} PRIMARY KEY',
      ${5:field}: '${6:text}'
    });
  }

  async down() {
    await this.dropTable('${2:table_name}');
  }
}
```

### Schema Validation

```typescript
// Real-time schema validation
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    invalid_type: 'unknown_type' // ❌ Error: Unknown Cassandra type
  },
  key: ['nonexistent_field'] // ❌ Error: Field not defined in schema
});

// Relationship validation
const Post = await client.loadSchema('posts', {
  relations: {
    author: { 
      model: 'NonExistentModel', // ❌ Error: Model not found
      foreignKey: 'user_id',
      type: 'belongsTo'
    }
  }
});
```

### Integrated Debugger

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CassandraORM App",
      "type": "cassandraorm",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "cassandra": {
        "host": "localhost:9042",
        "keyspace": "myapp"
      },
      "breakpoints": {
        "queries": true,
        "migrations": true,
        "events": true
      }
    }
  ]
}
```

### Command Palette Integration

```bash
# Available commands (Ctrl+Shift+P)
CassandraORM: Connect to Database
CassandraORM: Generate Model
CassandraORM: Run Migration
CassandraORM: Create Migration
CassandraORM: View Schema
CassandraORM: Execute Query
CassandraORM: Start Development Server
CassandraORM: Run Tests
CassandraORM: Generate API Documentation
CassandraORM: Optimize Queries
```

### Database Explorer

```typescript
// Sidebar panel showing:
// 📁 Keyspaces
//   📁 myapp
//     📋 Tables
//       📄 users (1,234 rows)
//       📄 posts (5,678 rows)
//       📄 comments (12,345 rows)
//     📋 Materialized Views
//       📄 users_by_email
//     📋 Indexes
//       📄 users_email_idx
//     📋 User Defined Types
//       📄 address_type

// Right-click context menu:
// - View Data
// - Describe Table
// - Generate Model
// - Export Data
// - Run Query
```

### Query Editor

```sql
-- Enhanced CQL editor with:
-- ✅ Syntax highlighting
-- ✅ Auto-completion
-- ✅ Error detection
-- ✅ Query execution
-- ✅ Result visualization

SELECT * FROM users 
WHERE email = 'john@example.com'
  AND created_at > '2024-01-01'
LIMIT 10;

-- Execute with Ctrl+Enter
-- Results shown in integrated panel
```

### Code Generation

```typescript
// Generate from template
// Command: "CassandraORM: Generate Model"

// Input: Table name "users"
// Output: Generated model file

export interface UserModel {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

export const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text',
    created_at: 'timestamp'
  },
  key: ['id'],
  validate: {
    email: { required: true, isEmail: true },
    name: { required: true, minLength: 2 }
  }
});
```

### Testing Integration

```typescript
// Test runner integration
// Command: "CassandraORM: Run Tests"

describe('User Model', () => {
  it('should create user', async () => {
    const user = await User.create({
      id: uuid(),
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});

// ✅ Test results shown in integrated terminal
// ✅ Coverage reports in Problems panel
// ✅ Failed tests highlighted in editor
```

### Performance Monitoring

```typescript
// Integrated performance panel showing:
// 📊 Query Performance
//   - Slow queries (>100ms)
//   - Most frequent queries
//   - Query distribution
// 📊 Connection Health
//   - Active connections
//   - Connection errors
//   - Latency metrics
// 📊 Resource Usage
//   - Memory usage
//   - CPU usage
//   - Disk I/O

// Real-time monitoring with charts and alerts
```

### Extension Settings

```json
// settings.json
{
  "cassandraorm.connection": {
    "host": "localhost:9042",
    "keyspace": "myapp",
    "username": "cassandra",
    "password": "cassandra"
  },
  "cassandraorm.intellisense": {
    "enabled": true,
    "autoImport": true,
    "typeChecking": true
  },
  "cassandraorm.formatting": {
    "enabled": true,
    "indentSize": 2,
    "maxLineLength": 100
  },
  "cassandraorm.debugging": {
    "logQueries": true,
    "logLevel": "debug",
    "breakOnErrors": true
  },
  "cassandraorm.codegen": {
    "typescript": true,
    "generateInterfaces": true,
    "generateValidation": true
  }
}
```

### Workspace Configuration

```json
// .vscode/settings.json (workspace-specific)
{
  "cassandraorm.project": {
    "configFile": "./cassandraorm.config.js",
    "modelsPath": "./src/models",
    "migrationsPath": "./migrations",
    "seedsPath": "./seeds"
  },
  "cassandraorm.environments": {
    "development": {
      "host": "localhost:9042",
      "keyspace": "myapp_dev"
    },
    "staging": {
      "host": "staging-cassandra:9042",
      "keyspace": "myapp_staging"
    },
    "production": {
      "host": "prod-cassandra:9042",
      "keyspace": "myapp_prod"
    }
  }
}
```

### Custom Themes

```json
// CassandraORM-specific syntax highlighting
{
  "tokenColors": [
    {
      "name": "CQL Keywords",
      "scope": "keyword.control.cql",
      "settings": {
        "foreground": "#569CD6",
        "fontStyle": "bold"
      }
    },
    {
      "name": "Cassandra Types",
      "scope": "support.type.cassandra",
      "settings": {
        "foreground": "#4EC9B0"
      }
    },
    {
      "name": "CassandraORM Methods",
      "scope": "support.function.cassandraorm",
      "settings": {
        "foreground": "#DCDCAA"
      }
    }
  ]
}
```

### Extension API

```typescript
// For other extensions to integrate with CassandraORM
import * as vscode from 'vscode';
import { CassandraORMExtension } from 'cassandraorm-vscode';

export function activate(context: vscode.ExtensionContext) {
  const cassandraORM = vscode.extensions.getExtension('cassandraorm.cassandraorm-vscode');
  
  if (cassandraORM) {
    const api = cassandraORM.exports as CassandraORMExtension;
    
    // Get current connection
    const connection = api.getCurrentConnection();
    
    // Execute query
    const result = await api.executeQuery('SELECT * FROM users LIMIT 5');
    
    // Get schema information
    const schema = await api.getTableSchema('users');
    
    // Register custom command
    api.registerCommand('myextension.customCommand', () => {
      // Custom logic
    });
  }
}
```
