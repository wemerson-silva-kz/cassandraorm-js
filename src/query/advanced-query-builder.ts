import type { Client } from "cassandra-driver";

export interface WhereCondition {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'contains_key';
  value: any;
}

export interface QueryBuilderOptions {
  allowFiltering?: boolean;
  limit?: number;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  select?: string[];
}

export class AdvancedQueryBuilder {
  private tableName: string;
  private keyspace: string;
  private conditions: WhereCondition[] = [];
  private options: QueryBuilderOptions = {};

  constructor(
    private client: Client,
    tableName: string,
    keyspace: string
  ) {
    this.tableName = tableName;
    this.keyspace = keyspace;
  }

  select(fields: string[] | string = '*'): this {
    this.options.select = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  where(field: string): WhereClause {
    return new WhereClause(this, field);
  }

  and(field: string): WhereClause {
    return new WhereClause(this, field);
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (!this.options.orderBy) this.options.orderBy = [];
    this.options.orderBy.push({ field, direction });
    return this;
  }

  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  allowFiltering(): this {
    this.options.allowFiltering = true;
    return this;
  }

  addCondition(condition: WhereCondition): this {
    this.conditions.push(condition);
    return this;
  }

  build(): { query: string; params: any[] } {
    const selectClause = this.options.select?.join(', ') || '*';
    let query = `SELECT ${selectClause} FROM ${this.keyspace}.${this.tableName}`;
    const params: any[] = [];

    if (this.conditions.length > 0) {
      const whereClause = this.conditions.map(condition => {
        params.push(condition.value);
        return this.buildCondition(condition);
      }).join(' AND ');
      
      query += ` WHERE ${whereClause}`;
    }

    if (this.options.orderBy?.length) {
      const orderClause = this.options.orderBy
        .map(order => `${order.field} ${order.direction}`)
        .join(', ');
      query += ` ORDER BY ${orderClause}`;
    }

    if (this.options.limit) {
      query += ` LIMIT ${this.options.limit}`;
    }

    if (this.options.allowFiltering) {
      query += ' ALLOW FILTERING';
    }

    return { query, params };
  }

  private buildCondition(condition: WhereCondition): string {
    switch (condition.operator) {
      case 'eq': return `${condition.field} = ?`;
      case 'gt': return `${condition.field} > ?`;
      case 'gte': return `${condition.field} >= ?`;
      case 'lt': return `${condition.field} < ?`;
      case 'lte': return `${condition.field} <= ?`;
      case 'in': return `${condition.field} IN ?`;
      case 'contains': return `${condition.field} CONTAINS ?`;
      case 'contains_key': return `${condition.field} CONTAINS KEY ?`;
      default: return `${condition.field} = ?`;
    }
  }

  async execute(): Promise<any[]> {
    const { query, params } = this.build();
    const result = await this.client.execute(query, params, { prepare: true });
    return result.rows;
  }

  async first(): Promise<any | null> {
    this.limit(1);
    const results = await this.execute();
    return results[0] || null;
  }

  async count(): Promise<number> {
    this.select('COUNT(*)');
    const result = await this.execute();
    return result[0]?.count || 0;
  }
}

export class WhereClause {
  constructor(
    private builder: AdvancedQueryBuilder,
    private field: string
  ) {}

  eq(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'eq', value });
  }

  gt(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'gt', value });
  }

  gte(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'gte', value });
  }

  lt(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'lt', value });
  }

  lte(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'lte', value });
  }

  in(values: any[]): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'in', value: values });
  }

  contains(value: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'contains', value });
  }

  containsKey(key: any): AdvancedQueryBuilder {
    return this.builder.addCondition({ field: this.field, operator: 'contains_key', value: key });
  }
}
