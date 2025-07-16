import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Hash, keccak256, toBytes, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const QIP_REGISTRY_ABI = [
  {
    inputs: [
      { name: "_title", type: "string" },
      { name: "_network", type: "string" },
      { name: "_contentHash", type: "bytes32" },
      { name: "_ipfsUrl", type: "string" }
    ],
    name: "createQIP",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  },
  {
    inputs: [
      { name: "_qipNumber", type: "uint256" },
      { name: "_title", type: "string" },
      { name: "_newContentHash", type: "bytes32" },
      { name: "_newIpfsUrl", type: "string" },
      { name: "_changeNote", type: "string" }
    ],
    name: "updateQIP",
    outputs: [],
    type: "function"
  },
  {
    inputs: [
      { name: "_qipNumber", type: "uint256" },
      { name: "_snapshotProposalId", type: "string" }
    ],
    name: "linkSnapshotProposal",
    outputs: [],
    type: "function"
  },
  {
    inputs: [
      { name: "_qipNumber", type: "uint256" },
      { name: "_content", type: "string" }
    ],
    name: "verifyContent",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
    stateMutability: "view"
  },
  {
    inputs: [{ name: "_qipNumber", type: "uint256" }],
    name: "qips",
    outputs: [
      { name: "qipNumber", type: "uint256" },
      { name: "author", type: "address" },
      { name: "title", type: "string" },
      { name: "network", type: "string" },
      { name: "contentHash", type: "bytes32" },
      { name: "ipfsUrl", type: "string" },
      { name: "createdAt", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "implementor", type: "string" },
      { name: "implementationDate", type: "uint256" },
      { name: "snapshotProposalId", type: "string" },
      { name: "version", type: "uint256" }
    ],
    type: "function",
    stateMutability: "view"
  },
  {
    inputs: [{ name: "_status", type: "uint8" }],
    name: "getQIPsByStatus",
    outputs: [{ name: "", type: "uint256[]" }],
    type: "function",
    stateMutability: "view"
  },
  {
    inputs: [{ name: "_author", type: "address" }],
    name: "getQIPsByAuthor",
    outputs: [{ name: "", type: "uint256[]" }],
    type: "function",
    stateMutability: "view"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "qipNumber", type: "uint256" },
      { indexed: true, name: "author", type: "address" },
      { indexed: false, name: "title", type: "string" },
      { indexed: false, name: "network", type: "string" },
      { indexed: false, name: "contentHash", type: "bytes32" },
      { indexed: false, name: "ipfsUrl", type: "string" }
    ],
    name: "QIPCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "qipNumber", type: "uint256" },
      { indexed: false, name: "version", type: "uint256" },
      { indexed: false, name: "newContentHash", type: "bytes32" },
      { indexed: false, name: "newIpfsUrl", type: "string" },
      { indexed: false, name: "changeNote", type: "string" }
    ],
    name: "QIPUpdated",
    type: "event"
  }
] as const;

export enum QIPStatus {
  Draft = 0,
  ReviewPending = 1,
  VotePending = 2,
  Approved = 3,
  Rejected = 4,
  Implemented = 5,
  Superseded = 6,
  Withdrawn = 7
}

export interface QIPContent {
  qip: number;
  title: string;
  network: string;
  status: string;
  author: string;
  implementor: string;
  'implementation-date': string;
  proposal: string;
  created: string;
  content: string; // Full markdown content
}

export interface QIP {
  qipNumber: bigint;
  author: Address;
  title: string;
  network: string;
  contentHash: Hash;
  ipfsUrl: string;
  createdAt: bigint;
  lastUpdated: bigint;
  status: QIPStatus;
  implementor: string;
  implementationDate: bigint;
  snapshotProposalId: string;
  version: bigint;
}

export class QIPClient {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private contractAddress: Address;

  constructor(
    contractAddress: Address,
    rpcUrl?: string,
    testnet: boolean = false
  ) {
    console.log("🔧 QIPClient Debug:");
    console.log("- contractAddress:", contractAddress);
    console.log("- rpcUrl:", rpcUrl);
    console.log("- testnet:", testnet);
    
    this.contractAddress = contractAddress;
    
    // For local development, use a custom chain configuration
    const chain = rpcUrl?.includes('localhost') || rpcUrl?.includes('127.0.0.1') 
      ? {
          ...base,
          id: 8453, // Base chain ID
          name: 'Local Base Fork',
          rpcUrls: {
            default: { http: [rpcUrl || 'http://localhost:8545'] },
            public: { http: [rpcUrl || 'http://localhost:8545'] }
          }
        }
      : (testnet ? baseSepolia : base);
    
    console.log("- Using chain:", chain.name, "with ID:", chain.id);
    
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });
    
    console.log("- PublicClient created:", !!this.publicClient);
  }

  setWalletClient(walletClient: WalletClient) {
    this.walletClient = walletClient;
  }

  /**
   * Check if running in local development
   */
  private isLocalDevelopment(): boolean {
    const transport = this.publicClient.transport;
    const url = transport.url || '';
    return url.includes('localhost') || url.includes('127.0.0.1');
  }

  /**
   * Create a new QIP
   */
  async createQIP(
    title: string,
    network: string,
    contentHash: Hash,
    ipfsUrl: string
  ): Promise<{ hash: Hash; qipNumber: bigint }> {
    if (!this.walletClient) throw new Error("Wallet client not set");
    
    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'createQIP',
      args: [title, network, contentHash, ipfsUrl],
      account: this.walletClient.account!
    });
    
    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'createQIP',
      args: [title, network, contentHash, ipfsUrl],
      account: this.walletClient.account!,
      gas: estimatedGas * 120n / 100n // Add 20% buffer
    });

    console.log('📝 Writing contract transaction...');
    const hash = await this.walletClient.writeContract(request);
    console.log('✅ Transaction submitted:', hash);
    
    // Wait for transaction and get QIP number from logs
    console.log('⏳ Waiting for transaction receipt...');
    
    // Add timeout for local development (Anvil sometimes doesn't auto-mine)
    const receipt = await this.publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 20_000, // 20 second timeout
      pollingInterval: 1_000, // Poll every second
      confirmations: 1
    }).catch(async (error) => {
      console.warn('⚠️ Receipt timeout, attempting to force mine...');
      
      // For local development, try to force mine a block
      if (this.isLocalDevelopment()) {
        try {
          // Force mine a block using Anvil's RPC method
          await fetch(this.publicClient.transport.url || 'http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'evm_mine',
              params: [],
              id: 1
            })
          });
          console.log('✅ Forced block mine');
          
          // Try again after mining
          return await this.publicClient.waitForTransactionReceipt({ 
            hash,
            timeout: 5_000,
            confirmations: 1
          });
        } catch (mineError) {
          console.error('❌ Failed to force mine:', mineError);
        }
      }
      
      throw error;
    });
    
    console.log('✅ Transaction confirmed:', receipt);
    
    if (!receipt) {
      // If we couldn't get a receipt, return a placeholder QIP number
      console.warn('⚠️ No receipt available, returning transaction hash only');
      return { hash, qipNumber: BigInt(0) };
    }
    
    const log = receipt.logs.find(log => 
      log.address.toLowerCase() === this.contractAddress.toLowerCase()
    );
    
    if (!log) {
      console.warn('⚠️ No event log found in receipt, transaction may still be pending');
      return { hash, qipNumber: BigInt(0) };
    }
    
    // Decode the QIP number from the event
    const qipNumber = BigInt(log.topics[1]!);
    console.log('✅ QIP number decoded:', qipNumber);
    
    return { hash, qipNumber };
  }

  /**
   * Update an existing QIP
   */
  async updateQIP(
    qipNumber: bigint,
    title: string,
    newContentHash: Hash,
    newIpfsUrl: string,
    changeNote: string
  ): Promise<Hash> {
    if (!this.walletClient) throw new Error("Wallet client not set");
    
    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'updateQIP',
      args: [qipNumber, title, newContentHash, newIpfsUrl, changeNote],
      account: this.walletClient.account!
    });
    
    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'updateQIP',
      args: [qipNumber, title, newContentHash, newIpfsUrl, changeNote],
      account: this.walletClient.account!,
      gas: estimatedGas * 120n / 100n // Add 20% buffer
    });

    return await this.walletClient.writeContract(request);
  }

  /**
   * Link a Snapshot proposal to a QIP
   */
  async linkSnapshotProposal(
    qipNumber: bigint,
    snapshotProposalId: string
  ): Promise<Hash> {
    if (!this.walletClient) throw new Error("Wallet client not set");
    
    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'linkSnapshotProposal',
      args: [qipNumber, snapshotProposalId],
      account: this.walletClient.account!
    });
    
    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'linkSnapshotProposal',
      args: [qipNumber, snapshotProposalId],
      account: this.walletClient.account!,
      gas: estimatedGas * 120n / 100n // Add 20% buffer
    });

    return await this.walletClient.writeContract(request);
  }

  /**
   * Calculate content hash for QIP content
   */
  calculateContentHash(content: string): Hash {
    return keccak256(toBytes(content));
  }

  /**
   * Format QIP content for hashing and storage
   */
  formatQIPContent(qipData: QIPContent): string {
    // Create YAML frontmatter
    const frontmatter = `---
qip: ${qipData.qip}
title: ${qipData.title}
network: ${qipData.network}
status: ${qipData.status}
author: ${qipData.author}
implementor: ${qipData.implementor}
implementation-date: ${qipData['implementation-date']}
proposal: ${qipData.proposal}
created: ${qipData.created}
---

${qipData.content}`;
    
    return frontmatter;
  }

  /**
   * Verify QIP content matches on-chain hash
   */
  async verifyContent(qipNumber: bigint, content: string): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'verifyContent',
      args: [qipNumber, content]
    });
    
    return result;
  }

  /**
   * Get QIP details
   */
  async getQIP(qipNumber: bigint): Promise<QIP> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'qips',
      args: [qipNumber]
    });
    
    return {
      qipNumber: result[0],
      author: result[1],
      title: result[2],
      network: result[3],
      contentHash: result[4],
      ipfsUrl: result[5],
      createdAt: result[6],
      lastUpdated: result[7],
      status: result[8] as QIPStatus,
      implementor: result[9],
      implementationDate: result[10],
      snapshotProposalId: result[11],
      version: result[12]
    };
  }

  /**
   * Get QIPs by status
   */
  async getQIPsByStatus(status: QIPStatus): Promise<bigint[]> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: QIP_REGISTRY_ABI,
        functionName: 'getQIPsByStatus',
        args: [status]
      });
      
      // Handle case where result is empty or null
      if (!result || (Array.isArray(result) && result.length === 0)) {
        return [];
      }
      
      return result;
    } catch (error: any) {
      // Handle viem "no data" error which occurs when array is empty
      if (error.message?.includes('returned no data') || error.message?.includes('0x')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get QIPs by author
   */
  async getQIPsByAuthor(author: Address): Promise<bigint[]> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: 'getQIPsByAuthor',
      args: [author]
    });
    
    return result;
  }

  /**
   * Watch for new QIPs
   */
  watchQIPs(callback: (qip: {
    qipNumber: bigint;
    author: Address;
    title: string;
    network: string;
    contentHash: Hash;
    ipfsUrl: string;
  }) => void) {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      eventName: 'QIPCreated',
      onLogs: (logs) => {
        logs.forEach(log => {
          callback({
            qipNumber: BigInt(log.topics[1]!),
            author: log.topics[2] as Address,
            title: log.args.title,
            network: log.args.network,
            contentHash: log.args.contentHash,
            ipfsUrl: log.args.ipfsUrl
          });
        });
      }
    });
  }

  /**
   * Get status string from enum
   */
  getStatusString(status: QIPStatus): string {
    const statusMap = {
      [QIPStatus.Draft]: 'Draft',
      [QIPStatus.ReviewPending]: 'Review',
      [QIPStatus.VotePending]: 'Vote',
      [QIPStatus.Approved]: 'Approved',
      [QIPStatus.Rejected]: 'Rejected',
      [QIPStatus.Implemented]: 'Implemented',
      [QIPStatus.Superseded]: 'Superseded',
      [QIPStatus.Withdrawn]: 'Withdrawn'
    };
    
    return statusMap[status] || 'Unknown';
  }
}