import { Client } from 'cassandra-driver';

export interface ResilienceConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  circuitBreakerThreshold?: number;
  healthCheckInterval?: number;
}

export class ResilientConnection {
  private client: Client;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private circuitBreakerOpen = false;
  private consecutiveFailures = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  
  constructor(
    private clientOptions: any,
    private config: ResilienceConfig = {}
  ) {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      circuitBreakerThreshold: 5,
      healthCheckInterval: 30000,
      ...config
    };
    
    this.client = new Client(clientOptions);
  }

  async connect(): Promise<void> {
    if (this.circuitBreakerOpen) {
      throw new Error('Circuit breaker is open - connection unavailable');
    }

    try {
      await this.client.connect();
      this.onConnectionSuccess();
      this.startHealthCheck();
    } catch (error) {
      this.onConnectionFailure();
      await this.handleConnectionFailure(error);
    }
  }

  private onConnectionSuccess(): void {
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    this.circuitBreakerOpen = false;
    this.isReconnecting = false;
  }

  private onConnectionFailure(): void {
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold!) {
      this.circuitBreakerOpen = true;
      console.warn('🔴 Circuit breaker opened - too many connection failures');
    }
  }

  private async handleConnectionFailure(error: any): Promise<void> {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts! && !this.isReconnecting) {
      await this.attemptReconnection();
    } else {
      throw error;
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (this.isReconnecting || this.circuitBreakerOpen) return;
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.client.connect();
        this.onConnectionSuccess();
        console.log('✅ Reconnection successful');
      } catch (error) {
        this.isReconnecting = false;
        if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
          await this.attemptReconnection();
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      }
    }, delay);
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;
    
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.client.execute('SELECT now() FROM system.local');
        
        // If circuit breaker was open, try to close it
        if (this.circuitBreakerOpen) {
          this.circuitBreakerOpen = false;
          this.consecutiveFailures = 0;
          console.log('🟢 Circuit breaker closed - connection restored');
        }
      } catch (error) {
        console.warn('⚠️ Health check failed:', error);
        this.onConnectionFailure();
      }
    }, this.config.healthCheckInterval);
  }

  getClient(): Client {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    
    await this.client.shutdown();
  }

  getConnectionStatus() {
    return {
      isConnected: this.client && !this.circuitBreakerOpen,
      reconnectAttempts: this.reconnectAttempts,
      circuitBreakerOpen: this.circuitBreakerOpen,
      consecutiveFailures: this.consecutiveFailures,
      isReconnecting: this.isReconnecting
    };
  }
}
