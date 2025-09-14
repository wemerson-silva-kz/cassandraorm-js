# ✅ Validation

Complete guide to data validation in CassandraORM JS with built-in and custom validation rules.

## 🎯 Overview

CassandraORM JS provides comprehensive validation:
- **Built-in validators** for common patterns
- **Custom validation functions**
- **Schema-level validation**
- **Field-level validation**
- **Async validation support**

## 🔧 Basic Validation

### Field-Level Validation

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true,
        maxLength: 255
      }
    },
    username: {
      type: 'text',
      validate: {
        required: true,
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 13,
        max: 120
      }
    }
  },
  key: ['id']
});
```

### Required Fields

```typescript
const Product = await client.loadSchema('products', {
  fields: {
    id: 'uuid',
    name: {
      type: 'text',
      validate: {
        required: true,
        notEmpty: true  // Also check for empty strings
      }
    },
    price: {
      type: 'decimal',
      validate: {
        required: true,
        min: 0
      }
    }
  },
  key: ['id']
});

// This will fail validation
try {
  await Product.create({
    name: '',  // Empty string
    price: -10 // Negative price
  });
} catch (error) {
  console.log('Validation errors:', error.message);
}
```

## 📏 Built-in Validators

### String Validators

```typescript
const stringValidation = {
  // Length validators
  minLength: 5,
  maxLength: 100,
  length: 10,        // Exact length
  
  // Content validators
  notEmpty: true,    // Not empty string
  isEmail: true,     // Valid email format
  isUrl: true,       // Valid URL format
  isUUID: true,      // Valid UUID format
  
  // Pattern matching
  pattern: /^[A-Z][a-z]+$/,  // Regex pattern
  
  // Predefined patterns
  isAlpha: true,     // Only letters
  isAlphanumeric: true, // Letters and numbers
  isNumeric: true,   // Only numbers
  
  // Case validators
  isLowercase: true,
  isUppercase: true
};
```

### Number Validators

```typescript
const numberValidation = {
  // Range validators
  min: 0,
  max: 100,
  
  // Type validators
  isInt: true,       // Integer only
  isFloat: true,     // Float numbers
  isPositive: true,  // Positive numbers
  isNegative: true,  // Negative numbers
  
  // Divisibility
  isDivisibleBy: 5   // Divisible by 5
};
```

### Date Validators

```typescript
const dateValidation = {
  // Date range
  isAfter: new Date('2020-01-01'),
  isBefore: new Date('2030-12-31'),
  
  // Relative dates
  isAfterNow: true,
  isBeforeNow: true,
  
  // Date format
  isISO8601: true
};
```

### Collection Validators

```typescript
const collectionValidation = {
  // Array/Set validators
  minItems: 1,
  maxItems: 10,
  notEmpty: true,
  
  // Item validation
  itemValidation: {
    minLength: 2,
    maxLength: 50
  }
};
```

## 🎨 Custom Validators

### Simple Custom Validator

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    password: {
      type: 'text',
      validate: {
        required: true,
        custom: (value) => {
          // Password strength validation
          if (value.length < 8) {
            throw new Error('Password must be at least 8 characters');
          }
          
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            throw new Error('Password must contain uppercase, lowercase, and number');
          }
          
          return true;
        }
      }
    }
  },
  key: ['id']
});
```

### Async Custom Validator

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true,
        custom: async (value, instance) => {
          // Check if email already exists
          const existing = await User.findOne({ email: value });
          
          if (existing && existing.id !== instance.id) {
            throw new Error('Email already exists');
          }
          
          // Check against external service
          const isValid = await validateEmailWithService(value);
          if (!isValid) {
            throw new Error('Email domain not allowed');
          }
          
          return true;
        }
      }
    }
  },
  key: ['id']
});
```

### Conditional Validation

```typescript
const Order = await client.loadSchema('orders', {
  fields: {
    id: 'uuid',
    type: 'text',
    shipping_address: {
      type: 'map<text,text>',
      validate: {
        custom: (value, instance) => {
          // Require shipping address for physical products
          if (instance.type === 'physical' && !value) {
            throw new Error('Shipping address required for physical products');
          }
          
          if (value && !value.street) {
            throw new Error('Street address is required');
          }
          
          return true;
        }
      }
    }
  },
  key: ['id']
});
```

## 🔍 Schema Validator

### Using SchemaValidator

```typescript
import { SchemaValidator } from 'cassandraorm-js';

const validator = new SchemaValidator();

// Define validation schema
const userValidationSchema = {
  email: {
    required: true,
    isEmail: true,
    maxLength: 255
  },
  username: {
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/
  },
  age: {
    min: 13,
    max: 120
  }
};

// Validate data
const userData = {
  email: 'john@example.com',
  username: 'johndoe',
  age: 25
};

try {
  const isValid = await validator.validate(userData, userValidationSchema);
  console.log('Validation passed:', isValid);
} catch (error) {
  console.log('Validation failed:', error.errors);
}
```

### Batch Validation

```typescript
const users = [
  { email: 'user1@example.com', username: 'user1', age: 25 },
  { email: 'invalid-email', username: 'u', age: 200 },
  { email: 'user3@example.com', username: 'user3', age: 30 }
];

const results = await validator.validateBatch(users, userValidationSchema);

results.forEach((result, index) => {
  if (result.isValid) {
    console.log(`User ${index + 1}: Valid`);
  } else {
    console.log(`User ${index + 1}: Errors -`, result.errors);
  }
});
```

## 🎯 Validation Rules

### Complex Validation Rules

```typescript
const complexValidation = {
  // Multiple conditions
  email: {
    required: true,
    isEmail: true,
    custom: [
      // Multiple custom validators
      (value) => {
        if (value.includes('+')) {
          throw new Error('Plus signs not allowed in email');
        }
        return true;
      },
      async (value) => {
        const domain = value.split('@')[1];
        const allowedDomains = ['gmail.com', 'company.com'];
        if (!allowedDomains.includes(domain)) {
          throw new Error('Email domain not allowed');
        }
        return true;
      }
    ]
  },
  
  // Conditional validation
  phone: {
    required: function(instance) {
      return instance.contact_method === 'phone';
    },
    pattern: /^\+?[\d\s\-\(\)]+$/
  },
  
  // Cross-field validation
  password_confirmation: {
    custom: (value, instance) => {
      if (value !== instance.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }
  }
};
```

### Validation Groups

```typescript
const User = await client.loadSchema('users', {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      validate: {
        groups: {
          registration: {
            required: true,
            isEmail: true,
            custom: async (value) => {
              // Check uniqueness only during registration
              const exists = await User.findOne({ email: value });
              if (exists) throw new Error('Email already exists');
              return true;
            }
          },
          update: {
            isEmail: true
          }
        }
      }
    }
  },
  key: ['id']
});

// Validate for specific group
await User.create(userData, { validationGroup: 'registration' });
await User.update({ id: userId }, updateData, { validationGroup: 'update' });
```

## 🚨 Error Handling

### Validation Error Structure

```typescript
try {
  await User.create({
    email: 'invalid-email',
    username: 'ab',
    age: 200
  });
} catch (error) {
  if (error.name === 'ValidationError') {
    console.log('Validation failed:');
    
    error.errors.forEach(err => {
      console.log(`- ${err.field}: ${err.message}`);
    });
    
    // Error structure:
    // {
    //   name: 'ValidationError',
    //   message: 'Validation failed',
    //   errors: [
    //     { field: 'email', message: 'Invalid email format', value: 'invalid-email' },
    //     { field: 'username', message: 'Must be at least 3 characters', value: 'ab' },
    //     { field: 'age', message: 'Must be less than or equal to 120', value: 200 }
    //   ]
    // }
  }
}
```

### Custom Error Messages

```typescript
const User = await client.loadSchema('users', {
  fields: {
    email: {
      type: 'text',
      validate: {
        required: {
          value: true,
          message: 'Email address is required'
        },
        isEmail: {
          value: true,
          message: 'Please provide a valid email address'
        },
        maxLength: {
          value: 255,
          message: 'Email address is too long (maximum 255 characters)'
        }
      }
    }
  },
  key: ['id']
});
```

## ⚡ Performance Optimization

### Validation Caching

```typescript
const validator = new SchemaValidator({
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000
  }
});

// Validation results are cached for repeated validations
```

### Selective Validation

```typescript
// Validate only specific fields
await User.update({ id: userId }, { name: 'New Name' }, {
  validateOnly: ['name']
});

// Skip validation for trusted data
await User.create(trustedData, {
  skipValidation: true
});
```

### Async Validation Batching

```typescript
const User = await client.loadSchema('users', {
  fields: {
    email: {
      type: 'text',
      validate: {
        custom: async (value, instance, context) => {
          // Batch async validations
          if (context.batch) {
            context.batch.add('email_check', value);
            return true;
          }
          
          return await validateEmailUniqueness(value);
        }
      }
    }
  },
  key: ['id']
});
```

## 🎯 Best Practices

### Validation Design

```typescript
// ✅ Good: Clear, specific validation rules
const Product = await client.loadSchema('products', {
  fields: {
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_]+$/
      }
    },
    price: {
      type: 'decimal',
      validate: {
        required: true,
        min: 0.01,
        max: 999999.99
      }
    }
  },
  key: ['id']
});

// ❌ Avoid: Overly complex validation in model
const badValidation = {
  custom: (value, instance) => {
    // Too much business logic in validation
    if (instance.type === 'premium' && instance.user.subscription !== 'premium') {
      // This should be in business logic, not validation
      throw new Error('Premium features require premium subscription');
    }
    return true;
  }
};
```

### Error Messages

```typescript
// ✅ Good: User-friendly error messages
const validation = {
  email: {
    required: { message: 'Email address is required' },
    isEmail: { message: 'Please enter a valid email address' }
  },
  password: {
    minLength: { 
      value: 8, 
      message: 'Password must be at least 8 characters long' 
    }
  }
};

// ❌ Avoid: Technical error messages
const badMessages = {
  email: {
    required: { message: 'Field validation failed: null value' }
  }
};
```

## 🔗 Next Steps

- **[Unique Constraints →](./unique-constraints.md)** - Handle unique field validation
- **[Middleware & Hooks →](../middleware/hooks-middleware.md)** - Validation hooks
- **[Performance →](../performance/optimization.md)** - Optimize validation performance

---

**Ensure data integrity with comprehensive validation in CassandraORM JS! ✅✨**
