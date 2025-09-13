export class QueryBuilder {
  private query = '';
  private params: any[] = [];

  select(fields: string | string[] = '*'): this {
    const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
    this.query = `SELECT ${fieldList}`;
    return this;
  }

  from(table: string): this {
    this.query += ` FROM ${table}`;
    return this;
  }

  where(conditions: Record<string, any>): this {
    const whereClause = Object.entries(conditions)
      .map(([key, value]) => {
        this.params.push(value);
        return `${key} = ?`;
      })
      .join(' AND ');
    
    this.query += ` WHERE ${whereClause}`;
    return this;
  }

  limit(count: number): this {
    this.query += ` LIMIT ${count}`;
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.query += ` ORDER BY ${field} ${direction}`;
    return this;
  }

  build(): { query: string; params: any[] } {
    return {
      query: this.query,
      params: this.params
    };
  }

  reset(): this {
    this.query = '';
    this.params = [];
    return this;
  }
}
