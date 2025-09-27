import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
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
import { Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SnapshotStatus } from '../components/SnapshotStatus'
import SnapshotModerator from "../components/SnapshotModerator";

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from '../config/env'

const QCIDetail: React.FC = () => {
  const { qciNumber } = useParams<{ qciNumber: string }>()
  const { address } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()
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
        const message = state.justCreated ? `QCI created successfully!` : `QCI updated successfully!`;

        toast.success(message, {
          description: "Your changes are now on-chain",
          action: {
            label: "View on Basescan",
            onClick: () => {
              window.open(`https://basescan.org/tx/${state.txHash}`, "_blank");
            },
          },
          duration: 8000, // Show for 8 seconds
        });

        // Force invalidate and refetch both QCI and IPFS data
        console.log(`[QCIDetail] Forcing complete cache invalidation for QCI`);
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
        <div className="flex justify-between items-center mb-6">
          <Link to="/all-proposals" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <span>←</span>
            <span>Back to all proposals</span>
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && qciData.status === "Draft" && (
              <Button
                onClick={() => navigate(`/edit-proposal?qci=${qciData.qciNumber}`)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                title="Edit Proposal"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </Button>
            )}
            <MarkdownExportButton qciData={qciData} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" />
            <ExportMenu
              qciData={qciData}
              registryAddress={registryAddress}
              rpcUrl={rpcUrl}
              className="text-muted-foreground hover:text-foreground"
            />
            {process.env.NODE_ENV === "development" && (
              <Button
                onClick={() => {
                  // Clear all caches
                  queryClient.removeQueries();
                  localStorage.removeItem("qcis-query-cache");
                  window.location.reload();
                }}
                variant="outline"
                size="sm"
                className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
              >
                Clear Cache (Dev)
              </Button>
            )}
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-4">{qciData.title}</h1>

        {/* Display Snapshot status if proposal is linked */}
        {qciData.proposal && qciData.proposal !== "None" && qciData.proposal !== "TBU" && (
          <div className="mb-6">
            <SnapshotStatus proposalIdOrUrl={qciData.proposal} showVotes={true} className="bg-muted/50 p-4 rounded-lg border" />
            {/* Show moderation UI for editors when proposal is already linked */}
            {isEditor && qciData.status === "Posted to Snapshot" && (
              <div className="mt-4">
                <SnapshotModerator
                  qciNumber={qciData.qciNumber}
                  currentProposalId={qciData.proposal}
                  registryAddress={registryAddress}
                  onSuccess={async () => {
                    // Refresh QCI data after successful update
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    queryClient.removeQueries({
                      queryKey: ["qci", parseInt(qciNumberParsed)],
                      exact: false,
                    });
                    queryClient.removeQueries({
                      queryKey: ["qci-blockchain", parseInt(qciNumberParsed)],
                      exact: false,
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["qcis", "list", registryAddress],
                    });
                    await refetch();
                  }}
                />
              </div>
            )}
          </div>
        )}

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

        {/* Version info */}
        <div className="mt-8 p-4 bg-muted rounded">
          <p className="text-sm text-muted-foreground">
            Version {qciData.version}
            {qciData.version > 1 && ` • Updated ${qciData.version - 1} time${qciData.version > 2 ? "s" : ""}`}
          </p>
        </div>

        {/* Snapshot submission for QCIs ready for snapshot submission */}
        {canSubmitSnapshot && qciData.status === "Ready for Snapshot" && (!qciData.proposal || qciData.proposal === "None") && (
          <div className="mt-8 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              Submit to Snapshot
              <span className="text-xs px-2 py-0.5 rounded-md border text-muted-foreground">
                {config.snapshotTestMode ? `TEST MODE: ${config.snapshotTestSpace}` : config.snapshotSpace}
              </span>
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
      </div>
    </div>
  );
}

export default QCIDetail