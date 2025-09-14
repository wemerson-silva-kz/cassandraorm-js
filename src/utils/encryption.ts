import { createCipheriv, createDecipheriv, createHash, randomBytes, pbkdf2Sync } from 'crypto';

export interface EncryptionOptions {
  algorithm?: string;
  key?: string;
  keyDerivation?: {
    salt?: string;
    iterations?: number;
    keyLength?: number;
  };
  encoding?: BufferEncoding;
}

export interface FieldEncryptionConfig {
  fields: string[];
  algorithm: string;
  key: string;
  encoding: BufferEncoding;
}

export class EncryptionManager {
  private modelConfigs = new Map<string, FieldEncryptionConfig>();
  private defaultOptions: Required<EncryptionOptions> = {
    algorithm: 'aes-256-cbc',
    key: process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
    keyDerivation: {
      salt: process.env.ENCRYPTION_SALT || 'default-salt',
      iterations: 10000,
      keyLength: 32
    },
    encoding: 'hex'
  };

  constructor(options: Partial<EncryptionOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    
    if (this.defaultOptions.key === 'default-key-change-in-production') {
      console.warn('⚠️ Using default encryption key. Set ENCRYPTION_KEY environment variable for production.');
    }
  }

  // Register fields for encryption
  registerModel(modelName: string, fields: string[], options: Partial<EncryptionOptions> = {}): void {
    const config = { ...this.defaultOptions, ...options };
    
    // Derive key if using key derivation
    let derivedKey = config.key;
    if (config.keyDerivation) {
      derivedKey = pbkdf2Sync(
        config.key,
        config.keyDerivation.salt,
        config.keyDerivation.iterations,
        config.keyDerivation.keyLength,
        'sha256'
      ).toString('hex');
    }

    this.modelConfigs.set(modelName, {
      fields,
      algorithm: config.algorithm,
      key: derivedKey,
      encoding: config.encoding
    });
  }

  // Check if field should be encrypted
  shouldEncrypt(modelName: string, fieldName: string): boolean {
    const config = this.modelConfigs.get(modelName);
    return config?.fields.includes(fieldName) || false;
  }

  // Encrypt a value
  encrypt(value: any, modelName?: string, fieldName?: string): string {
    if (value === null || value === undefined) {
      return value;
    }

    const config = modelName ? this.modelConfigs.get(modelName) : null;
    const algorithm = config?.algorithm || this.defaultOptions.algorithm;
    const key = config?.key || this.defaultOptions.key;
    const encoding = config?.encoding || this.defaultOptions.encoding;

    try {
      // Convert value to string
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Generate random IV
      const iv = randomBytes(16);
      
      // Create cipher with IV
      const cipher = createCipheriv(algorithm, Buffer.from(key.slice(0, 32)), iv);
      
      // Encrypt
      let encrypted = cipher.update(stringValue, 'utf8', encoding);
      encrypted += cipher.final(encoding);
      
      // Combine IV and encrypted data
      return iv.toString(encoding) + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt value');
    }
  }

  // Decrypt a value
  decrypt(encryptedValue: any, modelName?: string, fieldName?: string): any {
    if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
      return encryptedValue;
    }

    const config = modelName ? this.modelConfigs.get(modelName) : null;
    const algorithm = config?.algorithm || this.defaultOptions.algorithm;
    const key = config?.key || this.defaultOptions.key;
    const encoding = config?.encoding || this.defaultOptions.encoding;

    try {
      // Split IV and encrypted data
      const parts = encryptedValue.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted value format');
      }

      const iv = Buffer.from(parts[0], encoding);
      const encrypted = parts[1];
      
      // Create decipher with IV
      const decipher = createDecipheriv(algorithm, Buffer.from(key.slice(0, 32)), iv);
      
      // Decrypt
      let decrypted = decipher.update(encrypted, encoding, 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt value');
    }
  }

  // Hash a value (one-way)
  hash(value: any, algorithm: string = 'sha256'): string {
    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return createHash(algorithm).update(stringValue).digest('hex');
  }

  // Encrypt multiple fields in an object
  encryptFields(data: Record<string, any>, modelName: string): Record<string, any> {
    const config = this.modelConfigs.get(modelName);
    if (!config) {
      return data;
    }

    const encrypted = { ...data };
    
    for (const field of config.fields) {
      if (encrypted[field] !== undefined) {
        encrypted[field] = this.encrypt(encrypted[field], modelName, field);
      }
    }

    return encrypted;
  }

  // Decrypt multiple fields in an object
  decryptFields(data: Record<string, any>, modelName: string): Record<string, any> {
    const config = this.modelConfigs.get(modelName);
    if (!config) {
      return data;
    }

    const decrypted = { ...data };
    
    for (const field of config.fields) {
      if (decrypted[field] !== undefined) {
        try {
          decrypted[field] = this.decrypt(decrypted[field], modelName, field);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Keep original value if decryption fails
        }
      }
    }

    return decrypted;
  }

  // Generate a secure random key
  static generateKey(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  // Generate a secure random salt
  static generateSalt(length: number = 16): string {
    return randomBytes(length).toString('hex');
  }
}

// Encryption hooks for model lifecycle
export const EncryptionHooks = {
  beforeSave: (data: any, context?: any) => {
    if (!context?.modelName) return data;
    
    return encryptionManager.encryptFields(data, context.modelName);
  },

  afterFind: (data: any, context?: any) => {
    if (!context?.modelName) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => encryptionManager.decryptFields(item, context.modelName));
    }
    
    return encryptionManager.decryptFields(data, context.modelName);
  },

  beforeUpdate: (data: any, context?: any) => {
    if (!context?.modelName) return data;
    
    return encryptionManager.encryptFields(data, context.modelName);
  }
};

// Model encryption mixin
export const EncryptionMixin = {
  // Encrypt specific field
  encryptField(this: any, fieldName: string): void {
    if (this[fieldName] !== undefined) {
      this[fieldName] = encryptionManager.encrypt(this[fieldName], this.constructor.name, fieldName);
    }
  },

  // Decrypt specific field
  decryptField(this: any, fieldName: string): void {
    if (this[fieldName] !== undefined) {
      this[fieldName] = encryptionManager.decrypt(this[fieldName], this.constructor.name, fieldName);
    }
  },

  // Encrypt all configured fields
  encryptFields(this: any): void {
    const encrypted = encryptionManager.encryptFields(this.toObject(), this.constructor.name);
    Object.assign(this, encrypted);
  },

  // Decrypt all configured fields
  decryptFields(this: any): void {
    const decrypted = encryptionManager.decryptFields(this.toObject(), this.constructor.name);
    Object.assign(this, decrypted);
  },

  // Check if field is encrypted
  isFieldEncrypted(this: any, fieldName: string): boolean {
    return encryptionManager.shouldEncrypt(this.constructor.name, fieldName);
  }
};

// Searchable encryption for specific use cases
export class SearchableEncryption {
  private keywordMap = new Map<string, Set<string>>();

  // Add searchable keywords for encrypted field
  addKeywords(recordId: string, fieldValue: string, keywords: string[]): void {
    const hashedKeywords = keywords.map(keyword => 
      createHash('sha256').update(keyword.toLowerCase()).digest('hex')
    );

    hashedKeywords.forEach(hashedKeyword => {
      if (!this.keywordMap.has(hashedKeyword)) {
        this.keywordMap.set(hashedKeyword, new Set());
      }
      this.keywordMap.get(hashedKeyword)!.add(recordId);
    });
  }

  // Search for records by keyword
  searchByKeyword(keyword: string): string[] {
    const hashedKeyword = createHash('sha256').update(keyword.toLowerCase()).digest('hex');
    const recordIds = this.keywordMap.get(hashedKeyword);
    return recordIds ? Array.from(recordIds) : [];
  }

  // Remove keywords for a record
  removeKeywords(recordId: string): void {
    this.keywordMap.forEach((recordIds, keyword) => {
      recordIds.delete(recordId);
      if (recordIds.size === 0) {
        this.keywordMap.delete(keyword);
      }
    });
  }
}

// Utility functions
export const EncryptionUtils = {
  // Validate encryption key strength
  validateKey: (key: string): boolean => {
    return key.length >= 32; // At least 256 bits
  },

  // Generate secure password hash
  hashPassword: (password: string, salt?: string): { hash: string; salt: string } => {
    const generatedSalt = salt || randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha256').toString('hex');
    
    return { hash, salt: generatedSalt };
  },

  // Verify password
  verifyPassword: (password: string, hash: string, salt: string): boolean => {
    const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
    return hash === verifyHash;
  },

  // Mask sensitive data for logging
  maskSensitiveData: (data: any, fields: string[] = ['password', 'ssn', 'credit_card']): any => {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = { ...data };
    
    fields.forEach(field => {
      if (masked[field]) {
        const value = String(masked[field]);
        if (value.length <= 4) {
          masked[field] = '*'.repeat(value.length);
        } else {
          masked[field] = '*'.repeat(value.length - 4) + value.slice(-4);
        }
      }
    });

    return masked;
  },

  // Check if value appears to be encrypted
  isEncrypted: (value: string): boolean => {
    if (typeof value !== 'string') return false;
    
    // Check for IV:encrypted format
    const parts = value.split(':');
    if (parts.length !== 2) return false;
    
    // Check if both parts are hex strings
    const hexRegex = /^[0-9a-fA-F]+$/;
    return hexRegex.test(parts[0]) && hexRegex.test(parts[1]);
  }
};

// Default encryption manager instance
export const encryptionManager = new EncryptionManager();

// Environment-based configuration
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  
  if (!process.env.ENCRYPTION_SALT) {
    console.warn('⚠️ ENCRYPTION_SALT not set. Using default salt.');
  }
}
