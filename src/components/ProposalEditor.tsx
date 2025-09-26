import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { type Address } from 'viem';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { QCIClient, QCIStatus, type QCIContent } from '../services/qciClient';
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
  existingQCI?: {
    qciNumber: bigint;
    content: QCIContent;
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
  existingQCI,
  initialTitle,
  initialChain,
  initialContent,
  initialImplementor,
}) => {
  const { address, isConnected, chain, status } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const navigate = useNavigate();
  const location = useLocation();

  // Track if we've already navigated to prevent multiple navigations
  const hasNavigatedRef = useRef(false);

  // Check if we need to switch chains
  const isWrongChain = chain && chain.id !== 8453;

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: 8453 });
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };

  // Check for imported data from the import dialog
  const importedData = (location.state as any)?.importedData;
  const fromImport = (location.state as any)?.fromImport;

  // Form state - prioritize existingQCI, then imported data, then initial props
  const [title, setTitle] = useState(existingQCI?.content.title || importedData?.title || initialTitle || "");
  const [combooxSelectedChain, setComboboxSelectedChain] = useState(
    existingQCI?.content.chain || importedData?.chain || initialChain || "Polygon"
  );
  const [content, setContent] = useState(existingQCI?.content.content || importedData?.content || initialContent || "");
  const [implementor, setImplementor] = useState(
    existingQCI?.content.implementor || importedData?.implementor || initialImplementor || "None"
  );
  const [author] = useState(existingQCI?.content.author || address || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);

  // Services
  const [qciClient, setQipClient] = useState<QCIClient | null>(null);
  const [ipfsService, setIpfsService] = useState<IPFSService | null>(null);
  const queryClient = useQueryClient();

  // Add a safety timeout to clear saving state if it gets stuck
  useEffect(() => {
    if (saving) {
      const timeout = setTimeout(() => {
        console.warn("Saving operation timed out after 30 seconds");
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
      const client = new QCIClient(registryAddress, rpcUrl || config.baseRpcUrl);
      setQipClient(client);
    }

    // Use centralized IPFS service selection
    try {
      const service = getIPFSService();
      setIpfsService(service);
    } catch (error) {
      console.error("Failed to initialize IPFS service:", error);
      // Service will remain null, and the component will show the error state
    }
  }, [registryAddress, walletClient, rpcUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Reset navigation flag for new submission
      hasNavigatedRef.current = false;

      if (!qciClient || !ipfsService || !address || !walletClient) {
        setError("Please connect your wallet");
        console.error("Missing required services:", { qciClient: !!qciClient, ipfsService: !!ipfsService, address });
        return;
      }

      setError(null);
      setSuccess(null);
      setSaving(true);

      try {
        // Create QCI content object
        // For existing QCIs, preserve certain blockchain fields (source of truth)
        const qciContent: QCIContent = {
          qci: existingQCI?.qciNumber ? Number(existingQCI.qciNumber) : 0, // Will be assigned by contract
          title,
          chain: combooxSelectedChain, // Allow updating in IPFS content
          // Preserve critical blockchain fields for existing QCIs
          status: existingQCI ? existingQCI.content.status : "Draft",
          author: author,
          implementor, // Allow updating in IPFS content
          "implementation-date": existingQCI ? existingQCI.content["implementation-date"] : "None",
          proposal: existingQCI ? existingQCI.content.proposal : "None",
          created: existingQCI ? existingQCI.content.created : new Date().toISOString().split("T")[0], // Preserve original creation date
          content,
          transactions: transactions.length > 0 ? transactions.map((tx) => ABIParser.formatTransaction(tx)) : undefined,
        };

        // Format the full content for IPFS
        const fullContent = ipfsService.formatQCIContent(qciContent);

        // Step 1: Pre-calculate IPFS CID without uploading
        const expectedCID = await ipfsService.calculateCID(fullContent);
        const expectedIpfsUrl = `ipfs://${expectedCID}`;

        // Step 2: Calculate content hash for blockchain
        const contentHash = ipfsService.calculateContentHash(qciContent);

        let qciNumber: bigint;
        let txHash: string;

        if (existingQCI) {
          // Update existing QCI
          try {
            txHash = await qciClient.updateQCI({
              walletClient,
              qciNumber: existingQCI.qciNumber,
              title,
              chain: combooxSelectedChain,
              implementor,
              newContentHash: contentHash,
              newIpfsUrl: expectedIpfsUrl,
              changeNote: "Updated via web interface",
            });
            qciNumber = existingQCI.qciNumber;
          } catch (updateError) {
            console.error("QCI update failed:", updateError);
            throw updateError;
          }
        } else {
          // Create new QCI
          const result = await qciClient.createQCI(walletClient, title, combooxSelectedChain, contentHash, expectedIpfsUrl);
          txHash = result.hash;
          qciNumber = result.qciNumber;
        }

        // Step 3: Upload to IPFS with proper metadata AFTER blockchain confirmation
        let actualCID;
        try {
          actualCID = await ipfsService.provider.upload(fullContent, {
            qciNumber: qciNumber > 0 ? qciNumber.toString() : "pending",
            groupId: config.pinataGroupId,
          });
        } catch (ipfsError) {
          console.error("IPFS upload failed:", ipfsError);
          // Don't throw here - blockchain update succeeded
          // Set actualCID to expectedCID as fallback
          actualCID = expectedCID;
          console.warn("Using expected CID as fallback:", actualCID);
        }

        // Verify CIDs match
        if (actualCID !== expectedCID) {
          console.warn("CID mismatch! Expected:", expectedCID, "Actual:", actualCID);
        }

        // Invalidate caches immediately after successful update
        if (existingQCI) {
          // Invalidate all related caches for the updated QCI
          const qciNum = Number(qciNumber);

          // Get current data to find IPFS URL
          const currentData = queryClient.getQueryData<any>(["qci", qciNum, registryAddress]);

          // Invalidate QCI query
          queryClient.invalidateQueries({
            queryKey: ["qci", qciNum, registryAddress],
          });

          // Invalidate blockchain cache
          queryClient.invalidateQueries({
            queryKey: ["qci-blockchain", qciNum, registryAddress],
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
        queryClient.invalidateQueries({ queryKey: ["qcis"] });

        // Show success toast and navigate (prevent multiple navigations)
        if (!hasNavigatedRef.current) {
          if (existingQCI) {
            toast.success(`QCI-${qciNumber} updated successfully!`);
            // Mark as navigated before actually navigating
            hasNavigatedRef.current = true;
            // Navigate back to the QCI detail page with transaction hash
            // Include timestamp to ensure fresh data fetch
            navigate(`/qcis/${qciNumber}`, {
              state: {
                txHash,
                justUpdated: true,
                timestamp: Date.now(), // Force refresh with timestamp
              },
            });
          } else {
            // For new QCI, show success and reset form
            if (qciNumber > 0) {
              toast.success(`QCI-${qciNumber} created successfully!`);
              // Mark as navigated before actually navigating
              hasNavigatedRef.current = true;
              // Navigate to the new QCI page
              navigate(`/qcis/${qciNumber}`, {
                state: {
                  txHash,
                  justCreated: true,
                  timestamp: Date.now(), // Force refresh with timestamp
                },
              });
            } else {
              toast.success(`QCI submitted! Check transaction for QCI number.`);
              setSuccess(`Transaction: ${txHash}`);
            }
          }
        }

        // Reset form only for new QCIs that don't redirect
        if (!existingQCI && qciNumber === 0n) {
          setTitle("");
          setContent("");
          setImplementor("None");
        }
      } catch (err: any) {
        console.error("Error saving QCI:", err);

        // Provide more helpful error messages
        let errorMessage = err.message || "Failed to save QCI";

        if (errorMessage.includes("Content already exists")) {
          errorMessage = "A QCI with identical content already exists. Please modify your proposal content to make it unique.";
        }

        setError(errorMessage);
      } finally {
        setSaving(false);
      }
    },
    [qciClient, ipfsService, address, walletClient, title, combooxSelectedChain, content, implementor, existingQCI, transactions]
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
          Please connect your wallet to create or edit QCIs
        </AlertDescription>
      </Alert>
    );
  }

  if (!registryAddress) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error: Registry address not configured. Please restart Gatsby to load environment variables.</AlertDescription>
      </Alert>
    );
  }

  if (!ipfsService) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error: IPFS provider not configured. Please check your environment configuration.</AlertDescription>
      </Alert>
    );
  }

  if (isWrongChain) {
    return (
      <Alert className="border-yellow-400 bg-yellow-500/10">
        <AlertDescription className="text-yellow-700 dark:text-yellow-400">
          <p className="mb-2">Please switch to Local Base Fork network (Chain ID: 8453)</p>
          <Button onClick={handleSwitchChain} variant="default">
            Switch to Local Base Fork
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
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

      {fromImport && (
        <Alert className="mb-4 border-blue-400 bg-blue-50 dark:bg-blue-950">
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            Data imported from JSON export. Review and modify as needed before saving.
          </AlertDescription>
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
            {saving ? "Saving..." : existingQCI ? "Update QCI" : "Create QCI"}
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
              <span>Chain: {combooxSelectedChain}</span> •<span> Author: {author || address}</span> •<span> Status: Draft</span>
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