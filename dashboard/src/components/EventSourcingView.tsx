import React, { useState } from 'react';
import { GitBranch, Clock, User, Database } from 'lucide-react';

export default function EventSourcingView() {
  const [events] = useState([
    {
      id: '1',
      aggregateId: 'user-123',
      eventType: 'UserCreated',
      data: { name: 'John Doe', email: 'john@example.com' },
      timestamp: '2024-01-15T10:30:00Z',
      version: 1
    },
    {
      id: '2',
      aggregateId: 'user-123',
      eventType: 'UserEmailChanged',
      data: { oldEmail: 'john@example.com', newEmail: 'john.doe@example.com' },
      timestamp: '2024-01-15T11:15:00Z',
      version: 2
    },
    {
      id: '3',
      aggregateId: 'user-456',
      eventType: 'UserCreated',
      data: { name: 'Jane Smith', email: 'jane@example.com' },
      timestamp: '2024-01-15T12:00:00Z',
      version: 1
    }
  ]);

  const [aggregates] = useState([
    { id: 'user-123', type: 'User', version: 2, lastEvent: '2024-01-15T11:15:00Z' },
    { id: 'user-456', type: 'User', version: 1, lastEvent: '2024-01-15T12:00:00Z' },
    { id: 'order-789', type: 'Order', version: 3, lastEvent: '2024-01-15T13:30:00Z' }
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Event Sourcing</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <GitBranch className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{events.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aggregates</p>
              <p className="text-2xl font-bold text-gray-900">{aggregates.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Events/Hour</p>
              <p className="text-2xl font-bold text-gray-900">127</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Recent Events</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {event.eventType}
                    </span>
                    <span className="text-xs text-gray-500">v{event.version}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Aggregate: {event.aggregateId}</p>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Aggregate Roots</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {aggregates.map((aggregate) => (
                <div key={aggregate.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{aggregate.id}</p>
                      <p className="text-xs text-gray-500">{aggregate.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">v{aggregate.version}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(aggregate.lastEvent).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
