# Validation System

## Overview
Comprehensive validation system with built-in validators, custom rules, and async validation support.

## Schema Validation

```typescript
const User = await client.loadSchema('users', {
  fields: {
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true,
        unique: true
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 18,
        max: 120
      }
    },
    password: {
      type: 'text',
      validate: {
        required: true,
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
      }
    }
  }
});
```

## Built-in Validators

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 3,
        maxLength: 100,
        trim: true
      }
    },
    price: {
      type: 'decimal',
      validate: {
        required: true,
        min: 0,
        isNumeric: true
      }
    },
    category: {
      type: 'text',
      validate: {
        required: true,
        isIn: ['electronics', 'clothing', 'books', 'home']
      }
    },
    url: {
      type: 'text',
      validate: {
        isURL: true,
        protocols: ['http', 'https']
      }
    }
  }
});
```

## Custom Validators

```typescript
import { Validator } from 'cassandraorm-js';

// Register custom validator
Validator.register('isStrongPassword', (value) => {
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*]/.test(value);
  
  return hasUpper && hasLower && hasNumber && hasSpecial;
});

// Use custom validator
const Account = await client.loadSchema('accounts', {
  fields: {
    password: {
      type: 'text',
      validate: {
        required: true,
        isStrongPassword: true
      }
    }
  }
});
```

## Async Validators

```typescript
// Async uniqueness check
Validator.register('uniqueEmail', async (value, context) => {
  const existing = await context.model.findOne({ email: value });
  return !existing || existing.id === context.instance?.id;
});

// External API validation
Validator.register('validZipCode', async (value) => {
  const response = await fetch(`https://api.zippopotam.us/us/${value}`);
  return response.ok;
});

const Address = await client.loadSchema('addresses', {
  fields: {
    email: {
      type: 'text',
      validate: {
        uniqueEmail: true
      }
    },
    zipCode: {
      type: 'text',
      validate: {
        validZipCode: true
      }
    }
  }
});
```

## Conditional Validation

```typescript
const Order = await client.loadSchema('orders', {
  fields: {
    type: {
      type: 'text',
      validate: {
        isIn: ['standard', 'express', 'overnight']
      }
    },
    delivery_date: {
      type: 'date',
      validate: {
        required: function(value, instance) {
          return instance.type === 'express' || instance.type === 'overnight';
        },
        isAfter: new Date()
      }
    },
    tracking_number: {
      type: 'text',
      validate: {
        required: function(value, instance) {
          return instance.status === 'shipped';
        }
      }
    }
  }
});
```

## Validation Groups

```typescript
const User = await client.loadSchema('users', {
  fields: {
    email: {
      type: 'text',
      validate: {
        required: { groups: ['registration', 'profile'] },
        isEmail: { groups: ['registration', 'profile'] }
      }
    },
    password: {
      type: 'text',
      validate: {
        required: { groups: ['registration'] },
        minLength: { value: 8, groups: ['registration'] }
      }
    },
    profile_complete: {
      type: 'boolean',
      validate: {
        equals: { value: true, groups: ['complete_profile'] }
      }
    }
  }
});

// Validate specific group
await user.validate({ groups: ['registration'] });
```

## Error Handling

```typescript
try {
  await User.create({
    email: 'invalid-email',
    age: 15,
    password: '123'
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation errors:');
    error.errors.forEach(err => {
      console.log(`${err.field}: ${err.message}`);
    });
    
    // Get errors by field
    const emailErrors = error.getFieldErrors('email');
    const ageErrors = error.getFieldErrors('age');
  }
}
```

## Sanitization

```typescript
import { Sanitizer } from 'cassandraorm-js';

const BlogPost = await client.loadSchema('blog_posts', {
  fields: {
    title: {
      type: 'text',
      sanitize: {
        trim: true,
        escape: true
      }
    },
    content: {
      type: 'text',
      sanitize: {
        stripTags: true,
        allowedTags: ['p', 'br', 'strong', 'em']
      }
    },
    slug: {
      type: 'text',
      sanitize: {
        toLowerCase: true,
        replace: { pattern: /[^a-z0-9]/g, replacement: '-' }
      }
    }
  }
});
```

## Validation Middleware

```typescript
import { ValidationMiddleware } from 'cassandraorm-js';

const validationMiddleware = new ValidationMiddleware({
  skipValidation: (context) => {
    return context.operation === 'select';
  },
  transformErrors: (errors) => {
    return errors.map(error => ({
      field: error.field,
      message: error.message,
      code: error.code
    }));
  }
});

client.use(validationMiddleware);
```
