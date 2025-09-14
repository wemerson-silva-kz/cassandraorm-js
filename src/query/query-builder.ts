import type { Client } from "cassandra-driver";
import type { ModelSchema } from "../core/types.js";

export interface WhereCondition {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'contains_key' | 'like' | 'ne';
  value: any;
  connector?: 'AND' | 'OR';
}

export interface JoinCondition {
  table: string;
  localKey: string;
  foreignKey: string;
  type: 'INNER' | 'LEFT' | 'RIGHT';
}

export interface QueryBuilderOptions {
  allowFiltering?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  select?: string[];
  groupBy?: string[];
  having?: WhereCondition[];
  distinct?: boolean;
}

export class QueryBuilder {
  private tableName: string;
  private keyspace: string;
  private conditions: WhereCondition[] = [];
  private joins: JoinCondition[] = [];
  private options: QueryBuilderOptions = {};
  private schema?: ModelSchema;

  constructor(
    private client: Client,
    tableName: string,
    keyspace: string,
    schema?: ModelSchema
  ) {
    this.tableName = tableName;
    this.keyspace = keyspace;
    this.schema = schema;
  }

  // SELECT methods
  select(fields: string[] | string = '*'): this {
    this.options.select = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  distinct(): this {
    this.options.distinct = true;
    return this;
  }

  // WHERE methods
  where(field: string, operator: WhereCondition['operator'] | any = 'eq', value?: any): this {
    if (arguments.length === 2) {
      value = operator;
      operator = 'eq';
    }
    
    this.conditions.push({
      field,
      operator: operator as WhereCondition['operator'],
      value,
      connector: this.conditions.length > 0 ? 'AND' : undefined
    });
    return this;
  }

  orWhere(field: string, operator: WhereCondition['operator'] | any = 'eq', value?: any): this {
    if (arguments.length === 2) {
      value = operator;
      operator = 'eq';
    }
    
    this.conditions.push({
      field,
      operator: operator as WhereCondition['operator'],
      value,
      connector: 'OR'
    });
    return this;
  }

  whereIn(field: string, values: any[]): this {
    return this.where(field, 'in', values);
  }

  whereNotIn(field: string, values: any[]): this {
    return this.where(field, 'ne', values);
  }

  whereLike(field: string, pattern: string): this {
    return this.where(field, 'like', pattern);
  }

  whereNull(field: string): this {
    return this.where(field, 'eq', null);
  }

  whereNotNull(field: string): this {
    return this.where(field, 'ne', null);
  }

  whereBetween(field: string, min: any, max: any): this {
    return this.where(field, 'gte', min).where(field, 'lte', max);
  }

  // JOIN methods (simulated for Cassandra)
  join(table: string, localKey: string, foreignKey: string): this {
    this.joins.push({ table, localKey, foreignKey, type: 'INNER' });
    return this;
  }

  leftJoin(table: string, localKey: string, foreignKey: string): this {
    this.joins.push({ table, localKey, foreignKey, type: 'LEFT' });
    return this;
  }

  rightJoin(table: string, localKey: string, foreignKey: string): this {
    this.joins.push({ table, localKey, foreignKey, type: 'RIGHT' });
    return this;
  }

  // ORDER BY methods
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (!this.options.orderBy) this.options.orderBy = [];
    this.options.orderBy.push({ field, direction });
    return this;
  }

  orderByDesc(field: string): this {
    return this.orderBy(field, 'DESC');
  }

  // GROUP BY methods
  groupBy(fields: string | string[]): this {
    this.options.groupBy = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  having(field: string, operator: WhereCondition['operator'], value: any): this {
    if (!this.options.having) this.options.having = [];
    this.options.having.push({ field, operator, value });
    return this;
  }

  // LIMIT/OFFSET methods
  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

  take(count: number): this {
    return this.limit(count);
  }

  skip(count: number): this {
    return this.offset(count);
  }

  // Pagination
  paginate(page: number, perPage: number = 15): this {
    return this.limit(perPage).offset((page - 1) * perPage);
  }

  // Execution methods
  async get(): Promise<any[]> {
    const { query, params } = this.buildSelectQuery();
    const result = await this.client.execute(query, params);
    return result.rows;
  }

  async first(): Promise<any | null> {
    const results = await this.limit(1).get();
    return results.length > 0 ? results[0] : null;
  }

  async find(id: any): Promise<any | null> {
    return this.where('id', id).first();
  }

  async count(): Promise<number> {
    const originalSelect = this.options.select;
    this.options.select = ['COUNT(*)'];
    
    const { query, params } = this.buildSelectQuery();
    const result = await this.client.execute(query, params);
    
    this.options.select = originalSelect;
    return result.rows[0].count;
  }

  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  // Aggregation methods
  async sum(field: string): Promise<number> {
    return this.aggregate('SUM', field);
  }

  async avg(field: string): Promise<number> {
    return this.aggregate('AVG', field);
  }

  async max(field: string): Promise<any> {
    return this.aggregate('MAX', field);
  }

  async min(field: string): Promise<any> {
    return this.aggregate('MIN', field);
  }

  private async aggregate(func: string, field: string): Promise<any> {
    const originalSelect = this.options.select;
    this.options.select = [`${func}(${field})`];
    
    const { query, params } = this.buildSelectQuery();
    const result = await this.client.execute(query, params);
    
    this.options.select = originalSelect;
    return result.rows[0][`${func.toLowerCase()}(${field})`];
  }

  // Update methods
  async update(data: Record<string, any>): Promise<any> {
    const { query, params } = this.buildUpdateQuery(data);
    return this.client.execute(query, params);
  }

  async increment(field: string, amount: number = 1): Promise<any> {
    return this.update({ [field]: { $add: amount } });
  }

  async decrement(field: string, amount: number = 1): Promise<any> {
    return this.update({ [field]: { $subtract: amount } });
  }

  // Delete methods
  async delete(): Promise<any> {
    const { query, params } = this.buildDeleteQuery();
    return this.client.execute(query, params);
  }

  // Query building methods
  private buildSelectQuery(): { query: string; params: any[] } {
    const select = this.options.select?.join(', ') || '*';
    const distinct = this.options.distinct ? 'DISTINCT ' : '';
    
    let query = `SELECT ${distinct}${select} FROM ${this.getTableName()}`;
    const params: any[] = [];

    // WHERE clause
    if (this.conditions.length > 0) {
      const { whereClause, whereParams } = this.buildWhereClause();
      query += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    // GROUP BY clause
    if (this.options.groupBy?.length) {
      query += ` GROUP BY ${this.options.groupBy.join(', ')}`;
    }

    // HAVING clause
    if (this.options.having?.length) {
      const havingClauses = this.options.having.map(h => `${h.field} ${this.getOperatorSymbol(h.operator)} ?`);
      query += ` HAVING ${havingClauses.join(' AND ')}`;
      params.push(...this.options.having.map(h => h.value));
    }

    // ORDER BY clause
    if (this.options.orderBy?.length) {
      const orderClauses = this.options.orderBy.map(o => `${o.field} ${o.direction}`);
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT clause
    if (this.options.limit) {
      query += ` LIMIT ${this.options.limit}`;
    }

    // ALLOW FILTERING
    if (this.options.allowFiltering || this.needsAllowFiltering()) {
      query += ' ALLOW FILTERING';
    }

    return { query, params };
  }

  private buildUpdateQuery(data: Record<string, any>): { query: string; params: any[] } {
    const setClauses: string[] = [];
    const params: any[] = [];

    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        // Handle special operations like $add, $subtract
        if (value.$add) {
          setClauses.push(`${field} = ${field} + ?`);
          params.push(value.$add);
        } else if (value.$subtract) {
          setClauses.push(`${field} = ${field} - ?`);
          params.push(value.$subtract);
        }
      } else {
        setClauses.push(`${field} = ?`);
        params.push(value);
      }
    }

    let query = `UPDATE ${this.getTableName()} SET ${setClauses.join(', ')}`;

    // WHERE clause
    if (this.conditions.length > 0) {
      const { whereClause, whereParams } = this.buildWhereClause();
      query += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    return { query, params };
  }

  private buildDeleteQuery(): { query: string; params: any[] } {
    let query = `DELETE FROM ${this.getTableName()}`;
    const params: any[] = [];

    // WHERE clause
    if (this.conditions.length > 0) {
      const { whereClause, whereParams } = this.buildWhereClause();
      query += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    return { query, params };
  }

  private buildWhereClause(): { whereClause: string; whereParams: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];

    for (let i = 0; i < this.conditions.length; i++) {
      const condition = this.conditions[i];
      
      if (i > 0 && condition.connector) {
        clauses.push(condition.connector);
      }

      const operator = this.getOperatorSymbol(condition.operator);
      
      if (condition.operator === 'in') {
        const placeholders = condition.value.map(() => '?').join(', ');
        clauses.push(`${condition.field} ${operator} (${placeholders})`);
        params.push(...condition.value);
      } else {
        clauses.push(`${condition.field} ${operator} ?`);
        params.push(condition.value);
      }
    }

    return {
      whereClause: clauses.join(' '),
      whereParams: params
    };
  }

  private getOperatorSymbol(operator: WhereCondition['operator']): string {
    const operators = {
      eq: '=',
      ne: '!=',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      in: 'IN',
      contains: 'CONTAINS',
      contains_key: 'CONTAINS KEY',
      like: 'LIKE'
    };
    return operators[operator] || '=';
  }

  private getTableName(): string {
    return this.keyspace ? `"${this.keyspace}"."${this.tableName}"` : `"${this.tableName}"`;
  }

  private needsAllowFiltering(): boolean {
    // Check if query needs ALLOW FILTERING based on conditions
    return this.conditions.some(c => 
      c.operator === 'like' || 
      c.operator === 'contains' || 
      c.field !== 'id' // Simplified check
    );
  }

  // Clone method for chaining
  clone(): QueryBuilder {
    const cloned = new QueryBuilder(this.client, this.tableName, this.keyspace, this.schema);
    cloned.conditions = [...this.conditions];
    cloned.joins = [...this.joins];
    cloned.options = { ...this.options };
    return cloned;
  }
}
