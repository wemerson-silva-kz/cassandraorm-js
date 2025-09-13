export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  isEmail?: boolean;
  isUUID?: boolean;
  custom?: (value: any) => boolean | string;
  enum?: any[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export class SchemaValidator {
  private static emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static validate(data: Record<string, any>, schema: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const value = data[fieldName];
      const rules = this.extractValidationRules(fieldDef);
      
      if (!rules) continue;

      const fieldErrors = this.validateField(fieldName, value, rules);
      errors.push(...fieldErrors);
    }

    return errors;
  }

  private static extractValidationRules(fieldDef: any): ValidationRule | null {
    if (typeof fieldDef === 'string') return null;
    return fieldDef.validate || null;
  }

  private static validateField(fieldName: string, value: any, rules: ValidationRule): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required validation
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldName,
        message: `${fieldName} is required`,
        value
      });
      return errors; // Stop validation if required field is missing
    }

    // Skip other validations if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return errors;
    }

    // Type-specific validations
    if (typeof value === 'string') {
      // String length validations
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at least ${rules.minLength} characters`,
          value
        });
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at most ${rules.maxLength} characters`,
          value
        });
      }

      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} format is invalid`,
          value
        });
      }

      // Email validation
      if (rules.isEmail && !this.emailRegex.test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be a valid email`,
          value
        });
      }

      // UUID validation
      if (rules.isUUID && !this.uuidRegex.test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be a valid UUID`,
          value
        });
      }
    }

    // Numeric validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at least ${rules.min}`,
          value
        });
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at most ${rules.max}`,
          value
        });
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be one of: ${rules.enum.join(', ')}`,
        value
      });
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push({
          field: fieldName,
          message: typeof customResult === 'string' ? customResult : `${fieldName} is invalid`,
          value
        });
      }
    }

    return errors;
  }

  static async validateAsync(data: Record<string, any>, schema: Record<string, any>): Promise<ValidationError[]> {
    // For now, just call sync validation
    // Can be extended for async validations like database uniqueness checks
    return this.validate(data, schema);
  }
}
