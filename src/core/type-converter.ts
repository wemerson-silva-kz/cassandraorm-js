import { types } from 'cassandra-driver';
import type { CassandraDataType } from './cassandra-types.js';

/**
 * Converts JavaScript values to Cassandra-compatible values
 */
export class TypeConverter {
  
  /**
   * Convert a JavaScript value to the appropriate Cassandra type
   */
  static convertValue(value: any, cassandraType: CassandraDataType): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle basic types
    switch (cassandraType) {
      // Numeric types
      case 'tinyint':
        return this.convertTinyInt(value);
      case 'smallint':
        return this.convertSmallInt(value);
      case 'int':
        return this.convertInt(value);
      case 'bigint':
        return this.convertBigInt(value);
      case 'varint':
        return this.convertVarInt(value);
      case 'float':
        return this.convertFloat(value);
      case 'double':
        return this.convertDouble(value);
      case 'decimal':
        return this.convertDecimal(value);

      // String types
      case 'ascii':
      case 'text':
      case 'varchar':
        return this.convertText(value);

      // Binary types
      case 'blob':
        return this.convertBlob(value);

      // Boolean type
      case 'boolean':
        return this.convertBoolean(value);

      // Date/Time types
      case 'timestamp':
        return this.convertTimestamp(value);
      case 'date':
        return this.convertDate(value);
      case 'time':
        return this.convertTime(value);
      case 'duration':
        return this.convertDuration(value);

      // UUID types
      case 'uuid':
        return this.convertUuid(value);
      case 'timeuuid':
        return this.convertTimeUuid(value);

      // Network types
      case 'inet':
        return this.convertInet(value);

      // Counter type
      case 'counter':
        return this.convertCounter(value);

      // JSON type
      case 'json':
        return this.convertJson(value);

      default:
        // Handle collection types
        if (cassandraType.startsWith('set<')) {
          return this.convertSet(value, cassandraType);
        }
        if (cassandraType.startsWith('list<')) {
          return this.convertList(value, cassandraType);
        }
        if (cassandraType.startsWith('map<')) {
          return this.convertMap(value, cassandraType);
        }
        if (cassandraType.startsWith('tuple<')) {
          return this.convertTuple(value, cassandraType);
        }
        if (cassandraType.startsWith('frozen<')) {
          return this.convertFrozen(value, cassandraType);
        }
        
        return value;
    }
  }

  // Numeric type converters
  private static convertTinyInt(value: any): number {
    const num = Number(value);
    if (num < -128 || num > 127) {
      throw new Error(`TinyInt value ${num} out of range (-128 to 127)`);
    }
    return num;
  }

  private static convertSmallInt(value: any): number {
    const num = Number(value);
    if (num < -32768 || num > 32767) {
      throw new Error(`SmallInt value ${num} out of range (-32768 to 32767)`);
    }
    return num;
  }

  private static convertInt(value: any): number {
    const num = Number(value);
    if (num < -2147483648 || num > 2147483647) {
      throw new Error(`Int value ${num} out of range (-2147483648 to 2147483647)`);
    }
    return num;
  }

  private static convertBigInt(value: any): types.Long {
    if (typeof value === 'string') {
      return types.Long.fromString(value);
    }
    return types.Long.fromNumber(Number(value));
  }

  private static convertVarInt(value: any): types.Integer {
    if (typeof value === 'string') {
      return types.Integer.fromString(value);
    }
    return types.Integer.fromNumber(Number(value));
  }

  private static convertFloat(value: any): number {
    return Number(value);
  }

  private static convertDouble(value: any): number {
    return Number(value);
  }

  private static convertDecimal(value: any): types.BigDecimal {
    if (typeof value === 'string') {
      return types.BigDecimal.fromString(value);
    }
    return types.BigDecimal.fromNumber(Number(value));
  }

  // String type converters
  private static convertText(value: any): string {
    return String(value);
  }

  // Binary type converters
  private static convertBlob(value: any): Buffer {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return Buffer.from(value, 'utf8');
    }
    return Buffer.from(String(value), 'utf8');
  }

  // Boolean type converter
  private static convertBoolean(value: any): boolean {
    return Boolean(value);
  }

  // Date/Time type converters
  private static convertTimestamp(value: any): Date {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  private static convertDate(value: any): types.LocalDate {
    if (value instanceof Date) {
      return types.LocalDate.fromDate(value);
    }
    if (typeof value === 'string') {
      // Parse YYYY-MM-DD format
      const parts = value.split('-');
      if (parts.length === 3) {
        return new types.LocalDate(
          parseInt(parts[0]), 
          parseInt(parts[1]) - 1, // Month is 0-based
          parseInt(parts[2])
        );
      }
    }
    return types.LocalDate.fromDate(new Date(value));
  }

  private static convertTime(value: any): types.LocalTime {
    if (typeof value === 'string') {
      // Parse HH:MM:SS.nnnnnnnnn format
      const parts = value.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secondsParts = parts[2] ? parts[2].split('.') : ['0'];
        const seconds = parseInt(secondsParts[0] || '0');
        const nanoseconds = secondsParts[1] ? 
          parseInt(secondsParts[1].padEnd(9, '0').substring(0, 9)) : 0;
        
        return new types.LocalTime(
          types.Long.fromNumber(hours * 3600000000000 + 
                               minutes * 60000000000 + 
                               seconds * 1000000000 + 
                               nanoseconds)
        );
      }
    }
    return new types.LocalTime(types.Long.fromNumber(0));
  }

  private static convertDuration(value: any): types.Duration {
    if (typeof value === 'string') {
      // Parse duration string (e.g., "1h30m45s")
      return types.Duration.fromString(value);
    }
    if (typeof value === 'number') {
      // Assume milliseconds
      return new types.Duration(0, 0, types.Long.fromNumber(value * 1000000));
    }
    return new types.Duration(0, 0, types.Long.fromNumber(0));
  }

  // UUID type converters
  private static convertUuid(value: any): types.Uuid {
    if (value instanceof types.Uuid) {
      return value;
    }
    if (typeof value === 'string') {
      return types.Uuid.fromString(value);
    }
    return types.Uuid.random();
  }

  private static convertTimeUuid(value: any): types.TimeUuid {
    if (value instanceof types.TimeUuid) {
      return value;
    }
    if (typeof value === 'string') {
      return types.TimeUuid.fromString(value);
    }
    return types.TimeUuid.now();
  }

  // Network type converters
  private static convertInet(value: any): types.InetAddress {
    if (value instanceof types.InetAddress) {
      return value;
    }
    return types.InetAddress.fromString(String(value));
  }

  // Counter type converter
  private static convertCounter(value: any): types.Long {
    return types.Long.fromNumber(Number(value));
  }

  // JSON type converter
  private static convertJson(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  // Collection type converters
  private static convertSet(value: any, cassandraType: string): any[] {
    const elementType = this.extractElementType(cassandraType);
    
    if (Array.isArray(value)) {
      // For set, convert to array and let Cassandra driver handle uniqueness
      return value.map(item => 
        this.convertValue(item, elementType as CassandraDataType)
      );
    } else if (value instanceof Set) {
      return Array.from(value).map(item => 
        this.convertValue(item, elementType as CassandraDataType)
      );
    }
    
    return [];
  }

  private static convertList(value: any, cassandraType: string): any[] {
    const elementType = this.extractElementType(cassandraType);
    
    if (Array.isArray(value)) {
      return value.map(item => 
        this.convertValue(item, elementType as CassandraDataType)
      );
    }
    
    return [];
  }

  private static convertMap(value: any, cassandraType: string): Record<string, any> {
    const [keyType, valueType] = this.extractMapTypes(cassandraType);
    const result: Record<string, any> = {};
    
    if (value instanceof Map) {
      value.forEach((val, key) => {
        result[String(key)] = this.convertValue(val, valueType as CassandraDataType);
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, val]) => {
        result[key] = this.convertValue(val, valueType as CassandraDataType);
      });
    }
    
    return result;
  }

  private static convertTuple(value: any, cassandraType: string): types.Tuple {
    if (Array.isArray(value)) {
      return new types.Tuple(...value);
    }
    return new types.Tuple();
  }

  private static convertFrozen(value: any, cassandraType: string): any {
    // For frozen types, return as-is for now
    return value;
  }

  // Helper methods
  private static extractElementType(collectionType: string): string {
    const match = collectionType.match(/<(.+)>/);
    return match ? match[1] : 'text';
  }

  private static extractMapTypes(mapType: string): [string, string] {
    const match = mapType.match(/<(.+),(.+)>/);
    if (match) {
      return [match[1].trim(), match[2].trim()];
    }
    return ['text', 'text'];
  }

  /**
   * Get the appropriate prepared statement parameter for a Cassandra type
   */
  static getParameterHint(cassandraType: CassandraDataType): string | undefined {
    switch (cassandraType) {
      case 'tinyint':
        return 'tinyint';
      case 'smallint':
        return 'smallint';
      case 'int':
        return 'int';
      case 'bigint':
        return 'bigint';
      case 'varint':
        return 'varint';
      case 'float':
        return 'float';
      case 'double':
        return 'double';
      case 'decimal':
        return 'decimal';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      case 'duration':
        return 'duration';
      default:
        return undefined;
    }
  }
}
