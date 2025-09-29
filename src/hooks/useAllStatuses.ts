import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { QCIClient } from '../services/qciClient';
import { ALL_STATUS_NAMES, ALL_STATUS_HASHES } from '../config/statusConfig';
import { config } from '../config/env';
import { CACHE_TIMES } from '../config/queryClient';
import { queryKeys } from '../utils/queryKeys';

interface StatusData {
  name: string;
  hash: string;
}

interface UseAllStatusesOptions {
  registryAddress?: `0x${string}`;
  rpcUrl?: string;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<StatusData[]>, 'queryKey' | 'queryFn'>;
}

/**
 * Hook to fetch all available statuses from the QCI registry
 * Uses React Query caching to avoid repeated blockchain calls
 */
export function useAllStatuses({
  registryAddress,
  rpcUrl = config.baseRpcUrl,
  enabled = true,
  queryOptions = {},
}: UseAllStatusesOptions = {}) {
  return useQuery<StatusData[]>({
    queryKey: queryKeys.allStatuses(registryAddress),
    queryFn: async () => {
      if (!registryAddress) {
        // Fallback to static config when no registry address
        console.warn('[useAllStatuses] No registry address provided, using static config');
        return ALL_STATUS_NAMES.map((name, index) => ({
          name,
          hash: ALL_STATUS_HASHES[index],
        }));
      }

      try {
        console.log('[useAllStatuses] 🔍 Fetching statuses from registry...');
        const qciClient = new QCIClient(registryAddress, rpcUrl, false);
        const result = await qciClient.fetchAllStatuses();

        const statusArray = result.names.map((name, index) => ({
          name,
          hash: result.hashes[index],
        }));

        console.log(`[useAllStatuses] ✓ Fetched ${statusArray.length} statuses:`, statusArray);
        return statusArray;
      } catch (error) {
        console.error('[useAllStatuses] Failed to fetch statuses from registry:', error);

        // Fallback to static config on error
        console.log('[useAllStatuses] Using fallback static config');
        return ALL_STATUS_NAMES.map((name, index) => ({
          name,
          hash: ALL_STATUS_HASHES[index],
        }));
      }
    },
    enabled: enabled,
    staleTime: 15 * 60 * 1000, // 15 minutes - statuses rarely change
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
    retry: 1, // Only retry once before falling back
    retryDelay: 1000, // 1 second delay between retries
    ...queryOptions,
  });
}

/**
 * Type export for consumers
 */
export type { StatusData };