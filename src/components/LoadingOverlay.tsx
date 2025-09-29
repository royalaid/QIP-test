import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

/**
 * Loading overlay that shows during mutations
 * Provides visual feedback during async operations
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Updating...',
  className
}) => {
  if (!isLoading) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-black/50 flex items-center justify-center z-50",
      className
    )}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-lg font-medium">{message}</span>
      </div>
    </div>
  );
};

/**
 * Inline loading indicator for smaller components
 */
export const InlineLoader: React.FC<{
  isLoading: boolean;
  message?: string;
  className?: string;
}> = ({ isLoading, message = 'Loading...', className }) => {
  if (!isLoading) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

export default LoadingOverlay;