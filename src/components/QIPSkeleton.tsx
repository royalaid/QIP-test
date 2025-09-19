import React from 'react';
import { cn } from '@/lib/utils';

interface QIPSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'card' | 'list' | 'detail';
}

/**
 * Skeleton loader for QIP cards
 * Shows a pulsing placeholder while data is loading
 */
export const QIPSkeleton: React.FC<QIPSkeletonProps> = ({
  className,
  count = 1,
  variant = 'card'
}) => {
  if (variant === 'detail') {
    return (
      <div className={cn("animate-pulse", className)}>
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-800/20 dark:bg-gray-700/30 rounded w-3/4 mb-4"></div>
          <div className="flex gap-4">
            <div className="h-6 bg-gray-800/20 dark:bg-gray-700/30 rounded w-24"></div>
            <div className="h-6 bg-gray-800/20 dark:bg-gray-700/30 rounded w-32"></div>
            <div className="h-6 bg-gray-800/20 dark:bg-gray-700/30 rounded w-28"></div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-800/20 dark:bg-gray-700/30 rounded"></div>
          <div className="h-4 bg-gray-800/20 dark:bg-gray-700/30 rounded"></div>
          <div className="h-4 bg-gray-800/20 dark:bg-gray-700/30 rounded w-5/6"></div>
          <div className="h-4 bg-gray-800/20 dark:bg-gray-700/30 rounded"></div>
          <div className="h-4 bg-gray-800/20 dark:bg-gray-700/30 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-900/40 dark:bg-gray-800/60 border border-gray-800/50 dark:border-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-5 bg-gray-700/30 dark:bg-gray-600/30 rounded w-20"></div>
                  <div className="h-6 bg-gray-700/30 dark:bg-gray-600/30 rounded flex-1 max-w-xl"></div>
                </div>
                <div className="h-12 bg-gray-700/20 dark:bg-gray-600/20 rounded mt-3"></div>
              </div>
              <div className="h-7 bg-gray-700/30 dark:bg-gray-600/30 rounded-full w-28 ml-4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default card variant
  return (
    <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full px-3 w-20"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full px-3 w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton loader for status groups
 */
export const StatusGroupSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("mb-8", className)}>
      <div className="animate-pulse">
        {/* Status header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 bg-gray-700/30 dark:bg-gray-600/30 rounded w-32"></div>
          <div className="h-6 bg-gray-700/20 dark:bg-gray-600/20 rounded-full px-2 w-12"></div>
        </div>
        {/* QIP items */}
        <QIPSkeleton variant="list" count={2} />
      </div>
    </div>
  );
};

export default QIPSkeleton;