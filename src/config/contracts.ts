import { config } from './env'

/**
 * Contract addresses by chain ID
 */
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  8453: {
    qciRegistry: config.qciRegistryAddress || "0xA541fD5521115E6d1DD510D5203E7e7065BcB652",
  },
  // Base Sepolia
  84532: {
    qciRegistry: config.qciRegistryAddress || "0x0000000000000000000000000000000000000000", // TODO: Deploy to testnet
  },
} as const;

/**
 * Get contract address for current chain
 */
export const getContractAddress = (chainId: number, contract: 'qciRegistry'): `0x${string}` => {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]
  
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ${chainId}`)
  }
  
  const address = addresses[contract]
  
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Contract ${contract} not deployed on chain ${chainId}`)
  }
  
  return address as `0x${string}`
}

/**
 * Contract ABIs
 */
export { QCIRegistryABI as QCI_REGISTRY_ABI } from "./abis/QCIRegistry";