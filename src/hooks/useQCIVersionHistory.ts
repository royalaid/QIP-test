import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { QCIClient } from '../services/qciClient';
import { config } from '../config/env';

interface QCIVersion {
  version: number;
  ipfsUrl: string;
  updatedAt: string;
  author: string;
}

interface UseQCIVersionHistoryOptions {
  registryAddress: `0x${string}`;
  qciNumber: number;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<QCIVersion[]>, 'queryKey' | 'queryFn'>;
}

/**
 * Hook to fetch version history for a QCI
 */
export function useQCIVersionHistory({
  registryAddress,
  qciNumber,
  enabled = true,
  queryOptions = {},
}: UseQCIVersionHistoryOptions) {
  const qciClient = new QCIClient(registryAddress, config.baseRpcUrl, false);

  return useQuery<QCIVersion[]>({
    queryKey: ['qci', 'versions', qciNumber, registryAddress],
    queryFn: async () => {
      if (!qciClient || qciNumber <= 0) return [];

      try {
        const qci = await qciClient.getQCI(BigInt(qciNumber));
        
        if (!qci || qci.qciNumber === 0n) {
          return [];
        }

        // For now, we only have the current version
        // In the future, this could fetch from event logs or a separate version tracking system
        const versions: QCIVersion[] = [{
          version: Number(qci.version),
          ipfsUrl: qci.ipfsUrl,
          updatedAt: new Date(Number(qci.lastUpdated) * 1000).toISOString(),
          author: qci.author,
        }];

        // TODO: Fetch historical versions from blockchain events
        // This would involve querying QCIUpdated events for this QCI number

        return versions;
      } catch (error) {
        console.error(`Error fetching version history for QCI ${qciNumber}:`, error);
        throw error;
      }
    },
    enabled: enabled && !!registryAddress && qciNumber > 0,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...queryOptions,
  });
}