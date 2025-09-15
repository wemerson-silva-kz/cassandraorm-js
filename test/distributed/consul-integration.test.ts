import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConsulServiceDiscovery, DistributedConfigManager } from '../../src/distributed/consul-integration.js';

// Mock fetch
global.fetch = jest.fn();

describe('Consul Integration', () => {
  describe('ConsulServiceDiscovery', () => {
    let consul: ConsulServiceDiscovery;

    beforeEach(() => {
      jest.clearAllMocks();
      consul = new ConsulServiceDiscovery({
        host: 'localhost',
        port: 8500
      });
    });

    it('should create ConsulServiceDiscovery instance', () => {
      expect(consul).toBeDefined();
      expect(typeof consul.registerService).toBe('function');
      expect(typeof consul.deregisterService).toBe('function');
      expect(typeof consul.discoverServices).toBe('function');
    });

    it('should register service successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('')
      });

      await consul.registerService({
        name: 'test-service',
        address: 'localhost',
        port: 3000,
        tags: ['test']
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8500/v1/agent/service/register',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should deregister service successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('')
      });

      await consul.deregisterService('test-service-id');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8500/v1/agent/service/deregister/test-service-id',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    it('should discover services successfully', async () => {
      const mockServices = [
        {
          Service: { Address: '192.168.1.1', Port: 3000 },
          Node: { Address: '192.168.1.1' }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockServices))
      });

      const services = await consul.discoverServices('test-service');

      expect(services).toEqual(mockServices);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8500/v1/health/service/test-service?passing=true',
        expect.any(Object)
      );
    });

    it('should get healthy services', async () => {
      const mockServices = [
        {
          Service: { Address: '192.168.1.1', Port: 3000 },
          Node: { Address: '192.168.1.1' }
        },
        {
          Service: { Address: '192.168.1.2', Port: 3001 },
          Node: { Address: '192.168.1.2' }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockServices))
      });

      const healthyServices = await consul.getHealthyServices('test-service');

      expect(healthyServices).toEqual([
        { address: '192.168.1.1', port: 3000 },
        { address: '192.168.1.2', port: 3001 }
      ]);
    });

    it('should set key-value pair', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('')
      });

      await consul.setKeyValue('test-key', { data: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8500/v1/kv/test-key',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ data: 'test' })
        })
      );
    });

    it('should get key-value pair', async () => {
      const mockValue = btoa(JSON.stringify({ data: 'test' }));
      const mockResponse = [{ Value: mockValue }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const value = await consul.getKeyValue('test-key');

      expect(value).toEqual({ data: 'test' });
    });

    it('should return null for non-existent key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('[]')
      });

      const value = await consul.getKeyValue('non-existent');

      expect(value).toBeNull();
    });

    it('should delete key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('')
      });

      await consul.deleteKey('test-key');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8500/v1/kv/test-key',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(consul.getKeyValue('test-key')).rejects.toThrow();
    });
  });

  describe('DistributedConfigManager', () => {
    let consul: ConsulServiceDiscovery;
    let configManager: DistributedConfigManager;

    beforeEach(() => {
      jest.clearAllMocks();
      consul = new ConsulServiceDiscovery();
      configManager = new DistributedConfigManager(consul, 'test/config');
    });

    it('should create DistributedConfigManager instance', () => {
      expect(configManager).toBeDefined();
      expect(typeof configManager.setConfig).toBe('function');
      expect(typeof configManager.getConfig).toBe('function');
      expect(typeof configManager.getAllConfigs).toBe('function');
    });

    it('should set config with prefix', async () => {
      const mockSetKeyValue = jest.spyOn(consul, 'setKeyValue').mockResolvedValue();

      await configManager.setConfig('database_url', 'localhost:9042');

      expect(mockSetKeyValue).toHaveBeenCalledWith('test/config/database_url', 'localhost:9042');
    });

    it('should get config with prefix', async () => {
      const mockGetKeyValue = jest.spyOn(consul, 'getKeyValue').mockResolvedValue('localhost:9042');

      const value = await configManager.getConfig('database_url');

      expect(mockGetKeyValue).toHaveBeenCalledWith('test/config/database_url');
      expect(value).toBe('localhost:9042');
    });

    it('should get all configs', async () => {
      const mockListKeys = jest.spyOn(consul, 'listKeys').mockResolvedValue([
        'test/config/database_url',
        'test/config/cache_ttl'
      ]);
      const mockGetKeyValue = jest.spyOn(consul, 'getKeyValue')
        .mockResolvedValueOnce('localhost:9042')
        .mockResolvedValueOnce(300);

      const configs = await configManager.getAllConfigs();

      expect(configs).toEqual({
        'database_url': 'localhost:9042',
        'cache_ttl': 300
      });
    });

    it('should delete config', async () => {
      const mockDeleteKey = jest.spyOn(consul, 'deleteKey').mockResolvedValue();

      await configManager.deleteConfig('database_url');

      expect(mockDeleteKey).toHaveBeenCalledWith('test/config/database_url');
    });
  });
});
