import type { Client } from "cassandra-driver";

export interface TimeSeriesOptions {
  ttl?: number;
  bucketSize?: string; // '1h', '1d', '1w', etc.
  compactionStrategy?: 'TimeWindowCompactionStrategy' | 'SizeTieredCompactionStrategy';
  compressionOptions?: Record<string, any>;
  retentionPolicy?: {
    enabled: boolean;
    maxAge: number;
    cleanupInterval: number;
  };
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number | string | Record<string, any>;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface TimeSeriesQuery {
  start: Date;
  end: Date;
  tags?: Record<string, string>;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  interval?: string; // '5m', '1h', '1d'
  limit?: number;
}

export interface TimeSeriesResult {
  timestamp: Date;
  value: any;
  tags?: Record<string, string>;
}

export class TimeSeriesManager {
  private client: Client;
  private keyspace: string;
  private options: Required<TimeSeriesOptions>;

  constructor(client: Client, keyspace: string, options: TimeSeriesOptions = {}) {
    this.client = client;
    this.keyspace = keyspace;
    this.options = {
      ttl: 86400 * 30, // 30 days
      bucketSize: '1d',
      compactionStrategy: 'TimeWindowCompactionStrategy',
      compressionOptions: {
        sstable_compression: 'LZ4Compressor',
        chunk_length_kb: 64
      },
      retentionPolicy: {
        enabled: true,
        maxAge: 86400 * 90, // 90 days
        cleanupInterval: 86400 // 1 day
      },
      ...options
    };
  }

  async createTimeSeriesTable(tableName: string, schema: Record<string, string>): Promise<void> {
    const bucketField = this.getBucketField();
    
    // Create main time series table
    const fields = [
      'bucket text',
      'timestamp timestamp',
      ...Object.entries(schema).map(([name, type]) => `${name} ${type}`),
      'tags map<text, text>',
      'metadata map<text, text>'
    ];

    let createQuery = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${tableName} (
        ${fields.join(',\n        ')},
        PRIMARY KEY (bucket, timestamp)
      ) WITH CLUSTERING ORDER BY (timestamp DESC)
    `;

    // Add compaction strategy
    createQuery += ` AND compaction = {
      'class': '${this.options.compactionStrategy}'
    }`;

    // Add compression
    if (this.options.compressionOptions) {
      const compressionOptions = Object.entries(this.options.compressionOptions)
        .map(([key, value]) => `'${key}': '${value}'`)
        .join(', ');
      createQuery += ` AND compression = { ${compressionOptions} }`;
    }

    // Add TTL
    if (this.options.ttl > 0) {
      createQuery += ` AND default_time_to_live = ${this.options.ttl}`;
    }

    await this.client.execute(createQuery);

    // Create indexes for common queries
    await this.createTimeSeriesIndexes(tableName);
  }

  private async createTimeSeriesIndexes(tableName: string): Promise<void> {
    // Index on tags for filtering
    try {
      await this.client.execute(
        `CREATE INDEX IF NOT EXISTS ${tableName}_tags_idx ON ${this.keyspace}.${tableName} (tags)`
      );
    } catch (error) {
      // Index might already exist
    }
  }

  async insert(tableName: string, points: TimeSeriesPoint[]): Promise<void> {
    const batch: any[] = [];

    for (const point of points) {
      const bucket = this.getBucket(point.timestamp);
      const query = `
        INSERT INTO ${this.keyspace}.${tableName} 
        (bucket, timestamp, value, tags, metadata) 
        VALUES (?, ?, ?, ?, ?)
      `;
      
      batch.push({
        query,
        params: [
          bucket,
          point.timestamp,
          point.value,
          point.tags || {},
          point.metadata || {}
        ]
      });
    }

    if (batch.length > 0) {
      await this.client.batch(batch, { prepare: true });
    }
  }

  async query(tableName: string, query: TimeSeriesQuery): Promise<TimeSeriesResult[]> {
    const buckets = this.getBucketsInRange(query.start, query.end);
    const results: TimeSeriesResult[] = [];

    for (const bucket of buckets) {
      const bucketResults = await this.queryBucket(tableName, bucket, query);
      results.push(...bucketResults);
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply aggregation if specified
    if (query.aggregation && query.interval) {
      return this.aggregateResults(results, query.aggregation, query.interval);
    }

    // Apply limit
    if (query.limit) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  private async queryBucket(
    tableName: string, 
    bucket: string, 
    query: TimeSeriesQuery
  ): Promise<TimeSeriesResult[]> {
    let cqlQuery = `
      SELECT timestamp, value, tags 
      FROM ${this.keyspace}.${tableName} 
      WHERE bucket = ? 
      AND timestamp >= ? 
      AND timestamp <= ?
    `;
    
    const params = [bucket, query.start, query.end];

    // Add tag filtering
    if (query.tags && Object.keys(query.tags).length > 0) {
      const tagConditions = Object.entries(query.tags).map(([key, value]) => {
        params.push(value);
        return `tags[?] = ?`;
      });
      cqlQuery += ` AND ${tagConditions.join(' AND ')}`;
      
      // Add the keys for the tag conditions
      if (query.tags) {
        Object.keys(query.tags).forEach(key => {
          params.splice(-Object.keys(query.tags!).length, 0, key);
        });
      }
    }

    cqlQuery += ' ALLOW FILTERING';

    const result = await this.client.execute(cqlQuery, params, { prepare: true });
    
    return result.rows.map(row => ({
      timestamp: row.timestamp,
      value: row.value,
      tags: row.tags
    }));
  }

  private getBucket(timestamp: Date): string {
    const bucketSizeMs = this.parseBucketSize(this.options.bucketSize);
    const bucketStart = Math.floor(timestamp.getTime() / bucketSizeMs) * bucketSizeMs;
    return new Date(bucketStart).toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private getBucketsInRange(start: Date, end: Date): string[] {
    const buckets: string[] = [];
    const bucketSizeMs = this.parseBucketSize(this.options.bucketSize);
    
    let current = new Date(Math.floor(start.getTime() / bucketSizeMs) * bucketSizeMs);
    
    while (current <= end) {
      buckets.push(this.getBucket(current));
      current = new Date(current.getTime() + bucketSizeMs);
    }
    
    return [...new Set(buckets)]; // Remove duplicates
  }

  private parseBucketSize(bucketSize: string): number {
    const unit = bucketSize.slice(-1);
    const value = parseInt(bucketSize.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      default: return 60 * 60 * 1000; // default 1 hour
    }
  }

  private getBucketField(): string {
    return 'bucket';
  }

  private aggregateResults(
    results: TimeSeriesResult[], 
    aggregation: string, 
    interval: string
  ): TimeSeriesResult[] {
    const intervalMs = this.parseBucketSize(interval);
    const aggregated = new Map<number, TimeSeriesResult[]>();

    // Group results by interval
    results.forEach(result => {
      const intervalStart = Math.floor(result.timestamp.getTime() / intervalMs) * intervalMs;
      
      if (!aggregated.has(intervalStart)) {
        aggregated.set(intervalStart, []);
      }
      aggregated.get(intervalStart)!.push(result);
    });

    // Apply aggregation function
    const aggregatedResults: TimeSeriesResult[] = [];
    
    aggregated.forEach((points, intervalStart) => {
      let aggregatedValue: any;
      
      switch (aggregation) {
        case 'avg':
          aggregatedValue = points.reduce((sum, p) => sum + Number(p.value), 0) / points.length;
          break;
        case 'sum':
          aggregatedValue = points.reduce((sum, p) => sum + Number(p.value), 0);
          break;
        case 'min':
          aggregatedValue = Math.min(...points.map(p => Number(p.value)));
          break;
        case 'max':
          aggregatedValue = Math.max(...points.map(p => Number(p.value)));
          break;
        case 'count':
          aggregatedValue = points.length;
          break;
        default:
          aggregatedValue = points[0].value;
      }

      aggregatedResults.push({
        timestamp: new Date(intervalStart),
        value: aggregatedValue,
        tags: points[0].tags // Use tags from first point
      });
    });

    return aggregatedResults.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async deleteOldData(tableName: string, maxAge: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAge * 1000);
    const bucketsToDelete = this.getBucketsInRange(
      new Date(0), // Start from epoch
      cutoffDate
    );

    for (const bucket of bucketsToDelete) {
      await this.client.execute(
        `DELETE FROM ${this.keyspace}.${tableName} WHERE bucket = ? AND timestamp < ?`,
        [bucket, cutoffDate],
        { prepare: true }
      );
    }
  }

  async getMetrics(tableName: string): Promise<{
    totalPoints: number;
    oldestPoint: Date | null;
    newestPoint: Date | null;
    bucketsCount: number;
  }> {
    // Get basic metrics
    const countResult = await this.client.execute(
      `SELECT COUNT(*) as total FROM ${this.keyspace}.${tableName}`
    );

    const minMaxResult = await this.client.execute(
      `SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM ${this.keyspace}.${tableName}`
    );

    const bucketsResult = await this.client.execute(
      `SELECT DISTINCT bucket FROM ${this.keyspace}.${tableName}`
    );

    return {
      totalPoints: countResult.rows[0]?.total || 0,
      oldestPoint: minMaxResult.rows[0]?.oldest || null,
      newestPoint: minMaxResult.rows[0]?.newest || null,
      bucketsCount: bucketsResult.rows.length
    };
  }
}
