import { useStatusUpdateMutation } from './useStatusUpdateMutation';
import { QCIStatus } from '../services/qciClient';
import type { Hash } from 'viem';
import { config } from '../config/env';

interface UpdateQCIStatusResult {
  updateStatus: (qciNumber: bigint, newStatus: QCIStatus | string) => Promise<Hash | undefined>;
  isUpdating: boolean;
  error: Error | null;
  transactionHash: Hash | null;
}

/**
 * Legacy hook for updating QCI status
 * @deprecated Use useStatusUpdateMutation directly for better React Query integration
 */
export function useUpdateQCIStatus(): UpdateQCIStatusResult {
  const mutation = useStatusUpdateMutation();

  const updateStatus = async (qciNumber: bigint, newStatus: QCIStatus | string): Promise<Hash | undefined> => {
    const contractAddress = config.registryAddress || import.meta.env.VITE_QCI_REGISTRY_ADDRESS;
    const rpcUrl = config.baseRpcUrl || import.meta.env.VITE_BASE_RPC_URL;

    if (!contractAddress) {
      throw new Error('QCI Registry contract address not configured');
    }

    try {
      const hash = await mutation.mutateAsync({
        qciNumber,
        newStatus,
        registryAddress: contractAddress as `0x${string}`,
        rpcUrl
      });
      return hash;
    } catch (error) {
      console.error('[useUpdateQCIStatus] Failed:', error);
      return undefined;
    }
  };

  return {
    updateStatus,
    isUpdating: mutation.isPending,
    error: mutation.error,
    transactionHash: mutation.data || null
  };
}