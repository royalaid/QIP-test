import React from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { QIPClient, QIPStatus } from '../services/qipClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { QIPData } from './useQIPData';
import { config } from '../config/env';

interface UseQIPListOptions {
  registryAddress: `0x${string}`;
  status?: QIPStatus;
  author?: string;
  network?: string;
  enabled?: boolean;
  pollingInterval?: number;
  queryOptions?: Omit<UseQueryOptions<QIPData[]>, 'queryKey' | 'queryFn'>;
}

/**
 * Hook to fetch all QIPs with optional filtering
 */
export function useQIPList({
  registryAddress,
  status,
  author,
  network,
  enabled = true,
  pollingInterval = 30000,
  queryOptions = {},
}: UseQIPListOptions) {
  // Memoize QIPClient to avoid recreating on every render
  const qipClient = React.useMemo(() => 
    new QIPClient(registryAddress, config.baseRpcUrl, false),
    [registryAddress]
  );
  
  // Use centralized IPFS service selection
  const ipfsService = getIPFSService();

  return useQuery<QIPData[]>({
    queryKey: ['qips', 'list', registryAddress, { status, author, network }],
    queryFn: async () => {
      console.log('[useQIPList] Starting fetch with filters:', { status, author, network });
      console.log('[useQIPList] Registry address:', registryAddress);
      console.log('[useQIPList] Config RPC URL:', config.baseRpcUrl);
      
      const qips: QIPData[] = [];
      
      // First, get the next QIP number to determine the upper bound
      let maxQipNumber: bigint;
      try {
        const nextQipNumber = await qipClient.getNextQIPNumber();
        // Check if QIP at nextQIPNumber exists (edge case from migration bug)
        // This handles the case where nextQIPNumber hasn't been properly incremented
        try {
          const testQip = await qipClient.getQIP(nextQipNumber);
          if (testQip && testQip.qipNumber > 0n) {
            console.log(`[useQIPList] Found QIP at nextQIPNumber ${nextQipNumber}, including it`);
            maxQipNumber = nextQipNumber; // Include the QIP at nextQIPNumber
          } else {
            maxQipNumber = nextQipNumber - 1n; // Normal case
          }
        } catch {
          maxQipNumber = nextQipNumber - 1n; // Normal case if QIP doesn't exist
        }
        console.log('[useQIPList] Next QIP number:', nextQipNumber.toString(), 'Max QIP:', maxQipNumber.toString());
      } catch (error) {
        console.warn('[useQIPList] Failed to get nextQIPNumber, falling back to hardcoded range', error);
        maxQipNumber = 248n; // Fallback to known range if contract call fails
      }

      // Check if the contract is empty (nextQIPNumber is 209, meaning no QIPs exist)
      if (maxQipNumber < 209n) {
        console.log('[useQIPList] No QIPs in registry (contract is empty)');
        return [];
      }

      // Create array of QIP numbers to fetch (starting from 209, the first QIP in registry)
      const qipNumbers: bigint[] = [];
      for (let qipNum = 209n; qipNum <= maxQipNumber; qipNum++) {
        qipNumbers.push(qipNum);
      }
      
      console.log(`[useQIPList] Fetching QIPs 209-${maxQipNumber} (${qipNumbers.length} total) with multicall batching`);

      // Batch fetch all QIPs using multicall
      const BATCH_SIZE = 5; // Reduced to avoid gas limits
      for (let i = 0; i < qipNumbers.length; i += BATCH_SIZE) {
        const batch = qipNumbers.slice(i, Math.min(i + BATCH_SIZE, qipNumbers.length));
        
        try {
          // Fetch batch of QIPs with multicall
          const batchQIPs = await qipClient.getQIPsBatch(batch);

          for (const qip of batchQIPs) {
            // Skip if QIP doesn't exist
            if (!qip || qip.qipNumber === 0n) {
              continue;
            }
            
            // Apply filters
            if (status !== undefined && qip.status !== status) {
              continue;
            }
            
            if (author && qip.author.toLowerCase() !== author.toLowerCase()) {
              continue;
            }
            
            if (network && qip.network.toLowerCase() !== network.toLowerCase()) {
              continue;
            }
            
            try {
              // Fetch content from IPFS
              const ipfsContent = await ipfsService.fetchQIP(qip.ipfsUrl);
              const { frontmatter, content } = ipfsService.parseQIPMarkdown(ipfsContent);
              
              const implDate = qip.implementationDate > 0n 
                ? new Date(Number(qip.implementationDate) * 1000).toISOString().split('T')[0]
                : 'None';
              
              qips.push({
                qipNumber: Number(qip.qipNumber),
                title: qip.title,
                network: qip.network,
                status: qipClient.getStatusString(qip.status), // On-chain status (source of truth)
                statusEnum: qip.status, // Include the enum value
                ipfsStatus: frontmatter.status, // Status from IPFS (may differ)
                author: frontmatter.author || qip.author,
                implementor: qip.implementor,
                implementationDate: implDate,
                // Filter out TBU and other placeholders
                proposal: (qip.snapshotProposalId && 
                          qip.snapshotProposalId !== 'TBU' && 
                          qip.snapshotProposalId !== 'tbu' &&
                          qip.snapshotProposalId !== 'None') 
                          ? qip.snapshotProposalId 
                          : 'None',
                created: frontmatter.created || new Date(Number(qip.createdAt) * 1000).toISOString().split('T')[0],
                content,
                ipfsUrl: qip.ipfsUrl,
                contentHash: qip.contentHash,
                version: Number(qip.version),
                source: 'blockchain',
                lastUpdated: Date.now()
              });
            } catch (error) {
              console.error(`Error processing QIP ${qip.qipNumber}:`, error);
            }
          }
          
          // Progressive delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < qipNumbers.length) {
            const delay = Math.min(100 * (Math.floor(i/BATCH_SIZE) + 1), 500);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`Error fetching batch:`, error);
        }
      }

      console.log('[useQIPList] Total QIPs fetched:', qips.length);
      console.log('[useQIPList] QIP numbers fetched:', qips.map(q => q.qipNumber).sort((a, b) => a - b));
      console.log('[useQIPList] QIP statuses:', qips.map(q => `${q.qipNumber}: ${q.status}`));

      return qips;
    },
    enabled: enabled && !!registryAddress,
    refetchInterval: pollingInterval,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });
}