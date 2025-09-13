import type { Client } from "cassandra-driver";

export interface AggregationPipeline {
  operations: AggregationOperation[];
}

export interface AggregationOperation {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'groupBy' | 'having' | 'sort' | 'limit';
  field?: string;
  alias?: string;
  value?: any;
  condition?: string;
}

export interface AggregationResult {
  [key: string]: any;
}

export interface AggregationsConfig {
  enabled?: boolean;
  useMapReduce?: boolean;
  batchSize?: number;
}

export class AggregationsManager {
  private client: Client;
  private keyspace: string;
  private config: AggregationsConfig;

  constructor(client: Client, keyspace: string, config: AggregationsConfig = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      useMapReduce: false,
      batchSize: 1000,
      ...config
    };
  }

  createPipeline(tableName: string): AggregationBuilder {
    return new AggregationBuilder(this.client, this.keyspace, tableName, this.config);
  }
}

export class AggregationBuilder {
  private client: Client;
  private keyspace: string;
  private tableName: string;
  private config: AggregationsConfig;
  private operations: AggregationOperation[] = [];
  private whereConditions: string[] = [];
  private whereParams: any[] = [];

  constructor(client: Client, keyspace: string, tableName: string, config: AggregationsConfig) {
    this.client = client;
    this.keyspace = keyspace;
    this.tableName = tableName;
    this.config = config;
  }

  where(field: string, operator: string, value: any): this {
    this.whereConditions.push(`${field} ${operator} ?`);
    this.whereParams.push(value);
    return this;
  }

  count(alias: string = 'count'): this {
    this.operations.push({ type: 'count', alias });
    return this;
  }

  sum(field: string, alias?: string): this {
    this.operations.push({ 
      type: 'sum', 
      field, 
      alias: alias || `sum_${field}` 
    });
    return this;
  }

  avg(field: string, alias?: string): this {
    this.operations.push({ 
      type: 'avg', 
      field, 
      alias: alias || `avg_${field}` 
    });
    return this;
  }

  min(field: string, alias?: string): this {
    this.operations.push({ 
      type: 'min', 
      field, 
      alias: alias || `min_${field}` 
    });
    return this;
  }

  max(field: string, alias?: string): this {
    this.operations.push({ 
      type: 'max', 
      field, 
      alias: alias || `max_${field}` 
    });
    return this;
  }

  groupBy(field: string): this {
    this.operations.push({ type: 'groupBy', field });
    return this;
  }

  having(field: string): HavingClause {
    return new HavingClause(this, field);
  }

  sort(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.operations.push({ 
      type: 'sort', 
      field, 
      value: direction 
    });
    return this;
  }

  limit(count: number): this {
    this.operations.push({ type: 'limit', value: count });
    return this;
  }

  async execute(): Promise<AggregationResult[]> {
    if (!this.config.enabled) {
      throw new Error('Aggregations are disabled');
    }

    // Check if we can use native Cassandra aggregations
    if (this.canUseNativeAggregation()) {
      return this.executeNativeAggregation();
    }

    // Fall back to client-side aggregation
    return this.executeClientSideAggregation();
  }

  private canUseNativeAggregation(): boolean {
    // Cassandra supports limited aggregations
    const supportedOps = ['count', 'sum', 'avg', 'min', 'max'];
    const hasGroupBy = this.operations.some(op => op.type === 'groupBy');
    const hasOnlySupportedOps = this.operations.every(op => 
      supportedOps.includes(op.type) || op.type === 'groupBy'
    );

    return hasOnlySupportedOps && !hasGroupBy; // Cassandra doesn't support GROUP BY
  }

  private async executeNativeAggregation(): Promise<AggregationResult[]> {
    const selectClauses: string[] = [];

    this.operations.forEach(op => {
      switch (op.type) {
        case 'count':
          selectClauses.push(`COUNT(*) AS ${op.alias}`);
          break;
        case 'sum':
          selectClauses.push(`SUM(${op.field}) AS ${op.alias}`);
          break;
        case 'avg':
          selectClauses.push(`AVG(${op.field}) AS ${op.alias}`);
          break;
        case 'min':
          selectClauses.push(`MIN(${op.field}) AS ${op.alias}`);
          break;
        case 'max':
          selectClauses.push(`MAX(${op.field}) AS ${op.alias}`);
          break;
      }
    });

    let query = `SELECT ${selectClauses.join(', ')} FROM ${this.keyspace}.${this.tableName}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    query += ' ALLOW FILTERING';

    const result = await this.client.execute(query, this.whereParams, { prepare: true });
    return result.rows;
  }

  private async executeClientSideAggregation(): Promise<AggregationResult[]> {
    // Fetch all data (with pagination for large datasets)
    let query = `SELECT * FROM ${this.keyspace}.${this.tableName}`;
    
    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    query += ' ALLOW FILTERING';

    const result = await this.client.execute(query, this.whereParams, { prepare: true });
    let data = result.rows;

    // Apply aggregations
    return this.processAggregations(data);
  }

  private processAggregations(data: any[]): AggregationResult[] {
    const groupByField = this.operations.find(op => op.type === 'groupBy')?.field;
    
    if (groupByField) {
      return this.processGroupedAggregations(data, groupByField);
    } else {
      return [this.processSingleAggregation(data)];
    }
  }

  private processGroupedAggregations(data: any[], groupByField: string): AggregationResult[] {
    const groups = new Map<any, any[]>();
    
    // Group data
    data.forEach(row => {
      const key = row[groupByField];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    // Process each group
    const results: AggregationResult[] = [];
    groups.forEach((groupData, groupKey) => {
      const result = this.processSingleAggregation(groupData);
      result[groupByField] = groupKey;
      results.push(result);
    });

    // Apply having conditions
    const havingOps = this.operations.filter(op => op.type === 'having');
    let filteredResults = results;
    
    havingOps.forEach(op => {
      filteredResults = filteredResults.filter(result => {
        // Simple having implementation
        return this.evaluateHavingCondition(result, op);
      });
    });

    // Apply sorting
    const sortOp = this.operations.find(op => op.type === 'sort');
    if (sortOp) {
      filteredResults.sort((a, b) => {
        const aVal = a[sortOp.field!];
        const bVal = b[sortOp.field!];
        const direction = sortOp.value === 'DESC' ? -1 : 1;
        return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * direction;
      });
    }

    // Apply limit
    const limitOp = this.operations.find(op => op.type === 'limit');
    if (limitOp) {
      filteredResults = filteredResults.slice(0, limitOp.value);
    }

    return filteredResults;
  }

  private processSingleAggregation(data: any[]): AggregationResult {
    const result: AggregationResult = {};

    this.operations.forEach(op => {
      switch (op.type) {
        case 'count':
          result[op.alias!] = data.length;
          break;
        case 'sum':
          result[op.alias!] = data.reduce((sum, row) => sum + (row[op.field!] || 0), 0);
          break;
        case 'avg':
          const sum = data.reduce((sum, row) => sum + (row[op.field!] || 0), 0);
          result[op.alias!] = data.length > 0 ? sum / data.length : 0;
          break;
        case 'min':
          result[op.alias!] = Math.min(...data.map(row => row[op.field!] || 0));
          break;
        case 'max':
          result[op.alias!] = Math.max(...data.map(row => row[op.field!] || 0));
          break;
      }
    });

    return result;
  }

  private evaluateHavingCondition(result: AggregationResult, op: AggregationOperation): boolean {
    // Simple implementation - can be extended
    return true;
  }

  addHavingCondition(field: string, condition: string, value: any): this {
    this.operations.push({ 
      type: 'having', 
      field, 
      condition, 
      value 
    });
    return this;
  }
}

export class HavingClause {
  constructor(
    private builder: AggregationBuilder,
    private field: string
  ) {}

  gt(value: any): AggregationBuilder {
    return this.builder.addHavingCondition(this.field, '>', value);
  }

  gte(value: any): AggregationBuilder {
    return this.builder.addHavingCondition(this.field, '>=', value);
  }

  lt(value: any): AggregationBuilder {
    return this.builder.addHavingCondition(this.field, '<', value);
  }

  lte(value: any): AggregationBuilder {
    return this.builder.addHavingCondition(this.field, '<=', value);
  }

  eq(value: any): AggregationBuilder {
    return this.builder.addHavingCondition(this.field, '=', value);
  }
}
