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
  onStatusUpdate: (newStatus: QIPStatus | string) => Promise<void>;
  onSyncToIPFS?: () => Promise<void>;
  hideStatusPill?: boolean;
}

// No status transition rules - all transitions are allowed

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
  console.log('StatusUpdateComponent received currentStatus:', currentStatus, 'which is:', QIPStatus[currentStatus]);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<{ hash: string, name: string }[]>([]);

  // Fetch available statuses from contract on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      // Use import.meta.env for Vite environment variables
      const contractAddress = import.meta.env.VITE_QIP_REGISTRY_ADDRESS as Address;

      if (!contractAddress) {
        console.warn('QIP Registry address not configured, using defaults');
        // Set default statuses immediately if no contract address
        setAvailableStatuses([
          { hash: '0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382', name: 'Draft' },
          { hash: '0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb', name: 'Ready for Snapshot' },
          { hash: '0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c', name: 'Posted to Snapshot' }
        ]);
        return;
      }

      try {
        const client = new QIPClient(contractAddress);
        const statuses = await client.fetchAllStatuses();

        const statusList: { hash: string, name: string }[] = [];

        for (let i = 0; i < statuses.hashes.length; i++) {
          statusList.push({ hash: statuses.hashes[i], name: statuses.names[i] });
        }

        console.log('Fetched statuses:', statusList);
        setAvailableStatuses(statusList);
      } catch (error) {
        console.error('Failed to fetch statuses, using defaults:', error);
        // Fallback to default statuses
        setAvailableStatuses([
          { hash: '0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382', name: 'Draft' },
          { hash: '0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb', name: 'Ready for Snapshot' },
          { hash: '0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c', name: 'Posted to Snapshot' }
        ]);
      }
    };

    fetchStatuses();
  }, []);

  const canUpdate = isAuthor || isEditor;

  const getAvailableTransitions = () => {
    // Get current status hash
    const currentStatusHash = getCurrentStatusHash();

    console.log('Getting available transitions:');
    console.log('- Current status:', currentStatus, QIPStatus[currentStatus]);
    console.log('- Current status hash:', currentStatusHash);
    console.log('- Available statuses:', availableStatuses);

    // All users can transition to any status except the current one
    const transitions = availableStatuses.filter(s => s.hash.toLowerCase() !== currentStatusHash.toLowerCase());
    console.log('- Available transitions:', transitions);

    return transitions;
  };

  const getCurrentStatusHash = () => {
    // Map enum values to hashes
    const statusToHash: Record<number, string> = {
      [QIPStatus.Draft]: '0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382',
      [QIPStatus.ReadyForSnapshot]: '0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb',
      [QIPStatus.PostedToSnapshot]: '0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c'
    };
    return statusToHash[currentStatus] || '';
  };

  const getStatusLabel = (statusInput: number | string): string => {
    if (typeof statusInput === 'number') {
      // Convert enum to string
      const statusMap: Record<number, string> = {
        [QIPStatus.Draft]: 'Draft',
        [QIPStatus.ReadyForSnapshot]: 'Ready for Snapshot',
        [QIPStatus.PostedToSnapshot]: 'Posted to Snapshot'
      };
      return statusMap[statusInput] || 'Unknown';
    }

    // If it's a hash, find the corresponding name
    const status = availableStatuses.find(s => s.hash.toLowerCase() === statusInput.toLowerCase());
    return status?.name || 'Unknown';
  };

  const handleStatusChange = (newStatusHash: string, newStatusName: string) => {
    setSelectedStatus(newStatusName);
    setShowConfirmation(true);
  };

  const confirmStatusUpdate = async () => {
    if (selectedStatus === null || !walletClient) return;

    setIsUpdating(true);
    try {
      // Call onStatusUpdate with the status name (string)
      await onStatusUpdate(selectedStatus as any);
      toast.success(`Status updated to ${selectedStatus}`);
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

  // Check if there's a discrepancy between blockchain and IPFS status
  const hasStatusDiscrepancy = currentIpfsStatus &&
    currentIpfsStatus.toLowerCase() !== getStatusLabel(currentStatus).toLowerCase();

  const availableTransitions = getAvailableTransitions();

  if (!canUpdate && !hasStatusDiscrepancy) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Status Management</h3>
        {!hideStatusPill && (
          <div className={`px-3 py-1 rounded-full text-white text-sm ${getStatusColor(currentStatus)}`}>
            {getStatusLabel(currentStatus)}
          </div>
        )}
      </div>

      {hasStatusDiscrepancy && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Status discrepancy detected:
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                • Blockchain: <span className="font-semibold">{getStatusLabel(currentStatus)}</span>
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                • IPFS: <span className="font-semibold">{currentIpfsStatus}</span>
              </p>
              {onSyncToIPFS && canUpdate && (
                <button
                  onClick={handleSyncToIPFS}
                  disabled={isUpdating}
                  className="mt-2 text-sm text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 font-medium underline"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Update Status
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableTransitions.map((status) => (
                <button
                  key={status.hash}
                  onClick={() => handleStatusChange(status.hash, status.name)}
                  disabled={isUpdating}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedStatus === status.name
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            You can transition to any available status.
          </p>
        </>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && selectedStatus !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Confirm Status Update</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to change the status from{' '}
              <span className="font-semibold">{getStatusLabel(currentStatus)}</span> to{' '}
              <span className="font-semibold">{selectedStatus}</span>?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmStatusUpdate}
                disabled={isUpdating}
                className="flex-1 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Only the author or editors can update the status or sync with IPFS.
        </p>
      )}

      {canUpdate && availableTransitions.length === 0 && !hasStatusDiscrepancy && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>Loading status options...</p>
          {availableStatuses.length === 0 && (
            <p className="text-xs mt-2">No statuses available. Check console for errors.</p>
          )}
        </div>
      )}

    </div>
  );
};