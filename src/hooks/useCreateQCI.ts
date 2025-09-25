import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useWalletClient } from 'wagmi';
import { QCIClient, type QCIContent } from '../services/qciClient';
import { IPFSService } from '../services/ipfsService';
import { getIPFSService } from '../services/getIPFSService';
import { config } from '../config/env';

interface CreateQCIParams {
  content: QCIContent;
}

interface CreateQCIResult {
  qciNumber: bigint;
  ipfsUrl: string;
  transactionHash: string;
}

interface UseCreateQCIOptions {
  registryAddress: `0x${string}`;
  mutationOptions?: Omit<UseMutationOptions<CreateQCIResult, Error, CreateQCIParams>, 'mutationFn'>;
}

/**
 * Hook to create a new QCI
 */
export function useCreateQCI({
  registryAddress,
  mutationOptions = {},
}: UseCreateQCIOptions) {
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const qciClient = new QCIClient(registryAddress, config.baseRpcUrl, false);
  
  // Use centralized IPFS service selection
  const ipfsService = getIPFSService();

  return useMutation<CreateQCIResult, Error, CreateQCIParams>({
    mutationFn: async ({ content }) => {
      if (!walletClient) {
        throw new Error('Wallet not connected');
      }


      try {
        // Format the full content for IPFS
        const fullContent = ipfsService.formatQCIContent(content);
        
        // Step 1: Pre-calculate IPFS CID without uploading
        console.log('🔮 Calculating IPFS CID...');
        const expectedCID = await ipfsService.calculateCID(fullContent);
        const expectedIpfsUrl = `ipfs://${expectedCID}`;
        console.log('✅ Expected CID:', expectedCID);
        
        // Step 2: Calculate content hash for blockchain
        const contentHash = ipfsService.calculateContentHash(content);

        // Step 3: Create QCI on blockchain with pre-calculated IPFS URL
        console.log('🚀 Creating new QCI on blockchain...');
        const result = await qciClient.createQCI(
          walletClient,
          content.title,
          content.chain,
          contentHash,
          expectedIpfsUrl
        );
        const txHash = result.hash;
        const qciNumber = result.qciNumber;
        console.log('✅ QCI created on blockchain:', { txHash, qciNumber });
        
        // Step 4: Upload to IPFS with proper metadata AFTER blockchain confirmation
        console.log('📤 Uploading to IPFS with metadata...');
        const actualCID = await ipfsService.provider.upload(fullContent, {
          qciNumber: qciNumber > 0 ? qciNumber.toString() : 'pending',
          groupId: config.pinataGroupId
        });
        
        // Verify CIDs match
        if (actualCID !== expectedCID) {
          console.warn('⚠️ CID mismatch! Expected:', expectedCID, 'Actual:', actualCID);
        } else {
          console.log('✅ IPFS upload successful, CID matches:', actualCID);
        }

        return {
          qciNumber: qciNumber,
          ipfsUrl: expectedIpfsUrl,
          transactionHash: txHash,
        };
      } catch (error) {
        console.error('Error creating QCI:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate QCI list queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['qcis'] });
      
      // Prefetch the new QCI data
      queryClient.setQueryData(['qci', Number(data.qciNumber), registryAddress], {
        qciNumber: Number(data.qciNumber),
        ipfsUrl: data.ipfsUrl,
        source: 'blockchain',
        lastUpdated: Date.now(),
      });
    },
    ...mutationOptions,
  });
}