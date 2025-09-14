import type { ModelSchema } from "../core/types.js";

export interface SerializationOptions {
  hidden?: string[];
  visible?: string[];
  appends?: string[];
  casts?: Record<string, CastType>;
  accessors?: Record<string, (this: any) => any>;
  mutators?: Record<string, (this: any, value: any) => any>;
  relations?: string[];
  dateFormat?: string;
  includeTimestamps?: boolean;
}

export type CastType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'json' 
  | 'array' 
  | 'object'
  | ((value: any) => any);

export interface TransformationContext {
  modelName: string;
  operation: 'serialize' | 'deserialize';
  depth: number;
  maxDepth: number;
}

export class SerializationManager {
  private modelConfigs = new Map<string, SerializationOptions>();
  private globalConfig: SerializationOptions = {
    dateFormat: 'iso',
    includeTimestamps: true,
    hidden: [],
    visible: [],
    appends: [],
    casts: {},
    accessors: {},
    mutators: {},
    relations: []
  };

  // Register serialization config for a model
  registerModel(modelName: string, options: SerializationOptions): void {
    this.modelConfigs.set(modelName, { ...this.globalConfig, ...options });
  }

  // Get serialization config for a model
  getConfig(modelName: string): SerializationOptions {
    return this.modelConfigs.get(modelName) || this.globalConfig;
  }

  // Serialize a single record
  serialize(
    record: any,
    modelName: string,
    options: Partial<SerializationOptions> = {},
    context: Partial<TransformationContext> = {}
  ): any {
    const config = { ...this.getConfig(modelName), ...options };
    const ctx: TransformationContext = {
      modelName,
      operation: 'serialize',
      depth: 0,
      maxDepth: 5,
      ...context
    };

    if (ctx.depth >= ctx.maxDepth) {
      return record.id || record;
    }

    const serialized: any = {};

    // Get all fields from record
    const allFields = Object.keys(record);

    // Apply visible filter (if specified, only include these fields)
    const fieldsToInclude = config.visible?.length 
      ? allFields.filter(field => config.visible!.includes(field))
      : allFields;

    // Apply hidden filter (exclude these fields)
    const visibleFields = fieldsToInclude.filter(field => 
      !config.hidden?.includes(field)
    );

    // Process visible fields
    for (const field of visibleFields) {
      const value = record[field];
      
      // Apply casts
      if (config.casts?.[field]) {
        serialized[field] = this.applyCast(value, config.casts[field]);
      } else {
        serialized[field] = this.defaultCast(value, config);
      }
    }

    // Apply accessors (computed properties)
    if (config.accessors) {
      for (const [accessor, getter] of Object.entries(config.accessors)) {
        try {
          serialized[accessor] = getter.call(record);
        } catch (error) {
          console.warn(`Error applying accessor ${accessor}:`, error);
        }
      }
    }

    // Apply appends (additional computed fields)
    if (config.appends) {
      for (const append of config.appends) {
        if (config.accessors?.[append]) {
          try {
            serialized[append] = config.accessors[append].call(record);
          } catch (error) {
            console.warn(`Error applying append ${append}:`, error);
          }
        } else if (typeof record[append] === 'function') {
          try {
            serialized[append] = record[append]();
          } catch (error) {
            console.warn(`Error calling method ${append}:`, error);
          }
        }
      }
    }

    // Process relations
    if (config.relations) {
      for (const relation of config.relations) {
        if (record[relation] !== undefined) {
          const relationData = record[relation];
          
          if (Array.isArray(relationData)) {
            serialized[relation] = relationData.map(item => 
              this.serialize(item, relation, options, { ...ctx, depth: ctx.depth + 1 })
            );
          } else if (relationData && typeof relationData === 'object') {
            serialized[relation] = this.serialize(
              relationData, 
              relation, 
              options, 
              { ...ctx, depth: ctx.depth + 1 }
            );
          } else {
            serialized[relation] = relationData;
          }
        }
      }
    }

    return serialized;
  }

  // Serialize multiple records
  serializeMany(
    records: any[],
    modelName: string,
    options: Partial<SerializationOptions> = {},
    context: Partial<TransformationContext> = {}
  ): any[] {
    return records.map(record => this.serialize(record, modelName, options, context));
  }

  // Deserialize data (reverse transformation)
  deserialize(
    data: any,
    modelName: string,
    options: Partial<SerializationOptions> = {},
    context: Partial<TransformationContext> = {}
  ): any {
    const config = { ...this.getConfig(modelName), ...options };
    const ctx: TransformationContext = {
      modelName,
      operation: 'deserialize',
      depth: 0,
      maxDepth: 5,
      ...context
    };

    const deserialized: any = {};

    // Process all fields
    for (const [field, value] of Object.entries(data)) {
      // Skip appends and accessors during deserialization
      if (config.appends?.includes(field) || config.accessors?.[field]) {
        continue;
      }

      // Apply reverse casts
      if (config.casts?.[field]) {
        deserialized[field] = this.applyReverseCast(value, config.casts[field]);
      } else {
        deserialized[field] = value;
      }

      // Apply mutators
      if (config.mutators?.[field]) {
        try {
          deserialized[field] = config.mutators[field].call(deserialized, deserialized[field]);
        } catch (error) {
          console.warn(`Error applying mutator ${field}:`, error);
        }
      }
    }

    return deserialized;
  }

  private applyCast(value: any, cast: CastType): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof cast === 'function') {
      return cast(value);
    }

    switch (cast) {
      case 'string':
        return String(value);
      
      case 'number':
        return Number(value);
      
      case 'boolean':
        return Boolean(value);
      
      case 'date':
        if (value instanceof Date) return value.toISOString();
        return new Date(value).toISOString();
      
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      
      case 'array':
        return Array.isArray(value) ? value : [value];
      
      case 'object':
        return typeof value === 'object' ? value : { value };
      
      default:
        return value;
    }
  }

  private applyReverseCast(value: any, cast: CastType): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof cast === 'function') {
      // For custom casts, we can't easily reverse them
      return value;
    }

    switch (cast) {
      case 'date':
        return new Date(value);
      
      case 'json':
        return typeof value === 'object' ? JSON.stringify(value) : value;
      
      default:
        return value;
    }
  }

  private defaultCast(value: any, config: SerializationOptions): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Default date formatting
    if (value instanceof Date) {
      switch (config.dateFormat) {
        case 'iso':
          return value.toISOString();
        case 'timestamp':
          return value.getTime();
        case 'date':
          return value.toDateString();
        default:
          return value.toISOString();
      }
    }

    return value;
  }

  // Transform data for API responses
  toJSON(
    data: any,
    modelName: string,
    options: Partial<SerializationOptions> = {}
  ): any {
    if (Array.isArray(data)) {
      return this.serializeMany(data, modelName, options);
    }
    return this.serialize(data, modelName, options);
  }

  // Transform data from API requests
  fromJSON(
    data: any,
    modelName: string,
    options: Partial<SerializationOptions> = {}
  ): any {
    return this.deserialize(data, modelName, options);
  }
}

// Model serialization mixin
export const SerializationMixin = {
  // Instance methods
  toJSON(this: any, options: Partial<SerializationOptions> = {}): any {
    return serializationManager.serialize(this, this.constructor.name, options);
  },

  toObject(this: any, options: Partial<SerializationOptions> = {}): any {
    return this.toJSON(options);
  },

  serialize(this: any, options: Partial<SerializationOptions> = {}): any {
    return this.toJSON(options);
  },

  // Hide fields temporarily
  makeHidden(this: any, fields: string | string[]): any {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    const config = serializationManager.getConfig(this.constructor.name);
    
    return this.toJSON({
      ...config,
      hidden: [...(config.hidden || []), ...fieldsArray]
    });
  },

  // Show only specific fields
  makeVisible(this: any, fields: string | string[]): any {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    
    return this.toJSON({
      visible: fieldsArray
    });
  },

  // Append additional fields
  append(this: any, fields: string | string[]): any {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    const config = serializationManager.getConfig(this.constructor.name);
    
    return this.toJSON({
      ...config,
      appends: [...(config.appends || []), ...fieldsArray]
    });
  },

  // Load relations for serialization
  load(this: any, relations: string | string[]): any {
    const relationsArray = Array.isArray(relations) ? relations : [relations];
    const config = serializationManager.getConfig(this.constructor.name);
    
    return this.toJSON({
      ...config,
      relations: [...(config.relations || []), ...relationsArray]
    });
  }
};

// Common casts
export const CommonCasts = {
  // Date casts
  date: (value: any) => value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
  timestamp: (value: any) => value instanceof Date ? value.getTime() : new Date(value).getTime(),
  
  // JSON casts
  json: (value: any) => typeof value === 'string' ? JSON.parse(value) : value,
  jsonString: (value: any) => typeof value === 'object' ? JSON.stringify(value) : value,
  
  // Number casts
  integer: (value: any) => parseInt(value, 10),
  float: (value: any) => parseFloat(value),
  
  // Boolean casts
  boolean: (value: any) => Boolean(value),
  
  // Array casts
  array: (value: any) => Array.isArray(value) ? value : [value],
  commaSeparated: (value: any) => Array.isArray(value) ? value.join(',') : value,
  
  // String casts
  string: (value: any) => String(value),
  lowercase: (value: any) => String(value).toLowerCase(),
  uppercase: (value: any) => String(value).toUpperCase(),
  
  // Custom casts
  currency: (value: any) => {
    const num = parseFloat(value);
    return isNaN(num) ? value : `$${num.toFixed(2)}`;
  },
  
  percentage: (value: any) => {
    const num = parseFloat(value);
    return isNaN(num) ? value : `${(num * 100).toFixed(2)}%`;
  }
};

// Common accessors
export const CommonAccessors = {
  // Full name accessor
  fullName: function(this: any) {
    return `${this.first_name || ''} ${this.last_name || ''}`.trim();
  },
  
  // Age from birth date
  age: function(this: any) {
    if (!this.birth_date) return null;
    const birthDate = new Date(this.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },
  
  // Time ago
  timeAgo: function(this: any) {
    if (!this.created_at) return null;
    const date = new Date(this.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  },
  
  // URL slug
  slug: function(this: any) {
    if (!this.name && !this.title) return null;
    const text = this.name || this.title;
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
};

// Default serialization manager instance
export const serializationManager = new SerializationManager();

// Utility functions
export const SerializationUtils = {
  // Deep clone object
  deepClone: (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(SerializationUtils.deepClone);
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = SerializationUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  },
  
  // Pick specific fields from object
  pick: (obj: any, fields: string[]): any => {
    const result: any = {};
    fields.forEach(field => {
      if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
    });
    return result;
  },
  
  // Omit specific fields from object
  omit: (obj: any, fields: string[]): any => {
    const result = { ...obj };
    fields.forEach(field => {
      delete result[field];
    });
    return result;
  },
  
  // Transform keys (e.g., camelCase to snake_case)
  transformKeys: (obj: any, transformer: (key: string) => string): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => SerializationUtils.transformKeys(item, transformer));
    
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = transformer(key);
        result[newKey] = SerializationUtils.transformKeys(obj[key], transformer);
      }
    }
    return result;
  },
  
  // Convert camelCase to snake_case
  camelToSnake: (str: string): string => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  },
  
  // Convert snake_case to camelCase
  snakeToCamel: (str: string): string => {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
};
