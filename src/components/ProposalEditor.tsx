import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from 'react-router-dom';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { type Address } from 'viem';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { QIPClient, QIPStatus, type QIPContent } from '../services/qipClient';
import { getIPFSService } from '../services/getIPFSService';
import { IPFSService } from '../services/ipfsService';
import { config } from '../config/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChainCombobox } from "./ChainCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TransactionFormatter } from "./TransactionFormatter";
import { type TransactionData, ABIParser } from "../utils/abiParser";
import { Plus, Edit2, Trash2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ProposalEditorProps {
  registryAddress: Address;
  rpcUrl?: string;
  existingQIP?: {
    qipNumber: bigint;
    content: QIPContent;
  };
  initialTitle?: string;
  initialChain?: string;
  initialContent?: string;
  initialImplementor?: string;
}

const NETWORKS = [
  "Ethereum",
  "Base",
  "Polygon PoS",
  "Linea",
  "BNB",
  "Metis",
  "Optimism",
  "Arbitrum",
  "Avalanche",
  "Polygon zkEVM",
  "Gnosis",
  "Kava",
];

export const ProposalEditor: React.FC<ProposalEditorProps> = ({ 
  registryAddress, 
  rpcUrl,
  existingQIP,
  initialTitle,
  initialChain,
  initialContent,
  initialImplementor
}) => {
  const { address, isConnected, chain, status } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const navigate = useNavigate();

  // Track if we've already navigated to prevent multiple navigations
  const hasNavigatedRef = useRef(false);
  
  // Debug logging
  console.log("🔍 ProposalEditor Debug:");
  console.log("- registryAddress:", registryAddress);
  console.log("- Wallet Connection Status:", status);
  console.log("- isConnected:", isConnected);
  console.log("- address:", address);
  console.log("- chain:", chain);
  console.log("- walletClient:", walletClient ? "✅ Available" : "❌ Not available");
  
  // Debug environment variables directly
  console.log("🔍 Direct Env Vars Check:");
  // @ts-ignore
  console.log("- VITE_USE_MAI_API:", import.meta.env?.VITE_USE_MAI_API);
  // @ts-ignore
  console.log("- VITE_IPFS_API_URL:", import.meta.env?.VITE_IPFS_API_URL);
  // @ts-ignore
  console.log("- VITE_USE_LOCAL_IPFS:", import.meta.env?.VITE_USE_LOCAL_IPFS);
  
  // Check if we need to switch chains
  const isWrongChain = chain && chain.id !== 8453;
  
  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: 8453 });
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };
  
  // Form state - prioritize existingQIP over initial props
  const [title, setTitle] = useState(existingQIP?.content.title || initialTitle || '');
  const [combooxSelectedChain, setComboboxSelectedChain] = useState(existingQIP?.content.chain || initialChain || "Polygon");
  const [content, setContent] = useState(existingQIP?.content.content || initialContent || '');
  const [implementor, setImplementor] = useState(existingQIP?.content.implementor || initialImplementor || 'None');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);
  
  // Services
  const [qipClient, setQipClient] = useState<QIPClient | null>(null);
  const [ipfsService, setIpfsService] = useState<IPFSService | null>(null);
  const queryClient = useQueryClient();

  // Debug saving state changes
  useEffect(() => {
    console.log("🔍 Saving state changed:", saving);
  }, [saving]);

  // Add a safety timeout to clear saving state if it gets stuck
  useEffect(() => {
    if (saving) {
      const timeout = setTimeout(() => {
        console.warn("⚠️ Saving state stuck for 30 seconds, forcing clear");
        setSaving(false);
        if (!success && !error) {
          setError("Operation timed out. Please check if your transaction was successful.");
        }
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [saving, success, error]);

  useEffect(() => {
    if (registryAddress) {
      console.log("🔧 Initializing QIPClient with RPC:", rpcUrl || config.baseRpcUrl);
      const client = new QIPClient(registryAddress, rpcUrl || config.baseRpcUrl);
      setQipClient(client);
    }

    // Use centralized IPFS service selection
    try {
      const service = getIPFSService();
      setIpfsService(service);
      console.log("✅ IPFS service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize IPFS service:", error);
      // Service will remain null, and the component will show the error state
    }
  }, [registryAddress, walletClient, rpcUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      console.log("📝 Form submission started");

      // Reset navigation flag for new submission
      hasNavigatedRef.current = false;

      if (!qipClient || !ipfsService || !address || !walletClient) {
        setError("Please connect your wallet");
        console.error("❌ Missing required services:", { qipClient: !!qipClient, ipfsService: !!ipfsService, address });
        return;
      }

      setError(null);
      setSuccess(null);
      setSaving(true);
      console.log("🔄 Saving state set to true");

      try {
        // Create QIP content object
        // For existing QIPs, preserve certain blockchain fields (source of truth)
        const qipContent: QIPContent = {
          qip: existingQIP?.qipNumber ? Number(existingQIP.qipNumber) : 0, // Will be assigned by contract
          title,
          chain: combooxSelectedChain, // Allow updating in IPFS content
          // Preserve critical blockchain fields for existing QIPs
          status: existingQIP ? existingQIP.content.status : "Draft",
          author: existingQIP ? existingQIP.content.author : address, // Always preserve original author
          implementor, // Allow updating in IPFS content
          "implementation-date": existingQIP ? existingQIP.content["implementation-date"] : "None",
          proposal: existingQIP ? existingQIP.content.proposal : "None",
          created: existingQIP ? existingQIP.content.created : new Date().toISOString().split("T")[0], // Preserve original creation date
          content,
          transactions: transactions.length > 0 ? transactions.map((tx) => ABIParser.formatTransaction(tx)) : undefined,
        };

        console.log("📝 QIP Content being saved:", {
          ...qipContent,
          transactionCount: transactions.length,
          hasTransactions: !!qipContent.transactions,
          transactions: qipContent.transactions,
        });

        // Format the full content for IPFS
        const fullContent = ipfsService.formatQIPContent(qipContent);

        console.log("📄 Formatted content preview (first 500 chars):", fullContent.substring(0, 500));
        console.log("📄 Full content includes transactions section:", fullContent.includes("## Transactions"));

        // Step 1: Pre-calculate IPFS CID without uploading
        console.log("🔮 Calculating IPFS CID...");
        const expectedCID = await ipfsService.calculateCID(fullContent);
        const expectedIpfsUrl = `ipfs://${expectedCID}`;
        console.log("✅ Expected CID:", expectedCID);

        // Step 2: Calculate content hash for blockchain
        const contentHash = ipfsService.calculateContentHash(qipContent);

        let qipNumber: bigint;
        let txHash: string;

        if (existingQIP) {
          // Update existing QIP
          console.log("📝 Updating QIP on blockchain...");
          txHash = await qipClient.updateQIP({
            walletClient,
            qipNumber: existingQIP.qipNumber,
            title,
            chain: combooxSelectedChain,
            implementor,
            newContentHash: contentHash,
            newIpfsUrl: expectedIpfsUrl,
            changeNote: "Updated via web interface",
          });
          qipNumber = existingQIP.qipNumber;
          console.log("✅ Blockchain update successful:", txHash);
        } else {
          // Create new QIP
          console.log("🚀 Creating new QIP on blockchain...");
          const result = await qipClient.createQIP(walletClient, title, combooxSelectedChain, contentHash, expectedIpfsUrl);
          txHash = result.hash;
          qipNumber = result.qipNumber;
          console.log("✅ QIP created on blockchain:", { txHash, qipNumber });
        }

        // Step 3: Upload to IPFS with proper metadata AFTER blockchain confirmation
        console.log("📤 Uploading to IPFS with metadata...");
        const actualCID = await ipfsService.provider.upload(fullContent, {
          qipNumber: qipNumber > 0 ? qipNumber.toString() : "pending",
          groupId: config.pinataGroupId,
        });

        // Verify CIDs match
        if (actualCID !== expectedCID) {
          console.warn("⚠️ CID mismatch! Expected:", expectedCID, "Actual:", actualCID);
          // In production, you might want to handle this more gracefully
        } else {
          console.log("✅ IPFS upload successful, CID matches:", actualCID);
        }

        // Invalidate caches immediately after successful update
        if (existingQIP) {
          // Invalidate all related caches for the updated QIP
          const qipNum = Number(qipNumber);

          // Get current data to find IPFS URL
          const currentData = queryClient.getQueryData<any>(["qip", qipNum, registryAddress]);

          // Invalidate QIP query
          queryClient.invalidateQueries({
            queryKey: ["qip", qipNum, registryAddress],
          });

          // Invalidate blockchain cache
          queryClient.invalidateQueries({
            queryKey: ["qip-blockchain", qipNum, registryAddress],
          });

          // Invalidate old IPFS content if exists
          if (currentData?.ipfsUrl) {
            queryClient.invalidateQueries({
              queryKey: ["ipfs", currentData.ipfsUrl],
            });
          }

          // Also invalidate the new IPFS URL
          queryClient.invalidateQueries({
            queryKey: ["ipfs", `ipfs://${actualCID}`],
          });
        }

        // Invalidate list to refresh AllProposals
        queryClient.invalidateQueries({ queryKey: ["qips"] });

        // Show success toast and navigate (prevent multiple navigations)
        if (!hasNavigatedRef.current) {
          if (existingQIP) {
            toast.success(`QIP-${qipNumber} updated successfully!`);
            // Mark as navigated before actually navigating
            hasNavigatedRef.current = true;
            // Navigate back to the QIP detail page with transaction hash
            // Include timestamp to ensure fresh data fetch
            navigate(`/qips/${qipNumber}`, {
              state: {
                txHash,
                justUpdated: true,
                timestamp: Date.now(), // Force refresh with timestamp
              },
            });
          } else {
            // For new QIP, show success and reset form
            if (qipNumber > 0) {
              toast.success(`QIP-${qipNumber} created successfully!`);
              // Mark as navigated before actually navigating
              hasNavigatedRef.current = true;
              // Navigate to the new QIP page
              navigate(`/qips/${qipNumber}`, {
                state: {
                  txHash,
                  justCreated: true,
                  timestamp: Date.now(), // Force refresh with timestamp
                },
              });
            } else {
              toast.success(`QIP submitted! Check transaction for QIP number.`);
              setSuccess(`Transaction: ${txHash}`);
            }
          }
        }

        // Reset form only for new QIPs that don't redirect
        if (!existingQIP && qipNumber === 0n) {
          console.log("🔄 Resetting form...");
          setTitle("");
          setContent("");
          setImplementor("None");
          console.log("✅ Form reset complete");
        }
      } catch (err: any) {
        console.error("❌ Error saving QIP:", err);

        // Provide more helpful error messages
        let errorMessage = err.message || "Failed to save QIP";

        if (errorMessage.includes("Content already exists")) {
          errorMessage = "A QIP with identical content already exists. Please modify your proposal content to make it unique.";
        }

        setError(errorMessage);
      } finally {
        console.log("🔄 Setting saving state to false in finally block");
        setSaving(false);
        console.log("✅ Saving state set to false");
      }
    },
    [qipClient, ipfsService, address, walletClient, title, combooxSelectedChain, content, implementor, existingQIP, transactions]
  );

  const handlePreview = () => {
    setPreview(!preview);
  };

  const handleAddTransaction = (transaction: TransactionData) => {
    if (editingTransactionIndex !== null) {
      const updated = [...transactions];
      updated[editingTransactionIndex] = transaction;
      setTransactions(updated);
      setEditingTransactionIndex(null);
    } else {
      setTransactions([...transactions, transaction]);
    }
  };

  const handleEditTransaction = (index: number) => {
    setEditingTransactionIndex(index);
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index));
  };

  if (!isConnected) {
    return (
      <Alert className="border-yellow-400 bg-yellow-500/10">
        <AlertDescription className="text-yellow-700 dark:text-yellow-400">
          Please connect your wallet to create or edit QIPs
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!registryAddress) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error: Registry address not configured. Please restart Gatsby to load environment variables.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!ipfsService) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error: IPFS provider not configured. Please check your environment configuration.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (isWrongChain) {
    return (
      <Alert className="border-yellow-400 bg-yellow-500/10">
        <AlertDescription className="text-yellow-700 dark:text-yellow-400">
          <p className="mb-2">Please switch to Local Base Fork network (Chain ID: 8453)</p>
          <Button 
            onClick={handleSwitchChain}
            variant="default"
          >
            Switch to Local Base Fork
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">{existingQIP ? `Edit QIP-${existingQIP.qipNumber}` : "Create New QIP"}</h2>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-400 bg-green-100 text-green-700">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Improve QiDAO Collateral Framework"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chain">Chain *</Label>
          <ChainCombobox value={combooxSelectedChain} onChange={setComboboxSelectedChain} placeholder="Select or type a chain..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="implementor">Implementor</Label>
          <Input
            type="text"
            id="implementor"
            value={implementor}
            onChange={(e) => setImplementor(e.target.value)}
            placeholder="Dev team, DAO, or None"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Proposal Content (Markdown) *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={20}
            className="font-mono text-sm"
            placeholder={`## Summary

Brief overview of your proposal...

## Abstract

Detailed explanation...

## Rationale

Why this proposal is needed...

## Technical Specification

Implementation details...`}
          />
        </div>

        {/* Transactions Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Transactions</Label>
            <Button
              type="button"
              onClick={() => {
                setEditingTransactionIndex(null);
                setShowTransactionModal(true);
              }}
              variant="outline"
              size="sm"
            >
              <Plus size={16} />
              Add Transaction
            </Button>
          </div>

          {transactions.length > 0 ? (
            <div className="space-y-2 mb-4">
              {transactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex-1">
                    <code className="text-sm font-mono break-all">{ABIParser.formatTransaction(tx)}</code>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button type="button" onClick={() => handleEditTransaction(index)} variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 size={16} className="text-muted-foreground" />
                    </Button>
                    <Button type="button" onClick={() => handleDeleteTransaction(index)} variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              No transactions added. Click "Add Transaction" to include on-chain transactions with this proposal.
            </p>
          )}
        </div>

        <div className="flex space-x-4">
          <Button type="submit" disabled={saving} variant="gradient-primary" size="lg">
            {saving ? "Saving..." : existingQIP ? "Update QIP" : "Create QIP"}
          </Button>

          <Button type="button" onClick={handlePreview} variant="outline" size="lg">
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>
      </form>

      {preview && (
        <div className="mt-8 border-t pt-8">
          <h3 className="text-xl font-bold mb-4">Preview</h3>
          <div className="bg-muted/30 dark:bg-zinc-800/50 p-6 rounded-lg">
            <h1 className="text-2xl font-bold mb-2">{title || "Untitled"}</h1>
            <div className="text-sm text-muted-foreground mb-4">
              <span>Chain: {combooxSelectedChain}</span> •<span> Author: {address}</span> •<span> Status: Draft</span>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>

            {/* Show transactions in preview */}
            {transactions.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border">
                <h2 className="text-xl font-bold mb-4">Transactions</h2>
                <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">
                    {JSON.stringify(
                      transactions.map((tx) => {
                        const formatted = ABIParser.formatTransaction(tx);
                        try {
                          return JSON.parse(formatted);
                        } catch {
                          return formatted;
                        }
                      }),
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Formatter Modal */}
      <TransactionFormatter
        isOpen={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setEditingTransactionIndex(null);
        }}
        onAdd={handleAddTransaction}
        networks={NETWORKS}
        editingTransaction={editingTransactionIndex !== null ? transactions[editingTransactionIndex] : undefined}
      />
    </div>
  );
};