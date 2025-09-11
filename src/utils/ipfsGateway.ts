import { config } from '../config/env';

/**
 * Get the appropriate IPFS gateway URL based on current configuration
 */
export function getIPFSGatewayUrl(cidOrIpfsUrl: string): string {
  // Extract CID from IPFS URL if needed
  const cid = cidOrIpfsUrl.replace('ipfs://', '');
  
  // In local mode, use local gateway
  if (config.localMode && config.localIPFSGateway) {
    return `${config.localIPFSGateway}/ipfs/${cid}`;
  }
  
  // Use configured Pinata gateway if available
  if (config.pinataGateway) {
    return `${config.pinataGateway}/ipfs/${cid}`;
  }
  
  // Fallback to public IPFS gateway
  return `https://ipfs.io/ipfs/${cid}`;
}