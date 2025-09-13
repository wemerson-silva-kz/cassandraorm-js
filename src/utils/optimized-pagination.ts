import type { Client } from "cassandra-driver";

export interface PaginationOptions {
  limit?: number;
  pageState?: string;
  fetchSize?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pageState?: string;
  hasMore: boolean;
  totalFetched: number;
}

export interface CursorPaginationOptions {
  limit?: number;
  cursor?: string;
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
}

export class OptimizedPagination {
  constructor(private client: Client, private keyspace: string) {}

  // Token-based pagination (Cassandra native)
  async paginate<T>(
    query: string,
    params: any[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    const { limit = 20, pageState, fetchSize = 1000 } = options;

    const queryOptions: any = {
      prepare: true,
      fetchSize: Math.min(fetchSize, limit * 2), // Optimize fetch size
    };

    if (pageState) {
      queryOptions.pageState = pageState;
    }

    const result = await this.client.execute(query, params, queryOptions);

    return {
      data: result.rows.slice(0, limit) as T[],
      pageState: result.pageState,
      hasMore: !!result.pageState || result.rows.length > limit,
      totalFetched: result.rows.length
    };
  }

  // Cursor-based pagination (for ordered results)
  async cursorPaginate<T>(
    tableName: string,
    options: CursorPaginationOptions = {}
  ): Promise<CursorPaginationResult<T>> {
    const {
      limit = 20,
      cursor,
      orderBy = 'id',
      direction = 'ASC'
    } = options;

    let query = `SELECT * FROM ${this.keyspace}.${tableName}`;
    const params: any[] = [];

    // Add cursor condition
    if (cursor) {
      const operator = direction === 'ASC' ? '>' : '<';
      query += ` WHERE ${orderBy} ${operator} ?`;
      params.push(cursor);
    }

    query += ` ORDER BY ${orderBy} ${direction} LIMIT ${limit + 1}`;

    const result = await this.client.execute(query, params, { prepare: true });
    const rows = result.rows as T[];

    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1] as any;
      const firstItem = data[0] as any;
      
      nextCursor = hasNext ? lastItem[orderBy] : undefined;
      prevCursor = cursor ? firstItem[orderBy] : undefined;
    }

    return {
      data,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev: !!cursor
    };
  }

  // Offset-based pagination (less efficient, use sparingly)
  async offsetPaginate<T>(
    query: string,
    params: any[] = [],
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: T[]; page: number; limit: number; hasMore: boolean }> {
    // Note: OFFSET is not natively supported in Cassandra
    // This is a workaround that fetches more data and slices it
    const offset = (page - 1) * limit;
    const fetchLimit = offset + limit + 1; // +1 to check if there's more

    const modifiedQuery = query.includes('LIMIT') 
      ? query.replace(/LIMIT\s+\d+/i, `LIMIT ${fetchLimit}`)
      : `${query} LIMIT ${fetchLimit}`;

    const result = await this.client.execute(modifiedQuery, params, { prepare: true });
    const allRows = result.rows as T[];

    const data = allRows.slice(offset, offset + limit);
    const hasMore = allRows.length > offset + limit;

    return {
      data,
      page,
      limit,
      hasMore
    };
  }

  // Auto-pagination for large datasets
  async *autoPaginate<T>(
    query: string,
    params: any[] = [],
    batchSize: number = 1000
  ): AsyncGenerator<T[], void, unknown> {
    let pageState: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.paginate<T>(query, params, {
        limit: batchSize,
        pageState
      });

      if (result.data.length > 0) {
        yield result.data;
      }

      pageState = result.pageState;
      hasMore = result.hasMore;
    }
  }

  // Streaming pagination for memory efficiency
  async streamPaginate<T>(
    query: string,
    params: any[] = [],
    onBatch: (batch: T[]) => Promise<void>,
    batchSize: number = 1000
  ): Promise<void> {
    for await (const batch of this.autoPaginate<T>(query, params, batchSize)) {
      await onBatch(batch);
    }
  }
}

// Helper class for building paginated queries
export class PaginatedQueryBuilder {
  private query: string = '';
  private params: any[] = [];
  private tableName: string;
  private keyspace: string;

  constructor(
    private pagination: OptimizedPagination,
    tableName: string,
    keyspace: string
  ) {
    this.tableName = tableName;
    this.keyspace = keyspace;
    this.query = `SELECT * FROM ${keyspace}.${tableName}`;
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

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.query += ` ORDER BY ${field} ${direction}`;
    return this;
  }

  async paginate<T>(options: PaginationOptions = {}): Promise<PaginationResult<T>> {
    return this.pagination.paginate<T>(this.query, this.params, options);
  }

  async cursorPaginate<T>(options: CursorPaginationOptions = {}): Promise<CursorPaginationResult<T>> {
    return this.pagination.cursorPaginate<T>(this.tableName, options);
  }
}
