import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AdvancedPerformanceOptimizer, ConnectionPoolOptimizer } from "../../src/performance/advanced-optimization";
describe('Advanced Performance Optimization', () => {
    const mockConfig = {
        queryCache: {
            enabled: true,
            maxSize: 100,
            ttl: 60000
        },
        connectionPool: {
            minConnections: 2,
            maxConnections: 10,
            acquireTimeout: 5000
        },
        queryOptimization: {
            enabled: true,
            analyzeSlowQueries: true,
            slowQueryThreshold: 100
        }
    };
    describe('AdvancedPerformanceOptimizer', () => {
        let optimizer;
        beforeEach(() => {
            optimizer = new AdvancedPerformanceOptimizer(mockConfig);
        });
        afterEach(() => {
            if (optimizer) {
                optimizer.destroy();
            }
        });
        it('should create AdvancedPerformanceOptimizer instance', () => {
            expect(optimizer).toBeDefined();
            expect(typeof optimizer.optimizeQuery).toBe('function');
            expect(typeof optimizer.executeWithCache).toBe('function');
            expect(typeof optimizer.getPerformanceReport).toBe('function');
        });
        it('should optimize queries', async () => {
            const query = '  SELECT   *   FROM   users  ';
            const params = ['test'];
            const result = await optimizer.optimizeQuery(query, params);
            expect(result.query).toBe('SELECT * FROM users');
            expect(result.params).toEqual(params);
            expect(result.optimizations).toContain('Removed unnecessary whitespace');
        });
        it('should suggest LIMIT for SELECT queries', async () => {
            const query = 'SELECT * FROM users WHERE active = true';
            const params = [];
            const result = await optimizer.optimizeQuery(query, params);
            expect(result.optimizations).toContain('Consider adding LIMIT clause for better performance');
        });
        it('should warn about potential full table scan', async () => {
            const query = 'SELECT * FROM users';
            const params = [];
            const result = await optimizer.optimizeQuery(query, params);
            expect(result.optimizations).toContain('WARNING: Query may cause full table scan');
        });
        it('should execute with caching', async () => {
            const query = 'SELECT * FROM users WHERE id = ?';
            const params = ['123'];
            const mockResult = { rows: [{ id: '123', name: 'test' }] };
            const mockExecutor = jest.fn().mockResolvedValue(mockResult);
            const result = await optimizer.executeWithCache(query, params, mockExecutor);
            expect(result).toEqual(mockResult);
            expect(mockExecutor).toHaveBeenCalledWith(query, params);
        });
        it('should return performance report', () => {
            const report = optimizer.getPerformanceReport();
            expect(report).toHaveProperty('cache');
            expect(report).toHaveProperty('topSlowQueries');
            expect(report).toHaveProperty('recentSlowQueries');
            expect(report).toHaveProperty('recommendations');
            expect(Array.isArray(report.recommendations)).toBe(true);
        });
    });
    describe('ConnectionPoolOptimizer', () => {
        let poolOptimizer;
        beforeEach(() => {
            poolOptimizer = new ConnectionPoolOptimizer(mockConfig.connectionPool);
        });
        it('should create ConnectionPoolOptimizer instance', () => {
            expect(poolOptimizer).toBeDefined();
            expect(typeof poolOptimizer.acquireConnection).toBe('function');
            expect(typeof poolOptimizer.releaseConnection).toBe('function');
            expect(typeof poolOptimizer.getPoolStats).toBe('function');
        });
        it('should acquire connection when under limit', async () => {
            const connection = await poolOptimizer.acquireConnection();
            expect(connection).toHaveProperty('id');
            expect(connection).toHaveProperty('acquired');
            expect(connection.acquired).toBe(true);
        });
        it('should return pool statistics', () => {
            const stats = poolOptimizer.getPoolStats();
            expect(stats).toHaveProperty('active');
            expect(stats).toHaveProperty('queued');
            expect(stats).toHaveProperty('max');
            expect(stats).toHaveProperty('utilization');
            expect(stats.max).toBe(mockConfig.connectionPool.maxConnections);
        });
        it('should release connection and update stats', async () => {
            const connection = await poolOptimizer.acquireConnection();
            const statsBefore = poolOptimizer.getPoolStats();
            poolOptimizer.releaseConnection(connection);
            const statsAfter = poolOptimizer.getPoolStats();
            expect(statsAfter.active).toBe(statsBefore.active - 1);
        });
        it('should queue requests when at max connections', async () => {
            // Fill up the pool
            const connections = [];
            for (let i = 0; i < mockConfig.connectionPool.maxConnections; i++) {
                connections.push(await poolOptimizer.acquireConnection());
            }
            // This should be queued
            const queuedPromise = poolOptimizer.acquireConnection();
            const stats = poolOptimizer.getPoolStats();
            expect(stats.active).toBe(mockConfig.connectionPool.maxConnections);
            // Release one connection to process queue
            poolOptimizer.releaseConnection(connections[0]);
            const queuedConnection = await queuedPromise;
            expect(queuedConnection).toHaveProperty('acquired');
            expect(queuedConnection.acquired).toBe(true);
        });
    });
});
