export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  strategy?: 'lru' | 'lfu' | 'fifo';
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
  ttl: number;
}

export class IntelligentCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // For LRU
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: 300, // 5 minutes default
      maxSize: 1000,
      strategy: 'lru',
      ...options
    };
  }

  set(key: string, data: any, ttl?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      hits: 0,
      ttl: ttl || this.options.ttl
    };

    // Remove expired entries and enforce size limit
    this.cleanup();
    
    if (this.cache.size >= this.options.maxSize) {
      this.evict();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access statistics
    entry.hits++;
    this.updateAccessOrder(key);
    
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  stats(): { size: number; hitRate: number; totalHits: number } {
    let totalHits = 0;
    let totalRequests = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalRequests += entry.hits + 1; // +1 for initial set
    }

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
  }

  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string;

    switch (this.options.strategy) {
      case 'lru':
        keyToEvict = this.accessOrder[0];
        break;
      case 'lfu':
        keyToEvict = this.findLFUKey();
        break;
      case 'fifo':
        keyToEvict = this.cache.keys().next().value || '';
        break;
      default:
        keyToEvict = this.accessOrder[0];
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }
    this.removeFromAccessOrder(keyToEvict);
  }

  private findLFUKey(): string {
    let minHits = Infinity;
    let lfuKey = '';

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

export class QueryCache {
  private cache: IntelligentCache;

  constructor(options: CacheOptions = {}) {
    this.cache = new IntelligentCache(options);
  }

  generateKey(query: string, params: any[]): string {
    return `${query}:${JSON.stringify(params)}`;
  }

  get(query: string, params: any[]): any | null {
    const key = this.generateKey(query, params);
    return this.cache.get(key);
  }

  set(query: string, params: any[], result: any, ttl?: number): void {
    const key = this.generateKey(query, params);
    this.cache.set(key, result, ttl);
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Simple pattern matching for cache invalidation
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    for (const [key] of this.cache['cache'].entries()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  stats() {
    return this.cache.stats();
  }
}
