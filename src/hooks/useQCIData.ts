import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { QCIClient, QCIStatus } from '../services/qciClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { config } from '../config/env';
import { useQCIsFromAPI } from './useQCIsFromAPI';
import { useQCIList } from './useQCIList';

export interface QCIData {
  qciNumber: number;
  title: string;
  chain: string;
  status: string; // On-chain status (source of truth)
  statusEnum: QCIStatus; // On-chain status enum value
  ipfsStatus?: string; // Status from IPFS frontmatter (may be outdated)
  author: string;
  implementor: string;
  implementationDate: string;
  proposal: string;
  created: string;
  content: string;
  ipfsUrl: string;
  contentHash: string;
  version: number;
  source: 'blockchain' | 'github';
  lastUpdated: number;
}

interface UseQCIDataOptions {
  registryAddress?: `0x${string}`;
  pollingInterval?: number;
  enabled?: boolean;
  forceRefresh?: boolean;
}

/**
 * Data fetching for QCIs using Mai API
 */
export function useQCIData(options: UseQCIDataOptions = {}) {
  const {
    registryAddress,
    pollingInterval = 5 * 60 * 1000, // 5 minutes default (was 30 seconds)
    enabled = true,
    forceRefresh = false,
  } = options;

  // Use API only if explicitly enabled
  // In local mode, never use API
  const shouldUseAPI = config.localMode ? false : (config.useMaiApi && config.maiApiUrl);
  
  console.log('[useQCIData] Config:', {
    useMaiApi: config.useMaiApi,
    maiApiUrl: config.maiApiUrl,
    localMode: config.localMode,
    shouldUseAPI,
    registryAddress: registryAddress || config.registryAddress
  });
  
  // API result (only used when shouldUseAPI is true)
  const apiResult = useQCIsFromAPI({
    apiUrl: config.maiApiUrl,
    enabled: enabled && Boolean(shouldUseAPI),
    pollingInterval,
    includeContent: false, // Fetch content from API to avoid client-side IPFS calls
    forceRefresh,
  });

  // Blockchain result (only used when shouldUseAPI is false)
  const blockchainResult = useQCIList({
    registryAddress: registryAddress || config.registryAddress as `0x${string}`,
    enabled: enabled && !shouldUseAPI,
    pollingInterval,
  });
  
  console.log('[useQCIData] Blockchain result enabled:', enabled && !shouldUseAPI);
  console.log('[useQCIData] Registry being used:', registryAddress || config.registryAddress);

  // Choose which data source to use based on configuration
  if (shouldUseAPI) {
    return {
      // Map API result to expected interface
      blockchainQCIs: apiResult.qcis,
      isLoading: apiResult.isLoading,
      isError: apiResult.isError,
      error: apiResult.error,

      // Methods
      getQCI: apiResult.getQCI,
      invalidateQCIs: apiResult.refreshQCIs || apiResult.invalidateQCIs, // Use refreshQCIs if available for force refresh
      prefetchQCI: apiResult.prefetchQCI,

      // Status
      isFetching: apiResult.isFetching,
      isStale: apiResult.isStale,
      dataUpdatedAt: apiResult.dataUpdatedAt,
    };
  } else {
    // Use blockchain data
    return {
      // Map blockchain result to expected interface
      blockchainQCIs: blockchainResult.data || [],
      isLoading: blockchainResult.isLoading,
      isError: blockchainResult.isError,
      error: blockchainResult.error,

      // Methods (some need to be stubbed for blockchain mode)
      getQCI: (qciNumber: number) => {
        // Return a hook that finds the QCI from the list
        return {
          data: blockchainResult.data?.find(q => q.qciNumber === qciNumber) || null,
          isLoading: blockchainResult.isLoading,
          isError: blockchainResult.isError,
          error: blockchainResult.error,
        };
      },
      invalidateQCIs: () => blockchainResult.refetch(),
      prefetchQCI: async (qciNumber: number) => {
        // No-op for blockchain mode as we fetch all at once
        console.log(`[useQCIData] Prefetch not needed in blockchain mode for QCI ${qciNumber}`);
      },

      // Status
      isFetching: blockchainResult.isFetching,
      isStale: blockchainResult.isStale,
      dataUpdatedAt: blockchainResult.dataUpdatedAt,
    };
  }
}

/**
 * Hook for getting QCIs by status with real-time updates
 */
export function useQCIsByStatus(status: QCIStatus, options: UseQCIDataOptions = {}) {
  const { blockchainQCIs, isLoading, isError, error } = useQCIData(options);
  
  const filteredQCIs = blockchainQCIs.filter(qci => {
    // Map status string back to enum for comparison
    const statusMap: Record<string, QCIStatus> = {
      Draft: QCIStatus.Draft,
      "Ready for Snapshot": QCIStatus.ReadyForSnapshot,
      "Posted to Snapshot": QCIStatus.PostedToSnapshot,
    };
    
    return statusMap[qci.status] === status;
  });

  return {
    qcis: filteredQCIs,
    isLoading,
    isError,
    error,
    count: filteredQCIs.length,
  };
}

/**
 * Hook for real-time QCI count by status
 */
export function useQCICounts(options: UseQCIDataOptions = {}) {
  const { blockchainQCIs, isLoading } = useQCIData(options);
  
  const counts = blockchainQCIs.reduce((acc, qci) => {
    acc[qci.status] = (acc[qci.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    counts,
    total: blockchainQCIs.length,
    isLoading,
  };
}