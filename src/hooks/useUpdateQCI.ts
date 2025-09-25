import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useWalletClient } from 'wagmi';
import { QCIClient, type QCIContent, QCIStatus } from '../services/qciClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { config } from '../config/env';

interface UpdateQCIParams {
  qciNumber: bigint;
  content: QCIContent;
  newStatus?: QCIStatus;
}

interface UpdateQCIResult {
  qciNumber: bigint;
  ipfsUrl: string;
  version: bigint;
  transactionHash: string;
}

interface UseUpdateQCIOptions {
  registryAddress: `0x${string}`;
  mutationOptions?: Omit<UseMutationOptions<UpdateQCIResult, Error, UpdateQCIParams>, 'mutationFn'>;
}

/**
 * Hook to update an existing QCI
 */
export function useUpdateQCI({
  registryAddress,
  mutationOptions = {},
}: UseUpdateQCIOptions) {
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const qciClient = new QCIClient(registryAddress, config.baseRpcUrl, false);
  
  // Use centralized IPFS service selection
  const ipfsService = getIPFSService();

  return useMutation<UpdateQCIResult, Error, UpdateQCIParams>({
    mutationFn: async ({ qciNumber, content, newStatus }) => {
      if (!walletClient) {
        throw new Error('Wallet not connected');
      }

      try {
        // Ensure content has qci number set
        const qciContent: QCIContent = {
          ...content,
          qci: Number(qciNumber)
        };

        // Format the full content for IPFS
        const fullContent = ipfsService.formatQCIContent(qciContent);

        // Step 1: Pre-calculate IPFS CID without uploading
        const expectedCID = await ipfsService.calculateCID(fullContent);
        const expectedIpfsUrl = `ipfs://${expectedCID}`;

        // Step 2: Calculate content hash for blockchain
        const contentHash = ipfsService.calculateContentHash(qciContent);

        const txHash = await qciClient.updateQCI({
          walletClient,
          qciNumber,
          title: content.title,
          chain: content.chain,
          implementor: content.implementor,
          newContentHash: contentHash,
          newIpfsUrl: expectedIpfsUrl,
          changeNote: "Updated via web interface",
        });

        // Step 4: Upload to IPFS with proper metadata AFTER blockchain confirmation
        const actualCID = await ipfsService.provider.upload(fullContent, {
          qciNumber: qciNumber.toString(),
          groupId: config.pinataGroupId
        });

        // Verify CIDs match
        if (actualCID !== expectedCID) {
          console.warn('CID mismatch! Expected:', expectedCID, 'Actual:', actualCID);
        }

        // Update status if provided
        if (newStatus !== undefined) {
          // Get current QCI to check status
          const currentQCI = await qciClient.getQCI(qciNumber);
          if (newStatus !== currentQCI.status) {
            await qciClient.updateQCIStatus(walletClient, qciNumber, newStatus);
          }
        }

        // Get updated QCI data for version
        const updatedQCI = await qciClient.getQCI(qciNumber);

        return {
          qciNumber,
          ipfsUrl: expectedIpfsUrl,
          version: updatedQCI.version,
          transactionHash: txHash,
        };
      } catch (error) {
        console.error('Error updating QCI:', error);
        if (error instanceof Error) {
          // Check for specific error patterns
          if (error.message.includes('execution reverted')) {
            console.error('Transaction reverted - possible causes:');
            console.error('1. User does not have editor role');
            console.error('2. QCI does not exist');
            console.error('3. QCI status does not allow updates');
            console.error('4. QCI already has snapshot ID');
          }
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['qcis'] });
      queryClient.invalidateQueries({ queryKey: ['qci', Number(data.qciNumber)] });
    },
    ...mutationOptions,
  });
}