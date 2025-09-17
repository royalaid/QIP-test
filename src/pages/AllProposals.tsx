import React, { useMemo } from 'react'
import ProposalListItem from '../components/ProposalListItem'
import { sortBy } from 'lodash/fp'
import { useQIPData } from '../hooks/useQIPData'
import LocalModeBanner from '../components/LocalModeBanner'
import { config } from '../config/env'

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

  const {
    blockchainQIPs: qips,
    isLoading,
    isError,
    invalidateQIPs: invalidate
  } = useQIPData({
    enabled: true
  })

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
          network: qip.network,
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
          <h1 className="text-4xl font-bold mb-4">All Proposals</h1>
          
          {localMode && <LocalModeBanner />}
          
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

          {isLoading && qips.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              <span className="ml-3">Loading proposals from blockchain...</span>
            </div>
          )}

          {!isLoading && !isError && qips.length === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
              <p className="font-bold">No proposals found</p>
              <p className="text-sm">There are no proposals in the registry yet.</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
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

    </div>
  )
}

export default AllProposals