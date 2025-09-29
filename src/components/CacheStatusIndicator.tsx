import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Database, RefreshCw, Clock } from 'lucide-react';
import { showCacheDebug } from '../config/debug';

interface CacheStatusIndicatorProps {
  dataUpdatedAt?: number;
  isFetching?: boolean;
  isStale?: boolean;
  source?: 'api' | 'blockchain' | 'cache';
  cacheHit?: boolean;
}

/**
 * Component to show cache status for debugging
 * Only shown in development mode or when DEBUG=true
 */
export function CacheStatusIndicator({
  dataUpdatedAt,
  isFetching,
  isStale,
  source,
  cacheHit,
}: CacheStatusIndicatorProps) {
  const queryClient = useQueryClient();

  // Use centralized debug config
  if (!showCacheDebug) {
    return null;
  }

  const getSourceIcon = () => {
    switch (source) {
      case 'api':
        return <Database className="h-3 w-3" />;
      case 'blockchain':
        return <Database className="h-3 w-3" />;
      case 'cache':
        return <RefreshCw className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  const getStatusColor = () => {
    if (isFetching) return 'text-yellow-600 bg-yellow-50';
    if (isStale) return 'text-orange-600 bg-orange-50';
    if (cacheHit) return 'text-green-600 bg-green-50';
    return 'text-blue-600 bg-blue-50';
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}s ago`;
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  // Get cache statistics
  const getCacheStats = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    const stats = {
      total: queries.length,
      stale: queries.filter(q => q.isStale()).length,
      fetching: queries.filter(q => q.state.fetchStatus === 'fetching').length,
      fresh: queries.filter(q => !q.isStale() && q.state.fetchStatus !== 'fetching').length,
    };

    return stats;
  };

  const stats = getCacheStats();

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`rounded-lg shadow-lg border p-3 ${getStatusColor()} border-current/20`}>
        <div className="flex items-center gap-2 mb-2">
          {getSourceIcon()}
          <span className="text-xs font-semibold uppercase tracking-wide">
            Cache Debug
          </span>
          {isFetching && (
            <RefreshCw className="h-3 w-3 animate-spin ml-auto" />
          )}
        </div>

        <div className="space-y-1 text-xs">
          {/* Data source */}
          <div className="flex justify-between">
            <span className="opacity-75">Source:</span>
            <span className="font-medium">
              {source || 'Unknown'} {cacheHit && '(cached)'}
            </span>
          </div>

          {/* Last updated */}
          <div className="flex justify-between">
            <span className="opacity-75">Updated:</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(dataUpdatedAt)}
            </span>
          </div>

          {/* Cache status */}
          <div className="flex justify-between">
            <span className="opacity-75">Status:</span>
            <span className="font-medium">
              {isStale ? 'Stale' : 'Fresh'}
              {isFetching && ' (Fetching...)'}
            </span>
          </div>

          {/* Global cache stats */}
          <div className="pt-2 mt-2 border-t border-current/20">
            <div className="font-semibold mb-1">Global Cache:</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <span className="opacity-75">Total:</span>
              <span className="font-medium">{stats.total}</span>
              <span className="opacity-75">Fresh:</span>
              <span className="font-medium text-green-700">{stats.fresh}</span>
              <span className="opacity-75">Stale:</span>
              <span className="font-medium text-orange-700">{stats.stale}</span>
              <span className="opacity-75">Fetching:</span>
              <span className="font-medium text-yellow-700">{stats.fetching}</span>
            </div>
          </div>

          {/* Toggle debug mode */}
          <div className="pt-2 mt-2 border-t border-current/20">
            <button
              onClick={() => {
                const current = localStorage.getItem('DEBUG_CACHE') === 'true';
                localStorage.setItem('DEBUG_CACHE', (!current).toString());
                window.location.reload();
              }}
              className="text-xs underline hover:no-underline"
            >
              {localStorage.getItem('DEBUG_CACHE') === 'true' ? 'Hide' : 'Show'} Debug Info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CacheStatusIndicator;