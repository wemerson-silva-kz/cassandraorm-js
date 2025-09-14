# WebSocket Integration

## Overview
Real-time WebSocket communication with automatic reconnection, message queuing, and scalable connection management.

## WebSocket Server Setup

```typescript
import { WebSocketManager } from 'cassandraorm-js';

const wsManager = new WebSocketManager(client, {
  port: 3001,
  maxConnections: 10000,
  heartbeatInterval: 30000,
  compression: true,
  authentication: true
});

await wsManager.start();
```

## Connection Management

```typescript
// Handle new connections
wsManager.on('connection', async (ws, request) => {
  const userId = await authenticateUser(request.headers.authorization);
  ws.userId = userId;
  
  console.log(`User ${userId} connected`);
  
  // Join user to their personal room
  await wsManager.joinRoom(ws, `user:${userId}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected successfully'
  }));
});

// Handle disconnections
wsManager.on('disconnect', (ws) => {
  console.log(`User ${ws.userId} disconnected`);
  // Cleanup user-specific subscriptions
});
```

## Real-time Data Broadcasting

```typescript
// Broadcast to all connections
wsManager.broadcast({
  type: 'system_announcement',
  message: 'System maintenance in 10 minutes'
});

// Broadcast to specific room
wsManager.broadcastToRoom('user:123', {
  type: 'notification',
  data: { message: 'New message received' }
});

// Broadcast to multiple rooms
wsManager.broadcastToRooms(['admin', 'moderator'], {
  type: 'alert',
  data: { level: 'warning', message: 'High CPU usage detected' }
});
```

## Database Change Notifications

```typescript
import { ChangeStreamManager } from 'cassandraorm-js';

const changeStream = new ChangeStreamManager(client, wsManager);

// Watch table changes and notify WebSocket clients
await changeStream.watch('posts', {
  operations: ['insert', 'update', 'delete'],
  callback: async (change) => {
    // Notify all users in the same category
    const categoryRoom = `category:${change.data.category}`;
    wsManager.broadcastToRoom(categoryRoom, {
      type: 'post_update',
      operation: change.operation,
      data: change.data
    });
  }
});

// User-specific notifications
await changeStream.watch('user_notifications', {
  operations: ['insert'],
  callback: async (change) => {
    const userRoom = `user:${change.data.user_id}`;
    wsManager.broadcastToRoom(userRoom, {
      type: 'notification',
      data: change.data
    });
  }
});
```

## Message Handling

```typescript
// Handle incoming messages
wsManager.on('message', async (ws, message) => {
  const data = JSON.parse(message);
  
  switch (data.type) {
    case 'subscribe':
      await handleSubscription(ws, data.payload);
      break;
      
    case 'chat_message':
      await handleChatMessage(ws, data.payload);
      break;
      
    case 'query':
      await handleDatabaseQuery(ws, data.payload);
      break;
  }
});

async function handleSubscription(ws, payload) {
  const { table, filters } = payload;
  
  // Validate user permissions
  if (!await hasPermission(ws.userId, table, 'read')) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Insufficient permissions'
    }));
    return;
  }
  
  // Create subscription
  const subscription = await subscriptions.subscribe({
    table,
    filters,
    callback: (event) => {
      ws.send(JSON.stringify({
        type: 'data_update',
        table,
        event
      }));
    }
  });
  
  ws.subscriptions = ws.subscriptions || [];
  ws.subscriptions.push(subscription.id);
}
```

## Room Management

```typescript
// Create and manage rooms
await wsManager.createRoom('chat:general', {
  maxUsers: 100,
  persistent: true,
  moderators: ['admin', 'moderator']
});

// Join/leave rooms
wsManager.on('message', async (ws, message) => {
  const data = JSON.parse(message);
  
  if (data.type === 'join_room') {
    await wsManager.joinRoom(ws, data.room);
    ws.send(JSON.stringify({
      type: 'room_joined',
      room: data.room
    }));
  }
  
  if (data.type === 'leave_room') {
    await wsManager.leaveRoom(ws, data.room);
  }
});

// Room-based messaging
async function handleChatMessage(ws, payload) {
  const { room, message } = payload;
  
  // Store message in database
  await ChatMessage.create({
    id: uuid(),
    room,
    user_id: ws.userId,
    message,
    timestamp: new Date()
  });
  
  // Broadcast to room
  wsManager.broadcastToRoom(room, {
    type: 'chat_message',
    data: {
      user_id: ws.userId,
      message,
      timestamp: new Date()
    }
  });
}
```

## Authentication and Authorization

```typescript
// JWT-based authentication
async function authenticateUser(authHeader) {
  if (!authHeader) throw new Error('No authorization header');
  
  const token = authHeader.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  return decoded.userId;
}

// Permission-based access control
async function hasPermission(userId, resource, action) {
  const user = await User.findOne({ id: userId });
  const permissions = await UserPermission.find({ user_id: userId });
  
  return permissions.some(p => 
    p.resource === resource && p.actions.includes(action)
  );
}

// Rate limiting per user
const rateLimiter = new Map();

wsManager.on('message', (ws, message) => {
  const userId = ws.userId;
  const now = Date.now();
  
  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, { count: 0, resetTime: now + 60000 });
  }
  
  const userLimit = rateLimiter.get(userId);
  
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + 60000;
  }
  
  if (userLimit.count >= 100) { // 100 messages per minute
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Rate limit exceeded'
    }));
    return;
  }
  
  userLimit.count++;
});
```

## Scalability and Load Balancing

```typescript
// Redis-based scaling
const scalableWsManager = new WebSocketManager(client, {
  scaling: {
    type: 'redis',
    redis: {
      host: 'redis-cluster',
      port: 6379
    }
  }
});

// Sticky sessions with load balancer
const stickySessionManager = new StickySessionManager({
  sessionStore: 'redis',
  hashFunction: (userId) => userId % 3 // 3 server instances
});

// Cross-server message broadcasting
wsManager.on('cross_server_message', (message) => {
  wsManager.broadcastToRoom(message.room, message.data);
});
```

## Error Handling and Reconnection

```typescript
// Client-side reconnection logic
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
    this.connect();
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, this.reconnectInterval * Math.pow(2, this.reconnectAttempts));
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
}

// Server-side error handling
wsManager.on('error', (error, ws) => {
  console.error('WebSocket error:', error);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Internal server error'
    }));
  }
});
```

## Performance Monitoring

```typescript
import { WebSocketMetrics } from 'cassandraorm-js';

const wsMetrics = new WebSocketMetrics(wsManager);

// Real-time metrics
setInterval(() => {
  const stats = wsMetrics.getStats();
  
  console.log('WebSocket Stats:');
  console.log(`Active connections: ${stats.activeConnections}`);
  console.log(`Messages/sec: ${stats.messagesPerSecond}`);
  console.log(`Rooms: ${stats.totalRooms}`);
  console.log(`Memory usage: ${stats.memoryUsage}MB`);
}, 10000);

// Export metrics
wsMetrics.exportToPrometheus({
  endpoint: '/ws-metrics',
  port: 9092
});
```
