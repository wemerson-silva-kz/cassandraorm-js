import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join } from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../client/dist')));

// Mock data for demonstration
let connectionStats = {
  connected: true,
  activeConnections: 5,
  totalQueries: 1247,
  avgResponseTime: 12.5,
  errorRate: 0.02
};

let queryMetrics = [
  { timestamp: Date.now() - 60000, queries: 45, avgTime: 11.2 },
  { timestamp: Date.now() - 30000, queries: 52, avgTime: 13.1 },
  { timestamp: Date.now(), queries: 48, avgTime: 12.5 }
];

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    connections: connectionStats
  });
});

app.get('/api/metrics', (req, res) => {
  res.json({
    connection: connectionStats,
    queries: queryMetrics,
    performance: {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  });
});

app.get('/api/schemas', (req, res) => {
  res.json([
    {
      name: 'users',
      fields: ['id', 'name', 'email', 'created_at'],
      indexes: ['email'],
      rowCount: 1250
    },
    {
      name: 'posts',
      fields: ['id', 'user_id', 'title', 'content', 'created_at'],
      indexes: ['user_id'],
      rowCount: 3420
    }
  ]);
});

app.post('/api/query', (req, res) => {
  const { query } = req.body;
  
  // Mock query execution
  setTimeout(() => {
    res.json({
      success: true,
      rows: [
        { id: '123e4567-e89b-12d3-a456-426614174000', name: 'John Doe', email: 'john@example.com' },
        { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Jane Smith', email: 'jane@example.com' }
      ],
      executionTime: Math.random() * 20 + 5,
      rowCount: 2
    });
  }, Math.random() * 100 + 50);
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Dashboard client connected:', socket.id);

  // Send initial data
  socket.emit('metrics', {
    connection: connectionStats,
    queries: queryMetrics
  });

  // Simulate real-time updates
  const interval = setInterval(() => {
    // Update mock data
    connectionStats.totalQueries += Math.floor(Math.random() * 5) + 1;
    connectionStats.avgResponseTime = Math.random() * 10 + 8;
    
    queryMetrics.push({
      timestamp: Date.now(),
      queries: Math.floor(Math.random() * 20) + 40,
      avgTime: Math.random() * 10 + 8
    });
    
    // Keep only last 20 data points
    if (queryMetrics.length > 20) {
      queryMetrics.shift();
    }

    socket.emit('metrics', {
      connection: connectionStats,
      queries: queryMetrics
    });
  }, 2000);

  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected:', socket.id);
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
🚀 CassandraORM Dashboard running on http://localhost:${PORT}

📊 Features:
  - Real-time performance monitoring
  - Query execution interface
  - Schema visualization
  - Connection management
  - Live metrics and charts

🎯 Access the dashboard in your browser!
  `);
});
