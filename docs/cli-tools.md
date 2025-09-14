# CLI Tools

## Overview
Comprehensive command-line interface for project management, code generation, migrations, and development workflows.

## Installation and Setup

```bash
# Install CLI globally
npm install -g cassandraorm-cli

# Initialize new project
cassandraorm init my-project --typescript --ai

# Navigate to project
cd my-project

# Install dependencies
npm install
```

## Project Commands

```bash
# Create new project with templates
cassandraorm create my-app --template=microservice
cassandraorm create my-app --template=graphql-api
cassandraorm create my-app --template=rest-api
cassandraorm create my-app --template=event-sourcing

# Project information
cassandraorm info
cassandraorm status
cassandraorm health-check
```

## Code Generation

```bash
# Generate model
cassandraorm generate model User --fields="name:text,email:text,age:int"

# Generate controller
cassandraorm generate controller UserController --model=User

# Generate service
cassandraorm generate service UserService --crud

# Generate GraphQL schema
cassandraorm generate graphql --models=User,Post,Comment

# Generate REST API
cassandraorm generate api --models=User,Post --version=v1

# Generate tests
cassandraorm generate tests --model=User --type=unit
cassandraorm generate tests --model=User --type=integration
```

## Database Management

```bash
# Database connection
cassandraorm db:connect --host=localhost --keyspace=myapp

# Create keyspace
cassandraorm db:create-keyspace myapp --replication="{'class': 'SimpleStrategy', 'replication_factor': 3}"

# Drop keyspace
cassandraorm db:drop-keyspace myapp --force

# List keyspaces
cassandraorm db:list-keyspaces

# Describe keyspace
cassandraorm db:describe myapp
```

## Migration Commands

```bash
# Create migration
cassandraorm migration:create add_user_profile

# Run migrations
cassandraorm migration:run

# Rollback migration
cassandraorm migration:rollback

# Migration status
cassandraorm migration:status

# Reset migrations
cassandraorm migration:reset --force
```

## Schema Management

```bash
# Generate schema from existing tables
cassandraorm schema:import --keyspace=myapp

# Export schema
cassandraorm schema:export --format=json --output=schema.json

# Validate schema
cassandraorm schema:validate

# Compare schemas
cassandraorm schema:diff --source=local --target=production

# Sync schema
cassandraorm schema:sync --target=staging
```

## Development Tools

```bash
# Start development server
cassandraorm dev --port=3000 --watch

# Run tests
cassandraorm test
cassandraorm test --unit
cassandraorm test --integration
cassandraorm test --coverage

# Lint code
cassandraorm lint
cassandraorm lint --fix

# Format code
cassandraorm format

# Build project
cassandraorm build
cassandraorm build --production
```

## Data Management

```bash
# Seed database
cassandraorm seed
cassandraorm seed --file=users.json

# Import data
cassandraorm import --table=users --file=users.csv --format=csv
cassandraorm import --table=users --file=users.json --format=json

# Export data
cassandraorm export --table=users --format=csv --output=users.csv
cassandraorm export --keyspace=myapp --format=json --output=backup.json

# Backup database
cassandraorm backup --keyspace=myapp --output=backup_$(date +%Y%m%d).tar.gz

# Restore database
cassandraorm restore --file=backup_20240115.tar.gz --keyspace=myapp_restored
```

## Performance Tools

```bash
# Analyze performance
cassandraorm analyze --table=users
cassandraorm analyze --slow-queries --threshold=1000ms

# Optimize queries
cassandraorm optimize --table=users --suggest-indexes

# Benchmark
cassandraorm benchmark --queries=benchmark.sql --duration=60s

# Profile application
cassandraorm profile --duration=30s --output=profile.json
```

## Monitoring Commands

```bash
# Start monitoring dashboard
cassandraorm dashboard --port=3001

# View metrics
cassandraorm metrics
cassandraorm metrics --table=users
cassandraorm metrics --real-time

# Check cluster health
cassandraorm cluster:health
cassandraorm cluster:status
cassandraorm cluster:topology

# Node management
cassandraorm node:add --host=new-node --datacenter=dc1
cassandraorm node:remove --host=old-node --decommission
cassandraorm node:repair --host=node1 --keyspace=myapp
```

## AI/ML Commands

```bash
# Setup AI features
cassandraorm ai:setup --provider=openai --api-key=$OPENAI_API_KEY

# Generate embeddings
cassandraorm ai:embed --table=documents --field=content --model=ada-002

# Vector search
cassandraorm ai:search --table=documents --query="machine learning" --limit=10

# Anomaly detection
cassandraorm ai:detect-anomalies --table=metrics --field=value --algorithm=isolation-forest

# Query optimization
cassandraorm ai:optimize-queries --analyze-logs --suggest-improvements
```

## Configuration Management

```bash
# Initialize configuration
cassandraorm config:init

# Set configuration
cassandraorm config:set database.host localhost
cassandraorm config:set database.keyspace myapp

# Get configuration
cassandraorm config:get database.host
cassandraorm config:list

# Environment-specific config
cassandraorm config:env production
cassandraorm config:env staging

# Validate configuration
cassandraorm config:validate
```

## Plugin Management

```bash
# List available plugins
cassandraorm plugin:list

# Install plugin
cassandraorm plugin:install @cassandraorm/plugin-graphql
cassandraorm plugin:install @cassandraorm/plugin-monitoring

# Enable/disable plugins
cassandraorm plugin:enable graphql
cassandraorm plugin:disable monitoring

# Plugin information
cassandraorm plugin:info graphql

# Update plugins
cassandraorm plugin:update
```

## Deployment Commands

```bash
# Deploy to staging
cassandraorm deploy staging

# Deploy to production
cassandraorm deploy production --confirm

# Rollback deployment
cassandraorm rollback --version=1.2.0

# Deployment status
cassandraorm deploy:status

# Environment management
cassandraorm env:create staging --copy-from=development
cassandraorm env:delete staging --confirm
```

## Interactive Mode

```bash
# Start interactive shell
cassandraorm shell

# Interactive commands within shell
> connect localhost myapp
> describe users
> select * from users limit 5
> help
> exit
```

## Custom Commands

```typescript
// Create custom CLI command
// cli/commands/custom-command.js
module.exports = {
  name: 'custom:hello',
  description: 'Custom hello command',
  options: [
    { name: '--name <name>', description: 'Name to greet' }
  ],
  action: async (options) => {
    console.log(`Hello, ${options.name || 'World'}!`);
  }
};

// Register in package.json
{
  "cassandraorm": {
    "commands": ["./cli/commands"]
  }
}
```

## Configuration File

```yaml
# cassandraorm.yml
database:
  hosts:
    - localhost:9042
  keyspace: myapp
  consistency: QUORUM

development:
  database:
    keyspace: myapp_dev
  logging:
    level: debug

production:
  database:
    keyspace: myapp_prod
    ssl: true
  logging:
    level: info

plugins:
  - '@cassandraorm/plugin-graphql'
  - '@cassandraorm/plugin-monitoring'

ai:
  provider: openai
  models:
    embedding: text-embedding-ada-002
    completion: gpt-4
```
