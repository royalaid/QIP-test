import { config } from '../config/env';

/**
 * Get the appropriate IPFS gateway URL based on current configuration
 */
export function getIPFSGatewayUrl(cidOrIpfsUrl: string): string {
  // Extract CID from IPFS URL if needed
  const cid = cidOrIpfsUrl.replace('ipfs://', '');

  // Use the unified gateway configuration
  const gateway = config.ipfsGateway || "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${cid}`;
}