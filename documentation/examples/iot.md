# 🌐 IoT Data Platform Example

Complete IoT data platform showcasing time-series data, real-time analytics, and AI-powered anomaly detection.

## 🎯 Overview

This example demonstrates:
- **Time-series data** management
- **Real-time streaming** from IoT devices
- **AI anomaly detection** for sensor data
- **Performance monitoring** at scale
- **Event sourcing** for device lifecycle

## 🏗️ Architecture

```
IoT Devices → Message Queue → Data Ingestion → CassandraORM JS → Analytics Dashboard
     ↓              ↓              ↓               ↓                    ↓
  Sensors      Apache Kafka    Stream Processor   Time Series      Real-time UI
  Actuators    MQTT Broker     Batch Processor    Event Store      Alerts
```

## 📊 Data Models

### Device Management

```typescript
const Device = await client.loadSchema('devices', {
  fields: {
    id: 'uuid',
    device_type: 'text',
    location: 'map<text,text>',
    manufacturer: 'text',
    model: 'text',
    firmware_version: 'text',
    status: 'text',
    last_seen: 'timestamp',
    created_at: 'timestamp'
  },
  key: ['id']
});

const Sensor = await client.loadSchema('sensors', {
  fields: {
    id: 'uuid',
    device_id: 'uuid',
    sensor_type: 'text',
    unit: 'text',
    min_value: 'float',
    max_value: 'float',
    calibration_date: 'timestamp'
  },
  key: ['id'],
  relations: {
    device: { model: 'devices', foreignKey: 'device_id', type: 'belongsTo' }
  }
});
```

### Time-Series Data

```typescript
import { TimeSeriesManager } from 'cassandraorm-js';

const timeSeriesManager = new TimeSeriesManager(client.driver, 'iot_platform', {
  defaultTTL: 2592000, // 30 days
  bucketSize: 'hour',
  compressionEnabled: true
});

// Create time-series tables
await timeSeriesManager.createTimeSeriesTable('sensor_readings', {
  partitionKeys: ['device_id', 'sensor_id'],
  clusteringKeys: ['timestamp'],
  valueFields: {
    value: 'double',
    quality: 'int',
    status: 'text'
  },
  bucketSize: 'hour'
});

await timeSeriesManager.createTimeSeriesTable('device_metrics', {
  partitionKeys: ['device_id'],
  clusteringKeys: ['timestamp'],
  valueFields: {
    cpu_usage: 'float',
    memory_usage: 'float',
    battery_level: 'float',
    signal_strength: 'int'
  },
  bucketSize: 'minute'
});
```

## 📡 Real-time Data Ingestion

```typescript
class IoTDataIngestionService {
  private timeSeriesManager: TimeSeriesManager;
  private subscriptions: SubscriptionManager;
  private aiml: AIMLManager;

  constructor(client: CassandraClient) {
    this.timeSeriesManager = new TimeSeriesManager(client.driver, 'iot_platform');
    this.subscriptions = new SubscriptionManager(client.driver, 'iot_platform');
    this.aiml = new AIMLManager(client.driver, 'iot_platform');
  }

  async initialize(): Promise<void> {
    await this.subscriptions.initialize();
    await this.setupRealTimeProcessing();
  }

  async ingestSensorData(deviceId: string, sensorId: string, readings: SensorReading[]): Promise<void> {
    // Batch insert for performance
    const timeSeriesData = readings.map(reading => ({
      device_id: deviceId,
      sensor_id: sensorId,
      timestamp: reading.timestamp,
      value: reading.value,
      quality: reading.quality || 100,
      status: reading.status || 'ok'
    }));

    await this.timeSeriesManager.insert('sensor_readings', timeSeriesData);

    // Trigger real-time processing
    for (const reading of readings) {
      await this.processRealtimeReading(deviceId, sensorId, reading);
    }
  }

  private async processRealtimeReading(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<void> {
    // Anomaly detection
    const isAnomaly = await this.detectAnomaly(deviceId, sensorId, reading);
    
    if (isAnomaly) {
      await this.handleAnomaly(deviceId, sensorId, reading);
    }

    // Real-time aggregation
    await this.updateRealTimeAggregates(deviceId, sensorId, reading);

    // Broadcast to subscribers
    await this.broadcastReading(deviceId, sensorId, reading);
  }

  private async detectAnomaly(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<boolean> {
    // Get historical data for comparison
    const historicalData = await this.timeSeriesManager.query('sensor_readings', {
      device_id: deviceId,
      sensor_id: sensorId,
      timestamp: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    });

    // Use AI for anomaly detection
    const detector = this.aiml.getAnomalyDetector();
    const metrics = historicalData.map(d => ({
      timestamp: d.timestamp,
      value: d.value,
      metric: 'sensor_reading'
    }));

    const anomalies = await detector.detectAnomalies([
      ...metrics,
      {
        timestamp: reading.timestamp,
        value: reading.value,
        metric: 'sensor_reading'
      }
    ]);

    return anomalies.some(a => 
      a.timestamp.getTime() === reading.timestamp.getTime() && 
      a.confidence > 0.8
    );
  }

  private async handleAnomaly(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<void> {
    // Log anomaly
    const Anomaly = await client.loadSchema('anomalies', {
      fields: {
        id: 'uuid',
        device_id: 'uuid',
        sensor_id: 'uuid',
        timestamp: 'timestamp',
        value: 'double',
        expected_range: 'map<text,double>',
        severity: 'text',
        status: 'text',
        created_at: 'timestamp'
      },
      key: ['id']
    });

    await Anomaly.create({
      device_id: deviceId,
      sensor_id: sensorId,
      timestamp: reading.timestamp,
      value: reading.value,
      severity: this.calculateSeverity(reading),
      status: 'open',
      created_at: new Date()
    });

    // Send alert
    await this.sendAnomalyAlert(deviceId, sensorId, reading);
  }

  private async updateRealTimeAggregates(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<void> {
    // Update minute aggregates
    const minuteBucket = new Date(Math.floor(reading.timestamp.getTime() / 60000) * 60000);
    
    await this.timeSeriesManager.upsert('sensor_aggregates_minute', {
      device_id: deviceId,
      sensor_id: sensorId,
      bucket: minuteBucket,
      count: 1,
      sum: reading.value,
      min: reading.value,
      max: reading.value,
      avg: reading.value
    });

    // Update hourly aggregates
    const hourBucket = new Date(Math.floor(reading.timestamp.getTime() / 3600000) * 3600000);
    
    await this.timeSeriesManager.upsert('sensor_aggregates_hour', {
      device_id: deviceId,
      sensor_id: sensorId,
      bucket: hourBucket,
      count: 1,
      sum: reading.value,
      min: reading.value,
      max: reading.value,
      avg: reading.value
    });
  }

  private async broadcastReading(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<void> {
    // Broadcast to WebSocket subscribers
    await this.subscriptions.broadcast('sensor_readings', {
      deviceId,
      sensorId,
      reading
    });
  }

  private calculateSeverity(reading: SensorReading): string {
    // Simple severity calculation
    if (Math.abs(reading.value) > 1000) return 'critical';
    if (Math.abs(reading.value) > 500) return 'high';
    if (Math.abs(reading.value) > 100) return 'medium';
    return 'low';
  }

  private async sendAnomalyAlert(
    deviceId: string, 
    sensorId: string, 
    reading: SensorReading
  ): Promise<void> {
    console.log(`🚨 Anomaly detected: Device ${deviceId}, Sensor ${sensorId}, Value: ${reading.value}`);
    // Integration with alerting system (email, SMS, Slack, etc.)
  }

  private async setupRealTimeProcessing(): Promise<void> {
    // Subscribe to device status changes
    await this.subscriptions.subscribe(
      { table: 'devices', operation: 'update' },
      async (event) => {
        if (event.data.status === 'offline') {
          await this.handleDeviceOffline(event.data.id);
        }
      }
    );
  }

  private async handleDeviceOffline(deviceId: string): Promise<void> {
    console.log(`📱 Device ${deviceId} went offline`);
    // Handle device offline logic
  }
}

interface SensorReading {
  timestamp: Date;
  value: number;
  quality?: number;
  status?: string;
}
```

## 🔄 Device Lifecycle with Event Sourcing

```typescript
class DeviceAggregate extends BaseAggregateRoot {
  private deviceType: string = '';
  private location: any = {};
  private status: DeviceStatus = DeviceStatus.INACTIVE;
  private lastSeen: Date | null = null;
  private sensors: string[] = [];

  static provision(
    id: string, 
    deviceType: string, 
    location: any, 
    sensors: string[]
  ): DeviceAggregate {
    const device = new DeviceAggregate(id);
    device.addEvent('DeviceProvisioned', {
      deviceType,
      location,
      sensors
    });
    return device;
  }

  activate(): void {
    if (this.status === DeviceStatus.ACTIVE) return;
    this.addEvent('DeviceActivated', { activatedAt: new Date() });
  }

  updateLocation(newLocation: any): void {
    this.addEvent('DeviceLocationUpdated', {
      oldLocation: this.location,
      newLocation
    });
  }

  reportHeartbeat(): void {
    this.addEvent('DeviceHeartbeat', { timestamp: new Date() });
  }

  addSensor(sensorId: string, sensorType: string): void {
    if (this.sensors.includes(sensorId)) return;
    this.addEvent('SensorAdded', { sensorId, sensorType });
  }

  decommission(reason: string): void {
    this.addEvent('DeviceDecommissioned', { 
      reason, 
      decommissionedAt: new Date() 
    });
  }

  protected applyEvent(event: any): void {
    switch (event.eventType) {
      case 'DeviceProvisioned':
        this.deviceType = event.eventData.deviceType;
        this.location = event.eventData.location;
        this.sensors = [...event.eventData.sensors];
        this.status = DeviceStatus.INACTIVE;
        break;

      case 'DeviceActivated':
        this.status = DeviceStatus.ACTIVE;
        break;

      case 'DeviceLocationUpdated':
        this.location = event.eventData.newLocation;
        break;

      case 'DeviceHeartbeat':
        this.lastSeen = event.eventData.timestamp;
        break;

      case 'SensorAdded':
        this.sensors.push(event.eventData.sensorId);
        break;

      case 'DeviceDecommissioned':
        this.status = DeviceStatus.DECOMMISSIONED;
        break;
    }
  }

  getStatus(): DeviceStatus { return this.status; }
  getLocation(): any { return this.location; }
  getSensors(): string[] { return [...this.sensors]; }
  getLastSeen(): Date | null { return this.lastSeen; }
}

enum DeviceStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  DECOMMISSIONED = 'decommissioned'
}
```

## 📊 Analytics and Reporting

```typescript
class IoTAnalyticsService {
  private timeSeriesManager: TimeSeriesManager;
  private aggregationsManager: AggregationsManager;

  constructor(client: CassandraClient) {
    this.timeSeriesManager = new TimeSeriesManager(client.driver, 'iot_platform');
    this.aggregationsManager = new AggregationsManager(client.driver, 'iot_platform');
  }

  async getDeviceMetrics(deviceId: string, timeRange: TimeRange): Promise<DeviceMetrics> {
    // Get sensor readings
    const readings = await this.timeSeriesManager.query('sensor_readings', {
      device_id: deviceId,
      timestamp: {
        $gte: timeRange.start,
        $lte: timeRange.end
      }
    });

    // Calculate statistics
    const stats = this.calculateStatistics(readings);

    // Get anomalies
    const anomalies = await this.getAnomalies(deviceId, timeRange);

    // Get uptime
    const uptime = await this.calculateUptime(deviceId, timeRange);

    return {
      deviceId,
      timeRange,
      totalReadings: readings.length,
      statistics: stats,
      anomalies: anomalies.length,
      uptime
    };
  }

  async getFleetOverview(): Promise<FleetOverview> {
    // Use aggregations for fleet-wide metrics
    const deviceStats = await this.aggregationsManager.createPipeline('devices')
      .groupBy('status')
      .count('total')
      .execute();

    const sensorStats = await this.aggregationsManager.createPipeline('sensor_readings')
      .where('timestamp', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .groupBy('device_id')
      .count('readings_count')
      .avg('value', 'avg_value')
      .execute();

    const anomalyStats = await this.aggregationsManager.createPipeline('anomalies')
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .groupBy('severity')
      .count('count')
      .execute();

    return {
      totalDevices: deviceStats.reduce((sum, stat) => sum + stat.total, 0),
      activeDevices: deviceStats.find(s => s.status === 'active')?.total || 0,
      totalReadings: sensorStats.reduce((sum, stat) => sum + stat.readings_count, 0),
      anomalies: anomalyStats,
      lastUpdated: new Date()
    };
  }

  async generateReport(reportType: ReportType, parameters: any): Promise<Report> {
    switch (reportType) {
      case ReportType.DEVICE_PERFORMANCE:
        return await this.generateDevicePerformanceReport(parameters);
      
      case ReportType.ANOMALY_SUMMARY:
        return await this.generateAnomalySummaryReport(parameters);
      
      case ReportType.FLEET_HEALTH:
        return await this.generateFleetHealthReport(parameters);
      
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private async generateDevicePerformanceReport(params: any): Promise<Report> {
    const devices = await Device.find({ status: 'active' });
    const reportData = [];

    for (const device of devices) {
      const metrics = await this.getDeviceMetrics(device.id, params.timeRange);
      reportData.push({
        deviceId: device.id,
        deviceType: device.device_type,
        location: device.location,
        metrics
      });
    }

    return {
      type: ReportType.DEVICE_PERFORMANCE,
      generatedAt: new Date(),
      parameters: params,
      data: reportData
    };
  }

  private calculateStatistics(readings: any[]): any {
    if (readings.length === 0) return null;

    const values = readings.map(r => r.value);
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: this.calculateMedian(values)
    };
  }

  private calculateMedian(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  private async getAnomalies(deviceId: string, timeRange: TimeRange): Promise<any[]> {
    const Anomaly = await client.loadSchema('anomalies', {/* schema */});
    return await Anomaly.find({
      device_id: deviceId,
      timestamp: {
        $gte: timeRange.start,
        $lte: timeRange.end
      }
    });
  }

  private async calculateUptime(deviceId: string, timeRange: TimeRange): Promise<number> {
    // Calculate uptime based on heartbeat events
    const heartbeats = await this.timeSeriesManager.query('device_metrics', {
      device_id: deviceId,
      timestamp: {
        $gte: timeRange.start,
        $lte: timeRange.end
      }
    });

    // Simple uptime calculation
    const totalMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60);
    const activeMinutes = heartbeats.length; // Assuming 1 heartbeat per minute
    
    return Math.min(100, (activeMinutes / totalMinutes) * 100);
  }
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface DeviceMetrics {
  deviceId: string;
  timeRange: TimeRange;
  totalReadings: number;
  statistics: any;
  anomalies: number;
  uptime: number;
}

interface FleetOverview {
  totalDevices: number;
  activeDevices: number;
  totalReadings: number;
  anomalies: any[];
  lastUpdated: Date;
}

enum ReportType {
  DEVICE_PERFORMANCE = 'device_performance',
  ANOMALY_SUMMARY = 'anomaly_summary',
  FLEET_HEALTH = 'fleet_health'
}

interface Report {
  type: ReportType;
  generatedAt: Date;
  parameters: any;
  data: any;
}
```

## 🚀 Complete IoT Platform

```typescript
class IoTPlatform {
  private client: CassandraClient;
  private ingestionService: IoTDataIngestionService;
  private analyticsService: IoTAnalyticsService;
  private deviceRepository: AggregateRepository<DeviceAggregate>;

  constructor() {
    this.client = createClient({
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'iot_platform'
      },
      ormOptions: {
        createKeyspace: true,
        migration: 'safe'
      }
    });

    this.ingestionService = new IoTDataIngestionService(this.client);
    this.analyticsService = new IoTAnalyticsService(this.client);
    
    const eventStore = new EventStore(this.client.driver, 'iot_platform');
    this.deviceRepository = new AggregateRepository(
      eventStore,
      (id: string) => new DeviceAggregate(id)
    );
  }

  async initialize(): Promise<void> {
    await this.client.connect();
    await this.ingestionService.initialize();
    console.log('🌐 IoT Platform initialized');
  }

  // Device management
  async provisionDevice(deviceData: any): Promise<string> {
    const deviceId = this.client.uuid();
    const device = DeviceAggregate.provision(
      deviceId,
      deviceData.type,
      deviceData.location,
      deviceData.sensors
    );

    await this.deviceRepository.save(device);
    return deviceId;
  }

  // Data ingestion
  async ingestSensorData(deviceId: string, sensorId: string, readings: SensorReading[]): Promise<void> {
    await this.ingestionService.ingestSensorData(deviceId, sensorId, readings);
  }

  // Analytics
  async getDeviceMetrics(deviceId: string, timeRange: TimeRange): Promise<DeviceMetrics> {
    return await this.analyticsService.getDeviceMetrics(deviceId, timeRange);
  }

  async getFleetOverview(): Promise<FleetOverview> {
    return await this.analyticsService.getFleetOverview();
  }

  async shutdown(): Promise<void> {
    await this.client.close();
    console.log('🌐 IoT Platform shutdown complete');
  }
}

// Usage
const iotPlatform = new IoTPlatform();
await iotPlatform.initialize();

// Provision device
const deviceId = await iotPlatform.provisionDevice({
  type: 'temperature_sensor',
  location: { building: 'A', floor: '2', room: '201' },
  sensors: ['temp_01', 'humidity_01']
});

// Ingest data
await iotPlatform.ingestSensorData(deviceId, 'temp_01', [
  { timestamp: new Date(), value: 23.5, quality: 100 },
  { timestamp: new Date(), value: 24.1, quality: 100 }
]);

// Get analytics
const metrics = await iotPlatform.getDeviceMetrics(deviceId, {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date()
});

console.log('Device metrics:', metrics);
```

## 🎯 Key Features Demonstrated

- ✅ **Time-series Data** - Efficient storage and querying
- ✅ **Real-time Processing** - Live data ingestion and alerts
- ✅ **AI Anomaly Detection** - Intelligent monitoring
- ✅ **Event Sourcing** - Device lifecycle management
- ✅ **Analytics & Reporting** - Fleet-wide insights
- ✅ **Scalable Architecture** - Handle millions of devices

This IoT platform example shows how CassandraORM JS handles high-throughput time-series data with advanced analytics and real-time processing! 🌐✨
