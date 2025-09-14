import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export interface TracingConfig {
  enabled?: boolean;
  sampleRate?: number; // 0.0 to 1.0
  jaeger?: {
    endpoint?: string;
    serviceName?: string;
  };
  maxSpans?: number;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: LogEntry[];
  status: 'ok' | 'error' | 'timeout';
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  fields?: Record<string, any>;
}

export class Span {
  private data: SpanData;
  private tracer: Tracer;

  constructor(
    tracer: Tracer,
    operationName: string,
    context?: SpanContext
  ) {
    this.tracer = tracer;
    this.data = {
      traceId: context?.traceId || this.generateId(),
      spanId: context?.spanId || this.generateId(),
      parentSpanId: context?.parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok'
    };
  }

  setTag(key: string, value: any): this {
    this.data.tags[key] = value;
    return this;
  }

  setTags(tags: Record<string, any>): this {
    Object.assign(this.data.tags, tags);
    return this;
  }

  log(message: string, level: LogEntry['level'] = 'info', fields?: Record<string, any>): this {
    this.data.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields
    });
    return this;
  }

  setStatus(status: SpanData['status']): this {
    this.data.status = status;
    return this;
  }

  finish(): void {
    this.data.endTime = Date.now();
    this.data.duration = this.data.endTime - this.data.startTime;
    this.tracer.finishSpan(this);
  }

  getContext(): SpanContext {
    return {
      traceId: this.data.traceId,
      spanId: this.data.spanId,
      parentSpanId: this.data.parentSpanId
    };
  }

  getData(): SpanData {
    return { ...this.data };
  }

  private generateId(): string {
    return randomBytes(8).toString('hex');
  }
}

export class Tracer extends EventEmitter {
  private config: Required<TracingConfig>;
  private activeSpans = new Map<string, Span>();
  private finishedSpans: SpanData[] = [];

  constructor(config: TracingConfig = {}) {
    super();
    const defaultConfig = {
      enabled: true,
      sampleRate: 1.0,
      jaeger: {
        endpoint: 'http://localhost:14268/api/traces',
        serviceName: 'cassandra-orm'
      },
      maxSpans: 10000
    };

    this.config = {
      ...defaultConfig,
      ...config,
      jaeger: { ...defaultConfig.jaeger, ...config.jaeger }
    };
  }

  startSpan(operationName: string, parentContext?: SpanContext): Span {
    if (!this.config.enabled || !this.shouldSample()) {
      return new NoOpSpan();
    }

    const context: SpanContext = {
      traceId: parentContext?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentContext?.spanId
    };

    const span = new Span(this, operationName, context);
    this.activeSpans.set(span.getContext().spanId, span);
    
    this.emit('spanStarted', span.getData());
    return span;
  }

  finishSpan(span: Span): void {
    const spanData = span.getData();
    this.activeSpans.delete(spanData.spanId);
    
    // Store finished span
    this.finishedSpans.push(spanData);
    
    // Limit memory usage
    if (this.finishedSpans.length > this.config.maxSpans) {
      this.finishedSpans = this.finishedSpans.slice(-this.config.maxSpans / 2);
    }

    this.emit('spanFinished', spanData);
  }

  // Convenience method for timing operations
  async trace<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    parentContext?: SpanContext
  ): Promise<T> {
    const span = this.startSpan(operationName, parentContext);
    
    try {
      const result = await operation(span);
      span.setStatus('ok');
      return result;
    } catch (error) {
      span.setStatus('error');
      span.setTag('error', true);
      span.log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    } finally {
      span.finish();
    }
  }

  // Get traces for a specific trace ID
  getTrace(traceId: string): SpanData[] {
    return this.finishedSpans.filter(span => span.traceId === traceId);
  }

  // Get all traces
  getTraces(limit: number = 100): SpanData[] {
    return this.finishedSpans.slice(-limit);
  }

  // Export traces in Jaeger format
  exportJaegerTraces(): any[] {
    const traceGroups = new Map<string, SpanData[]>();
    
    // Group spans by trace ID
    this.finishedSpans.forEach(span => {
      if (!traceGroups.has(span.traceId)) {
        traceGroups.set(span.traceId, []);
      }
      traceGroups.get(span.traceId)!.push(span);
    });

    // Convert to Jaeger format
    return Array.from(traceGroups.entries()).map(([traceId, spans]) => ({
      traceID: traceId,
      spans: spans.map(span => ({
        traceID: span.traceId,
        spanID: span.spanId,
        parentSpanID: span.parentSpanId || '',
        operationName: span.operationName,
        startTime: span.startTime * 1000, // Jaeger expects microseconds
        duration: (span.duration || 0) * 1000,
        tags: Object.entries(span.tags).map(([key, value]) => ({
          key,
          type: typeof value === 'string' ? 'string' : 'number',
          value: String(value)
        })),
        logs: span.logs.map(log => ({
          timestamp: log.timestamp * 1000,
          fields: [
            { key: 'level', value: log.level },
            { key: 'message', value: log.message },
            ...(log.fields ? Object.entries(log.fields).map(([k, v]) => ({
              key: k,
              value: String(v)
            })) : [])
          ]
        })),
        process: {
          serviceName: this.config.jaeger.serviceName,
          tags: []
        }
      }))
    }));
  }

  // Clear all traces
  clear(): void {
    this.finishedSpans = [];
    this.activeSpans.clear();
    this.emit('cleared');
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }
}

// No-op span for when tracing is disabled or not sampled
class NoOpSpan extends Span {
  constructor() {
    super(null as any, '', undefined);
  }

  setTag(): this { return this; }
  setTags(): this { return this; }
  log(): this { return this; }
  setStatus(): this { return this; }
  finish(): void { }
}

// Built-in Cassandra tracing
export class CassandraTracing {
  private tracer: Tracer;

  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }

  async traceQuery<T>(
    query: string,
    params: any[],
    operation: () => Promise<T>,
    parentContext?: SpanContext
  ): Promise<T> {
    return this.tracer.trace(
      'cassandra.query',
      async (span) => {
        span.setTags({
          'db.type': 'cassandra',
          'db.statement': query,
          'db.params.count': params.length
        });

        const result = await operation();
        
        if (result && typeof result === 'object' && 'rows' in result) {
          span.setTag('db.rows.count', (result as any).rows.length);
        }

        return result;
      },
      parentContext
    );
  }

  async traceBulkOperation<T>(
    operation: string,
    count: number,
    executor: () => Promise<T>,
    parentContext?: SpanContext
  ): Promise<T> {
    return this.tracer.trace(
      `cassandra.bulk.${operation}`,
      async (span) => {
        span.setTags({
          'db.type': 'cassandra',
          'bulk.operation': operation,
          'bulk.count': count
        });

        return await executor();
      },
      parentContext
    );
  }

  async traceConnection<T>(
    operation: string,
    executor: () => Promise<T>,
    parentContext?: SpanContext
  ): Promise<T> {
    return this.tracer.trace(
      `cassandra.connection.${operation}`,
      async (span) => {
        span.setTags({
          'db.type': 'cassandra',
          'connection.operation': operation
        });

        return await executor();
      },
      parentContext
    );
  }
}
