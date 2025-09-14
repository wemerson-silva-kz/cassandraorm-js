# SSL/TLS Configuration

## Overview
Secure your Cassandra connections with SSL/TLS encryption and certificate-based authentication.

## Basic SSL Setup

```typescript
import { createClient } from 'cassandraorm-js';
import fs from 'fs';

const client = createClient({
  clientOptions: {
    contactPoints: ['secure-cluster:9142'],
    localDataCenter: 'datacenter1',
    sslOptions: {
      cert: fs.readFileSync('client-cert.pem'),
      key: fs.readFileSync('client-key.pem'),
      ca: [fs.readFileSync('ca-cert.pem')],
      rejectUnauthorized: true
    }
  }
});
```

## Mutual TLS Authentication

```typescript
const client = createClient({
  clientOptions: {
    contactPoints: ['secure-cluster:9142'],
    sslOptions: {
      cert: fs.readFileSync('client-cert.pem'),
      key: fs.readFileSync('client-key.pem'),
      ca: [fs.readFileSync('ca-cert.pem')],
      checkServerIdentity: (host, cert) => {
        // Custom server identity verification
        return undefined; // No error = valid
      }
    },
    authProvider: new PlainTextAuthProvider('username', 'password')
  }
});
```

## Certificate Management

```typescript
import { SSLManager } from 'cassandraorm-js';

const sslManager = new SSLManager({
  certPath: './certs/',
  autoRenew: true,
  renewBeforeExpiry: 30 * 24 * 60 * 60 * 1000 // 30 days
});

// Check certificate expiry
const expiryInfo = await sslManager.checkExpiry();
console.log(`Certificate expires in ${expiryInfo.daysRemaining} days`);

// Auto-renewal setup
sslManager.on('certificateRenewed', (cert) => {
  console.log('Certificate renewed:', cert.subject);
});
```

## Environment-based Configuration

```typescript
// Development (no SSL)
const devClient = createClient({
  clientOptions: {
    contactPoints: ['localhost:9042'],
    sslOptions: null
  }
});

// Production (SSL required)
const prodClient = createClient({
  clientOptions: {
    contactPoints: process.env.CASSANDRA_HOSTS?.split(','),
    sslOptions: {
      cert: fs.readFileSync(process.env.SSL_CERT_PATH!),
      key: fs.readFileSync(process.env.SSL_KEY_PATH!),
      ca: [fs.readFileSync(process.env.SSL_CA_PATH!)]
    }
  }
});
```
