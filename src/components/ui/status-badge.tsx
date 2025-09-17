import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { QIPStatus, DEFAULT_STATUSES } from '@/services/qipClient';

export type StatusType = QIPStatus | 'Draft' | 'Ready for Snapshot' | 'Posted to Snapshot' | 'Review' | 'Vote' | 'Approved' | 'Rejected' | 'Implemented' | 'Superseded' | 'Withdrawn';

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType | string;
  statusName?: string; // Optional: if status name is already fetched
  size?: 'sm' | 'default' | 'lg';
}

const STATUS_CONFIG: Record<number | string, { label: string; className: string }> = {
  // New simplified status system (numbers)
  [DEFAULT_STATUSES.Draft]: {
    label: 'Draft',
    className: 'bg-muted text-foreground hover:bg-muted/80',
  },
  [DEFAULT_STATUSES.ReadyForSnapshot]: {
    label: 'Ready for Snapshot',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
  },
  [DEFAULT_STATUSES.PostedToSnapshot]: {
    label: 'Posted to Snapshot',
    className: 'bg-primary/10 text-primary hover:bg-primary/20',
  },
  // String values for backward compatibility and custom statuses
  'Draft': {
    label: 'Draft',
    className: 'bg-muted text-foreground hover:bg-muted/80',
  },
  'Ready for Snapshot': {
    label: 'Ready for Snapshot',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
  },
  'Posted to Snapshot': {
    label: 'Posted to Snapshot',
    className: 'bg-primary/10 text-primary hover:bg-primary/20',
  },
  // Legacy statuses (for migration/historical data)
  'Review': {
    label: 'Review',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
  },
  'Vote': {
    label: 'Vote',
    className: 'bg-primary/10 text-primary hover:bg-primary/20',
  },
  'Approved': {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40',
  },
  'Rejected': {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  },
  'Implemented': {
    label: 'Implemented',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/40',
  },
  'Superseded': {
    label: 'Superseded',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40',
  },
  'Withdrawn': {
    label: 'Withdrawn',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  statusName,
  size = 'default',
  className,
  ...props
}) => {
  // If statusName is provided, use it; otherwise look up in config
  const label = statusName || STATUS_CONFIG[status]?.label || STATUS_CONFIG[String(status)]?.label || `Status ${status}`;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)] || {
    label: label,
    className: 'bg-muted text-foreground',
  };

  return (
    <Badge
      className={cn(
        'font-medium border-0',
        config.className,
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {statusName || config.label}
    </Badge>
  );
};

export const getStatusColor = (status: StatusType | string): string => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)];
  return config?.className || 'bg-muted text-foreground';
};

export const getStatusLabel = (status: StatusType | string, statusName?: string): string => {
  if (statusName) return statusName;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)];
  return config?.label || String(status);
};