import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Activity, Zap, Brain, GitBranch, BarChart3 } from 'lucide-react';

// Components
import ConnectionStatus from './components/ConnectionStatus';
import QueryEditor from './components/QueryEditor';
import SchemaDesigner from './components/SchemaDesigner';
import PerformanceMonitor from './components/PerformanceMonitor';
import AIMLDashboard from './components/AIMLDashboard';
import EventSourcingView from './components/EventSourcingView';

function App() {
  const [metrics, setMetrics] = useState({
    connections: 0,
    queries: 0,
    latency: 0,
    throughput: 0
  });

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate real-time metrics
    const interval = setInterval(() => {
      setMetrics(prev => ({
        connections: Math.floor(Math.random() * 100) + 50,
        queries: Math.floor(Math.random() * 1000) + 500,
        latency: Math.floor(Math.random() * 50) + 10,
        throughput: Math.floor(Math.random() * 5000) + 2000
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">
                  CassandraORM Dashboard
                </h1>
              </div>
              <ConnectionStatus isConnected={isConnected} />
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <nav className="w-64 bg-white shadow-sm min-h-screen">
            <div className="p-4">
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <BarChart3 className="h-5 w-5 mr-3" />
                    Overview
                  </Link>
                </li>
                <li>
                  <Link to="/query" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <Activity className="h-5 w-5 mr-3" />
                    Query Editor
                  </Link>
                </li>
                <li>
                  <Link to="/schema" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <Database className="h-5 w-5 mr-3" />
                    Schema Designer
                  </Link>
                </li>
                <li>
                  <Link to="/performance" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <Zap className="h-5 w-5 mr-3" />
                    Performance
                  </Link>
                </li>
                <li>
                  <Link to="/aiml" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <Brain className="h-5 w-5 mr-3" />
                    AI/ML
                  </Link>
                </li>
                <li>
                  <Link to="/events" className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded">
                    <GitBranch className="h-5 w-5 mr-3" />
                    Event Sourcing
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Overview metrics={metrics} />} />
              <Route path="/query" element={<QueryEditor />} />
              <Route path="/schema" element={<SchemaDesigner />} />
              <Route path="/performance" element={<PerformanceMonitor />} />
              <Route path="/aiml" element={<AIMLDashboard />} />
              <Route path="/events" element={<EventSourcingView />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

// Overview Component
function Overview({ metrics }: { metrics: any }) {
  const chartData = [
    { time: '00:00', queries: 400, latency: 24 },
    { time: '04:00', queries: 300, latency: 18 },
    { time: '08:00', queries: 800, latency: 35 },
    { time: '12:00', queries: 1200, latency: 42 },
    { time: '16:00', queries: 900, latency: 28 },
    { time: '20:00', queries: 600, latency: 22 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Active Connections" value={metrics.connections} icon={Database} />
        <MetricCard title="Queries/sec" value={metrics.queries} icon={Activity} />
        <MetricCard title="Avg Latency" value={`${metrics.latency}ms`} icon={Zap} />
        <MetricCard title="Throughput" value={`${metrics.throughput}/s`} icon={BarChart3} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Query Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="queries" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Latency Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="latency" stroke="#EF4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon: Icon }: { title: string; value: any; icon: any }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center">
        <Icon className="h-8 w-8 text-blue-600" />
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
