import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function PerformanceMonitor() {
  const queryData = [
    { query: 'SELECT users', count: 1200, avgTime: 45 },
    { query: 'INSERT users', count: 800, avgTime: 23 },
    { query: 'UPDATE users', count: 400, avgTime: 67 },
    { query: 'DELETE users', count: 100, avgTime: 34 }
  ];

  const nodeData = [
    { name: 'Node 1', value: 35, status: 'healthy' },
    { name: 'Node 2', value: 30, status: 'healthy' },
    { name: 'Node 3', value: 25, status: 'warning' },
    { name: 'Node 4', value: 10, status: 'error' }
  ];

  const COLORS = ['#10B981', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Performance Monitor</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Query Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={queryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="query" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgTime" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Node Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={nodeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {nodeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Slow Queries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">SELECT * FROM users WHERE email = ?</td>
                <td className="px-6 py-4 text-sm text-red-600">2.3s</td>
                <td className="px-6 py-4 text-sm text-gray-500">2024-01-15 14:30:25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
