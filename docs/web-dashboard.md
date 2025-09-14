# Web Dashboard

## Overview
Comprehensive web-based dashboard for monitoring, managing, and visualizing CassandraORM applications with real-time metrics and interactive tools.

## Dashboard Setup

```typescript
import { WebDashboard } from 'cassandraorm-js';

const dashboard = new WebDashboard(client, {
  port: 3001,
  authentication: {
    enabled: true,
    users: [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'viewer', password: 'viewer123', role: 'viewer' }
    ]
  },
  features: {
    monitoring: true,
    queryEditor: true,
    schemaDesigner: true,
    dataExplorer: true,
    aiInsights: true
  }
});

await dashboard.start();
console.log('Dashboard available at http://localhost:3001');
```

## Monitoring Dashboard

```typescript
// Real-time metrics display
const monitoringConfig = {
  metrics: [
    {
      name: 'Query Performance',
      type: 'line_chart',
      data: 'query_latency',
      refreshInterval: 5000,
      alerts: [
        { threshold: 100, severity: 'warning', message: 'High query latency' },
        { threshold: 500, severity: 'critical', message: 'Critical query latency' }
      ]
    },
    {
      name: 'Throughput',
      type: 'area_chart',
      data: 'requests_per_second',
      refreshInterval: 1000
    },
    {
      name: 'Connection Pool',
      type: 'gauge',
      data: 'active_connections',
      max: 100,
      zones: [
        { from: 0, to: 50, color: 'green' },
        { from: 50, to: 80, color: 'yellow' },
        { from: 80, to: 100, color: 'red' }
      ]
    },
    {
      name: 'Error Rate',
      type: 'sparkline',
      data: 'error_percentage',
      refreshInterval: 2000
    }
  ],
  layout: {
    columns: 2,
    responsive: true
  }
};

dashboard.addPage('monitoring', {
  title: 'System Monitoring',
  config: monitoringConfig
});
```

## Query Editor

```typescript
// Interactive CQL editor
const queryEditorConfig = {
  features: {
    syntaxHighlighting: true,
    autoCompletion: true,
    queryHistory: true,
    resultExport: true,
    queryPlanning: true
  },
  savedQueries: [
    {
      name: 'Active Users',
      query: 'SELECT * FROM users WHERE status = \'active\' LIMIT 100',
      description: 'Get all active users'
    },
    {
      name: 'Recent Posts',
      query: 'SELECT * FROM posts WHERE created_at > ? ORDER BY created_at DESC',
      parameters: ['2024-01-01'],
      description: 'Get recent posts'
    }
  ],
  resultVisualization: {
    table: true,
    json: true,
    chart: true,
    export: ['csv', 'json', 'excel']
  }
};

dashboard.addPage('query-editor', {
  title: 'Query Editor',
  config: queryEditorConfig
});
```

## Schema Designer

```typescript
// Visual schema design tool
const schemaDesignerConfig = {
  features: {
    dragAndDrop: true,
    relationshipMapping: true,
    typeValidation: true,
    migrationGeneration: true,
    reverseEngineering: true
  },
  templates: [
    {
      name: 'User Management',
      tables: [
        {
          name: 'users',
          fields: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'text', unique: true },
            { name: 'name', type: 'text' }
          ]
        },
        {
          name: 'user_profiles',
          fields: [
            { name: 'user_id', type: 'uuid', primaryKey: true },
            { name: 'bio', type: 'text' },
            { name: 'avatar_url', type: 'text' }
          ],
          relations: [
            { type: 'belongsTo', table: 'users', foreignKey: 'user_id' }
          ]
        }
      ]
    }
  ]
};

dashboard.addPage('schema-designer', {
  title: 'Schema Designer',
  config: schemaDesignerConfig
});
```

## Data Explorer

```typescript
// Interactive data browser
const dataExplorerConfig = {
  features: {
    tableNavigation: true,
    dataFiltering: true,
    inlineEditing: true,
    bulkOperations: true,
    dataVisualization: true
  },
  tables: {
    users: {
      displayFields: ['id', 'email', 'name', 'created_at'],
      searchableFields: ['email', 'name'],
      editableFields: ['name', 'email'],
      actions: ['view', 'edit', 'delete'],
      pagination: { pageSize: 50, showSizeSelector: true }
    },
    posts: {
      displayFields: ['id', 'title', 'author', 'created_at'],
      searchableFields: ['title', 'content'],
      relations: {
        author: { table: 'users', displayField: 'name' }
      }
    }
  },
  visualizations: [
    {
      name: 'User Registration Trend',
      type: 'line_chart',
      table: 'users',
      xAxis: 'created_at',
      yAxis: 'count',
      groupBy: 'day'
    },
    {
      name: 'Posts by Category',
      type: 'pie_chart',
      table: 'posts',
      groupBy: 'category'
    }
  ]
};

dashboard.addPage('data-explorer', {
  title: 'Data Explorer',
  config: dataExplorerConfig
});
```

## AI Insights

```typescript
// AI-powered insights and recommendations
const aiInsightsConfig = {
  features: {
    queryOptimization: true,
    anomalyDetection: true,
    performanceInsights: true,
    dataQualityAnalysis: true,
    predictiveAnalytics: true
  },
  insights: [
    {
      type: 'query_optimization',
      title: 'Query Performance Recommendations',
      description: 'AI-generated suggestions to improve query performance',
      refreshInterval: 300000 // 5 minutes
    },
    {
      type: 'anomaly_detection',
      title: 'Data Anomalies',
      description: 'Unusual patterns detected in your data',
      refreshInterval: 60000 // 1 minute
    },
    {
      type: 'capacity_planning',
      title: 'Capacity Planning',
      description: 'Predicted resource usage and scaling recommendations',
      refreshInterval: 3600000 // 1 hour
    }
  ]
};

dashboard.addPage('ai-insights', {
  title: 'AI Insights',
  config: aiInsightsConfig
});
```

## Custom Widgets

```typescript
// Create custom dashboard widgets
class CustomMetricWidget {
  constructor(config) {
    this.config = config;
  }

  async render() {
    const data = await this.fetchData();
    
    return {
      type: 'custom',
      html: `
        <div class="custom-widget">
          <h3>${this.config.title}</h3>
          <div class="metric-value">${data.value}</div>
          <div class="metric-trend ${data.trend}">${data.change}%</div>
        </div>
      `,
      css: `
        .custom-widget {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
        }
        .metric-value {
          font-size: 2em;
          font-weight: bold;
        }
        .metric-trend.up { color: #4ade80; }
        .metric-trend.down { color: #f87171; }
      `,
      refreshInterval: this.config.refreshInterval
    };
  }

  async fetchData() {
    // Custom data fetching logic
    return {
      value: '1,234',
      change: '+12.5',
      trend: 'up'
    };
  }
}

// Register custom widget
dashboard.registerWidget('custom-metric', CustomMetricWidget);

// Use in dashboard
dashboard.addWidget('monitoring', {
  type: 'custom-metric',
  title: 'Custom Business Metric',
  refreshInterval: 30000,
  position: { row: 1, col: 1, width: 2, height: 1 }
});
```

## Dashboard API

```typescript
// REST API for dashboard integration
const dashboardAPI = {
  // Get dashboard configuration
  'GET /api/dashboard/config': async (req, res) => {
    const config = await dashboard.getConfig();
    res.json(config);
  },

  // Update widget configuration
  'PUT /api/dashboard/widgets/:id': async (req, res) => {
    const { id } = req.params;
    const config = req.body;
    
    await dashboard.updateWidget(id, config);
    res.json({ success: true });
  },

  // Get real-time metrics
  'GET /api/dashboard/metrics/:metric': async (req, res) => {
    const { metric } = req.params;
    const { timeRange = '1h' } = req.query;
    
    const data = await dashboard.getMetricData(metric, timeRange);
    res.json(data);
  },

  // Execute query
  'POST /api/dashboard/query': async (req, res) => {
    const { query, parameters } = req.body;
    
    try {
      const result = await client.execute(query, parameters);
      res.json({
        success: true,
        data: result.rows,
        metadata: {
          rowCount: result.rowLength,
          executionTime: result.info?.queriedHost
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
};
```

## Mobile Responsive Design

```css
/* Dashboard responsive styles */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .widget {
    min-height: 200px;
  }
  
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.open {
    transform: translateX(0);
  }
}

@media (max-width: 480px) {
  .dashboard-header {
    flex-direction: column;
    gap: 10px;
  }
  
  .metric-cards {
    flex-direction: column;
  }
  
  .chart-container {
    height: 250px;
  }
}
```

## Dashboard Themes

```typescript
// Theme configuration
const themes = {
  light: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    border: '#e2e8f0'
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#94a3b8',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    border: '#334155'
  },
  custom: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    background: '#faf5ff',
    surface: '#f3e8ff',
    text: '#581c87',
    border: '#c4b5fd'
  }
};

dashboard.setTheme('dark');

// User preference persistence
dashboard.enableThemeToggle({
  persistPreference: true,
  storageKey: 'dashboard-theme'
});
```

## Export and Sharing

```typescript
// Dashboard export functionality
const exportConfig = {
  formats: ['pdf', 'png', 'json'],
  scheduling: {
    enabled: true,
    intervals: ['daily', 'weekly', 'monthly'],
    recipients: ['admin@company.com']
  },
  sharing: {
    publicLinks: true,
    embedCode: true,
    apiAccess: true
  }
};

// Generate shareable link
const shareLink = await dashboard.generateShareLink('monitoring', {
  expiresIn: '7d',
  permissions: ['view'],
  password: 'optional-password'
});

// Export dashboard as PDF
const pdfBuffer = await dashboard.exportToPDF('monitoring', {
  format: 'A4',
  orientation: 'landscape',
  includeCharts: true
});
```
