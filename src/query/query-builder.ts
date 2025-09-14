export interface WhereCondition {
  field: string;
  operator: '=' | '>' | '<' | '>=' | '<=' | 'IN' | 'CONTAINS' | 'LIKE';
  value: any;
}

export class QueryBuilder {
  private selectFields: string[] = ['*'];
  private fromTable: string = '';
  private whereConditions: WhereCondition[] = [];
  private orderByFields: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];
  private limitValue?: number;
  private allowFilteringEnabled = false;

  constructor(private client: any) {}

  select(fields: string | string[]): this {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  from(table: string): this {
    this.fromTable = table;
    return this;
  }

  where(field: string, operator: WhereCondition['operator'], value: any): this {
    this.whereConditions.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  allowFiltering(): this {
    this.allowFilteringEnabled = true;
    return this;
  }

  build(): { query: string; params: any[] } {
    const params: any[] = [];
    let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.fromTable}`;

    if (this.whereConditions.length > 0) {
      const whereClause = this.whereConditions.map(condition => {
        params.push(condition.value);
        return `${condition.field} ${condition.operator} ?`;
      }).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    if (this.orderByFields.length > 0) {
      const orderClause = this.orderByFields
        .map(order => `${order.field} ${order.direction}`)
        .join(', ');
      query += ` ORDER BY ${orderClause}`;
    }

    if (this.limitValue) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.allowFilteringEnabled) {
      query += ' ALLOW FILTERING';
    }

    return { query, params };
  }

  async execute(): Promise<any> {
    const { query, params } = this.build();
    return this.client.execute(query, params);
  }

  // Aggregation methods
  async count(): Promise<number> {
    const originalFields = this.selectFields;
    this.selectFields = ['COUNT(*)'];
    const result = await this.execute();
    this.selectFields = originalFields;
    return result.rows[0]['count'];
  }

  // Collection operations
  whereContains(field: string, value: any): this {
    return this.where(field, 'CONTAINS', value);
  }

  whereIn(field: string, values: any[]): this {
    return this.where(field, 'IN', values);
  }
}
