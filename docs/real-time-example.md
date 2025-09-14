# Real-time Example

## Overview
Complete real-time application example with WebSocket connections, live data streaming, collaborative features, and real-time analytics.

## Real-time Chat Application

```typescript
// src/ChatApplication.ts
import { WebSocketManager, SubscriptionManager, StreamProcessor } from 'cassandraorm-js';

export class ChatApplication {
  private wsManager: WebSocketManager;
  private subscriptions: SubscriptionManager;
  private streamProcessor: StreamProcessor;

  constructor(client: any) {
    this.wsManager = new WebSocketManager(client, {
      port: 3001,
      maxConnections: 10000,
      heartbeatInterval: 30000,
      compression: true
    });

    this.subscriptions = new SubscriptionManager(client.driver, 'chat_app');
    this.streamProcessor = new StreamProcessor(client);
    
    this.setupModels();
    this.setupWebSocketHandlers();
    this.setupSubscriptions();
  }

  private async setupModels(): Promise<void> {
    // Chat rooms
    this.ChatRoom = await client.loadSchema('chat_rooms', {
      fields: {
        id: 'uuid',
        name: 'text',
        description: 'text',
        type: 'text', // 'public', 'private', 'direct'
        members: 'set<uuid>',
        admins: 'set<uuid>',
        created_by: 'uuid',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id']
    });

    // Messages
    this.Message = await client.loadSchema('messages', {
      fields: {
        id: 'timeuuid',
        room_id: 'uuid',
        user_id: 'uuid',
        content: 'text',
        message_type: 'text', // 'text', 'image', 'file', 'system'
        metadata: 'map<text, text>',
        edited_at: 'timestamp',
        created_at: 'timestamp'
      },
      key: [['room_id'], 'id'],
      clustering_order: { id: 'desc' }
    });

    // User presence
    this.UserPresence = await client.loadSchema('user_presence', {
      fields: {
        user_id: 'uuid',
        status: 'text', // 'online', 'away', 'busy', 'offline'
        last_seen: 'timestamp',
        current_room: 'uuid'
      },
      key: ['user_id']
    });

    // Typing indicators
    this.TypingIndicator = await client.loadSchema('typing_indicators', {
      fields: {
        room_id: 'uuid',
        user_id: 'uuid',
        started_at: 'timestamp'
      },
      key: [['room_id'], 'user_id'],
      ttl: 10 // Auto-expire after 10 seconds
    });
  }

  private setupWebSocketHandlers(): void {
    // Handle new connections
    this.wsManager.on('connection', async (ws, request) => {
      const userId = await this.authenticateUser(request.headers.authorization);
      ws.userId = userId;
      
      console.log(`User ${userId} connected`);
      
      // Update user presence
      await this.updateUserPresence(userId, 'online');
      
      // Join user to their rooms
      const userRooms = await this.getUserRooms(userId);
      for (const room of userRooms) {
        await this.wsManager.joinRoom(ws, `room:${room.id}`);
      }
      
      // Notify friends about online status
      await this.notifyPresenceChange(userId, 'online');
    });

    // Handle disconnections
    this.wsManager.on('disconnect', async (ws) => {
      if (ws.userId) {
        await this.updateUserPresence(ws.userId, 'offline');
        await this.notifyPresenceChange(ws.userId, 'offline');
        console.log(`User ${ws.userId} disconnected`);
      }
    });

    // Handle messages
    this.wsManager.on('message', async (ws, message) => {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'send_message':
          await this.handleSendMessage(ws, data.payload);
          break;
        case 'join_room':
          await this.handleJoinRoom(ws, data.payload);
          break;
        case 'leave_room':
          await this.handleLeaveRoom(ws, data.payload);
          break;
        case 'typing_start':
          await this.handleTypingStart(ws, data.payload);
          break;
        case 'typing_stop':
          await this.handleTypingStop(ws, data.payload);
          break;
        case 'get_room_history':
          await this.handleGetRoomHistory(ws, data.payload);
          break;
      }
    });
  }

  private async handleSendMessage(ws: any, payload: any): Promise<void> {
    const { roomId, content, messageType = 'text', metadata = {} } = payload;
    
    // Validate user can send to this room
    const canSend = await this.canUserSendToRoom(ws.userId, roomId);
    if (!canSend) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'You cannot send messages to this room'
      }));
      return;
    }

    // Create message
    const message = await this.Message.create({
      id: TimeUuid.now(),
      room_id: roomId,
      user_id: ws.userId,
      content,
      message_type: messageType,
      metadata,
      created_at: new Date()
    });

    // Get user info for the message
    const user = await this.getUser(ws.userId);
    
    // Broadcast to room
    this.wsManager.broadcastToRoom(`room:${roomId}`, {
      type: 'new_message',
      data: {
        id: message.id,
        room_id: roomId,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        },
        content,
        message_type: messageType,
        metadata,
        created_at: message.created_at
      }
    });

    // Clear typing indicator
    await this.clearTypingIndicator(roomId, ws.userId);
  }

  private async handleTypingStart(ws: any, payload: any): Promise<void> {
    const { roomId } = payload;
    
    // Set typing indicator
    await this.TypingIndicator.create({
      room_id: roomId,
      user_id: ws.userId,
      started_at: new Date()
    });

    // Get user info
    const user = await this.getUser(ws.userId);
    
    // Broadcast typing indicator to room (except sender)
    this.wsManager.broadcastToRoom(`room:${roomId}`, {
      type: 'user_typing',
      data: {
        user_id: ws.userId,
        user_name: user.name,
        room_id: roomId
      }
    }, [ws]);
  }

  private setupSubscriptions(): void {
    // Subscribe to message changes
    this.subscriptions.subscribe({
      table: 'messages',
      operations: ['insert'],
      callback: this.handleNewMessage.bind(this)
    });

    // Subscribe to user presence changes
    this.subscriptions.subscribe({
      table: 'user_presence',
      operations: ['update'],
      callback: this.handlePresenceChange.bind(this)
    });

    // Subscribe to room membership changes
    this.subscriptions.subscribe({
      table: 'chat_rooms',
      operations: ['update'],
      filters: {
        members: { $exists: true }
      },
      callback: this.handleRoomMembershipChange.bind(this)
    });
  }

  private async handleNewMessage(event: any): Promise<void> {
    const message = event.data;
    
    // Real-time message processing
    await this.processMessageForAnalytics(message);
    
    // Check for mentions and send notifications
    await this.processMentions(message);
    
    // Update room last activity
    await this.updateRoomActivity(message.room_id);
  }
}
```

## Live Dashboard with Real-time Metrics

```typescript
// src/LiveDashboard.ts
import { StreamProcessor, MetricsCollector, WebSocketManager } from 'cassandraorm-js';

export class LiveDashboard {
  private streamProcessor: StreamProcessor;
  private metricsCollector: MetricsCollector;
  private wsManager: WebSocketManager;

  constructor(client: any) {
    this.streamProcessor = new StreamProcessor(client);
    this.metricsCollector = new MetricsCollector({
      interval: 1000, // 1 second
      storage: 'memory'
    });
    this.wsManager = new WebSocketManager(client, { port: 3002 });
    
    this.setupMetricsCollection();
    this.setupRealTimeStreaming();
  }

  private setupMetricsCollection(): void {
    // Collect real-time metrics
    this.metricsCollector.collect('active_users', async () => {
      const result = await client.execute(
        "SELECT COUNT(*) as count FROM user_presence WHERE status = 'online'"
      );
      return result.rows[0].count;
    });

    this.metricsCollector.collect('messages_per_second', async () => {
      const oneSecondAgo = new Date(Date.now() - 1000);
      const result = await client.execute(
        'SELECT COUNT(*) as count FROM messages WHERE created_at > ?',
        [oneSecondAgo]
      );
      return result.rows[0].count;
    });

    this.metricsCollector.collect('room_activity', async () => {
      const result = await client.execute(`
        SELECT room_id, COUNT(*) as message_count 
        FROM messages 
        WHERE created_at > ? 
        GROUP BY room_id
      `, [new Date(Date.now() - 60000)]); // Last minute
      
      return result.rows.reduce((acc, row) => {
        acc[row.room_id] = row.message_count;
        return acc;
      }, {});
    });
  }

  private setupRealTimeStreaming(): void {
    // Stream metrics to connected dashboards
    setInterval(async () => {
      const metrics = {
        active_users: await this.metricsCollector.getLatest('active_users'),
        messages_per_second: await this.metricsCollector.getLatest('messages_per_second'),
        room_activity: await this.metricsCollector.getLatest('room_activity'),
        timestamp: new Date()
      };

      this.wsManager.broadcast({
        type: 'metrics_update',
        data: metrics
      });
    }, 1000);

    // Stream real-time events
    this.streamProcessor.createIngestionStream('dashboard_events', {
      schema: {
        event_type: 'text',
        data: 'text',
        timestamp: 'timestamp'
      }
    });

    // Process events in real-time
    this.streamProcessor.on('data', (events) => {
      const processedEvents = events.map(event => ({
        type: event.event_type,
        data: JSON.parse(event.data),
        timestamp: event.timestamp
      }));

      this.wsManager.broadcast({
        type: 'live_events',
        data: processedEvents
      });
    });
  }

  async startDashboard(): Promise<void> {
    await this.wsManager.start();
    console.log('Live dashboard started on port 3002');
  }
}
```

## Collaborative Document Editing

```typescript
// src/CollaborativeEditor.ts
import { WebSocketManager, OperationalTransform } from 'cassandraorm-js';

export class CollaborativeEditor {
  private wsManager: WebSocketManager;
  private ot: OperationalTransform;
  private documents: Map<string, DocumentState> = new Map();

  constructor(client: any) {
    this.wsManager = new WebSocketManager(client, { port: 3003 });
    this.ot = new OperationalTransform();
    
    this.setupModels();
    this.setupCollaboration();
  }

  private async setupModels(): Promise<void> {
    // Documents
    this.Document = await client.loadSchema('documents', {
      fields: {
        id: 'uuid',
        title: 'text',
        content: 'text',
        version: 'int',
        collaborators: 'set<uuid>',
        created_by: 'uuid',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id']
    });

    // Document operations (for operational transform)
    this.DocumentOperation = await client.loadSchema('document_operations', {
      fields: {
        document_id: 'uuid',
        operation_id: 'timeuuid',
        user_id: 'uuid',
        operation_type: 'text', // 'insert', 'delete', 'retain'
        position: 'int',
        content: 'text',
        version: 'int',
        created_at: 'timestamp'
      },
      key: [['document_id'], 'operation_id'],
      clustering_order: { operation_id: 'asc' }
    });

    // User cursors
    this.UserCursor = await client.loadSchema('user_cursors', {
      fields: {
        document_id: 'uuid',
        user_id: 'uuid',
        position: 'int',
        selection_start: 'int',
        selection_end: 'int',
        updated_at: 'timestamp'
      },
      key: [['document_id'], 'user_id'],
      ttl: 300 // 5 minutes
    });
  }

  private setupCollaboration(): void {
    this.wsManager.on('connection', async (ws, request) => {
      const userId = await this.authenticateUser(request.headers.authorization);
      ws.userId = userId;
    });

    this.wsManager.on('message', async (ws, message) => {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join_document':
          await this.handleJoinDocument(ws, data.payload);
          break;
        case 'leave_document':
          await this.handleLeaveDocument(ws, data.payload);
          break;
        case 'operation':
          await this.handleOperation(ws, data.payload);
          break;
        case 'cursor_update':
          await this.handleCursorUpdate(ws, data.payload);
          break;
      }
    });
  }

  private async handleJoinDocument(ws: any, payload: any): Promise<void> {
    const { documentId } = payload;
    
    // Check if user has access to document
    const hasAccess = await this.checkDocumentAccess(ws.userId, documentId);
    if (!hasAccess) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Access denied'
      }));
      return;
    }

    // Join document room
    await this.wsManager.joinRoom(ws, `document:${documentId}`);
    ws.currentDocument = documentId;

    // Get current document state
    const document = await this.Document.findOne({ id: documentId });
    const collaborators = await this.getActiveCollaborators(documentId);

    // Send current state to user
    ws.send(JSON.stringify({
      type: 'document_state',
      data: {
        document,
        collaborators,
        version: document.version
      }
    }));

    // Notify other collaborators
    this.wsManager.broadcastToRoom(`document:${documentId}`, {
      type: 'user_joined',
      data: {
        user_id: ws.userId,
        user_name: await this.getUserName(ws.userId)
      }
    }, [ws]);
  }

  private async handleOperation(ws: any, payload: any): Promise<void> {
    const { documentId, operation, version } = payload;
    
    if (ws.currentDocument !== documentId) {
      return;
    }

    try {
      // Get current document state
      const docState = this.documents.get(documentId) || await this.loadDocumentState(documentId);
      
      // Transform operation against concurrent operations
      const transformedOp = await this.ot.transform(operation, docState.operations, version);
      
      // Apply operation to document
      const newContent = this.ot.apply(docState.content, transformedOp);
      const newVersion = docState.version + 1;

      // Save operation
      await this.DocumentOperation.create({
        document_id: documentId,
        operation_id: TimeUuid.now(),
        user_id: ws.userId,
        operation_type: transformedOp.type,
        position: transformedOp.position,
        content: transformedOp.content || '',
        version: newVersion,
        created_at: new Date()
      });

      // Update document
      await this.Document.update(
        { id: documentId },
        { content: newContent, version: newVersion, updated_at: new Date() }
      );

      // Update local state
      docState.content = newContent;
      docState.version = newVersion;
      docState.operations.push(transformedOp);
      this.documents.set(documentId, docState);

      // Broadcast operation to other collaborators
      this.wsManager.broadcastToRoom(`document:${documentId}`, {
        type: 'operation',
        data: {
          operation: transformedOp,
          version: newVersion,
          user_id: ws.userId
        }
      }, [ws]);

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'operation_error',
        message: error.message
      }));
    }
  }

  private async handleCursorUpdate(ws: any, payload: any): Promise<void> {
    const { documentId, position, selectionStart, selectionEnd } = payload;
    
    // Update cursor position
    await this.UserCursor.create({
      document_id: documentId,
      user_id: ws.userId,
      position,
      selection_start: selectionStart,
      selection_end: selectionEnd,
      updated_at: new Date()
    });

    // Broadcast cursor update
    this.wsManager.broadcastToRoom(`document:${documentId}`, {
      type: 'cursor_update',
      data: {
        user_id: ws.userId,
        position,
        selection_start: selectionStart,
        selection_end: selectionEnd
      }
    }, [ws]);
  }
}
```

## Real-time Analytics Stream

```typescript
// src/AnalyticsStream.ts
import { StreamProcessor, WindowedProcessor, AnomalyDetector } from 'cassandraorm-js';

export class RealTimeAnalytics {
  private streamProcessor: StreamProcessor;
  private windowProcessor: WindowedProcessor;
  private anomalyDetector: AnomalyDetector;

  constructor(client: any) {
    this.streamProcessor = new StreamProcessor(client);
    this.windowProcessor = new WindowedProcessor({
      windowSize: '5m',
      slideInterval: '1m'
    });
    this.anomalyDetector = new AnomalyDetector(client);
    
    this.setupAnalyticsStreams();
  }

  private setupAnalyticsStreams(): void {
    // Real-time user activity stream
    this.streamProcessor.createIngestionStream('user_activity', {
      schema: {
        user_id: 'uuid',
        action: 'text',
        timestamp: 'timestamp',
        metadata: 'map<text, text>'
      }
    });

    // Process user activity in real-time
    this.streamProcessor.on('user_activity', async (events) => {
      // Sliding window aggregation
      const windowedData = await this.windowProcessor.process(events, {
        groupBy: ['action'],
        aggregations: {
          count: { $sum: 1 },
          unique_users: { $addToSet: 'user_id' }
        }
      });

      // Detect anomalies
      for (const window of windowedData) {
        const anomalies = await this.anomalyDetector.detect('user_activity', {
          metric: 'count',
          value: window.count,
          context: { action: window.action }
        });

        if (anomalies.length > 0) {
          await this.handleAnomalies(anomalies);
        }
      }

      // Broadcast real-time analytics
      this.broadcastAnalytics({
        type: 'user_activity_window',
        data: windowedData,
        timestamp: new Date()
      });
    });

    // Real-time performance metrics
    this.streamProcessor.createIngestionStream('performance_metrics', {
      schema: {
        metric_name: 'text',
        value: 'double',
        timestamp: 'timestamp',
        tags: 'map<text, text>'
      }
    });

    this.streamProcessor.on('performance_metrics', async (events) => {
      const processedMetrics = await this.processPerformanceMetrics(events);
      
      this.broadcastAnalytics({
        type: 'performance_update',
        data: processedMetrics,
        timestamp: new Date()
      });
    });
  }

  private async processPerformanceMetrics(events: any[]): Promise<any> {
    const metrics = {};
    
    for (const event of events) {
      const key = `${event.metric_name}:${JSON.stringify(event.tags)}`;
      
      if (!metrics[key]) {
        metrics[key] = {
          metric_name: event.metric_name,
          tags: event.tags,
          values: [],
          avg: 0,
          min: Infinity,
          max: -Infinity
        };
      }

      metrics[key].values.push(event.value);
      metrics[key].min = Math.min(metrics[key].min, event.value);
      metrics[key].max = Math.max(metrics[key].max, event.value);
    }

    // Calculate averages
    Object.values(metrics).forEach((metric: any) => {
      metric.avg = metric.values.reduce((a, b) => a + b, 0) / metric.values.length;
    });

    return Object.values(metrics);
  }

  private broadcastAnalytics(data: any): void {
    // Broadcast to connected analytics dashboards
    this.wsManager.broadcastToRoom('analytics', data);
  }

  private async handleAnomalies(anomalies: any[]): Promise<void> {
    for (const anomaly of anomalies) {
      console.log('Anomaly detected:', anomaly);
      
      // Send alert
      this.wsManager.broadcastToRoom('alerts', {
        type: 'anomaly_alert',
        data: anomaly,
        timestamp: new Date()
      });

      // Store anomaly for later analysis
      await this.storeAnomaly(anomaly);
    }
  }
}
```

## Usage Example

```typescript
// src/app.ts
import { ChatApplication } from './ChatApplication';
import { LiveDashboard } from './LiveDashboard';
import { CollaborativeEditor } from './CollaborativeEditor';
import { RealTimeAnalytics } from './AnalyticsStream';

async function startRealTimeApp() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['localhost:9042'],
      localDataCenter: 'datacenter1',
      keyspace: 'realtime_app'
    },
    ormOptions: {
      createKeyspace: true
    }
  });

  await client.connect();

  // Start all real-time services
  const chatApp = new ChatApplication(client);
  const dashboard = new LiveDashboard(client);
  const editor = new CollaborativeEditor(client);
  const analytics = new RealTimeAnalytics(client);

  await Promise.all([
    chatApp.start(),
    dashboard.startDashboard(),
    editor.start(),
    analytics.start()
  ]);

  console.log('Real-time application started');
  console.log('Chat: ws://localhost:3001');
  console.log('Dashboard: ws://localhost:3002');
  console.log('Editor: ws://localhost:3003');
}

startRealTimeApp().catch(console.error);
```
