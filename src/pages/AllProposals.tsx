import React, { useMemo, useState } from 'react'
import ProposalListItem from '../components/ProposalListItem'
import { sortBy } from 'lodash/fp'
import { useQIPData } from '../hooks/useQIPData'
import LocalModeBanner from '../components/LocalModeBanner'
import CacheStatusIndicator from '../components/CacheStatusIndicator'
import { StatusGroupSkeleton } from '../components/QIPSkeleton'
import { config } from '../config/env'
import { showDevTools } from '../config/debug'
import { RefreshCw } from 'lucide-react'

// Map blockchain status strings to display strings
const statusDisplayMap: Record<string, string> = {
  'Draft': 'Draft',
  'Ready for Snapshot': 'Ready for Snapshot',
  'Posted to Snapshot': 'Posted to Snapshot'
}

// Status order for display
const statusOrder = ['Draft', 'Ready for Snapshot', 'Posted to Snapshot']

const AllProposals: React.FC = () => {
  const localMode = config.localMode
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    blockchainQIPs: qips,
    isLoading,
    isError,
    invalidateQIPs: invalidate,
    isFetching,
    dataUpdatedAt
  } = useQIPData({
    enabled: true
  })

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await invalidate()
      console.log('[AllProposals] Manual refresh triggered')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Group QIPs by status
  const groupedQIPs = useMemo(() => {
    const groups: Record<string, any[]> = {}
    
    qips.forEach(qip => {
      const status = qip.status
      if (!groups[status]) {
        groups[status] = []
      }
      groups[status].push({
        ...qip,
        id: `blockchain-${qip.qipNumber}`,
        frontmatter: {
          qip: qip.qipNumber,
          title: qip.title,
          author: qip.author,
          chain: qip.chain,
          proposal: qip.proposal,
          implementor: qip.implementor,
          created: qip.created,
          status: qip.status
        }
      })
    })

    // Sort QIPs within each group by number (descending)
    Object.keys(groups).forEach(status => {
      groups[status] = sortBy(p => -p.qipNumber, groups[status])
    })

    return groups
  }, [qips])

  // Get ordered status groups
  const orderedGroups = statusOrder
    .filter(status => groupedQIPs[status] && groupedQIPs[status].length > 0)
    .map(status => ({
      status,
      qips: groupedQIPs[status],
      displayName: statusDisplayMap[status] || status
    }))

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold">All Proposals</h1>
            {showDevTools && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isFetching}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Refresh proposals"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing || isFetching ? 'animate-spin' : ''}`} />
                {isRefreshing || isFetching ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>

          {localMode && <LocalModeBanner />}

          {/* Show last updated time - development only */}
          {showDevTools && dataUpdatedAt && !isLoading && (
            <div className="text-sm text-muted-foreground mb-2">
              Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </div>
          )}
          
          {isError && (
            <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded mb-4">
              <p className="font-bold">Error loading data</p>
              <p className="text-sm">Please check your connection and try again.</p>
              <button 
                onClick={() => invalidate()}
                className="mt-2 bg-destructive text-white px-3 py-1 rounded text-sm hover:bg-destructive/90"
              >
                Retry
              </button>
            </div>
          )}

          {/* Show skeletons on initial load */}
          {isLoading && qips.length === 0 && (
            <div className="space-y-8">
              <StatusGroupSkeleton />
              <StatusGroupSkeleton />
              <StatusGroupSkeleton />
            </div>
          )}

          {!isLoading && !isError && qips.length === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
              <p className="font-bold">No proposals found</p>
              <p className="text-sm">There are no proposals in the registry yet.</p>
            </div>
          )}
        </div>

        {/* Show skeletons while refetching in background */}
        {isFetching && !isLoading && (
          <div className="space-y-8">
            <StatusGroupSkeleton />
            <StatusGroupSkeleton />
            <StatusGroupSkeleton />
          </div>
        )}

        {/* Show actual content when not fetching or when we have cached data */}
        <div className={`space-y-8 ${isFetching && !isLoading ? 'hidden' : ''}`}>
          {orderedGroups.map(({ status, qips, displayName }) => (
            <div key={status}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                {displayName}
                <span className="text-sm font-normal text-muted-foreground">
                  ({qips.length})
                </span>
              </h2>
              <ProposalListItem proposals={qips} />
            </div>
          ))}
        </div>

        {/* Total count indicator */}
        {qips.length > 0 && (
          <div className="py-8 text-center text-gray-500">
            <p>{qips.length} proposals total</p>
          </div>
        )}

        {/* Cache status indicator for debugging */}
        <CacheStatusIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          isStale={false}
          source={config.useMaiApi ? 'api' : 'blockchain'}
          cacheHit={!isLoading && dataUpdatedAt ? true : false}
        />

    </div>
  )
}

export default AllProposals