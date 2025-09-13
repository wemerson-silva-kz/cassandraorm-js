import React, { useState } from 'react';
import { Brain, Search, TrendingUp, Zap } from 'lucide-react';

export default function AIMLDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vectorResults, setVectorResults] = useState([
    { id: 1, content: 'Machine learning algorithms', similarity: 0.95 },
    { id: 2, content: 'Neural network architectures', similarity: 0.87 },
    { id: 3, content: 'Deep learning frameworks', similarity: 0.82 }
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">AI/ML Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Brain className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Vector Embeddings</p>
              <p className="text-2xl font-bold text-gray-900">1,247</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Search className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Similarity Searches</p>
              <p className="text-2xl font-bold text-gray-900">342</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Query Optimizations</p>
              <p className="text-2xl font-bold text-gray-900">89</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Anomalies Detected</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Vector Similarity Search</h3>
        </div>
        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search query for semantic similarity..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Search
            </button>
          </div>

          <div className="space-y-3">
            {vectorResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <p className="text-gray-900">{result.content}</p>
                </div>
                <div className="ml-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {(result.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Query Optimization Suggestions</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">Optimization Applied</p>
                  <p className="text-sm text-green-700">Added index on 'email' field - 40% performance improvement</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800">Suggestion Available</p>
                  <p className="text-sm text-yellow-700">Consider partitioning 'events' table by date for better performance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
