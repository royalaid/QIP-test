import { config } from '../config/env';
import { IPFSService, PinataProvider, LocalIPFSProvider, MaiAPIProvider, type IPFSProvider } from "./ipfsService";

/**
 * Get configured IPFS gateways from environment or use defaults
 */
function getConfiguredGateway(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_IPFS_GATEWAY) {
    return import.meta.env.VITE_IPFS_GATEWAY;
  }
  return "https://gateway.pinata.cloud";
}

/**
 * Get the appropriate IPFS provider based on environment configuration
 */
export function getIPFSProvider(): IPFSProvider {
  // Priority order:
  // 1. Local IPFS (if in local mode OR explicitly enabled)
  // 2. Mai API (if enabled and URL configured)
  // 3. Pinata (if JWT provided)
  // 4. Mai API fallback (if URL configured, even without explicit flag)

  console.log("🔍 IPFS Provider Selection Debug:", {
    localMode: config.localMode,
    useMaiApi: config.useMaiApi,
    ipfsApiUrl: config.ipfsApiUrl,
    useLocalIPFS: config.useLocalIPFS,
  });

  // Get configured gateways
  const gateways = [getConfiguredGateway()];

  // In local mode, always use local IPFS
  if (config.localMode || config.useLocalIPFS) {
    console.log("🏠 Using local IPFS node (localMode:", config.localMode, ", useLocalIPFS:", config.useLocalIPFS, ")");
    return new LocalIPFSProvider(config.localIPFSApi, config.localIPFSGateway);
  }

  // Only use Mai API if explicitly enabled
  if (config.useMaiApi && config.ipfsApiUrl) {
    console.log("🌐 Using Mai API for IPFS uploads:", config.ipfsApiUrl);
    console.log(`📡 Using ${gateways.length} IPFS gateways for load balancing`);
    return new MaiAPIProvider(config.ipfsApiUrl);
  }

  // No fallback to Mai API - require explicit configuration
  throw new Error(
    "No IPFS provider configured. Please set up local IPFS (VITE_USE_LOCAL_IPFS=true) or Mai API (VITE_USE_MAI_API=true with VITE_IPFS_API_URL)."
  );
}

/**
 * Get a configured IPFS service instance
 */
export function getIPFSService(): IPFSService {
  const provider = getIPFSProvider();
  return new IPFSService(provider);
}

// Export a singleton instance for convenience
let ipfsServiceInstance: IPFSService | null = null;

export function getSharedIPFSService(): IPFSService {
  if (!ipfsServiceInstance) {
    ipfsServiceInstance = getIPFSService();
  }
  return ipfsServiceInstance;
}