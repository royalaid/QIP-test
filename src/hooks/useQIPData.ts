import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { QIPClient, QIPStatus } from '../services/qipClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { config } from '../config/env';
import { useQIPsFromAPI } from './useQIPsFromAPI';
import { useQIPList } from './useQIPList';

export interface QIPData {
  qipNumber: number;
  title: string;
  network: string;
  status: string; // On-chain status (source of truth)
  statusEnum: QIPStatus; // On-chain status enum value
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

interface UseQIPDataOptions {
  registryAddress?: `0x${string}`;
  pollingInterval?: number;
  enabled?: boolean;
}

/**
 * Data fetching for QIPs using Mai API
 */
export function useQIPData(options: UseQIPDataOptions = {}) {
  const {
    registryAddress,
    pollingInterval = 30000, // 30 seconds default
    enabled = true,
  } = options;

  // Use API only if explicitly enabled
  // In local mode, never use API
  const shouldUseAPI = config.localMode ? false : (config.useMaiApi && config.maiApiUrl);
  
  console.log('[useQIPData] Config:', {
    useMaiApi: config.useMaiApi,
    maiApiUrl: config.maiApiUrl,
    localMode: config.localMode,
    shouldUseAPI,
    registryAddress: registryAddress || config.registryAddress
  });
  
  // API result (only used when shouldUseAPI is true)
  const apiResult = useQIPsFromAPI({
    apiUrl: config.maiApiUrl,
    enabled: enabled && Boolean(shouldUseAPI),
    pollingInterval,
    includeContent: false, // Don't fetch content by default for performance
  });

  // Blockchain result (only used when shouldUseAPI is false)
  const blockchainResult = useQIPList({
    registryAddress: registryAddress || config.registryAddress as `0x${string}`,
    enabled: enabled && !shouldUseAPI,
    pollingInterval,
  });
  
  console.log('[useQIPData] Blockchain result enabled:', enabled && !shouldUseAPI);
  console.log('[useQIPData] Registry being used:', registryAddress || config.registryAddress);

  // Choose which data source to use based on configuration
  if (shouldUseAPI) {
    return {
      // Map API result to expected interface
      blockchainQIPs: apiResult.qips,
      isLoading: apiResult.isLoading,
      isError: apiResult.isError,
      error: apiResult.error,

      // Methods
      getQIP: apiResult.getQIP,
      invalidateQIPs: apiResult.invalidateQIPs,
      prefetchQIP: apiResult.prefetchQIP,

      // Status
      isFetching: apiResult.isFetching,
      isStale: apiResult.isStale,
      dataUpdatedAt: apiResult.dataUpdatedAt,
    };
  } else {
    // Use blockchain data
    return {
      // Map blockchain result to expected interface
      blockchainQIPs: blockchainResult.data || [],
      isLoading: blockchainResult.isLoading,
      isError: blockchainResult.isError,
      error: blockchainResult.error,

      // Methods (some need to be stubbed for blockchain mode)
      getQIP: (qipNumber: number) => {
        // Return a hook that finds the QIP from the list
        return {
          data: blockchainResult.data?.find(q => q.qipNumber === qipNumber) || null,
          isLoading: blockchainResult.isLoading,
          isError: blockchainResult.isError,
          error: blockchainResult.error,
        };
      },
      invalidateQIPs: () => blockchainResult.refetch(),
      prefetchQIP: async (qipNumber: number) => {
        // No-op for blockchain mode as we fetch all at once
        console.log(`[useQIPData] Prefetch not needed in blockchain mode for QIP ${qipNumber}`);
      },

      // Status
      isFetching: blockchainResult.isFetching,
      isStale: blockchainResult.isStale,
      dataUpdatedAt: blockchainResult.dataUpdatedAt,
    };
  }
}

/**
 * Hook for getting QIPs by status with real-time updates
 */
export function useQIPsByStatus(status: QIPStatus, options: UseQIPDataOptions = {}) {
  const { blockchainQIPs, isLoading, isError, error } = useQIPData(options);
  
  const filteredQIPs = blockchainQIPs.filter(qip => {
    // Map status string back to enum for comparison
    const statusMap: Record<string, QIPStatus> = {
      'Draft': QIPStatus.Draft,
      'Review Pending': QIPStatus.ReviewPending,
      'Vote Pending': QIPStatus.VotePending,
      'Approved': QIPStatus.Approved,
      'Rejected': QIPStatus.Rejected,
      'Implemented': QIPStatus.Implemented,
    };
    
    return statusMap[qip.status] === status;
  });

  return {
    qips: filteredQIPs,
    isLoading,
    isError,
    error,
    count: filteredQIPs.length,
  };
}

/**
 * Hook for real-time QIP count by status
 */
export function useQIPCounts(options: UseQIPDataOptions = {}) {
  const { blockchainQIPs, isLoading } = useQIPData(options);
  
  const counts = blockchainQIPs.reduce((acc, qip) => {
    acc[qip.status] = (acc[qip.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    counts,
    total: blockchainQIPs.length,
    isLoading,
  };
}