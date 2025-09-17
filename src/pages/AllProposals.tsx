import React, { useMemo } from 'react'
import ProposalListItem from '../components/ProposalListItem'
import { sortBy } from 'lodash/fp'
import { useQIPData } from "../hooks/useQIPData";
import LocalModeBanner from "../components/LocalModeBanner";
import { config } from "../config/env";

// Map blockchain status strings to display strings
const statusDisplayMap: Record<string, string> = {
  "Draft": "Draft",
  "Ready for Snapshot": "Ready for Snapshot",
  "Posted to Snapshot": "Posted to Snapshot"
};

// Status order for display
const statusOrder = ["Draft", "Ready for Snapshot", "Posted to Snapshot"];

const AllProposals: React.FC = () => {
  // Configuration
  const localMode = config.localMode;

  // Always use API for fetching QIPs (24x faster)
  const {
    blockchainQIPs,
    isLoading: blockchainLoading,
    isError: blockchainError,
    invalidateQIPs,
    isFetching,
  } = useQIPData({
    pollingInterval: 30000, // 30 seconds
    enabled: true,
  });

  // Group QIPs by status
  const groupedQIPs = useMemo(() => {
    console.log('[AllProposals] Total QIPs fetched:', blockchainQIPs.length);
    console.log('[AllProposals] QIP numbers:', blockchainQIPs.map(q => q.qipNumber).sort((a, b) => a - b));

    const groups: Record<string, any[]> = {};

    blockchainQIPs.forEach((qip) => {
      const status = qip.status;
      console.log(`[AllProposals] QIP ${qip.qipNumber} has status: "${status}"`);

      if (!groups[status]) {
        groups[status] = [];
      }
      // Just pass the QIP as-is since ProposalListItem handles blockchain QIPs directly
      groups[status].push({
        ...qip,
        id: `api-${qip.qipNumber}`,
      });
    });

    // Sort QIPs within each group by number (descending)
    Object.keys(groups).forEach((status) => {
      groups[status] = sortBy((p) => -p.qipNumber, groups[status]);
    });

    console.log('[AllProposals] Grouped QIPs by status:', Object.keys(groups).map(s => `${s}: ${groups[s].length}`));
    return groups;
  }, [blockchainQIPs]);

  // Get ordered status groups
  const orderedGroups = statusOrder
    .filter((status) => {
      const hasQIPs = groupedQIPs[status] && groupedQIPs[status].length > 0;
      console.log(`[AllProposals] Checking status "${status}": found ${hasQIPs ? groupedQIPs[status].length : 0} QIPs`);
      return hasQIPs;
    })
    .map((status) => ({
      status,
      qips: groupedQIPs[status],
      displayName: statusDisplayMap[status] || status,
    }));

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">All Proposals</h1>

          {localMode && <LocalModeBanner />}

          {/* API Mode Indicator - Always shown since we're always using API */}
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">⚡ Using Mai API for faster QIP loading (24x performance improvement)</p>
          </div>

          {blockchainError && (
            <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded mb-4">
              <p className="font-bold">Error loading from API</p>
              <p className="text-sm">Please check your connection and try again.</p>
              <button
                onClick={() => invalidateQIPs()}
                className="mt-2 bg-destructive text-white px-3 py-1 rounded text-sm hover:bg-destructive/90"
              >
                Retry
              </button>
            </div>
          )}

          {blockchainLoading && !blockchainQIPs.length && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              <span className="ml-3">Loading proposals from API...</span>
            </div>
          )}

          {!blockchainLoading && !blockchainError && blockchainQIPs.length === 0 && (
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
                <span className="text-sm font-normal text-muted-foreground">({qips.length})</span>
                {isFetching && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground"></div>}
              </h2>
              <ProposalListItem proposals={qips} />
            </div>
          ))}
        </div>

        {/* Refresh button for development */}
        {process.env.NODE_ENV === "development" && (
          <div className="fixed bottom-4 right-4">
            <button
              onClick={() => invalidateQIPs()}
              className="bg-primary text-white px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 flex items-center"
              disabled={isFetching}
            >
              {isFetching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AllProposals