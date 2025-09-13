class QueryBuilder {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.reset();
  }

  reset() {
    this.queryType = null;
    this.selectFields = ['*'];
    this.whereConditions = [];
    this.orderByFields = [];
    this.limitValue = null;
    this.insertData = null;
    this.updateData = null;
    this.params = [];
  }

  select(fields = '*') {
    this.queryType = 'SELECT';
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  where(field, operator, value) {
    if (typeof field === 'object') {
      // Handle object syntax: where({ name: 'John', age: 30 })
      Object.entries(field).forEach(([key, val]) => {
        this.whereConditions.push(`${key} = ?`);
        this.params.push(val);
      });
    } else {
      this.whereConditions.push(`${field} ${operator} ?`);
      this.params.push(value);
    }
    return this;
  }

  orderBy(field, direction = 'ASC') {
    this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
    return this;
  }

  limit(count) {
    this.limitValue = count;
    return this;
  }

  insert(data) {
    this.queryType = 'INSERT';
    this.insertData = data;
    return this;
  }

  update(data) {
    this.queryType = 'UPDATE';
    this.updateData = data;
    return this;
  }

  delete() {
    this.queryType = 'DELETE';
    return this;
  }

  build() {
    let query = '';
    let params = [...this.params];

    switch (this.queryType) {
      case 'SELECT':
        query = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;
        if (this.whereConditions.length > 0) {
          query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }
        if (this.orderByFields.length > 0) {
          query += ` ORDER BY ${this.orderByFields.join(', ')}`;
        }
        if (this.limitValue) {
          query += ` LIMIT ${this.limitValue}`;
        }
        break;

      case 'INSERT':
        const fields = Object.keys(this.insertData);
        const placeholders = fields.map(() => '?').join(', ');
        query = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
        params = Object.values(this.insertData);
        break;

      case 'UPDATE':
        const setClause = Object.keys(this.updateData).map(key => `${key} = ?`).join(', ');
        query = `UPDATE ${this.tableName} SET ${setClause}`;
        params = [...Object.values(this.updateData), ...this.params];
        if (this.whereConditions.length > 0) {
          query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }
        break;

      case 'DELETE':
        query = `DELETE FROM ${this.tableName}`;
        if (this.whereConditions.length > 0) {
          query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }
        break;
    }

    return { query, params };
  }

  async execute() {
    const { query, params } = this.build();
    const result = await this.client.execute(query, params, { prepare: true });
    this.reset();
    return result;
  }

  async first() {
    this.limit(1);
    const result = await this.execute();
    return result.rows[0] || null;
  }

  async all() {
    const result = await this.execute();
    return result.rows;
  }
}

module.exports = { QueryBuilder };
