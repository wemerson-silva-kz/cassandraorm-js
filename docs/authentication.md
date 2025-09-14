# Authentication

## Overview
CassandraORM JS supports multiple authentication methods including username/password, LDAP, and custom providers.

## Username/Password Authentication

```typescript
import { createClient, PlainTextAuthProvider } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1:9042'],
    authProvider: new PlainTextAuthProvider('cassandra', 'cassandra')
  }
});
```

## LDAP Authentication

```typescript
import { LDAPAuthProvider } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    contactPoints: ['127.0.0.1:9042'],
    authProvider: new LDAPAuthProvider({
      server: 'ldap://ldap.company.com',
      baseDN: 'dc=company,dc=com',
      username: 'user@company.com',
      password: 'password'
    })
  }
});
```

## Custom Authentication Provider

```typescript
import { AuthProvider } from 'cassandraorm-js';

class CustomAuthProvider extends AuthProvider {
  async newAuthenticator(endpoint: string): Promise<Authenticator> {
    return {
      initialResponse: () => Buffer.from('custom-token'),
      evaluateChallenge: (challenge: Buffer) => {
        // Handle authentication challenge
        return Buffer.from('response');
      }
    };
  }
}

const client = createClient({
  clientOptions: {
    authProvider: new CustomAuthProvider()
  }
});
```

## Token-based Authentication

```typescript
import { TokenAuthProvider } from 'cassandraorm-js';

const client = createClient({
  clientOptions: {
    authProvider: new TokenAuthProvider({
      token: process.env.CASSANDRA_TOKEN,
      refreshToken: async () => {
        // Refresh token logic
        return await fetchNewToken();
      }
    })
  }
});
```

## Role-based Access Control

```typescript
import { RoleManager } from 'cassandraorm-js';

const roleManager = new RoleManager(client);

// Create role
await roleManager.createRole('app_user', {
  permissions: ['SELECT', 'INSERT', 'UPDATE'],
  keyspaces: ['myapp']
});

// Grant role to user
await roleManager.grantRole('john_doe', 'app_user');

// Check permissions
const permissions = await roleManager.getUserPermissions('john_doe');
console.log('User permissions:', permissions);
```
