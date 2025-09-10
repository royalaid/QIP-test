import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { type Address } from 'viem';
import { QIPClient, QIPStatus, type QIPContent } from '../services/qipClient';
import { getIPFSService } from '../services/getIPFSService';
import { IPFSService } from '../services/ipfsService';
import { config } from '../config/env';
import { GradientButton } from '@/components/gradient-button';
import { TransactionFormatter } from './TransactionFormatter';
import { type TransactionData, ABIParser } from '../utils/abiParser';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface ProposalEditorProps {
  registryAddress: Address;
  rpcUrl?: string;
  existingQIP?: {
    qipNumber: bigint;
    content: QIPContent;
  };
  initialTitle?: string;
  initialNetwork?: string;
  initialContent?: string;
  initialImplementor?: string;
}

const NETWORKS = ['Polygon', 'Ethereum', 'Base', 'Metis', 'Arbitrum', 'Optimism', 'BSC', 'Avalanche'];

export const ProposalEditor: React.FC<ProposalEditorProps> = ({ 
  registryAddress, 
  rpcUrl,
  existingQIP,
  initialTitle,
  initialNetwork,
  initialContent,
  initialImplementor
}) => {
  const { address, isConnected, chain, status } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  
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
  const [network, setNetwork] = useState(existingQIP?.content.network || initialNetwork || 'Polygon');
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
        const qipContent: QIPContent = {
          qip: existingQIP?.qipNumber ? Number(existingQIP.qipNumber) : 0, // Will be assigned by contract
          title,
          network,
          status: "Draft",
          author: address,
          implementor,
          "implementation-date": "None",
          proposal: "None",
          created: new Date().toISOString().split("T")[0],
          content,
          transactions: transactions.length > 0 ? transactions.map(tx => ABIParser.formatTransaction(tx)) : undefined
        };

        // Format the full content for IPFS
        const fullContent = ipfsService.formatQIPContent(qipContent);
        
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
          txHash = await qipClient.updateQIP(
            walletClient,
            existingQIP.qipNumber,
            title,
            contentHash,
            expectedIpfsUrl,
            "Updated via web interface"
          );
          qipNumber = existingQIP.qipNumber;
          console.log("✅ Blockchain update successful:", txHash);
        } else {
          // Create new QIP
          console.log("🚀 Creating new QIP on blockchain...");
          const result = await qipClient.createQIP(walletClient, title, network, contentHash, expectedIpfsUrl);
          txHash = result.hash;
          qipNumber = result.qipNumber;
          console.log("✅ QIP created on blockchain:", { txHash, qipNumber });
        }
        
        // Step 3: Upload to IPFS with proper metadata AFTER blockchain confirmation
        console.log("📤 Uploading to IPFS with metadata...");
        const actualCID = await ipfsService.provider.upload(fullContent, {
          qipNumber: qipNumber > 0 ? qipNumber.toString() : 'pending',
          groupId: config.pinataGroupId
        });
        
        // Verify CIDs match
        if (actualCID !== expectedCID) {
          console.warn("⚠️ CID mismatch! Expected:", expectedCID, "Actual:", actualCID);
          // In production, you might want to handle this more gracefully
        } else {
          console.log("✅ IPFS upload successful, CID matches:", actualCID);
        }
        
        // Set success message
        if (existingQIP) {
          setSuccess(`QIP-${qipNumber} updated successfully! Transaction: ${txHash}`);
        } else if (qipNumber > 0) {
          setSuccess(`QIP-${qipNumber} created successfully! Transaction: ${txHash}`);
        } else {
          setSuccess(
            `QIP submitted successfully! Transaction: ${txHash}\n\nNote: The QIP number will be available once the transaction is confirmed.`
          );
        }
        
        // Invalidate list to refresh AllProposals
        queryClient.invalidateQueries({ queryKey: ["qips"] });

        // Reset form for new QIP
        console.log("🔄 Resetting form...");
        setTitle("");
        setContent("");
        setImplementor("None");
        console.log("✅ Form reset complete");
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
    [qipClient, ipfsService, address, walletClient, title, network, content, implementor, existingQIP]
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
      <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
        Please connect your wallet to create or edit QIPs
      </div>
    );
  }
  
  if (!registryAddress) {
    return (
      <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
        Error: Registry address not configured. Please restart Gatsby to load environment variables.
      </div>
    );
  }
  
  if (!ipfsService) {
    return (
      <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
        Error: IPFS provider not configured. Please check your environment configuration.
      </div>
    );
  }
  
  if (isWrongChain) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
        <p className="mb-2">Please switch to Local Base Fork network (Chain ID: 8453)</p>
        <button 
          onClick={handleSwitchChain}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
        >
          Switch to Local Base Fork
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">
        {existingQIP ? `Edit QIP-${existingQIP.qipNumber}` : 'Create New QIP'}
      </h2>

      {error && (
        <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-foreground">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700"
            placeholder="Improve QiDAO Collateral Framework"
          />
        </div>

        <div>
          <label htmlFor="network" className="block text-sm font-medium text-foreground">
            Network *
          </label>
          <select
            id="network"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700"
          >
            {NETWORKS.map(net => (
              <option key={net} value={net}>{net}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="implementor" className="block text-sm font-medium text-foreground">
            Implementor
          </label>
          <input
            type="text"
            id="implementor"
            value={implementor}
            onChange={(e) => setImplementor(e.target.value)}
            className="mt-1 block w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700"
            placeholder="Dev team, DAO, or None"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-foreground">
            Proposal Content (Markdown) *
          </label>
          <div className="mt-1">
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={20}
              className="block w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary font-mono text-sm dark:bg-zinc-800 dark:border-zinc-700"
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
        </div>

        {/* Transactions Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">
              Transactions
            </label>
            <button
              type="button"
              onClick={() => {
                setEditingTransactionIndex(null);
                setShowTransactionModal(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/20"
            >
              <Plus size={16} />
              Add Transaction
            </button>
          </div>
          
          {transactions.length > 0 ? (
            <div className="space-y-2 mb-4">
              {transactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex-1">
                    <code className="text-sm font-mono break-all">
                      {ABIParser.formatTransaction(tx)}
                    </code>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEditTransaction(index)}
                      className="rounded p-1 hover:bg-muted/50"
                    >
                      <Edit2 size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(index)}
                      className="rounded p-1 hover:bg-muted/50"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
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
          <GradientButton
            type="submit"
            disabled={saving}
            variant="primary"
            className="text-sm"
          >
            {saving ? 'Saving...' : existingQIP ? 'Update QIP' : 'Create QIP'}
          </GradientButton>

          <button
            type="button"
            onClick={handlePreview}
            className="flex items-center justify-center rounded-lg border border-border bg-card py-3 px-8 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </form>

      {preview && (
        <div className="mt-8 border-t pt-8">
          <h3 className="text-xl font-bold mb-4">Preview</h3>
          <div className="bg-muted/30 dark:bg-zinc-800/50 p-6 rounded-lg">
            <h1 className="text-2xl font-bold mb-2">{title || 'Untitled'}</h1>
            <div className="text-sm text-muted-foreground mb-4">
              <span>Network: {network}</span> • 
              <span> Author: {address}</span> • 
              <span> Status: Draft</span>
            </div>
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: content.replace(/\n/g, '<br />') 
              }} 
            />
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