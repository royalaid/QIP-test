import React from 'react';
import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { MaiAPIClient, MaiAPIQCI, FetchQCIsOptions } from '../services/maiApiClient';
import { QCIStatus } from '../services/qciClient';
import { QCIData } from './useQCIData';

interface UseQCIsFromAPIOptions {
  apiUrl?: string;
  includeContent?: boolean;
  contentFor?: number[];
  forceRefresh?: boolean;
  enabled?: boolean;
  pollingInterval?: number;
  queryOptions?: Omit<UseQueryOptions<QCIData[]>, 'queryKey' | 'queryFn'>;
}

/**
 * Hook to fetch QCIs from the Mai API endpoint
 * Provides 24x faster performance compared to direct blockchain fetching
 */
export function useQCIsFromAPI({
  apiUrl,
  includeContent = false,
  contentFor,
  forceRefresh = false,
  enabled = true,
  pollingInterval = 5 * 60 * 1000, // 5 minutes default (was 30 seconds)
  queryOptions = {},
}: UseQCIsFromAPIOptions = {}) {
  const queryClient = useQueryClient();

  // Initialize API client
  const apiClient = React.useMemo(() => 
    new MaiAPIClient(apiUrl),
    [apiUrl]
  );

  // Main query for fetching QCIs
  const qcisQuery = useQuery<QCIData[]>({
    queryKey: ['qcis', 'api', apiUrl, { includeContent, contentFor, forceRefresh }],
    queryFn: async () => {
      console.log('[useQCIsFromAPI] Fetching QCIs from API:', apiUrl);
      
      const options: FetchQCIsOptions = {
        includeContent,
        contentFor,
        forceRefresh,
      };

      try {
        const response = await apiClient.fetchQCIs(options);
        
        console.log(`[useQCIsFromAPI] ✅ Received ${response.qcis.length} QCIs (cached: ${response.cached})`);
        
        // Convert API QCIs to app's QCIData format
        const qciData = response.qcis.map(apiQip => MaiAPIClient.toQCIData(apiQip));
        
        // Sort by QCI number descending (newest first)
        qciData.sort((a, b) => b.qciNumber - a.qciNumber);
        
        return qciData;
      } catch (error: any) {
        console.error('[useQCIsFromAPI] ❌ API fetch failed:', error.message);
        console.log('[useQCIsFromAPI] 🔄 Note: The app should fall back to blockchain mode');
        throw error;
      }
    },
    enabled,
    refetchInterval: pollingInterval,
    staleTime: 2 * 60 * 60 * 1000, // 2 hours - data is considered fresh for this period
    gcTime: 4 * 60 * 60 * 1000, // 4 hours - keep in cache for this long
    refetchOnWindowFocus: true, // Refetch when window regains focus (only if stale)
    refetchOnMount: false, // Don't refetch on component mount
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });

  // Get a specific QCI with content
  const getQCI = React.useCallback(
    (qciNumber: number) => {
      return useQuery({
        queryKey: ["qci", "api", qciNumber, apiUrl],
        queryFn: async (): Promise<QCIData | null> => {
          console.log(`[useQCIsFromAPI] Fetching QCI ${qciNumber} with content`);

          const apiQip = await apiClient.fetchQCI(qciNumber);

          if (!apiQip) {
            return null;
          }

          return MaiAPIClient.toQCIData(apiQip);
        },
        enabled: enabled && qciNumber > 0,
        staleTime: 2 * 60 * 60 * 1000, // 2 hours
        gcTime: 4 * 60 * 60 * 1000, // 4 hours
        refetchOnMount: false,
        refetchOnWindowFocus: true,
      });
    },
    [apiClient, apiUrl, enabled]
  );

  // Filter QCIs by status
  const getQCIsByStatus = React.useCallback(
    (status: QCIStatus) => {
      const allQCIs = qcisQuery.data || [];
      return allQCIs.filter(qci => qci.statusEnum === status);
    },
    [qcisQuery.data]
  );

  // Get QCI counts by status
  const getQCICounts = React.useCallback(() => {
    const allQCIs = qcisQuery.data || [];
    const counts = allQCIs.reduce((acc, qci) => {
      acc[qci.status] = (acc[qci.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      counts,
      total: allQCIs.length,
    };
  }, [qcisQuery.data]);

  // Invalidate queries for real-time updates
  const invalidateQCIs = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['qcis', 'api'] });
  }, [queryClient]);

  // Prefetch QCI data
  const prefetchQCI = React.useCallback(
    (qciNumber: number) => {
      queryClient.prefetchQuery({
        queryKey: ['qci', 'api', qciNumber, apiUrl],
        queryFn: async () => {
          const apiQip = await apiClient.fetchQCI(qciNumber);
          return apiQip ? MaiAPIClient.toQCIData(apiQip) : null;
        },
        staleTime: 30000,
      });
    },
    [apiClient, apiUrl, queryClient]
  );

  // Force refresh data from API (bypass cache)
  const refreshQCIs = React.useCallback(async () => {
    console.log('[useQCIsFromAPI] Force refreshing QCIs');
    
    const response = await apiClient.fetchQCIs({ forceRefresh: true });
    const qciData = response.qcis.map(apiQip => MaiAPIClient.toQCIData(apiQip));
    qciData.sort((a, b) => b.qciNumber - a.qciNumber);
    
    // Update the cache with fresh data
    queryClient.setQueryData(
      ['qcis', 'api', apiUrl, { includeContent: false, contentFor: undefined, forceRefresh: false }],
      qciData
    );
    
    return qciData;
  }, [apiClient, apiUrl, queryClient]);

  return {
    // Data
    qcis: qcisQuery.data || [],
    isLoading: qcisQuery.isLoading,
    isError: qcisQuery.isError,
    error: qcisQuery.error,
    
    // Methods
    getQCI,
    getQCIsByStatus,
    getQCICounts,
    invalidateQCIs,
    prefetchQCI,
    refreshQCIs,
    
    // Status
    isFetching: qcisQuery.isFetching,
    isStale: qcisQuery.isStale,
    dataUpdatedAt: qcisQuery.dataUpdatedAt,
  };
}

/**
 * Hook for getting QCIs by status using the API
 */
export function useAPIQCIsByStatus(
  status: QCIStatus,
  options: UseQCIsFromAPIOptions = {}
) {
  const { qcis, isLoading, isError, error } = useQCIsFromAPI(options);
  
  const filteredQCIs = React.useMemo(() => 
    qcis.filter(qci => qci.statusEnum === status),
    [qcis, status]
  );

  return {
    qcis: filteredQCIs,
    isLoading,
    isError,
    error,
    count: filteredQCIs.length,
  };
}

/**
 * Hook for real-time QCI count by status using the API
 */
export function useAPIQCICounts(options: UseQCIsFromAPIOptions = {}) {
  const { qcis, isLoading } = useQCIsFromAPI(options);
  
  const counts = React.useMemo(() => {
    const statusCounts = qcis.reduce((acc, qci) => {
      acc[qci.status] = (acc[qci.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      counts: statusCounts,
      total: qcis.length,
    };
  }, [qcis]);

  return {
    ...counts,
    isLoading,
  };
}