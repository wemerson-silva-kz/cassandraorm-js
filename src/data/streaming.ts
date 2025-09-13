import { EventEmitter } from 'events';
import type { Client } from "cassandra-driver";

export interface StreamingOptions {
  batchSize?: number;
  concurrency?: number;
  backpressure?: boolean;
  transform?: (data: any) => any | Promise<any>;
  filter?: (data: any) => boolean | Promise<boolean>;
}

export interface StreamingStats {
  processed: number;
  filtered: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  avgProcessingTime: number;
}

export class DataStream extends EventEmitter {
  private client: Client;
  private keyspace: string;
  private options: Required<StreamingOptions>;
  private stats: StreamingStats;
  private isRunning = false;
  private processingTimes: number[] = [];

  constructor(client: Client, keyspace: string, options: StreamingOptions = {}) {
    super();
    this.client = client;
    this.keyspace = keyspace;
    this.options = {
      batchSize: 1000,
      concurrency: 5,
      backpressure: true,
      transform: (data) => data,
      filter: () => true,
      ...options
    };
    
    this.stats = {
      processed: 0,
      filtered: 0,
      errors: 0,
      startTime: new Date(),
      avgProcessingTime: 0
    };
  }

  async stream(query: string, params: any[] = []): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stream is already running');
    }

    this.isRunning = true;
    this.stats.startTime = new Date();
    this.emit('start', this.stats);

    try {
      await this.executeStream(query, params);
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.stats.endTime = new Date();
      this.emit('end', this.stats);
    }
  }

  private async executeStream(query: string, params: any[]): Promise<void> {
    let pageState: string | undefined;
    let hasMore = true;

    while (hasMore && this.isRunning) {
      const startTime = Date.now();
      
      try {
        const result = await this.client.execute(query, params, {
          prepare: true,
          fetchSize: this.options.batchSize,
          pageState
        });

        const batch = result.rows;
        pageState = result.pageState;
        hasMore = !!pageState;

        if (batch.length > 0) {
          await this.processBatch(batch);
        }

        const processingTime = Date.now() - startTime;
        this.processingTimes.push(processingTime);
        this.updateAvgProcessingTime();

        this.emit('batch', { 
          size: batch.length, 
          processed: this.stats.processed,
          processingTime 
        });

        // Backpressure control
        if (this.options.backpressure && this.processingTimes.length > 10) {
          const avgTime = this.stats.avgProcessingTime;
          if (avgTime > 1000) { // If avg > 1s, add delay
            await this.sleep(Math.min(avgTime / 2, 5000));
          }
        }

      } catch (error) {
        this.stats.errors++;
        this.emit('error', error);
        
        if (this.listenerCount('error') === 0) {
          throw error;
        }
      }
    }
  }

  private async processBatch(batch: any[]): Promise<void> {
    const semaphore = new Semaphore(this.options.concurrency);
    const promises = batch.map(async (item) => {
      await semaphore.acquire();
      
      try {
        // Apply filter
        const shouldProcess = await this.options.filter(item);
        if (!shouldProcess) {
          this.stats.filtered++;
          return;
        }

        // Apply transform
        const transformed = await this.options.transform(item);
        
        this.stats.processed++;
        this.emit('data', transformed);
        
      } catch (error) {
        this.stats.errors++;
        this.emit('itemError', { item, error });
      } finally {
        semaphore.release();
      }
    });

    await Promise.allSettled(promises);
  }

  private updateAvgProcessingTime(): void {
    if (this.processingTimes.length === 0) return;
    
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    this.stats.avgProcessingTime = sum / this.processingTimes.length;
    
    // Keep only last 100 measurements
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-50);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    this.isRunning = false;
    this.emit('stop');
  }

  getStats(): StreamingStats {
    return { ...this.stats };
  }
}

export class StreamingManager {
  private client: Client;
  private keyspace: string;

  constructor(client: Client, keyspace: string) {
    this.client = client;
    this.keyspace = keyspace;
  }

  createStream(options: StreamingOptions = {}): DataStream {
    return new DataStream(this.client, this.keyspace, options);
  }

  // Convenience method for simple streaming
  async streamTable(
    tableName: string,
    options: StreamingOptions & { 
      where?: Record<string, any>;
      select?: string[];
    } = {}
  ): Promise<DataStream> {
    const { where, select, ...streamOptions } = options;
    
    let query = `SELECT ${select?.join(', ') || '*'} FROM ${this.keyspace}.${tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')} ALLOW FILTERING`;
    }

    const stream = this.createStream(streamOptions);
    
    // Start streaming in next tick
    process.nextTick(() => {
      stream.stream(query, params).catch(error => {
        stream.emit('error', error);
      });
    });

    return stream;
  }

  // Batch processing with streaming
  async processBatches<T, R>(
    query: string,
    params: any[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number;
      concurrency?: number;
    } = {}
  ): Promise<R[]> {
    const results: R[] = [];
    const stream = this.createStream({
      batchSize: options.batchSize || 1000,
      concurrency: options.concurrency || 5
    });

    return new Promise((resolve, reject) => {
      const batches: T[][] = [];
      let currentBatch: T[] = [];

      stream.on('data', (item: T) => {
        currentBatch.push(item);
        
        if (currentBatch.length >= (options.batchSize || 1000)) {
          batches.push([...currentBatch]);
          currentBatch = [];
        }
      });

      stream.on('end', async () => {
        // Process remaining items
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }

        try {
          // Process all batches
          const semaphore = new Semaphore(options.concurrency || 5);
          const promises = batches.map(async (batch) => {
            await semaphore.acquire();
            try {
              const batchResults = await processor(batch);
              results.push(...batchResults);
            } finally {
              semaphore.release();
            }
          });

          await Promise.all(promises);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', reject);
      stream.stream(query, params);
    });
  }
}

// Simple semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}
