export interface ConsulConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  token?: string;
  datacenter?: string;
}

export interface ServiceConfig {
  name: string;
  id?: string;
  address?: string;
  port?: number;
  tags?: string[];
  check?: {
    http?: string;
    interval?: string;
    timeout?: string;
  };
}

export class ConsulServiceDiscovery {
  private config: Required<ConsulConfig>;
  private baseUrl: string;

  constructor(config: ConsulConfig = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 8500,
      secure: config.secure || false,
      token: config.token || '',
      datacenter: config.datacenter || 'dc1'
    };

    const protocol = this.config.secure ? 'https' : 'http';
    this.baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.config.token) {
      headers['X-Consul-Token'] = this.config.token;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`Consul API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error('Consul request failed:', error);
      throw error;
    }
  }

  async registerService(service: ServiceConfig): Promise<void> {
    const serviceId = service.id || `${service.name}-${Date.now()}`;
    
    const registration = {
      ID: serviceId,
      Name: service.name,
      Address: service.address || 'localhost',
      Port: service.port || 3000,
      Tags: service.tags || [],
      Check: service.check ? {
        HTTP: service.check.http,
        Interval: service.check.interval || '10s',
        Timeout: service.check.timeout || '3s'
      } : undefined
    };

    await this.request('/v1/agent/service/register', {
      method: 'PUT',
      body: JSON.stringify(registration)
    });
  }

  async deregisterService(serviceId: string): Promise<void> {
    await this.request(`/v1/agent/service/deregister/${serviceId}`, {
      method: 'PUT'
    });
  }

  async discoverServices(serviceName: string): Promise<any[]> {
    const services = await this.request(`/v1/health/service/${serviceName}?passing=true`);
    return services || [];
  }

  async getHealthyServices(serviceName: string): Promise<Array<{ address: string, port: number }>> {
    const services = await this.discoverServices(serviceName);
    return services.map((service: any) => ({
      address: service.Service.Address || service.Node.Address,
      port: service.Service.Port
    }));
  }

  async setKeyValue(key: string, value: any): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.request(`/v1/kv/${key}`, {
      method: 'PUT',
      body: serialized
    });
  }

  async getKeyValue(key: string): Promise<any | null> {
    try {
      const result = await this.request(`/v1/kv/${key}`);
      if (!result || result.length === 0) return null;
      
      const decoded = atob(result[0].Value);
      try {
        return JSON.parse(decoded);
      } catch {
        return decoded;
      }
    } catch {
      return null;
    }
  }

  async deleteKey(key: string): Promise<void> {
    await this.request(`/v1/kv/${key}`, {
      method: 'DELETE'
    });
  }

  async listKeys(prefix: string): Promise<string[]> {
    try {
      const result = await this.request(`/v1/kv/${prefix}?keys=true`);
      return result || [];
    } catch {
      return [];
    }
  }

  async getClusterStatus(): Promise<any> {
    return await this.request('/v1/status/leader');
  }
}

export class DistributedConfigManager {
  private consul: ConsulServiceDiscovery;
  private configPrefix: string;

  constructor(consul: ConsulServiceDiscovery, configPrefix = 'cassandraorm/config') {
    this.consul = consul;
    this.configPrefix = configPrefix;
  }

  async setConfig(key: string, value: any): Promise<void> {
    await this.consul.setKeyValue(`${this.configPrefix}/${key}`, value);
  }

  async getConfig(key: string): Promise<any | null> {
    return await this.consul.getKeyValue(`${this.configPrefix}/${key}`);
  }

  async getAllConfigs(): Promise<Record<string, any>> {
    const keys = await this.consul.listKeys(this.configPrefix);
    const configs: Record<string, any> = {};

    for (const key of keys) {
      const shortKey = key.replace(`${this.configPrefix}/`, '');
      configs[shortKey] = await this.consul.getKeyValue(key);
    }

    return configs;
  }

  async deleteConfig(key: string): Promise<void> {
    await this.consul.deleteKey(`${this.configPrefix}/${key}`);
  }

  async watchConfig(key: string, callback: (value: any) => void): Promise<void> {
    // Simple polling implementation
    let lastValue = await this.getConfig(key);
    
    setInterval(async () => {
      const currentValue = await this.getConfig(key);
      if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
        lastValue = currentValue;
        callback(currentValue);
      }
    }, 5000); // Check every 5 seconds
  }
}
