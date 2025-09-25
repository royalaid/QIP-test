import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { useQCI } from '../hooks/useQCI'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../utils/queryKeys'
import FrontmatterTable from '../components/FrontmatterTable'
import SnapshotSubmitter from "../components/SnapshotSubmitter";
import { QCISkeleton } from '../components/QCISkeleton'
import { QCIRegistryABI } from "../config/abis/QCIRegistry";
import { QCIStatus, QCIClient } from '../services/qciClient'
import { useMemo } from 'react'
import { getIPFSGatewayUrl } from '../utils/ipfsGateway'
import { MarkdownExportButton } from '../components/MarkdownExportButton'
import { ExportMenu } from '../components/ExportMenu'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from '../config/env'

const QCIDetail: React.FC = () => {
  const { qciNumber } = useParams<{ qciNumber: string }>()
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

  // Extract number from QCI-XXX format
  const qciNumberParsed = qciNumber?.replace('QCI-', '') || '0'

  // Use config values
  const registryAddress = config.qciRegistryAddress
  const rpcUrl = config.baseRpcUrl


  const { data: qciData, isLoading: loading, error, refetch } = useQCI({
    registryAddress,
    qciNumber: parseInt(qciNumberParsed),
    rpcUrl,
    enabled: !!registryAddress && !!qciNumber
  })

  // Clear stale cache on mount to ensure fresh data
  useEffect(() => {
    if (registryAddress && qciNumber) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.qci(parseInt(qciNumberParsed), registryAddress)
      })
    }
  }, [qciNumberParsed, registryAddress, queryClient])

  // Handle navigation state from ProposalEditor
  useEffect(() => {
    if (location.state) {
      const state = location.state as { txHash?: string; justUpdated?: boolean; justCreated?: boolean; timestamp?: number }

      if (state.txHash && (state.justUpdated || state.justCreated)) {
        // Check if we've already shown a toast for this transaction
        if (toastShownRef.current === state.txHash) {
          console.log(`[QCIDetail] Toast already shown for tx ${state.txHash}, skipping`)
          return
        }

        // Mark this transaction as toasted
        toastShownRef.current = state.txHash

        // Clear the navigation state immediately to prevent duplicate toasts
        window.history.replaceState({}, document.title)

        // Show success toast with Basescan link (only once)
        const message = state.justCreated
          ? `QCI-${qciNumberParsed} created successfully!`
          : `QCI-${qciNumberParsed} updated successfully!`

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

        // Force invalidate and refetch both QCI and IPFS data
        console.log(`[QCIDetail] Forcing complete cache invalidation for QCI-${qciNumberParsed}`)
        if (registryAddress && qciNumber) {
          const qciNum = parseInt(qciNumberParsed)

          // Get the current QCI data to find the IPFS URL
          const currentData = queryClient.getQueryData<any>(queryKeys.qci(qciNum, registryAddress))
          console.log(`[QCIDetail] Current IPFS URL: ${currentData?.ipfsUrl}`)

          // Remove data from cache completely (not just invalidate)
          queryClient.removeQueries({
            queryKey: queryKeys.qci(qciNum, registryAddress)
          })

          queryClient.removeQueries({
            queryKey: queryKeys.qciBlockchain(qciNum, registryAddress)
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

          // Invalidate the QCIs list
          queryClient.invalidateQueries({
            queryKey: ['qcis']
          })

          // Force immediate refetch with multiple attempts
          console.log(`[QCIDetail] Scheduling refetch for QCI-${qciNum}`)

          // First attempt - immediate
          if (refetch) {
            console.log(`[QCIDetail] Immediate refetch attempt`)
            refetch()
          }

          // Second attempt - after small delay
          setTimeout(() => {
            if (refetch) {
              console.log(`[QCIDetail] Delayed refetch attempt (100ms)`)
              refetch()
            }
          }, 100)

          // Third attempt - after longer delay for safety
          setTimeout(() => {
            if (refetch) {
              console.log(`[QCIDetail] Final refetch attempt (500ms)`)
              refetch()
            }
          }, 500)
        }
      }
    }
  }, [location.state?.timestamp, location.state?.txHash, refetch, registryAddress, qciNumber, qciNumberParsed, queryClient]) // Use timestamp to trigger effect

  // Additional effect to force refetch when coming from edit
  useEffect(() => {
    if (location.state?.timestamp && location.state?.justUpdated) {
      console.log(`[QCIDetail] Detected navigation from edit with timestamp ${location.state.timestamp}, forcing data refresh`)

      // Invalidate everything related to this QCI
      if (registryAddress) {
        const qciNum = parseInt(qciNumberParsed)

        // Clear all caches for this QCI
        queryClient.resetQueries({
          queryKey: queryKeys.qci(qciNum, registryAddress),
          exact: true
        })

        // Force an immediate refetch
        if (refetch) {
          refetch()
        }
      }
    }
  }, [location.state?.timestamp]) // Only run when timestamp changes

  // Create a memoized QCIClient instance to avoid recreating it
  const qciClient = useMemo(() => {
    if (!registryAddress) return null
    return new QCIClient(registryAddress, rpcUrl, false)
  }, [registryAddress, rpcUrl])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Debounce timer to prevent rapid re-checks
    let timeoutId: NodeJS.Timeout

    const checkPermissions = async () => {
      console.log('[QCIDetail] Permission check - address:', address, 'qciData:', !!qciData, 'qciClient:', !!qciClient);

      if (!address || !qciData || !qciClient) {
        setCanEdit(false)
        setCanSubmitSnapshot(false)
        return
      }

      // Check if user is author
      const authorCheck = qciData.author.toLowerCase() === address.toLowerCase()
      setIsAuthor(authorCheck)
      
      // Check if user has editor or admin role using the load-balanced client
      let editorCheck = false

      // Check cache first
      const cacheKey = `${address}-roles`
      // Force fresh check - skip cache for debugging
      const skipCache = true;

      if (!skipCache && roleCache.has(cacheKey)) {
        editorCheck = roleCache.get(cacheKey) || false
        console.log('[QCIDetail] Using cached role:', editorCheck);
      } else {
        console.log('[QCIDetail] Making fresh role check for address:', address);
        try {
          // Use the QCIClient's public client which has load balancing
          const publicClient = qciClient.getPublicClient()

          // Batch both role checks together to reduce RPC calls
          const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'

          // Get EDITOR_ROLE constant first
          const editorRoleResult = await publicClient.readContract({
            address: registryAddress,
            abi: QCIRegistryABI,
            functionName: 'EDITOR_ROLE'
          })

          console.log('[QCIDetail] EDITOR_ROLE hash:', editorRoleResult);

          // Then batch the hasRole checks
          const [hasEditorRole, hasAdminRole] = await Promise.all([
            publicClient.readContract({
              address: registryAddress,
              abi: QCIRegistryABI,
              functionName: 'hasRole',
              args: [editorRoleResult, address]
            }),
            publicClient.readContract({
              address: registryAddress,
              abi: QCIRegistryABI,
              functionName: 'hasRole',
              args: [DEFAULT_ADMIN_ROLE, address]
            })
          ])

          console.log('[QCIDetail] Role check results - hasEditorRole:', hasEditorRole, 'hasAdminRole:', hasAdminRole);

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

      console.log('[QCIDetail] Final permissions - authorCheck:', authorCheck, 'editorCheck:', editorCheck);
      setCanEdit(authorCheck || editorCheck)
      // Editors can submit to snapshot even if they're not the author
      setCanSubmitSnapshot(authorCheck || editorCheck)
    }

    // Debounce the check to avoid rapid re-execution
    timeoutId = setTimeout(checkPermissions, 300)
    
    return () => clearTimeout(timeoutId)
  }, [address, qciData, qciClient, registryAddress])

  if (loading) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <QCISkeleton variant="detail" />
          </div>
        </div>
      </>
    )
  }

  if (error || !qciData) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{typeof error === 'string' ? error : error?.toString() || 'QCI not found'}</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-primary hover:text-primary/80">
              ← Back to all proposals
            </Link>
          </div>
        </div>
      </>
    )
  }

  const frontmatter = {
    qci: qciData.qciNumber,
    title: qciData.title,
    chain: qciData.chain,
    status: qciData.status,
    author: qciData.author,
    implementor: qciData.implementor,
    'implementation-date': qciData.implementationDate,
    proposal: qciData.proposal,
    created: qciData.created,
    version: qciData.version
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
                localStorage.removeItem("qcis-query-cache");
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
            QCI-{qciData.qciNumber}: {qciData.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <MarkdownExportButton qciData={qciData} />
            <ExportMenu
              qciData={qciData}
              registryAddress={registryAddress}
              rpcUrl={rpcUrl}
            />
          </div>
        </div>

        <div className="mb-8">
          <FrontmatterTable
            frontmatter={frontmatter}
            qciNumber={qciData.qciNumber}
            statusEnum={qciData.statusEnum}
            isAuthor={isAuthor}
            isEditor={isEditor}
            registryAddress={registryAddress}
            rpcUrl={rpcUrl}
            enableStatusEdit={true}
            onStatusUpdate={async () => {
              console.log("[QCIDetail] Status update triggered from FrontmatterTable");

              // Give the blockchain a moment to fully sync
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Remove ALL related queries to ensure clean state
              queryClient.removeQueries({
                queryKey: ["qci", parseInt(qciNumberParsed)],
                exact: false,
              });

              // Also remove blockchain-specific cache
              queryClient.removeQueries({
                queryKey: ["qci-blockchain", parseInt(qciNumberParsed)],
                exact: false,
              });

              // IMPORTANT: Invalidate the QCI list cache so the main page updates
              queryClient.invalidateQueries({
                queryKey: ["qcis", "list", registryAddress],
              });

              console.log("[QCIDetail] Cache cleared, refetching...");

              // Force a fresh fetch
              await refetch();
            }}
          />
        </div>

        {qciData.ipfsUrl && (
          <div className="mb-4 text-sm text-muted-foreground">
            <span className="font-semibold">IPFS:</span>{" "}
            <a
              href={getIPFSGatewayUrl(qciData.ipfsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              {qciData.ipfsUrl}
            </a>
          </div>
        )}

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {/* Fix reversed markdown link syntax (text)[url] -> [text](url) */}
            {qciData.content?.replace(/\(([^)]+)\)\[([^\]]+)\]/g, "[$1]($2)")}
          </ReactMarkdown>
        </div>

        {/* Version and edit info */}
        <div className="mt-8 p-4 bg-muted rounded">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Version {qciData.version}
              {qciData.version > 1 && ` • Updated ${qciData.version - 1} time${qciData.version > 2 ? "s" : ""}`}
            </p>
            {canEdit && qciData.status === "Draft" && (
              <Link to={`/edit-proposal?qci=${qciData.qciNumber}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                Edit Proposal
              </Link>
            )}
          </div>
        </div>

        {/* Snapshot submission for QCIs ready for snapshot submission */}
        {canSubmitSnapshot && qciData.status === "Ready for Snapshot" && (!qciData.proposal || qciData.proposal === "None") && (
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
                html={`<div>${qciData.content}</div>`}
                rawMarkdown={qciData.content}
                onStatusUpdate={async () => {
                  console.log("[QCIDetail] Status update triggered from SnapshotSubmitter");

                  // Give the blockchain a moment to fully sync
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Remove ALL related queries to ensure clean state
                  queryClient.removeQueries({
                    queryKey: ["qci", parseInt(qciNumberParsed)],
                    exact: false,
                  });

                  // Also remove blockchain-specific cache
                  queryClient.removeQueries({
                    queryKey: ["qci-blockchain", parseInt(qciNumberParsed)],
                    exact: false,
                  });

                  // IMPORTANT: Invalidate the QCI list cache so the main page updates
                  queryClient.invalidateQueries({
                    queryKey: ["qcis", "list", registryAddress],
                  });

                  console.log("[QCIDetail] Cache cleared, refetching...");

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
        {qciData.proposal && qciData.proposal !== "None" && (
          <div className="mt-8 p-4 bg-primary/5 rounded">
            <h3 className="font-bold mb-2">Snapshot Proposal</h3>
            <a
              href={(() => {
                if (qciData.proposal.startsWith("http")) {
                  return qciData.proposal;
                }
                // If it's just a proposal ID (0x...), construct the full URL with the space
                const space = config.snapshotSpace || 'qidao.eth';
                if (qciData.proposal.startsWith("0x")) {
                  return `https://snapshot.org/#/${space}/proposal/${qciData.proposal}`;
                }
                // Fallback for other formats
                return `https://snapshot.org/#/${qciData.proposal}`;
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

export default QCIDetail