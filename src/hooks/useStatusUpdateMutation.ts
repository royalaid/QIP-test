import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletClient } from 'wagmi';
import { QIPClient, QIPStatus } from '../services/qipClient';
import { toast } from 'react-hot-toast';
import type { Hash } from 'viem';
import { config } from '../config/env';

interface StatusUpdateParams {
  qipNumber: bigint;
  newStatus: QIPStatus | string;
  registryAddress: `0x${string}`;
  rpcUrl?: string;
}

/**
 * Mutation hook for updating QIP status
 * Properly integrates with React Query's caching strategy
 */
export function useStatusUpdateMutation() {
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  return useMutation<Hash, Error, StatusUpdateParams>({
    mutationFn: async ({ qipNumber, newStatus, registryAddress, rpcUrl }) => {
      if (!walletClient) {
        throw new Error("Please connect your wallet");
      }

      const qipClient = new QIPClient(registryAddress, rpcUrl, false);

      console.log(`[StatusUpdate] Updating QIP ${qipNumber} to ${newStatus}`);
      const hash = await qipClient.updateQIPStatus(walletClient, qipNumber, newStatus);

      // Wait for transaction confirmation
      const publicClient = walletClient.chain
        ? await import("viem").then((m) =>
            m.createPublicClient({
              chain: walletClient.chain,
              transport: m.http(rpcUrl || import.meta.env.VITE_BASE_RPC_URL),
            })
          )
        : null;

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });
      }

      // Invalidate backend cache - fire and forget
      const maiApiUrl = config.maiApiUrl || import.meta.env.VITE_MAI_API_URL;
      if (maiApiUrl && config.useMaiApi) {
        fetch(`${maiApiUrl}/v2/cache/invalidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "status_update",
            qipNumber: Number(qipNumber),
            txHash: hash,
            reason: `Status updated to ${newStatus}`,
          }),
        }).catch((err) => console.error("[StatusUpdate] Cache invalidation failed:", err));
      }

      return hash;
    },

    onMutate: async ({ qipNumber, newStatus }) => {
      // Show loading toast immediately
      toast.loading(`Updating status to ${newStatus}...`, { id: `status-${qipNumber}` });

      // Cancel any outgoing refetches to prevent overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["qips", "api"] });

      // Get current data
      const previousData = queryClient.getQueryData(["qips", "api"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["qips", "api"], (old: any) => {
        if (!old) return old;

        // Find the query data structure and update it
        // The actual structure depends on how the data is stored
        const queryKey = Object.keys(old).find((key) => key.includes("forceRefresh") || key === "0");

        if (queryKey && Array.isArray(old[queryKey])) {
          return {
            ...old,
            [queryKey]: old[queryKey].map((qip: any) =>
              qip.qipNumber === Number(qipNumber) ? { ...qip, status: newStatus, statusEnum: newStatus } : qip
            ),
          };
        }

        return old;
      });

      // Also update the full query key structure used by useQIPsFromAPI
      const fullQueryKey = ["qips", "api", config.maiApiUrl, { includeContent: false, contentFor: undefined, forceRefresh: false }];
      const currentQIPs = queryClient.getQueryData(fullQueryKey) as any[];

      if (currentQIPs) {
        queryClient.setQueryData(
          fullQueryKey,
          currentQIPs.map((qip: any) => (qip.qipNumber === Number(qipNumber) ? { ...qip, status: newStatus, statusEnum: newStatus } : qip))
        );
      }

      return { previousData, qipNumber };
    },

    onError: (err, variables, context: any) => {
      // Dismiss loading toast
      if (context?.qipNumber) {
        toast.dismiss(`status-${context.qipNumber}`);
      }

      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["qips", "api"], context.previousData);
      }

      let errorMessage = "Failed to update status";
      if (err.message?.includes("AccessControl")) {
        errorMessage = "You do not have permission to update this status";
      } else if (err.message?.includes("user rejected")) {
        errorMessage = "Transaction cancelled";
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    },

    onSuccess: (hash, { qipNumber, newStatus }) => {
      // Replace loading toast with success
      toast.success(`Status updated to ${newStatus}`, { id: `status-${qipNumber}` });

      // Mark queries as stale so they refetch in the background
      // This uses stale-while-revalidate: shows optimistic update while fetching fresh data
      queryClient.invalidateQueries({
        queryKey: ["qips"],
        refetchType: "active", // Only refetch if the component is mounted
      });
    },

    onSettled: () => {
      // Ensure we always resync with the server after mutation
      // This happens in the background without blocking the UI
      queryClient.invalidateQueries({ queryKey: ["qips", "api"] });
    },
  });
}