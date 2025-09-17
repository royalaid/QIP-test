import React, { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { QIPStatus, DEFAULT_STATUSES, QIPClient } from '../services/qipClient';
import { toast } from 'react-hot-toast';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { Address } from 'viem';

interface StatusUpdateComponentProps {
  qipNumber: bigint;
  currentStatus: QIPStatus;
  currentIpfsStatus?: string;
  isAuthor: boolean;
  isEditor: boolean;
  onStatusUpdate: (newStatus: QIPStatus) => Promise<void>;
  onSyncToIPFS?: () => Promise<void>;
  hideStatusPill?: boolean;
}

// Status transition rules for the simplified 3-status system
const STATUS_TRANSITIONS: Record<number, number[]> = {
  [DEFAULT_STATUSES.Draft]: [DEFAULT_STATUSES.ReadyForSnapshot],
  [DEFAULT_STATUSES.ReadyForSnapshot]: [DEFAULT_STATUSES.PostedToSnapshot, DEFAULT_STATUSES.Draft],
  [DEFAULT_STATUSES.PostedToSnapshot]: [DEFAULT_STATUSES.Draft] // Can go back to draft if needed
};

export const StatusUpdateComponent: React.FC<StatusUpdateComponentProps> = ({
  qipNumber,
  currentStatus,
  currentIpfsStatus,
  isAuthor,
  isEditor,
  onStatusUpdate,
  onSyncToIPFS,
  hideStatusPill = false
}) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<QIPStatus | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [statusNames, setStatusNames] = useState<Map<number, string>>(new Map());
  const [availableStatuses, setAvailableStatuses] = useState<{ id: number, name: string }[]>([]);

  // Fetch available statuses from contract on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!publicClient) return;

      const contractAddress = process.env.VITE_QIP_REGISTRY_ADDRESS as Address;
      if (!contractAddress) return;

      try {
        const client = new QIPClient(contractAddress);
        const statuses = await client.fetchActiveStatuses();

        const statusMap = new Map<number, string>();
        const statusList: { id: number, name: string }[] = [];

        for (let i = 0; i < statuses.ids.length; i++) {
          statusMap.set(statuses.ids[i], statuses.names[i]);
          statusList.push({ id: statuses.ids[i], name: statuses.names[i] });
        }

        setStatusNames(statusMap);
        setAvailableStatuses(statusList);
      } catch (error) {
        console.error('Failed to fetch statuses:', error);
        // Fallback to default names
        setStatusNames(new Map([
          [0, 'Draft'],
          [1, 'Ready for Snapshot'],
          [2, 'Posted to Snapshot']
        ]));
        setAvailableStatuses([
          { id: 0, name: 'Draft' },
          { id: 1, name: 'Ready for Snapshot' },
          { id: 2, name: 'Posted to Snapshot' }
        ]);
      }
    };

    fetchStatuses();
  }, [publicClient]);

  const canUpdate = isAuthor || isEditor;

  const getAvailableTransitions = () => {
    if (isEditor) {
      // Editors can transition to any status
      return availableStatuses.filter(s => s.id !== currentStatus);
    }

    // Authors can only follow defined transitions
    const transitions = STATUS_TRANSITIONS[currentStatus] || [];
    return availableStatuses.filter(s => transitions.includes(s.id));
  };

  const getStatusLabel = (status: number): string => {
    return statusNames.get(status) || `Status ${status}`;
  };

  const handleStatusChange = (newStatus: QIPStatus) => {
    setSelectedStatus(newStatus);
    setShowConfirmation(true);
  };

  const confirmStatusUpdate = async () => {
    if (selectedStatus === null || !walletClient) return;

    setIsUpdating(true);
    try {
      await onStatusUpdate(selectedStatus);
      toast.success(`Status updated to ${getStatusLabel(selectedStatus)}`);
      setShowConfirmation(false);
      setSelectedStatus(null);
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelStatusUpdate = () => {
    setShowConfirmation(false);
    setSelectedStatus(null);
  };

  const handleSyncToIPFS = async () => {
    if (!onSyncToIPFS) return;

    setIsUpdating(true);
    try {
      await onSyncToIPFS();
      toast.success('IPFS content synced with blockchain status');
    } catch (error: any) {
      console.error('Failed to sync to IPFS:', error);
      toast.error(error.message || 'Failed to sync to IPFS');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: QIPStatus): string => {
    switch (status) {
      case DEFAULT_STATUSES.Draft:
        return 'bg-gray-500';
      case DEFAULT_STATUSES.ReadyForSnapshot:
        return 'bg-yellow-500';
      case DEFAULT_STATUSES.PostedToSnapshot:
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const availableTransitions = getAvailableTransitions();

  // Check if there's a discrepancy between blockchain and IPFS status
  const hasStatusDiscrepancy = currentIpfsStatus &&
    currentIpfsStatus.toLowerCase() !== getStatusLabel(currentStatus).toLowerCase();

  if (!canUpdate && !hasStatusDiscrepancy) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Status Management</h3>
        {!hideStatusPill && (
          <div className={`px-3 py-1 rounded-full text-white text-sm ${getStatusColor(currentStatus)}`}>
            {getStatusLabel(currentStatus)}
          </div>
        )}
      </div>

      {hasStatusDiscrepancy && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                Status discrepancy detected:
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                • Blockchain: <span className="font-semibold">{getStatusLabel(currentStatus)}</span>
              </p>
              <p className="text-sm text-yellow-700">
                • IPFS: <span className="font-semibold">{currentIpfsStatus}</span>
              </p>
              {onSyncToIPFS && canUpdate && (
                <button
                  onClick={handleSyncToIPFS}
                  disabled={isUpdating}
                  className="mt-2 text-sm text-yellow-800 hover:text-yellow-900 font-medium underline"
                >
                  Sync IPFS with blockchain status
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {canUpdate && availableTransitions.length > 0 && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Update Status
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableTransitions.map((status) => (
                <button
                  key={status.id}
                  onClick={() => handleStatusChange(status.id)}
                  disabled={isUpdating}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedStatus === status.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          {isEditor && (
            <p className="mt-2 text-xs text-gray-500">
              As an editor, you can transition to any status.
            </p>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && selectedStatus !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold mb-4">Confirm Status Update</h4>
            <p className="text-gray-700 mb-6">
              Are you sure you want to change the status from{' '}
              <span className="font-semibold">{getStatusLabel(currentStatus)}</span> to{' '}
              <span className="font-semibold">{getStatusLabel(selectedStatus)}</span>?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmStatusUpdate}
                disabled={isUpdating}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Updating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <FiCheck className="mr-2" />
                    Confirm
                  </span>
                )}
              </button>
              <button
                onClick={cancelStatusUpdate}
                disabled={isUpdating}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="flex items-center justify-center">
                  <FiX className="mr-2" />
                  Cancel
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!canUpdate && hasStatusDiscrepancy && (
        <p className="text-sm text-gray-500 mt-4">
          Only the author or editors can update the status or sync with IPFS.
        </p>
      )}

      {canUpdate && availableTransitions.length === 0 && !hasStatusDiscrepancy && (
        <p className="text-sm text-gray-500">
          No status transitions available from the current status.
        </p>
      )}
    </div>
  );
};