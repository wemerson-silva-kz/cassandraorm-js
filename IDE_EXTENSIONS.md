# 🛠️ CassandraORM JS - IDE Extensions

## 📝 Overview

CassandraORM JS provides comprehensive IDE support through extensions for VS Code and Zed editor, offering IntelliSense, snippets, validation, and integrated tools.

## 🔧 VS Code Extension

### Features
- **IntelliSense**: Auto-completion for schema fields, types, and methods
- **Hover Documentation**: Detailed information on hover
- **Schema Validation**: Real-time validation of CassandraORM schemas
- **Code Snippets**: Pre-built templates for common patterns
- **Integrated Commands**: Direct access to CassandraORM tools

### Installation
```bash
# Install from VS Code Marketplace (coming soon)
# Or install locally:
cd vscode-extension
npm install
npm run compile
code --install-extension cassandraorm-vscode-1.0.0.vsix
```

### Available Commands
- `CassandraORM: Validate Schema` - Validate current schema
- `CassandraORM: Generate Migration` - Create new migration file
- `CassandraORM: Open Dashboard` - Launch web dashboard
- `CassandraORM: Run Query` - Execute selected CQL query

### Snippets
| Prefix | Description |
|--------|-------------|
| `cassandra-client` | Basic client setup |
| `cassandra-ai-client` | Enhanced client with AI/ML |
| `cassandra-schema` | Complete schema definition |
| `cassandra-crud` | CRUD operations template |
| `cassandra-ai-embedding` | AI/ML operations |
| `cassandra-distributed-lock` | Distributed locking |
| `cassandra-migration` | Database migration |

### IntelliSense Features
- **Field Types**: Auto-complete Cassandra data types
- **Validation Rules**: Smart suggestions for validation
- **Method Completion**: CassandraORM method signatures
- **Schema Templates**: Complete schema structures

## ⚡ Zed Extension

### Features
- **Syntax Highlighting**: CassandraORM-specific highlighting
- **Language Server**: Full LSP support with completions
- **Grammar Support**: Custom grammar for schema files
- **Fast Performance**: Optimized for Zed's speed

### Installation
```bash
# Install from Zed Extensions (coming soon)
# Or install locally:
cd zed-extension
zed --install-extension .
```

### Language Support
- **File Extensions**: `.cassandra.ts`, `.cassandra.js`
- **Syntax Highlighting**: Schema fields, types, methods
- **Auto-completion**: CassandraORM methods and types
- **Hover Information**: Documentation on hover

## 🎯 Usage Examples

### VS Code Schema Completion
```typescript
// Type "cassandra-schema" and press Tab
const UserSchema = {
  fields: {
    id: {
      type: 'uuid',
      validate: { required: true }
    },
    name: {
      type: 'text',
      validate: { required: true, minLength: 2 }
    }
  },
  key: ['id']
};
```

### AI/ML Integration
```typescript
// Type "cassandra-ai-embedding" and press Tab
// Generate embedding
const embedding = await client.generateEmbedding('search text');

// Vector similarity search
const similar = await client.vectorSimilaritySearch(embedding, 0.8);

// AI query optimization
const optimized = await client.optimizeQueryWithAI('SELECT * FROM users');
```

### Distributed Systems
```typescript
// Type "cassandra-distributed-lock" and press Tab
await client.withDistributedLock('resource-name', async () => {
  // Critical section - only one process can execute this
  // Your critical code here
}, 10000); // 10 second timeout
```

## 🔍 IntelliSense Details

### Field Types Auto-completion
- `text`, `varchar`, `ascii`
- `int`, `bigint`, `smallint`, `tinyint`
- `float`, `double`, `decimal`
- `boolean`, `uuid`, `timeuuid`
- `timestamp`, `date`, `time`
- `blob`, `inet`, `counter`
- `set<type>`, `list<type>`, `map<key,value>`

### Validation Rules
- `required: true`
- `minLength: number`
- `maxLength: number`
- `min: number`
- `max: number`
- `isEmail: true`
- `isUrl: true`
- `pattern: /regex/`

### Method Signatures
- `find(query)` - Find multiple records
- `findOne(query)` - Find single record
- `save(data)` - Save record
- `update(query, data)` - Update records
- `delete(query)` - Delete records
- `execute(query, params)` - Execute CQL
- `generateEmbedding(text)` - AI embedding
- `withDistributedLock(resource, callback)` - Distributed lock

## 📊 Configuration

### VS Code Settings
```json
{
  "cassandraorm.enableIntelliSense": true,
  "cassandraorm.dashboardPort": 3000,
  "cassandraorm.autoValidation": true
}
```

### Zed Configuration
```toml
[lsp.cassandraorm-lsp]
command = "cassandraorm-lsp"
args = ["--stdio"]
```

## 🚀 Development

### Building VS Code Extension
```bash
cd vscode-extension
npm install
npm run compile
vsce package
```

### Building Zed Extension
```bash
cd zed-extension
npm install
npm run build
zed --install-extension .
```

## 📈 Features Roadmap

### VS Code Extension
- ✅ IntelliSense and auto-completion
- ✅ Hover documentation
- ✅ Schema validation
- ✅ Code snippets
- ✅ Integrated commands
- 🔶 Debugging support
- 🔶 Query execution results
- 🔶 Schema visualization

### Zed Extension
- ✅ Syntax highlighting
- ✅ LSP server
- ✅ Auto-completion
- ✅ Hover information
- 🔶 Advanced diagnostics
- 🔶 Refactoring tools
- 🔶 Performance optimization

## 🤝 Contributing

We welcome contributions to improve IDE support:

1. **VS Code Extension**: `vscode-extension/`
2. **Zed Extension**: `zed-extension/`
3. **Language Server**: Shared LSP implementation
4. **Grammar Files**: Syntax highlighting rules

## 📄 License

Both extensions are released under MIT License, same as CassandraORM JS.

---

**Enhanced development experience for CassandraORM JS across all major editors!** 🚀
