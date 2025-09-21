import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { useQIP } from '../hooks/useQIP'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../utils/queryKeys'
import FrontmatterTable from '../components/FrontmatterTable'
import SnapshotSubmitter from "../components/SnapshotSubmitter";
import { QIPSkeleton } from '../components/QIPSkeleton'
import { QIPRegistryABI } from "../config/abis/QIPRegistry";
import { QIPStatus, QIPClient } from '../services/qipClient'
import { useMemo } from 'react'
import { getIPFSGatewayUrl } from '../utils/ipfsGateway'
import { MarkdownExportButton } from '../components/MarkdownExportButton'
import { ExportMenu } from '../components/ExportMenu'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from '../config/env'

const QIPDetail: React.FC = () => {
  const { qipNumber } = useParams<{ qipNumber: string }>()
  const { address } = useAccount()
  const location = useLocation()
  const [isClient, setIsClient] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canSubmitSnapshot, setCanSubmitSnapshot] = useState(false)
  const [isAuthor, setIsAuthor] = useState(false)
  const [isEditor, setIsEditor] = useState(false)

  // Use ref to track if we've already shown the toast for this transaction
  const toastShownRef = useRef<string | null>(null)

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

  // Handle navigation state from ProposalEditor
  useEffect(() => {
    if (location.state) {
      const state = location.state as { txHash?: string; justUpdated?: boolean; justCreated?: boolean; timestamp?: number }

      if (state.txHash && (state.justUpdated || state.justCreated)) {
        // Check if we've already shown a toast for this transaction
        if (toastShownRef.current === state.txHash) {
          console.log(`[QIPDetail] Toast already shown for tx ${state.txHash}, skipping`)
          return
        }

        // Mark this transaction as toasted
        toastShownRef.current = state.txHash

        // Clear the navigation state immediately to prevent duplicate toasts
        window.history.replaceState({}, document.title)

        // Show success toast with Basescan link (only once)
        const message = state.justCreated
          ? `QIP-${qipNumberParsed} created successfully!`
          : `QIP-${qipNumberParsed} updated successfully!`

        toast.success(message, {
          description: "Your changes are now on-chain",
          action: {
            label: "View on Basescan",
            onClick: () => {
              window.open(`https://basescan.org/tx/${state.txHash}`, '_blank')
            }
          },
          duration: 8000 // Show for 8 seconds
        })

        // Force invalidate and refetch both QIP and IPFS data
        console.log(`[QIPDetail] Forcing complete cache invalidation for QIP-${qipNumberParsed}`)
        if (registryAddress && qipNumber) {
          const qipNum = parseInt(qipNumberParsed)

          // Get the current QIP data to find the IPFS URL
          const currentData = queryClient.getQueryData<any>(queryKeys.qip(qipNum, registryAddress))
          console.log(`[QIPDetail] Current IPFS URL: ${currentData?.ipfsUrl}`)

          // Remove data from cache completely (not just invalidate)
          queryClient.removeQueries({
            queryKey: queryKeys.qip(qipNum, registryAddress)
          })

          queryClient.removeQueries({
            queryKey: queryKeys.qipBlockchain(qipNum, registryAddress)
          })

          // Remove IPFS content cache if we have the URL
          if (currentData?.ipfsUrl) {
            queryClient.removeQueries({
              queryKey: queryKeys.ipfs(currentData.ipfsUrl)
            })
          }

          // Also remove any potential new IPFS URL from cache
          queryClient.removeQueries({
            queryKey: ['ipfs'],
            exact: false
          })

          // Invalidate the QIPs list
          queryClient.invalidateQueries({
            queryKey: ['qips']
          })

          // Force immediate refetch with multiple attempts
          console.log(`[QIPDetail] Scheduling refetch for QIP-${qipNum}`)

          // First attempt - immediate
          if (refetch) {
            console.log(`[QIPDetail] Immediate refetch attempt`)
            refetch()
          }

          // Second attempt - after small delay
          setTimeout(() => {
            if (refetch) {
              console.log(`[QIPDetail] Delayed refetch attempt (100ms)`)
              refetch()
            }
          }, 100)

          // Third attempt - after longer delay for safety
          setTimeout(() => {
            if (refetch) {
              console.log(`[QIPDetail] Final refetch attempt (500ms)`)
              refetch()
            }
          }, 500)
        }
      }
    }
  }, [location.state?.timestamp, location.state?.txHash, refetch, registryAddress, qipNumber, qipNumberParsed, queryClient]) // Use timestamp to trigger effect

  // Additional effect to force refetch when coming from edit
  useEffect(() => {
    if (location.state?.timestamp && location.state?.justUpdated) {
      console.log(`[QIPDetail] Detected navigation from edit with timestamp ${location.state.timestamp}, forcing data refresh`)

      // Invalidate everything related to this QIP
      if (registryAddress) {
        const qipNum = parseInt(qipNumberParsed)

        // Clear all caches for this QIP
        queryClient.resetQueries({
          queryKey: queryKeys.qip(qipNum, registryAddress),
          exact: true
        })

        // Force an immediate refetch
        if (refetch) {
          refetch()
        }
      }
    }
  }, [location.state?.timestamp]) // Only run when timestamp changes

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
          <div className="max-w-4xl mx-auto">
            <QIPSkeleton variant="detail" />
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
    chain: qipData.chain,
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

        <div className="flex items-start justify-between mb-4">
          <h1 className="text-4xl font-bold">
            QIP-{qipData.qipNumber}: {qipData.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <MarkdownExportButton qipData={qipData} />
            <ExportMenu
              qipData={qipData}
              registryAddress={registryAddress}
              rpcUrl={rpcUrl}
            />
          </div>
        </div>

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