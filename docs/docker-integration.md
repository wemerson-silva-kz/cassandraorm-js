# Docker Integration

## Overview
Complete Docker integration with multi-stage builds, development environments, production deployment, and orchestration support.

## Development Environment

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=development

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"]
```

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - CASSANDRA_HOSTS=cassandra:9042
    depends_on:
      - cassandra
      - redis

  cassandra:
    image: cassandra:4.1
    ports:
      - "9042:9042"
    environment:
      - CASSANDRA_CLUSTER_NAME=dev-cluster
      - CASSANDRA_DC=datacenter1
      - CASSANDRA_RACK=rack1
    volumes:
      - cassandra_data:/var/lib/cassandra
    healthcheck:
      test: ["CMD-SHELL", "cqlsh -e 'describe cluster'"]
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  cassandra_data:
  redis_data:
```

## Production Build

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cassandraorm -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=cassandraorm:nodejs /app/dist ./dist
COPY --from=builder --chown=cassandraorm:nodejs /app/public ./public

# Switch to non-root user
USER cassandraorm

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js

# Start application
CMD ["node", "dist/index.js"]
```

## Multi-Service Architecture

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Application services
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CASSANDRA_HOSTS=cassandra-1:9042,cassandra-2:9042,cassandra-3:9042
      - REDIS_URL=redis://redis-cluster:6379
    depends_on:
      - cassandra-1
      - cassandra-2
      - cassandra-3
      - redis-cluster
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - NODE_ENV=production
      - CASSANDRA_HOSTS=cassandra-1:9042,cassandra-2:9042,cassandra-3:9042
    depends_on:
      - cassandra-1
      - kafka
    deploy:
      replicas: 2

  # Cassandra cluster
  cassandra-1:
    image: cassandra:4.1
    environment:
      - CASSANDRA_SEEDS=cassandra-1,cassandra-2
      - CASSANDRA_CLUSTER_NAME=prod-cluster
      - CASSANDRA_DC=datacenter1
      - CASSANDRA_RACK=rack1
      - CASSANDRA_ENDPOINT_SNITCH=GossipingPropertyFileSnitch
    volumes:
      - cassandra1_data:/var/lib/cassandra
    ports:
      - "9042:9042"

  cassandra-2:
    image: cassandra:4.1
    environment:
      - CASSANDRA_SEEDS=cassandra-1,cassandra-2
      - CASSANDRA_CLUSTER_NAME=prod-cluster
      - CASSANDRA_DC=datacenter1
      - CASSANDRA_RACK=rack2
    volumes:
      - cassandra2_data:/var/lib/cassandra
    depends_on:
      - cassandra-1

  cassandra-3:
    image: cassandra:4.1
    environment:
      - CASSANDRA_SEEDS=cassandra-1,cassandra-2
      - CASSANDRA_CLUSTER_NAME=prod-cluster
      - CASSANDRA_DC=datacenter1
      - CASSANDRA_RACK=rack3
    volumes:
      - cassandra3_data:/var/lib/cassandra
    depends_on:
      - cassandra-1

  # Redis cluster
  redis-cluster:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  # Message queue
  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  # Monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  cassandra1_data:
  cassandra2_data:
  cassandra3_data:
  redis_data:
  grafana_data:
```

## Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cassandraorm

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cassandraorm-config
  namespace: cassandraorm
data:
  NODE_ENV: "production"
  CASSANDRA_HOSTS: "cassandra-service:9042"
  REDIS_URL: "redis://redis-service:6379"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cassandraorm-secrets
  namespace: cassandraorm
type: Opaque
data:
  CASSANDRA_USERNAME: Y2Fzc2FuZHJh  # base64 encoded
  CASSANDRA_PASSWORD: Y2Fzc2FuZHJh  # base64 encoded

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cassandraorm-api
  namespace: cassandraorm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cassandraorm-api
  template:
    metadata:
      labels:
        app: cassandraorm-api
    spec:
      containers:
      - name: api
        image: cassandraorm/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: cassandraorm-config
        - secretRef:
            name: cassandraorm-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cassandraorm-api-service
  namespace: cassandraorm
spec:
  selector:
    app: cassandraorm-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
# k8s/cassandra-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cassandra
  namespace: cassandraorm
spec:
  serviceName: cassandra-service
  replicas: 3
  selector:
    matchLabels:
      app: cassandra
  template:
    metadata:
      labels:
        app: cassandra
    spec:
      containers:
      - name: cassandra
        image: cassandra:4.1
        ports:
        - containerPort: 9042
        env:
        - name: CASSANDRA_SEEDS
          value: "cassandra-0.cassandra-service,cassandra-1.cassandra-service"
        - name: CASSANDRA_CLUSTER_NAME
          value: "k8s-cluster"
        - name: CASSANDRA_DC
          value: "datacenter1"
        - name: CASSANDRA_RACK
          value: "rack1"
        volumeMounts:
        - name: cassandra-data
          mountPath: /var/lib/cassandra
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
  volumeClaimTemplates:
  - metadata:
      name: cassandra-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

## Docker Compose Profiles

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  app:
    profiles: ["dev", "test"]
    build:
      target: development
    volumes:
      - .:/app
      - /app/node_modules

  app-prod:
    profiles: ["prod"]
    build:
      target: production
    restart: unless-stopped

  cassandra:
    profiles: ["dev", "test", "prod"]

  cassandra-test:
    profiles: ["test"]
    image: cassandra:4.1
    tmpfs:
      - /var/lib/cassandra
    environment:
      - CASSANDRA_CLUSTER_NAME=test-cluster

  monitoring:
    profiles: ["prod", "monitoring"]
    extends:
      file: docker-compose.monitoring.yml
      service: monitoring-stack
```

```bash
# Usage with profiles
docker-compose --profile dev up          # Development
docker-compose --profile test up         # Testing
docker-compose --profile prod up         # Production
docker-compose --profile monitoring up   # With monitoring
```

## Health Checks

```javascript
// healthcheck.js
const { createClient } = require('cassandraorm-js');

async function healthCheck() {
  try {
    const client = createClient({
      clientOptions: {
        contactPoints: [process.env.CASSANDRA_HOSTS || 'localhost:9042'],
        localDataCenter: 'datacenter1'
      }
    });

    await client.connect();
    await client.execute('SELECT now() FROM system.local');
    await client.shutdown();

    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck();
```

## Build Optimization

```dockerfile
# Multi-stage build with caching
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cassandraorm -u 1001
USER cassandraorm

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Docker Secrets

```yaml
# docker-compose.secrets.yml
version: '3.8'

services:
  app:
    secrets:
      - cassandra_password
      - jwt_secret
    environment:
      - CASSANDRA_PASSWORD_FILE=/run/secrets/cassandra_password
      - JWT_SECRET_FILE=/run/secrets/jwt_secret

secrets:
  cassandra_password:
    file: ./secrets/cassandra_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

## Container Registry

```bash
# Build and push to registry
docker build -t myregistry.com/cassandraorm/api:latest .
docker push myregistry.com/cassandraorm/api:latest

# Multi-architecture build
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myregistry.com/cassandraorm/api:latest --push .
```
