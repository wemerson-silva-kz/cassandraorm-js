# 📦 Installation Guide

Complete installation guide for CassandraORM JS across different environments.

## 🎯 Prerequisites

- **Node.js** 16+ or **Bun** 1.0+
- **Cassandra** 3.11+ or **ScyllaDB** 4.0+
- **TypeScript** 4.5+ (optional but recommended)

## 📦 Package Installation

### NPM
```bash
npm install cassandraorm-js
```

### Yarn
```bash
yarn add cassandraorm-js
```

### Bun
```bash
bun add cassandraorm-js
```

### PNPM
```bash
pnpm add cassandraorm-js
```

## 🐳 Database Setup

### Cassandra with Docker

```bash
# Quick start
docker run --name cassandra -p 9042:9042 -d cassandra:latest

# With custom configuration
docker run --name cassandra \
  -p 9042:9042 \
  -e CASSANDRA_CLUSTER_NAME=MyCluster \
  -e CASSANDRA_DC=datacenter1 \
  -e CASSANDRA_RACK=rack1 \
  -d cassandra:4.1
```

### ScyllaDB with Docker

```bash
# ScyllaDB (faster alternative)
docker run --name scylla \
  -p 9042:9042 \
  -d scylladb/scylla:latest \
  --smp 1 --memory 750M
```

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  cassandra:
    image: cassandra:4.1
    container_name: cassandra
    ports:
      - "9042:9042"
    environment:
      - CASSANDRA_CLUSTER_NAME=MyCluster
      - CASSANDRA_DC=datacenter1
      - CASSANDRA_RACK=rack1
    volumes:
      - cassandra_data:/var/lib/cassandra
    healthcheck:
      test: ["CMD-SHELL", "cqlsh -e 'describe cluster'"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  cassandra_data:
```

```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps
```

## 🛠️ CLI Tools Installation

### Global CLI
```bash
npm install -g cassandraorm-cli
```

### Verify Installation
```bash
cassandraorm --version
cassandraorm --help
```

### CLI Commands
```bash
# Initialize project
cassandraorm init my-project --typescript

# Generate models
cassandraorm generate model User --fields "name:text,email:text"

# Run migrations
cassandraorm migrate

# Start dashboard
cassandraorm dashboard
```

## 🔧 Development Setup

### TypeScript Project
```bash
# Create new project
mkdir my-cassandra-app
cd my-cassandra-app

# Initialize package.json
npm init -y

# Install dependencies
npm install cassandraorm-js
npm install -D typescript @types/node ts-node

# Create tsconfig.json
npx tsc --init
```

### Basic Project Structure
```
my-cassandra-app/
├── src/
│   ├── models/
│   ├── services/
│   └── index.ts
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

### Sample tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🌐 Production Installation

### Ubuntu/Debian
```bash
# Install Cassandra
echo "deb https://debian.cassandra.apache.org 41x main" | sudo tee -a /etc/apt/sources.list.d/cassandra.sources.list
curl https://downloads.apache.org/cassandra/KEYS | sudo apt-key add -
sudo apt-get update
sudo apt-get install cassandra

# Start service
sudo systemctl start cassandra
sudo systemctl enable cassandra
```

### CentOS/RHEL
```bash
# Add repository
sudo tee /etc/yum.repos.d/cassandra.repo << EOF
[cassandra]
name=Apache Cassandra
baseurl=https://redhat.cassandra.apache.org/41x/
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://downloads.apache.org/cassandra/KEYS
EOF

# Install
sudo yum install cassandra

# Start service
sudo systemctl start cassandra
sudo systemctl enable cassandra
```

### macOS
```bash
# Using Homebrew
brew install cassandra

# Start service
brew services start cassandra
```

## ☁️ Cloud Deployment

### AWS Keyspaces
```typescript
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['cassandra.us-east-1.amazonaws.com'],
    localDataCenter: 'us-east-1',
    port: 9142,
    credentials: {
      username: 'your-username',
      password: 'your-password'
    },
    sslOptions: {
      ca: [fs.readFileSync('sf-class2-root.crt')],
      host: 'cassandra.us-east-1.amazonaws.com',
      rejectUnauthorized: true
    }
  }
});
```

### Azure Cosmos DB
```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['your-account.cassandra.cosmos.azure.com'],
    localDataCenter: 'datacenter1',
    port: 10350,
    credentials: {
      username: 'your-username',
      password: 'your-primary-key'
    },
    sslOptions: {
      secureProtocol: 'TLSv1_2_method'
    }
  }
});
```

### DataStax Astra
```typescript
const client = createClient({
  clientOptions: {
    cloud: {
      secureConnectBundle: 'path/to/secure-connect-database.zip'
    },
    credentials: {
      username: 'your-client-id',
      password: 'your-client-secret'
    }
  }
});
```

## 🔍 Verification

### Test Connection
```typescript
// test-connection.ts
import { createClient } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1'
  }
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Connected to Cassandra successfully!');
    
    const result = await client.execute('SELECT release_version FROM system.local');
    console.log('📊 Cassandra version:', result.rows[0].release_version);
    
    await client.close();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
```

### Run Test
```bash
# TypeScript
npx ts-node test-connection.ts

# JavaScript
node test-connection.js

# Bun
bun run test-connection.ts
```

## 🚨 Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if Cassandra is running
docker ps | grep cassandra
sudo systemctl status cassandra

# Check port availability
netstat -tlnp | grep 9042
```

#### Authentication Failed
```typescript
// Add credentials
const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    credentials: {
      username: 'cassandra',
      password: 'cassandra'
    }
  }
});
```

#### SSL/TLS Issues
```typescript
// Disable SSL for local development
const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    sslOptions: null
  }
});
```

### Environment Variables
```bash
# .env file
CASSANDRA_HOSTS=127.0.0.1
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=myapp
CASSANDRA_USERNAME=cassandra
CASSANDRA_PASSWORD=cassandra
CASSANDRA_SSL_ENABLED=false
```

```typescript
// Use environment variables
const client = createClient({
  clientOptions: {
    contactPoints: [process.env.CASSANDRA_HOSTS || '127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: process.env.CASSANDRA_KEYSPACE,
    credentials: process.env.CASSANDRA_USERNAME ? {
      username: process.env.CASSANDRA_USERNAME,
      password: process.env.CASSANDRA_PASSWORD
    } : undefined
  }
});
```

## 📚 Next Steps

After installation:
1. **[Configuration →](./configuration.md)** - Configure your client
2. **[First Steps →](./first-steps.md)** - Build your first app
3. **[Quick Start →](./quick-start.md)** - 5-minute tutorial

---

**Ready to build amazing applications with CassandraORM JS! 📦✨**
