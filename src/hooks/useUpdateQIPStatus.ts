import { useStatusUpdateMutation } from './useStatusUpdateMutation';
import { QIPStatus } from '../services/qipClient';
import type { Hash } from 'viem';
import { config } from '../config/env';

interface UpdateQIPStatusResult {
  updateStatus: (qipNumber: bigint, newStatus: QIPStatus | string) => Promise<Hash | undefined>;
  isUpdating: boolean;
  error: Error | null;
  transactionHash: Hash | null;
}

/**
 * Legacy hook for updating QIP status
 * @deprecated Use useStatusUpdateMutation directly for better React Query integration
 */
export function useUpdateQIPStatus(): UpdateQIPStatusResult {
  const mutation = useStatusUpdateMutation();

  const updateStatus = async (qipNumber: bigint, newStatus: QIPStatus | string): Promise<Hash | undefined> => {
    const contractAddress = config.registryAddress || import.meta.env.VITE_QIP_REGISTRY_ADDRESS;
    const rpcUrl = config.baseRpcUrl || import.meta.env.VITE_BASE_RPC_URL;

    if (!contractAddress) {
      throw new Error('QIP Registry contract address not configured');
    }

    try {
      const hash = await mutation.mutateAsync({
        qipNumber,
        newStatus,
        registryAddress: contractAddress as `0x${string}`,
        rpcUrl
      });
      return hash;
    } catch (error) {
      console.error('[useUpdateQIPStatus] Failed:', error);
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