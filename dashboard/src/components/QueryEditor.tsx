import React, { useState } from 'react';
import { Play, Save, History } from 'lucide-react';

export default function QueryEditor() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [results, setResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runQuery = async () => {
    setIsRunning(true);
    // Simulate query execution
    setTimeout(() => {
      setResults([
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ]);
      setIsRunning(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Query Editor</h2>
      
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">CQL Query</h3>
            <div className="flex space-x-2">
              <button
                onClick={runQuery}
                disabled={isRunning}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? 'Running...' : 'Run Query'}
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                <Save className="h-4 w-4 mr-2" />
                Save
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                <History className="h-4 w-4 mr-2" />
                History
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-40 p-4 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="Enter your CQL query here..."
          />
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-medium">Results ({results.length} rows)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(results[0] || {}).map((key) => (
                    <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value: any, cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
