import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Hash, keccak256, toBytes, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { loadBalance, getRPCEndpoints } from '../utils/loadBalance';
import { QIPRegistryABI } from "../config/abis/QIPRegistry";

// Use the full ABI from the JSON file
const QIP_REGISTRY_ABI = QIPRegistryABI;

// Status enum - only three statuses supported
export enum QIPStatus {
  Draft = 0,
  ReadyForSnapshot = 1,
  PostedToSnapshot = 2,
}

// Map bytes32 status hashes to enum values
const STATUS_HASH_TO_ENUM: Record<string, QIPStatus> = {
  // keccak256("Draft")
  "0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382": QIPStatus.Draft,
  // keccak256("Ready for Snapshot")
  "0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb": QIPStatus.ReadyForSnapshot,
  // keccak256("Posted to Snapshot")
  "0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c": QIPStatus.PostedToSnapshot,
};

// Default status IDs (initialized in contract constructor)
export const DEFAULT_STATUSES = {
  Draft: 0,
  ReadyForSnapshot: 1,
  PostedToSnapshot: 2,
} as const;

export interface QIPContent {
  qip: number;
  title: string;
  chain: string;
  status: string;
  author: string;
  implementor: string;
  "implementation-date": string;
  proposal: string;
  created: string;
  content: string; // Full markdown content
  transactions?: string[]; // Optional array of formatted transaction strings
}

export interface QIP {
  qipNumber: bigint;
  author: Address;
  title: string;
  chain: string;
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
  private contractAddress: Address;
  private statusNamesCache: Map<number, string> | null = null;

  constructor(contractAddress: Address, rpcUrl?: string, testnet: boolean = false) {
    console.log("🔧 QIPClient Debug:");
    console.log("- contractAddress:", contractAddress);
    console.log("- rpcUrl:", rpcUrl);
    console.log("- testnet:", testnet);

    this.contractAddress = contractAddress;

    // For local development, use a custom chain configuration
    const chain =
      rpcUrl?.includes("localhost") || rpcUrl?.includes("127.0.0.1")
        ? {
            ...base,
            id: 8453, // Base chain ID
            name: "Local Base Fork",
            rpcUrls: {
              default: { http: [rpcUrl || "http://localhost:8545"] },
              public: { http: [rpcUrl || "http://localhost:8545"] },
            },
          }
        : testnet
        ? baseSepolia
        : base;

    console.log("- Using chain:", chain.name, "with ID:", chain.id);

    // Create load balanced transport with multiple RPC endpoints
    // Always use multiple endpoints for load balancing, even if one is provided
    const rpcEndpoints = getRPCEndpoints();
    console.log(`- Using ${rpcEndpoints.length} RPC endpoints with load balancing`);
    console.log(`- RPC endpoints:`, rpcEndpoints.slice(0, 3).join(", "), "...");

    const transport = rpcEndpoints.length > 1 ? loadBalance(rpcEndpoints.map((url) => http(url))) : http(rpcEndpoints[0]);

    this.publicClient = createPublicClient({
      chain,
      transport,
      batch: {
        multicall: {
          batchSize: 3, // Further reduced to avoid rate limits
          wait: 50, // Increased wait time to batch requests
        },
      },
      pollingInterval: 4_000, // Poll every 4 seconds
    }) as any;

    console.log("- PublicClient created:", !!this.publicClient);
  }

  /**
   * Get the load-balanced public client for external use
   */
  public getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * Check if running in local development
   */
  private isLocalDevelopment(): boolean {
    const transport = this.publicClient.transport;
    const url = transport.url || "";
    return url.includes("localhost") || url.includes("127.0.0.1");
  }

  /**
   * Create a new QIP
   */
  async createQIP(
    walletClient: WalletClient,
    title: string,
    chain: string,
    contentHash: Hash,
    ipfsUrl: string
  ): Promise<{ hash: Hash; qipNumber: bigint }> {
    if (!walletClient?.account) throw new Error("Wallet client with account required");

    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "createQIP",
      args: [title, chain, contentHash, ipfsUrl],
      account: walletClient.account,
    });

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "createQIP",
      args: [title, chain, contentHash, ipfsUrl],
      account: walletClient.account,
      gas: (estimatedGas * 120n) / 100n, // Add 20% buffer
    });

    console.log("📝 Writing contract transaction...");
    const hash = await walletClient.writeContract(request);
    console.log("✅ Transaction submitted:", hash);

    // Wait for transaction and get QIP number from logs
    console.log("⏳ Waiting for transaction receipt...");

    // Add timeout for local development (Anvil sometimes doesn't auto-mine)
    const receipt = await this.publicClient
      .waitForTransactionReceipt({
        hash,
        timeout: 20_000, // 20 second timeout
        pollingInterval: 1_000, // Poll every second
        confirmations: 1,
      })
      .catch(async (error) => {
        console.warn("⚠️ Receipt timeout, attempting to force mine...");

        // For local development, try to force mine a block
        if (this.isLocalDevelopment()) {
          try {
            // Force mine a block using Anvil's RPC method
            await fetch(this.publicClient.transport.url || "http://localhost:8545", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "evm_mine",
                params: [],
                id: 1,
              }),
            });
            console.log("✅ Forced block mine");

            // Try again after mining
            return await this.publicClient.waitForTransactionReceipt({
              hash,
              timeout: 5_000,
              confirmations: 1,
            });
          } catch (mineError) {
            console.error("❌ Failed to force mine:", mineError);
          }
        }

        throw error;
      });

    console.log("✅ Transaction confirmed:", receipt);

    if (!receipt) {
      // If we couldn't get a receipt, return a placeholder QIP number
      console.warn("⚠️ No receipt available, returning transaction hash only");
      return { hash, qipNumber: BigInt(0) };
    }

    const log = receipt.logs.find((log) => log.address.toLowerCase() === this.contractAddress.toLowerCase());

    if (!log) {
      console.warn("⚠️ No event log found in receipt, transaction may still be pending");
      return { hash, qipNumber: BigInt(0) };
    }

    // Decode the QIP number from the event
    const qipNumber = BigInt(log.topics[1]!);
    console.log("✅ QIP number decoded:", qipNumber);

    return { hash, qipNumber };
  }

  /**
   * Update an existing QIP
   */
  async updateQIP({
    walletClient,
    qipNumber,
    title,
    chain,
    implementor,
    newContentHash,
    newIpfsUrl,
    changeNote,
  }: {
    walletClient: WalletClient;
    qipNumber: bigint;
    title: string;
    chain: string;
    implementor: string;
    newContentHash: Hash;
    newIpfsUrl: string;
    changeNote: string;
  }): Promise<Hash> {
    if (!walletClient?.account) throw new Error("Wallet client with account required");

    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "updateQIP",
      args: [qipNumber, title, chain, implementor, newContentHash, newIpfsUrl, changeNote],
      account: walletClient.account,
    });

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "updateQIP",
      args: [qipNumber, title, chain, implementor, newContentHash, newIpfsUrl, changeNote],
      account: walletClient.account,
      gas: (estimatedGas * 120n) / 100n, // Add 20% buffer
    });

    return await walletClient.writeContract(request);
  }

  /**
   * Link a Snapshot proposal to a QIP
   */
  async linkSnapshotProposal(walletClient: WalletClient, qipNumber: bigint, snapshotProposalId: string): Promise<Hash> {
    if (!walletClient?.account) throw new Error("Wallet client with account required");

    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "linkSnapshotProposal",
      args: [qipNumber, snapshotProposalId],
      account: walletClient.account,
    });

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "linkSnapshotProposal",
      args: [qipNumber, snapshotProposalId],
      account: walletClient.account,
      gas: (estimatedGas * 120n) / 100n, // Add 20% buffer
    });

    return await walletClient.writeContract(request);
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
    let frontmatter = `---
qip: ${qipData.qip}
title: ${qipData.title}
chain: ${qipData.chain}
status: ${qipData.status}
author: ${qipData.author}
implementor: ${qipData.implementor}
implementation-date: ${qipData["implementation-date"]}
proposal: ${qipData.proposal}
created: ${qipData.created}
---

${qipData.content}`;

    // Append transactions if they exist
    if (qipData.transactions && qipData.transactions.length > 0) {
      frontmatter += "\n\n## Transactions\n\n";
      frontmatter += "```json\n";

      // Convert all transactions to proper JSON format
      const jsonTransactions = qipData.transactions
        .map((tx) => {
          if (typeof tx === "string") {
            // Try to parse if it's already JSON
            try {
              return JSON.parse(tx);
            } catch {
              // Legacy format or plain string, skip for now
              return null;
            }
          } else if (typeof tx === "object") {
            return tx;
          }
          return null;
        })
        .filter((tx) => tx !== null);

      // Format as JSON array
      frontmatter += JSON.stringify(jsonTransactions, null, 2);
      frontmatter += "\n```\n";
    }

    return frontmatter;
  }

  /**
   * Verify QIP content matches on-chain hash
   */
  async verifyContent(qipNumber: bigint, content: string): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "verifyContent",
      args: [qipNumber, content],
    });

    return result;
  }

  /**
   * Get QIP details
   */
  async getQIP(qipNumber: bigint): Promise<QIP> {
    console.log(`[QIPClient] Fetching QIP ${qipNumber} from blockchain at ${this.contractAddress}`);
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "qips",
      args: [qipNumber],
    })) as any;

    // Status may come as bytes32 hash or uint8 depending on contract version
    const statusValue = result[8];
    console.log(`[QIPClient] QIP ${qipNumber} status value from blockchain:`, statusValue);

    // Convert status to enum
    let status: QIPStatus;
    if (typeof statusValue === "string" && statusValue.startsWith("0x")) {
      // It's a bytes32 hash, convert to enum
      status = this.convertStatusHashToEnum(statusValue);
    } else if (typeof statusValue === "number") {
      // It's already a number
      status = statusValue as QIPStatus;
    } else {
      // Fallback to Draft
      console.warn(`[QIPClient] Unknown status format for QIP ${qipNumber}:`, statusValue);
      status = QIPStatus.Draft;
    }
    console.log(`[QIPClient] QIP ${qipNumber} status enum:`, status, QIPStatus[status]);

    return {
      qipNumber: result[0],
      author: result[1],
      title: result[2],
      chain: result[3],
      contentHash: result[4],
      ipfsUrl: result[5],
      createdAt: result[6],
      lastUpdated: result[7],
      status: status,
      implementor: result[9],
      implementationDate: result[10],
      snapshotProposalId: result[11],
      version: result[12],
    };
  }

  /**
   * Get the next QIP number (highest QIP + 1)
   */
  async getNextQIPNumber(): Promise<bigint> {
    const result = await (this.publicClient as any).readContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "nextQIPNumber",
    });

    return result as bigint;
  }

  /**
   * Get multiple QIPs using multicall for efficiency
   */
  async getQIPsBatch(qipNumbers: bigint[]): Promise<QIP[]> {
    if (qipNumbers.length === 0) return [];

    // Limit batch size to avoid gas limits and rate limits
    const MAX_BATCH_SIZE = 3; // Reduced to avoid rate limits

    if (qipNumbers.length > MAX_BATCH_SIZE) {
      // Split into smaller batches if needed
      const results: QIP[] = [];
      for (let i = 0; i < qipNumbers.length; i += MAX_BATCH_SIZE) {
        const batch = qipNumbers.slice(i, Math.min(i + MAX_BATCH_SIZE, qipNumbers.length));

        // Add small delay between recursive calls to avoid rate limits
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const batchResults = await this.getQIPsBatch(batch);
        results.push(...batchResults);
      }
      return results;
    }

    // Create contract calls for multicall
    const calls = qipNumbers.map((qipNumber) => ({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "qips",
      args: [qipNumber],
      // gas removed - not supported in multicall parameters
    }));

    try {
      // Use multicall to batch all requests into a single RPC call
      const results = await this.publicClient.multicall({
        contracts: calls,
        allowFailure: true, // Allow individual calls to fail without failing the entire batch
        // gas removed - not supported in multicall parameters
      });

      const qips: QIP[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i] as any;
        if (result.status === "success" && result.result) {
          const data = result.result as any;
          // Only include QIPs that actually exist (qipNumber > 0)
          if (data[0] > 0n) {
            // The contract is actually returning bytes32 hash for status, not uint8!
            let status: QIPStatus;

            // data[8] could be a bigint, string, or already converted to number
            // We need to handle the bytes32 hash properly
            let statusValue = data[8];

            // If it's already a bigint, convert to hex
            if (typeof statusValue === "bigint") {
              const statusHex = "0x" + statusValue.toString(16).padStart(64, "0");

              // Map known status hashes to enum values
              if (statusHex === "0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c") {
                status = QIPStatus.PostedToSnapshot; // 2
              } else if (statusHex === "0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb") {
                status = QIPStatus.ReadyForSnapshot; // 1
              } else if (statusHex === "0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382") {
                status = QIPStatus.Draft; // 0
              } else {
                status = QIPStatus.Draft; // Default to Draft
              }
            }
            // If it's a string (hex), convert directly
            else if (typeof statusValue === "string" && statusValue.startsWith("0x")) {
              const statusHex = statusValue.toLowerCase();

              if (statusHex === "0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c") {
                status = QIPStatus.PostedToSnapshot; // 2
              } else if (statusHex === "0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb") {
                status = QIPStatus.ReadyForSnapshot; // 1
              } else if (statusHex === "0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382") {
                status = QIPStatus.Draft; // 0
              } else {
                status = QIPStatus.Draft; // Default to Draft
              }
            }
            // If it's a small number (0, 1, 2), it's already the correct enum value
            else if (typeof statusValue === "number" && statusValue <= 2) {
              status = statusValue as QIPStatus;
            }
            // Otherwise something went wrong - it's been converted to a large number
            else {
              // Handle scientific notation by converting to string
              const strValue = String(statusValue);

              // Match based on the string representation of scientific notation
              if (strValue.includes("3.557884566192312e+76")) {
                status = QIPStatus.PostedToSnapshot; // This is the most common in migration
              } else if (strValue.includes("8.683815104298986e+76")) {
                status = QIPStatus.Draft;
              } else if (strValue.includes("5.069118969180783e+76")) {
                // This is the Ready for Snapshot hash in scientific notation
                status = QIPStatus.ReadyForSnapshot;
              } else {
                // Default based on QIP number range from migration
                const qipNum = Number(data[0]);
                if (qipNum >= 246) {
                  status = QIPStatus.Draft; // QIPs 246-247 are Draft
                } else {
                  status = QIPStatus.PostedToSnapshot; // QIPs 209-245 are Posted
                }
              }
            }

            qips.push({
              qipNumber: data[0],
              author: data[1],
              title: data[2],
              chain: data[3],
              contentHash: data[4],
              ipfsUrl: data[5],
              createdAt: data[6],
              lastUpdated: data[7],
              status: status,
              implementor: data[9],
              implementationDate: data[10],
              snapshotProposalId: data[11],
              version: data[12],
            });
          }
        }
      }

      return qips;
    } catch (error) {
      console.error("Error in multicall batch:", error);
      // Fallback to individual calls if multicall fails
      const qips: QIP[] = [];
      for (const qipNumber of qipNumbers) {
        try {
          const qip = await this.getQIP(qipNumber);
          qips.push(qip);
        } catch (e) {
          console.error(`Failed to fetch QIP ${qipNumber}:`, e);
        }
      }
      return qips;
    }
  }

  /**
   * Get all QIPs by status using multicall for efficiency
   */
  async getAllQIPsByStatusBatch(): Promise<Map<QIPStatus, bigint[]>> {
    // Only use the 3 actual statuses from the contract
    const statuses: QIPStatus[] = [QIPStatus.Draft, QIPStatus.ReadyForSnapshot, QIPStatus.PostedToSnapshot];

    // Split status queries into smaller batches to avoid gas limits
    const BATCH_SIZE = 4; // Each getQIPsByStatus can return many items, so keep batch small
    const statusMap = new Map<QIPStatus, bigint[]>();

    for (let i = 0; i < statuses.length; i += BATCH_SIZE) {
      const batchStatuses = statuses.slice(i, Math.min(i + BATCH_SIZE, statuses.length));

      // Create calls for this batch of statuses
      const calls = batchStatuses.map((status) => ({
        address: this.contractAddress,
        abi: QIP_REGISTRY_ABI,
        functionName: "getQIPsByStatus",
        args: [status], // Status is already a number (QIPStatus enum value)
        // gas removed - not supported in multicall parameters
      }));

      try {
        // Batch status queries with gas limit
        const results = await this.publicClient.multicall({
          contracts: calls,
          allowFailure: true,
          // gas removed - not supported in multicall parameters
        });

        for (let j = 0; j < results.length; j++) {
          const result = results[j] as any;
          const status = batchStatuses[j];

          if (result.status === "success" && result.result) {
            statusMap.set(status, result.result as bigint[]);
          } else {
            statusMap.set(status, []);
          }
        }
      } catch (error) {
        console.error("Error in status multicall batch:", error);
        // Fallback to individual calls for this batch
        for (const status of batchStatuses) {
          try {
            const qips = await this.getQIPsByStatus(status);
            statusMap.set(status, qips);
          } catch (e) {
            statusMap.set(status, []);
          }
        }
      }
    }

    return statusMap;
  }

  /**
   * Get QIPs by status
   */
  async getQIPsByStatus(status: QIPStatus | string): Promise<bigint[]> {
    try {
      // Convert to numeric status value
      let statusValue: number;
      if (typeof status === "string") {
        const statusMap: Record<string, number> = {
          Draft: QIPStatus.Draft,
          "Ready for Snapshot": QIPStatus.ReadyForSnapshot,
          "Posted to Snapshot": QIPStatus.PostedToSnapshot,
        };
        statusValue = statusMap[status] ?? QIPStatus.Draft;
      } else {
        statusValue = status;
      }

      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: QIP_REGISTRY_ABI,
        functionName: "getQIPsByStatus",
        args: [statusValue.toString()],
      });

      // Handle case where result is empty or null
      if (!result || (Array.isArray(result) && result.length === 0)) {
        return [];
      }

      return result as bigint[];
    } catch (error: any) {
      // Handle viem "no data" error which occurs when array is empty
      if (error.message?.includes("returned no data") || error.message?.includes("0x")) {
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
      functionName: "getQIPsByAuthor",
      args: [author],
    });

    return result as bigint[];
  }

  /**
   * Watch for new QIPs
   */
  watchQIPs(
    callback: (qip: { qipNumber: bigint; author: Address; title: string; chain: string; contentHash: Hash; ipfsUrl: string }) => void
  ) {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      eventName: "QIPCreated",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const args = log.args as any;
          callback({
            qipNumber: BigInt(log.topics[1]!),
            author: log.topics[2] as Address,
            title: args?.title || "",
            chain: args?.chain || "",
            contentHash: args?.contentHash || "0x",
            ipfsUrl: args?.ipfsUrl || "",
          });
        });
      },
    });
  }

  /**
   * Fetch all statuses from contract
   */
  async fetchAllStatuses(): Promise<{ hashes: string[]; names: string[] }> {
    // Since we have fixed statuses with uint8 values, just return them directly
    return {
      hashes: ["0", "1", "2"], // Using status values as "hashes" for compatibility
      names: ["Draft", "Ready for Snapshot", "Posted to Snapshot"],
    };
  }

  /**
   * Convert bytes32 hash to readable status name
   */
  private getStatusStringFromHash(statusHash: string): string {
    // Map of known status hashes to their names
    const hashToName: Record<string, string> = {
      "0xbffca6d7a13b72cfdfdf4a97d0ffb89fac6c686a62ced4a04137794363a3e382": "Draft",
      "0x7070e08f253402b7697ed999df8646627439945a954330fcee1b731dac30d7fb": "Ready for Snapshot",
      "0x4ea8e9bba2b921001f72db15ceea1abf86759499f1e2f63f81995578937fc34c": "Posted to Snapshot",
    };

    return hashToName[statusHash.toLowerCase()] || "Unknown Status";
  }

  /**
   * Convert bytes32 status hash to enum value
   */
  private convertStatusHashToEnum(statusHash: string | number): QIPStatus {
    // Handle if it's already a number (for compatibility)
    if (typeof statusHash === "number") {
      return statusHash as QIPStatus;
    }

    // Convert bytes32 hash to enum
    const enumValue = STATUS_HASH_TO_ENUM[statusHash.toLowerCase()];
    if (enumValue !== undefined) {
      return enumValue;
    }

    // Default to Draft if unknown
    console.warn("[convertStatusHashToEnum] Unknown status hash:", statusHash);
    return QIPStatus.Draft;
  }

  /**
   * Get status string from ID (synchronous - uses predefined mappings)
   */
  getStatusString(status: QIPStatus | string): string {
    // If it's a string (bytes32 hash), convert to enum first
    if (typeof status === "string") {
      status = this.convertStatusHashToEnum(status);
    }

    const statusMap: Record<number, string> = {
      [QIPStatus.Draft]: "Draft",
      [QIPStatus.ReadyForSnapshot]: "Ready for Snapshot",
      [QIPStatus.PostedToSnapshot]: "Posted to Snapshot",
    };

    return statusMap[status] || "Unknown";
  }

  /**
   * Helper method to create QIP from QIPContent
   */
  async createQIPFromContent(
    walletClient: WalletClient,
    content: QIPContent,
    ipfsUrl: string
  ): Promise<{ qipNumber: bigint; transactionHash: string }> {
    const contentHash = keccak256(toBytes(content.content));
    const result = await this.createQIP(walletClient, content.title, content.chain, contentHash, ipfsUrl);

    return {
      qipNumber: result.qipNumber,
      transactionHash: result.hash,
    };
  }

  /**
   * Helper method to update QIP from QIPContent
   */
  async updateQIPFromContent(
    walletClient: WalletClient,
    qipNumber: bigint,
    content: QIPContent,
    ipfsUrl: string
  ): Promise<{ version: bigint; transactionHash: string }> {
    const contentHash = keccak256(toBytes(content.content));
    const hash = await this.updateQIP({
      walletClient,
      qipNumber,
      title: content.title,
      chain: content.chain,
      implementor: content.implementor,
      newContentHash: contentHash,
      newIpfsUrl: ipfsUrl,
      changeNote: "Updated via QIP Editor",
    });

    // Get the updated QIP to return the new version
    const updatedQIP = await this.getQIP(qipNumber);

    return {
      version: updatedQIP.version,
      transactionHash: hash,
    };
  }

  /**
   * Update QIP status
   */
  async updateQIPStatus(walletClient: WalletClient, qipNumber: bigint, newStatus: QIPStatus | string): Promise<Hash> {
    if (!walletClient?.account) throw new Error("Wallet client with account required");

    // Convert enum to string status name if needed
    let statusString: string;
    if (typeof newStatus === "string") {
      // Already a string, use as-is
      statusString = newStatus;
    } else {
      // Convert enum value to status string
      const statusNames: Record<number, string> = {
        [QIPStatus.Draft]: "Draft",
        [QIPStatus.ReadyForSnapshot]: "Ready for Snapshot",
        [QIPStatus.PostedToSnapshot]: "Posted to Snapshot",
      };
      statusString = statusNames[newStatus] ?? "Draft";
    }

    // First estimate gas
    const estimatedGas = await this.publicClient.estimateContractGas({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "updateStatus",
      args: [qipNumber, statusString], // Pass the status string, not the enum value
      account: walletClient.account,
    });

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: QIP_REGISTRY_ABI,
      functionName: "updateStatus",
      args: [qipNumber, statusString], // Pass the status string, not the enum value
      account: walletClient.account,
      gas: (estimatedGas * 120n) / 100n, // Add 20% buffer
    });

    return await walletClient.writeContract(request);
  }
}