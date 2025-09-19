import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { QIPClient, QIPStatus } from '../services/qipClient';
import { useStatusUpdateMutation } from '../hooks/useStatusUpdateMutation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InlineStatusEditorProps {
  qipNumber: number;
  currentStatus: string;
  currentStatusEnum?: QIPStatus;
  isAuthor: boolean;
  isEditor: boolean;
  onStatusUpdate?: () => void;
  registryAddress: `0x${string}`;
  rpcUrl?: string;
}

const statusStyles = {
  'Draft': 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  'Ready for Snapshot': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  'Posted to Snapshot': 'bg-green-100 text-green-800 hover:bg-green-200'
};

const InlineStatusEditor: React.FC<InlineStatusEditorProps> = ({
  qipNumber,
  currentStatus,
  currentStatusEnum,
  isAuthor,
  isEditor,
  onStatusUpdate,
  registryAddress,
  rpcUrl
}) => {
  const statusUpdateMutation = useStatusUpdateMutation();
  const [availableStatuses, setAvailableStatuses] = useState<{ name: string; hash: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch available statuses on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const qipClient = new QIPClient(registryAddress, rpcUrl, false);
        const result = await qipClient.fetchAllStatuses();
        // Convert the result to the expected format
        const statusArray = result.names.map((name, index) => ({
          name: name,
          hash: result.hashes[index]
        }));
        setAvailableStatuses(statusArray);
      } catch (error) {
        console.error('Failed to fetch statuses:', error);
        // Fallback to default statuses
        setAvailableStatuses([
          { name: 'Draft', hash: '0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382' },
          { name: 'Ready for Snapshot', hash: '0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb' },
          { name: 'Posted to Snapshot', hash: '0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c' }
        ]);
      }
    };
    fetchStatuses();
  }, [registryAddress, rpcUrl]);

  const canEdit = isAuthor || isEditor;

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    // Close dropdown immediately for better UX
    setIsOpen(false);

    // Execute the mutation
    try {
      await statusUpdateMutation.mutateAsync({
        qipNumber: BigInt(qipNumber),
        newStatus,
        registryAddress,
        rpcUrl
      });

      // Trigger refresh callback if provided
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      // Error handling is done by the mutation hook
      console.error('[InlineStatusEditor] Status update failed:', error);
    }
  };

  if (!canEdit) {
    // Just display the status badge if user can't edit
    return (
      <span className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusStyles[currentStatus as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'
      )}>
        {currentStatus}
      </span>
    );
  }

  const otherStatuses = availableStatuses.filter(s => s.name !== currentStatus);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto py-0.5 px-2.5 font-medium text-xs",
            statusStyles[currentStatus as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800',
            statusUpdateMutation.isPending && "opacity-50 cursor-not-allowed"
          )}
          disabled={statusUpdateMutation.isPending}
        >
          {statusUpdateMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : null}
          {currentStatus}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {otherStatuses.map((status) => (
          <DropdownMenuItem
            key={status.hash}
            onClick={() => handleStatusChange(status.name)}
            className="cursor-pointer"
          >
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2",
              statusStyles[status.name as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'
            )}>
              {status.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default InlineStatusEditor;