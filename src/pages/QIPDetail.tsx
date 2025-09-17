import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQIP } from '../hooks/useQIP'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../utils/queryKeys'
import FrontmatterTable from '../components/FrontmatterTable'
import SnapshotSubmitter from '../components/SnapshotSubmitter'
import { StatusDiscrepancyIndicator } from '../components/StatusDiscrepancyIndicator'
import { QIPRegistryABI } from "../config/abis/QIPRegistry";
import { QIPStatus, QIPClient } from '../services/qipClient'
import { useMemo } from 'react'
import { getIPFSGatewayUrl } from '../utils/ipfsGateway'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from '../config/env'

const QIPDetail: React.FC = () => {
  const { qipNumber } = useParams<{ qipNumber: string }>()
  const { address } = useAccount()
  const [isClient, setIsClient] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canSubmitSnapshot, setCanSubmitSnapshot] = useState(false)
  const [isAuthor, setIsAuthor] = useState(false)
  const [isEditor, setIsEditor] = useState(false)
  
  // Cache for role checks to avoid repeated contract calls
  const [roleCache] = useState<Map<string, boolean>>(new Map())
  const queryClient = useQueryClient()

  // Extract number from QIP-XXX format
  const qipNumberParsed = qipNumber?.replace('QIP-', '') || '0'

  // Use config values
  const registryAddress = config.qipRegistryAddress
  const rpcUrl = config.baseRpcUrl


  const { data: qipData, isLoading: loading, error, refetch } = useQIP({
    registryAddress,
    qipNumber: parseInt(qipNumberParsed),
    rpcUrl,
    enabled: !!registryAddress && !!qipNumber
  })

  // Clear stale cache on mount to ensure fresh data
  useEffect(() => {
    if (registryAddress && qipNumber) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.qip(parseInt(qipNumberParsed), registryAddress)
      })
    }
  }, [qipNumberParsed, registryAddress, queryClient])

  // Create a memoized QIPClient instance to avoid recreating it
  const qipClient = useMemo(() => {
    if (!registryAddress) return null
    return new QIPClient(registryAddress, rpcUrl, false)
  }, [registryAddress, rpcUrl])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Debounce timer to prevent rapid re-checks
    let timeoutId: NodeJS.Timeout

    const checkPermissions = async () => {
      console.log('[QIPDetail] Permission check - address:', address, 'qipData:', !!qipData, 'qipClient:', !!qipClient);

      if (!address || !qipData || !qipClient) {
        setCanEdit(false)
        setCanSubmitSnapshot(false)
        return
      }

      // Check if user is author
      const authorCheck = qipData.author.toLowerCase() === address.toLowerCase()
      setIsAuthor(authorCheck)
      
      // Check if user has editor or admin role using the load-balanced client
      let editorCheck = false

      // Check cache first
      const cacheKey = `${address}-roles`
      // Force fresh check - skip cache for debugging
      const skipCache = true;

      if (!skipCache && roleCache.has(cacheKey)) {
        editorCheck = roleCache.get(cacheKey) || false
        console.log('[QIPDetail] Using cached role:', editorCheck);
      } else {
        console.log('[QIPDetail] Making fresh role check for address:', address);
        try {
          // Use the QIPClient's public client which has load balancing
          const publicClient = qipClient.getPublicClient()

          // Batch both role checks together to reduce RPC calls
          const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'

          // Get EDITOR_ROLE constant first
          const editorRoleResult = await publicClient.readContract({
            address: registryAddress,
            abi: QIPRegistryABI,
            functionName: 'EDITOR_ROLE'
          })

          console.log('[QIPDetail] EDITOR_ROLE hash:', editorRoleResult);

          // Then batch the hasRole checks
          const [hasEditorRole, hasAdminRole] = await Promise.all([
            publicClient.readContract({
              address: registryAddress,
              abi: QIPRegistryABI,
              functionName: 'hasRole',
              args: [editorRoleResult, address]
            }),
            publicClient.readContract({
              address: registryAddress,
              abi: QIPRegistryABI,
              functionName: 'hasRole',
              args: [DEFAULT_ADMIN_ROLE, address]
            })
          ])

          console.log('[QIPDetail] Role check results - hasEditorRole:', hasEditorRole, 'hasAdminRole:', hasAdminRole);

          editorCheck = (hasEditorRole || hasAdminRole) as boolean
          // Cache the result
          roleCache.set(cacheKey, editorCheck)

          if (editorCheck) {
            console.log(`User ${address} has ${hasAdminRole ? 'admin' : 'editor'} role`)
          }
        } catch (error) {
          console.error('Error checking roles:', error)
        }
      }
      setIsEditor(editorCheck)

      console.log('[QIPDetail] Final permissions - authorCheck:', authorCheck, 'editorCheck:', editorCheck);
      setCanEdit(authorCheck || editorCheck)
      // Editors can submit to snapshot even if they're not the author
      setCanSubmitSnapshot(authorCheck || editorCheck)
    }

    // Debounce the check to avoid rapid re-execution
    timeoutId = setTimeout(checkPermissions, 300)
    
    return () => clearTimeout(timeoutId)
  }, [address, qipData, qipClient, registryAddress])

  if (loading) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            <span className="ml-3">Loading QIP...</span>
          </div>
        </div>
      </>
    )
  }

  if (error || !qipData) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{typeof error === 'string' ? error : error?.toString() || 'QIP not found'}</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-primary hover:text-primary/80">
              ← Back to all proposals
            </Link>
          </div>
        </div>
      </>
    )
  }

  const frontmatter = {
    qip: qipData.qipNumber,
    title: qipData.title,
    network: qipData.network,
    status: qipData.status,
    author: qipData.author,
    implementor: qipData.implementor,
    'implementation-date': qipData.implementationDate,
    proposal: qipData.proposal,
    created: qipData.created,
    version: qipData.version
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Link to="/all-proposals" className="text-primary hover:text-primary/80 inline-block">
            ← Back to all proposals
          </Link>
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={() => {
                // Clear all caches
                queryClient.removeQueries();
                localStorage.removeItem("qips-query-cache");
                window.location.reload();
              }}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
            >
              Clear Cache (Dev)
            </button>
          )}
        </div>

        <h1 className="text-4xl font-bold mb-4">
          QIP-{qipData.qipNumber}: {qipData.title}
        </h1>

        <div className="mb-8">
          <FrontmatterTable
            frontmatter={frontmatter}
            qipNumber={qipData.qipNumber}
            statusEnum={qipData.statusEnum}
            isAuthor={isAuthor}
            isEditor={isEditor}
            registryAddress={registryAddress}
            rpcUrl={rpcUrl}
            enableStatusEdit={true}
            onStatusUpdate={async () => {
              console.log("[QIPDetail] Status update triggered from FrontmatterTable");

              // Give the blockchain a moment to fully sync
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Remove ALL related queries to ensure clean state
              queryClient.removeQueries({
                queryKey: ["qip", parseInt(qipNumberParsed)],
                exact: false,
              });

              // Also remove blockchain-specific cache
              queryClient.removeQueries({
                queryKey: ["qip-blockchain", parseInt(qipNumberParsed)],
                exact: false,
              });

              // IMPORTANT: Invalidate the QIP list cache so the main page updates
              queryClient.invalidateQueries({
                queryKey: ["qips", "list", registryAddress],
              });

              console.log("[QIPDetail] Cache cleared, refetching...");

              // Force a fresh fetch
              await refetch();
            }}
          />
        </div>

        {qipData.status !== qipData.ipfsStatus && (
          <div className="mb-6">
            <StatusDiscrepancyIndicator onChainStatus={qipData.status} ipfsStatus={qipData.ipfsStatus} />
          </div>
        )}

        {qipData.ipfsUrl && (
          <div className="mb-4 text-sm text-muted-foreground">
            <span className="font-semibold">IPFS:</span>{" "}
            <a
              href={getIPFSGatewayUrl(qipData.ipfsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              {qipData.ipfsUrl}
            </a>
          </div>
        )}

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {/* Fix reversed markdown link syntax (text)[url] -> [text](url) */}
            {qipData.content?.replace(/\(([^)]+)\)\[([^\]]+)\]/g, "[$1]($2)")}
          </ReactMarkdown>
        </div>

        {/* Version and edit info */}
        <div className="mt-8 p-4 bg-muted rounded">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Version {qipData.version}
              {qipData.version > 1 && ` • Updated ${qipData.version - 1} time${qipData.version > 2 ? "s" : ""}`}
            </p>
            {canEdit && qipData.status === "Draft" && (
              <Link to={`/edit-proposal?qip=${qipData.qipNumber}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                Edit Proposal
              </Link>
            )}
          </div>
        </div>

        {/* Snapshot submission for QIPs ready for snapshot submission */}
        {canSubmitSnapshot && qipData.status === "Ready for Snapshot" && (!qipData.proposal || qipData.proposal === "None") && (
          <div className="mt-8 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">
              Submit to Snapshot
              {config.snapshotSpace !== "qidao.eth" && (
                <span className="text-base font-normal text-primary ml-2">(Space: {config.snapshotSpace})</span>
              )}
            </h2>
            {isClient ? (
              <SnapshotSubmitter
                frontmatter={frontmatter}
                html={`<div>${qipData.content}</div>`}
                rawMarkdown={qipData.content}
                onStatusUpdate={async () => {
                  console.log("[QIPDetail] Status update triggered from SnapshotSubmitter");

                  // Give the blockchain a moment to fully sync
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Remove ALL related queries to ensure clean state
                  queryClient.removeQueries({
                    queryKey: ["qip", parseInt(qipNumberParsed)],
                    exact: false,
                  });

                  // Also remove blockchain-specific cache
                  queryClient.removeQueries({
                    queryKey: ["qip-blockchain", parseInt(qipNumberParsed)],
                    exact: false,
                  });

                  // IMPORTANT: Invalidate the QIP list cache so the main page updates
                  queryClient.invalidateQueries({
                    queryKey: ["qips", "list", registryAddress],
                  });

                  console.log("[QIPDetail] Cache cleared, refetching...");

                  // Force a fresh fetch
                  await refetch();
                }}
                registryAddress={registryAddress}
                rpcUrl={rpcUrl}
                isAuthor={isAuthor}
                isEditor={isEditor}
              />
            ) : (
              <div className="text-center p-4">Loading interactive module...</div>
            )}
          </div>
        )}

        {/* Show existing Snapshot proposal link */}
        {qipData.proposal && qipData.proposal !== "None" && (
          <div className="mt-8 p-4 bg-primary/5 rounded">
            <h3 className="font-bold mb-2">Snapshot Proposal</h3>
            <a
              href={(() => {
                if (qipData.proposal.startsWith("http")) {
                  return qipData.proposal;
                }
                // If it's just a proposal ID (0x...), construct the full URL with the space
                const space = config.snapshotSpace || 'qidao.eth';
                if (qipData.proposal.startsWith("0x")) {
                  return `https://snapshot.org/#/${space}/proposal/${qipData.proposal}`;
                }
                // Fallback for other formats
                return `https://snapshot.org/#/${qipData.proposal}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View on Snapshot →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default QIPDetail