export interface ValidationRule {
  required?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  isEmail?: boolean;
  custom?: (value: any) => boolean | string;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export class SchemaValidator {
  private schema: Record<string, ValidationRule>;

  constructor(schema: Record<string, ValidationRule>) {
    this.schema = schema;
  }

  validate(data: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [field, rule] of Object.entries(this.schema)) {
      const value = data[field];
      const fieldErrors = this.validateField(field, value, rule);
      errors.push(...fieldErrors);
    }

    return errors;
  }

  private validateField(field: string, value: any, rule: ValidationRule): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required validation
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required`, value });
      return errors; // Skip other validations if required field is missing
    }

    // Skip other validations if value is not provided and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rule.type) {
      if (!this.validateType(value, rule.type)) {
        errors.push({ field, message: `${field} must be of type ${rule.type}`, value });
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({ field, message: `${field} must be at least ${rule.minLength} characters`, value });
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rule.maxLength} characters`, value });
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field, message: `${field} format is invalid`, value });
      }
      if (rule.isEmail && !this.isValidEmail(value)) {
        errors.push({ field, message: `${field} must be a valid email`, value });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({ field, message: `${field} must be at least ${rule.min}`, value });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({ field, message: `${field} must be at most ${rule.max}`, value });
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        const message = typeof customResult === 'string' ? customResult : `${field} is invalid`;
        errors.push({ field, message, value });
      }
    }

    return errors;
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
      case 'text':
        return typeof value === 'string';
      case 'number':
      case 'int':
      case 'float':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'uuid':
        return typeof value === 'string' && this.isValidUUID(value);
      default:
        return true; // Unknown types pass validation
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
