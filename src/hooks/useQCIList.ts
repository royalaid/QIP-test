import React from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { QCIClient, QCIStatus } from '../services/qciClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { QCIData } from './useQCIData';
import { config } from '../config/env';

interface UseQCIListOptions {
  registryAddress: `0x${string}`;
  status?: QCIStatus;
  author?: string;
  network?: string;
  enabled?: boolean;
  pollingInterval?: number;
  queryOptions?: Omit<UseQueryOptions<QCIData[]>, 'queryKey' | 'queryFn'>;
}

/**
 * Hook to fetch all QCIs with optional filtering
 */
export function useQCIList({
  registryAddress,
  status,
  author,
  network,
  enabled = true,
  pollingInterval = 5 * 60 * 1000, // 5 minutes default (was 30 seconds)
  queryOptions = {},
}: UseQCIListOptions) {
  // Memoize QCIClient to avoid recreating on every render
  const qciClient = React.useMemo(() => new QCIClient(registryAddress, config.baseRpcUrl, false), [registryAddress]);

  // Use centralized IPFS service selection
  const ipfsService = getIPFSService();

  return useQuery<QCIData[]>({
    queryKey: ["qcis", "list", registryAddress, { status, author, network }],
    queryFn: async () => {
      console.log("[useQCIList] Starting fetch with filters:", { status, author, network });
      console.log("[useQCIList] Registry address:", registryAddress);
      console.log("[useQCIList] Config RPC URL:", config.baseRpcUrl);

      const qcis: QCIData[] = [];

      // First, get the next QCI number to determine the upper bound
      let maxQipNumber: bigint;
      try {
        const nextQipNumber = await qciClient.getNextQCINumber();
        // Check if QCI at nextQCINumber exists (edge case from migration bug)
        // This handles the case where nextQCINumber hasn't been properly incremented
        try {
          const testQip = await qciClient.getQCI(nextQipNumber);
          if (testQip && testQip.qciNumber > 0n) {
            console.log(`[useQCIList] Found QCI at nextQCINumber ${nextQipNumber}, including it`);
            maxQipNumber = nextQipNumber; // Include the QCI at nextQCINumber
          } else {
            maxQipNumber = nextQipNumber - 1n; // Normal case
          }
        } catch {
          maxQipNumber = nextQipNumber - 1n; // Normal case if QCI doesn't exist
        }
        console.log("[useQCIList] Next QCI number:", nextQipNumber.toString(), "Max QCI:", maxQipNumber.toString());
      } catch (error) {
        console.warn("[useQCIList] Failed to get nextQCINumber, falling back to hardcoded range", error);
        maxQipNumber = 248n; // Fallback to known range if contract call fails
      }

      // Check if the contract is empty (nextQCINumber is 209, meaning no QCIs exist)
      if (maxQipNumber < 209n) {
        console.log("[useQCIList] No QCIs in registry (contract is empty)");
        return [];
      }

      // Create array of QCI numbers to fetch (starting from 209, the first QCI in registry)
      const qciNumbers: bigint[] = [];
      for (let qciNum = 209n; qciNum <= maxQipNumber; qciNum++) {
        qciNumbers.push(qciNum);
      }

      console.log(`[useQCIList] Fetching QCIs 209-${maxQipNumber} (${qciNumbers.length} total) with multicall batching`);

      // Batch fetch all QCIs using multicall
      const BATCH_SIZE = 5; // Reduced to avoid gas limits
      for (let i = 0; i < qciNumbers.length; i += BATCH_SIZE) {
        const batch = qciNumbers.slice(i, Math.min(i + BATCH_SIZE, qciNumbers.length));

        try {
          // Fetch batch of QCIs with multicall
          const batchQCIs = await qciClient.getQCIsBatch(batch);

          for (const qci of batchQCIs) {
            // Skip if QCI doesn't exist
            if (!qci || qci.qciNumber === 0n) {
              continue;
            }

            // Apply filters
            if (status !== undefined && qci.status !== status) {
              continue;
            }

            if (author && qci.author.toLowerCase() !== author.toLowerCase()) {
              continue;
            }

            if (network && qci.chain.toLowerCase() !== network.toLowerCase()) {
              continue;
            }

            try {
              // Fetch content from IPFS
              const ipfsContent = await ipfsService.fetchQCI(qci.ipfsUrl);
              const { frontmatter, content } = ipfsService.parseQCIMarkdown(ipfsContent);

              const implDate =
                qci.implementationDate > 0n ? new Date(Number(qci.implementationDate) * 1000).toISOString().split("T")[0] : "None";

              qcis.push({
                qciNumber: Number(qci.qciNumber),
                title: qci.title,
                chain: qci.chain,
                status: qciClient.getStatusString(qci.status), // On-chain status (source of truth)
                statusEnum: qci.status, // Include the enum value
                ipfsStatus: frontmatter.status, // Status from IPFS (may differ)
                author: frontmatter.author || qci.author,
                implementor: qci.implementor,
                implementationDate: implDate,
                // Filter out TBU and other placeholders
                proposal:
                  qci.snapshotProposalId &&
                  qci.snapshotProposalId !== "TBU" &&
                  qci.snapshotProposalId !== "tbu" &&
                  qci.snapshotProposalId !== "None"
                    ? qci.snapshotProposalId
                    : "None",
                created: frontmatter.created || new Date(Number(qci.createdAt) * 1000).toISOString().split("T")[0],
                content,
                ipfsUrl: qci.ipfsUrl,
                contentHash: qci.contentHash,
                version: Number(qci.version),
                source: "blockchain",
                lastUpdated: Date.now(),
              });
            } catch (error) {
              console.error(`Error processing QCI ${qci.qciNumber}:`, error);
            }
          }

          // Progressive delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < qciNumbers.length) {
            const delay = Math.min(100 * (Math.floor(i / BATCH_SIZE) + 1), 500);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`Error fetching batch:`, error);
        }
      }

      console.log("[useQCIList] Total QCIs fetched:", qcis.length);
      console.log(
        "[useQCIList] QCI numbers fetched:",
        qcis.map((q) => q.qciNumber).sort((a, b) => a - b)
      );
      console.log(
        "[useQCIList] QCI statuses:",
        qcis.map((q) => `${q.qciNumber}: ${q.status}`)
      );

      return qcis;
    },
    enabled: enabled && !!registryAddress,
    refetchInterval: pollingInterval,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });
}