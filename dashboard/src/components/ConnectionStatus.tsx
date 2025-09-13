import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  latency?: number;
}

export default function ConnectionStatus({ isConnected, latency = 0 }: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (!isConnected) return 'text-red-600';
    if (latency > 100) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (!isConnected) return <XCircle className="h-5 w-5" />;
    if (latency > 100) return <AlertCircle className="h-5 w-5" />;
    return <CheckCircle className="h-5 w-5" />;
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (latency > 100) return `Connected (${latency}ms)`;
    return `Connected (${latency}ms)`;
  };

  return (
    <div className={`flex items-center ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="ml-2 text-sm font-medium">
        {getStatusText()}
      </span>
    </div>
  );
}
