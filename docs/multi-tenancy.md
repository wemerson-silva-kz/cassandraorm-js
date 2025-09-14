# Multi-tenancy

## Overview
Flexible multi-tenant architecture with schema isolation, data partitioning, and tenant-aware operations.

## Tenant Manager Setup

```typescript
import { TenantManager } from 'cassandraorm-js';

const tenantManager = new TenantManager(client, {
  isolationStrategy: 'schema', // 'schema', 'table', 'row'
  tenantTable: 'tenants',
  defaultKeyspace: 'multi_tenant_app'
});

await tenantManager.initialize();
```

## Schema-level Isolation

```typescript
// Create tenant with dedicated keyspace
await tenantManager.createTenant('acme_corp', {
  name: 'ACME Corporation',
  isolationLevel: 'schema',
  keyspace: 'acme_corp_ks',
  replicationStrategy: {
    class: 'SimpleStrategy',
    replication_factor: 3
  }
});

// Get tenant-specific client
const acmeClient = await tenantManager.getTenantClient('acme_corp');

// All operations are isolated to tenant keyspace
const User = await acmeClient.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text'
  },
  key: ['id']
});

await User.create({
  id: uuid(),
  email: 'john@acme.com',
  name: 'John Doe'
});
```

## Table-level Isolation

```typescript
// Create tenant with table prefixes
await tenantManager.createTenant('globex_inc', {
  name: 'Globex Inc',
  isolationLevel: 'table',
  tablePrefix: 'globex_',
  keyspace: 'shared_ks'
});

const globexClient = await tenantManager.getTenantClient('globex_inc');

// Tables are automatically prefixed: globex_users, globex_orders, etc.
const User = await globexClient.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: 'text',
    name: 'text'
  },
  key: ['id']
});
```

## Row-level Isolation

```typescript
// Create tenant with row-level isolation
await tenantManager.createTenant('initech_llc', {
  name: 'Initech LLC',
  isolationLevel: 'row',
  tenantColumn: 'tenant_id'
});

// Shared tables with tenant_id column
const User = await client.loadSchema('users', {
  fields: {
    tenant_id: 'text',
    id: 'uuid',
    email: 'text',
    name: 'text'
  },
  key: [['tenant_id'], 'id']
});

// Tenant context is automatically added
const initechClient = await tenantManager.getTenantClient('initech_llc');
await initechClient.User.create({
  id: uuid(),
  email: 'peter@initech.com',
  name: 'Peter Gibbons'
  // tenant_id is automatically added
});
```

## Tenant-aware Middleware

```typescript
import { TenantMiddleware } from 'cassandraorm-js';

const tenantMiddleware = new TenantMiddleware(tenantManager, {
  tenantResolver: (request) => {
    // Extract tenant from subdomain
    const subdomain = request.hostname.split('.')[0];
    return subdomain !== 'www' ? subdomain : null;
  },
  fallbackTenant: 'default'
});

client.use(tenantMiddleware);

// Express.js integration
app.use(async (req, res, next) => {
  const tenantId = req.hostname.split('.')[0];
  req.tenantClient = await tenantManager.getTenantClient(tenantId);
  next();
});

app.get('/users', async (req, res) => {
  const users = await req.tenantClient.User.find({});
  res.json(users);
});
```

## Dynamic Tenant Provisioning

```typescript
import { TenantProvisioner } from 'cassandraorm-js';

const provisioner = new TenantProvisioner(tenantManager, {
  templates: {
    'saas_basic': {
      isolationLevel: 'row',
      resources: {
        maxTables: 10,
        maxStorage: '1GB',
        maxConnections: 50
      },
      features: ['basic_auth', 'basic_reporting']
    },
    'enterprise': {
      isolationLevel: 'schema',
      resources: {
        maxTables: 100,
        maxStorage: '100GB',
        maxConnections: 500
      },
      features: ['sso', 'advanced_reporting', 'api_access']
    }
  }
});

// Auto-provision tenant
app.post('/signup', async (req, res) => {
  const { companyName, plan } = req.body;
  
  const tenant = await provisioner.provision({
    name: companyName,
    template: plan,
    customizations: {
      branding: req.body.branding,
      features: req.body.additionalFeatures
    }
  });
  
  res.json({ tenantId: tenant.id, status: 'provisioned' });
});
```

## Tenant Resource Management

```typescript
import { TenantResourceManager } from 'cassandraorm-js';

const resourceManager = new TenantResourceManager(tenantManager, {
  monitoring: {
    interval: 60000,
    metrics: ['storage', 'connections', 'queries_per_second']
  },
  limits: {
    storage: '10GB',
    connections: 100,
    queries_per_second: 1000
  }
});

// Monitor tenant resource usage
resourceManager.on('limitExceeded', async (tenantId, metric, usage, limit) => {
  console.log(`Tenant ${tenantId} exceeded ${metric}: ${usage}/${limit}`);
  
  // Throttle or notify
  if (metric === 'queries_per_second') {
    await resourceManager.throttleTenant(tenantId, { duration: 60000 });
  }
});

// Get tenant usage statistics
const usage = await resourceManager.getTenantUsage('acme_corp');
console.log('Storage used:', usage.storage);
console.log('Active connections:', usage.connections);
```

## Cross-tenant Operations

```typescript
import { CrossTenantManager } from 'cassandraorm-js';

const crossTenantManager = new CrossTenantManager(tenantManager, {
  allowedOperations: ['analytics', 'reporting', 'backup'],
  auditLog: true
});

// Execute operation across multiple tenants
const results = await crossTenantManager.executeAcrossTenants(
  ['acme_corp', 'globex_inc', 'initech_llc'],
  async (tenantClient, tenantId) => {
    const userCount = await tenantClient.User.count();
    return { tenantId, userCount };
  },
  {
    operation: 'user_count_report',
    requiredPermission: 'analytics'
  }
);

// Aggregate tenant data
const aggregatedData = await crossTenantManager.aggregate({
  tenants: 'all',
  query: 'SELECT COUNT(*) as user_count FROM users',
  aggregation: 'sum',
  groupBy: 'tenant_id'
});
```

## Tenant Data Migration

```typescript
import { TenantMigrationManager } from 'cassandraorm-js';

const migrationManager = new TenantMigrationManager(tenantManager);

// Migrate tenant between isolation levels
await migrationManager.migrateTenant('acme_corp', {
  from: 'row',
  to: 'schema',
  strategy: 'online', // or 'offline'
  batchSize: 1000,
  onProgress: (progress) => {
    console.log(`Migration progress: ${progress.percentage}%`);
  }
});

// Migrate tenant data to different datacenter
await migrationManager.migrateTenantData('globex_inc', {
  sourceDatacenter: 'us-east',
  targetDatacenter: 'eu-west',
  copyStrategy: 'incremental',
  verifyIntegrity: true
});
```

## Tenant Security

```typescript
import { TenantSecurityManager } from 'cassandraorm-js';

const securityManager = new TenantSecurityManager(tenantManager, {
  encryption: {
    enabled: true,
    keyRotationInterval: '30d'
  },
  accessControl: {
    enforceRBAC: true,
    auditAccess: true
  }
});

// Tenant-specific encryption
await securityManager.enableTenantEncryption('acme_corp', {
  algorithm: 'AES-256-GCM',
  keyManagement: 'tenant_managed'
});

// Access control
await securityManager.createTenantRole('acme_corp', 'data_analyst', {
  permissions: ['read_users', 'read_orders', 'create_reports'],
  restrictions: {
    timeWindow: '09:00-17:00',
    ipWhitelist: ['192.168.1.0/24']
  }
});
```

## Tenant Analytics

```typescript
import { TenantAnalytics } from 'cassandraorm-js';

const analytics = new TenantAnalytics(tenantManager, {
  metricsRetention: '90d',
  aggregationIntervals: ['1h', '1d', '1w']
});

// Track tenant metrics
await analytics.track('acme_corp', 'user_login', {
  userId: '123',
  timestamp: new Date(),
  metadata: { source: 'web' }
});

// Generate tenant reports
const report = await analytics.generateReport('acme_corp', {
  metrics: ['active_users', 'storage_usage', 'api_calls'],
  timeRange: { start: '2024-01-01', end: '2024-01-31' },
  granularity: 'daily'
});

// Cross-tenant benchmarking
const benchmark = await analytics.benchmarkTenant('acme_corp', {
  compareWith: 'similar_size_tenants',
  metrics: ['user_engagement', 'feature_adoption']
});
```
