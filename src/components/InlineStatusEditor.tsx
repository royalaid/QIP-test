import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QIPClient, QIPStatus } from '../services/qipClient';
import { useWalletClient } from 'wagmi';
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
  const { data: walletClient } = useWalletClient();
  const [isUpdating, setIsUpdating] = useState(false);
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
    if (!walletClient) {
      toast.error('Please connect your wallet');
      return;
    }

    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const qipClient = new QIPClient(registryAddress, rpcUrl, false);
      const hash = await qipClient.updateQIPStatus(walletClient, BigInt(qipNumber), newStatus);

      // Wait for transaction confirmation
      const publicClient = walletClient.chain ?
        await import('viem').then(m => m.createPublicClient({
          chain: walletClient.chain,
          transport: m.http(rpcUrl || 'http://localhost:8545')
        })) : null;

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1
        });
      }

      toast.success(`Status updated to ${newStatus}`);
      setIsOpen(false);

      // Give blockchain a moment to sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Trigger refresh
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);

      let errorMessage = 'Failed to update status';
      if (error.message?.includes('AccessControl')) {
        errorMessage = 'You do not have permission to update this status';
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      }

      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
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
            isUpdating && "opacity-50 cursor-not-allowed"
          )}
          disabled={isUpdating}
        >
          {isUpdating ? (
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