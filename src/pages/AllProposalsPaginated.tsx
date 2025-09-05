import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import ProposalListItem from '../components/ProposalListItem'
import { sortBy } from 'lodash/fp'
import { useQIPsFromAPI } from '../hooks/useQIPsFromAPI'
import Layout from '../layout'
import LocalModeBanner from '../components/LocalModeBanner'
import { config } from '../config/env'

// Map blockchain status strings to display strings
const statusDisplayMap: Record<string, string> = {
  'Draft': 'Draft',
  'Review': 'Review Pending',
  'Vote': 'Vote Pending',
  'Approved': 'Approved',
  'Rejected': 'Rejected',
  'Implemented': 'Implemented',
  'Superseded': 'Deprecated',
  'Withdrawn': 'Deprecated'
}

// Status order for display
const statusOrder = ['Draft', 'Review', 'Vote', 'Approved', 'Implemented', 'Rejected', 'Withdrawn']

const AllProposalsPaginated: React.FC = () => {
  const localMode = config.localMode
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Use API directly - it's fast enough that we don't need pagination
  const {
    qips,
    isLoading,
    isError,
    invalidateQIPs: invalidate,
    isFetching: isFetchingMore
  } = useQIPsFromAPI({
    apiUrl: config.maiApiUrl,
    enabled: true
  })
  
  // Since API is fast, we don't need pagination
  const totalCount = qips.length
  const currentPage = 1
  const totalPages = 1
  const hasMore = false
  const loadMore = () => {} // No-op since we load everything at once

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || isFetchingMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, isFetchingMore, isLoading, loadMore])

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
    <Layout>
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
            <div key={status} className="proposal-list-container">
              <div className="shadow-s p-5 bg-card rounded-t-lg">
                <h3 className="text-2xl font-semibold mb-3 flex items-center">
                  {displayName}
                  <span className="ml-2 text-sm text-gray-500">({qips.length})</span>
                </h3>
              </div>
              <ProposalListItem proposals={qips} />
            </div>
          ))}
        </div>

        {/* Load more trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-8 text-center">
            {isFetchingMore ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-3">Loading more proposals...</span>
              </div>
            ) : (
              <button
                onClick={loadMore}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Load More Proposals
              </button>
            )}
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && qips.length > 0 && (
          <div className="py-8 text-center text-gray-500">
            <p>You've reached the end • {totalCount} proposals total</p>
          </div>
        )}

      </div>
    </Layout>
  )
}

export default AllProposalsPaginated