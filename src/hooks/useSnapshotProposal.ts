import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../utils/queryKeys';

export interface SnapshotProposal {
  id: string;
  title: string;
  state: 'pending' | 'active' | 'closed';
  author: string;
  created: number;
  start: number;
  end: number;
  snapshot: string;
  choices: string[];
  scores: number[];
  scores_total: number;
  votes: number;
  quorum: number;
  space: {
    id: string;
    name: string;
  };
  link?: string;
  discussion?: string;
}

interface SnapshotVote {
  id: string;
  voter: string;
  choice: number;
  vp: number;
  created: number;
}

const SNAPSHOT_GRAPHQL_URL = 'https://hub.snapshot.org/graphql';

function extractProposalId(input: string | undefined | null): string | null {
  if (!input) return null;

  // Handle full URLs
  const urlMatch = input.match(/snapshot\.org\/.*\/(0x[a-fA-F0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // Handle direct proposal IDs (0x format)
  if (input.startsWith('0x')) return input;

  // Handle ipfs:// URLs or other formats
  const ipfsMatch = input.match(/(0x[a-fA-F0-9]+)/);
  if (ipfsMatch) return ipfsMatch[1];

  return null;
}

async function fetchProposalById(proposalId: string): Promise<SnapshotProposal | null> {
  const query = `
    query Proposal($id: String!) {
      proposal(id: $id) {
        id
        title
        state
        author
        created
        start
        end
        snapshot
        choices
        scores
        scores_total
        votes
        quorum
        space {
          id
          name
        }
        link
        discussion
      }
    }
  `;

  try {
    const response = await fetch(SNAPSHOT_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id: proposalId },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    return data.data.proposal;
  } catch (error) {
    console.error('Error fetching proposal:', error);
    return null;
  }
}

export function useSnapshotProposal(proposalIdOrUrl: string | undefined | null) {
  const proposalId = extractProposalId(proposalIdOrUrl);

  return useQuery<SnapshotProposal | null>({
    queryKey: ['snapshot', 'proposal', proposalId],
    queryFn: () => proposalId ? fetchProposalById(proposalId) : Promise.resolve(null),
    enabled: !!proposalId,
    staleTime: 1000 * 60 * 5, // 5 minutes for active proposals
    gcTime: 1000 * 60 * 60, // 1 hour cache
    refetchInterval: (query) => {
      // Refetch active proposals every 5 minutes
      if (query.state.data?.state === 'active') {
        return 1000 * 60 * 5;
      }
      // Don't refetch closed/pending proposals
      return false;
    },
  });
}