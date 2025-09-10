import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { QIPStatus } from '@/services/qipClient';

export type StatusType = QIPStatus | 'Draft' | 'Review' | 'Vote' | 'Approved' | 'Rejected' | 'Implemented' | 'Superseded' | 'Withdrawn';

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType | string;
  size?: 'sm' | 'default' | 'lg';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // QIPStatus enum values
  [QIPStatus.Draft]: {
    label: 'Draft',
    className: 'bg-muted text-foreground hover:bg-muted/80',
  },
  [QIPStatus.ReviewPending]: {
    label: 'Review Pending',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
  },
  [QIPStatus.VotePending]: {
    label: 'Vote Pending',
    className: 'bg-primary/10 text-primary hover:bg-primary/20',
  },
  [QIPStatus.Approved]: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40',
  },
  [QIPStatus.Rejected]: {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  },
  [QIPStatus.Implemented]: {
    label: 'Implemented',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/40',
  },
  [QIPStatus.Superseded]: {
    label: 'Superseded',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40',
  },
  [QIPStatus.Withdrawn]: {
    label: 'Withdrawn',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
  // String values for backward compatibility
  'Draft': {
    label: 'Draft',
    className: 'bg-muted text-foreground hover:bg-muted/80',
  },
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
  size = 'default',
  className,
  ...props
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)] || {
    label: String(status),
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
      {config.label}
    </Badge>
  );
};

export const getStatusColor = (status: StatusType | string): string => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)];
  return config?.className || 'bg-muted text-foreground';
};

export const getStatusLabel = (status: StatusType | string): string => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[String(status)];
  return config?.label || String(status);
};