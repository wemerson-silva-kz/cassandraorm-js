import React, { useState } from 'react';
import { Plus, Trash2, Database, Key } from 'lucide-react';

export default function SchemaDesigner() {
  const [tables, setTables] = useState([
    {
      name: 'users',
      fields: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'name', type: 'text', isPrimary: false },
        { name: 'email', type: 'text', isPrimary: false }
      ]
    }
  ]);

  const addTable = () => {
    setTables([...tables, {
      name: 'new_table',
      fields: [{ name: 'id', type: 'uuid', isPrimary: true }]
    }]);
  };

  const addField = (tableIndex: number) => {
    const newTables = [...tables];
    newTables[tableIndex].fields.push({
      name: 'new_field',
      type: 'text',
      isPrimary: false
    });
    setTables(newTables);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Schema Designer</h2>
        <button
          onClick={addTable}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Table
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tables.map((table, tableIndex) => (
          <div key={tableIndex} className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="h-5 w-5 text-blue-600 mr-2" />
                  <input
                    type="text"
                    value={table.name}
                    onChange={(e) => {
                      const newTables = [...tables];
                      newTables[tableIndex].name = e.target.value;
                      setTables(newTables);
                    }}
                    className="text-lg font-medium border-none focus:outline-none"
                  />
                </div>
                <button className="text-red-600 hover:text-red-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {table.fields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                    {field.isPrimary && <Key className="h-4 w-4 text-yellow-600" />}
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => {
                        const newTables = [...tables];
                        newTables[tableIndex].fields[fieldIndex].name = e.target.value;
                        setTables(newTables);
                      }}
                      className="flex-1 border-none focus:outline-none"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const newTables = [...tables];
                        newTables[tableIndex].fields[fieldIndex].type = e.target.value;
                        setTables(newTables);
                      }}
                      className="border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="text">text</option>
                      <option value="uuid">uuid</option>
                      <option value="int">int</option>
                      <option value="timestamp">timestamp</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <button className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addField(tableIndex)}
                className="mt-4 flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
