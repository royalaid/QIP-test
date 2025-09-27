import snapshot from "@snapshot-labs/snapshot.js";
import { Proposal } from "@snapshot-labs/snapshot.js/dist/src/sign/types";
import { providers, Signer } from "ethers";

export function getSnapshotClient(hub: string) {
  return new snapshot.Client712(hub);
}

// Create a proposal using ethers.Signer
export async function createProposal(signer: Signer, hub: string, options: Proposal) {
  const client = getSnapshotClient(hub);
  // The SnapshotSubmitter component now always provides Ethereum mainnet blocks
  // This fallback should rarely be used
  if (!options.snapshot) {
    console.warn('No snapshot block provided, this should not happen');
    options.snapshot = 0;
  }
  const proposal: Proposal = {
    space: options.space,
    type: options.type,
    title: options.title,
    body: options.body,
    choices: options.choices,
    start: options.start,
    end: options.end,
    snapshot: options.snapshot,
    discussion: options.discussion || "",
    plugins: options.plugins || "",
    app: options.app || "snapshot",
  };

  // Only add timestamp if explicitly provided
  if (options.timestamp !== undefined) {
    proposal.timestamp = options.timestamp;
  }

  if (!signer.provider) {
    throw new Error("Signer must have a provider to create a proposal.");
  }

  const receipt = await client.proposal(signer.provider as providers.Web3Provider, await signer.getAddress(), proposal);
  return receipt;
}

export async function getProposals(space: string) {
  const query = `query Proposals {
      proposals(
        first: 100
        skip: 0
        where: {
          space_in: ["${space}"]
        }
        orderBy: "created"
        orderDirection: desc
      ) {
        id
        title
      }
    }
  `;
  const url = "https://hub.snapshot.org/graphql";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("response", data);

    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data.proposals;
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

/**
 * Extract QIP number from proposal title
 * Handles various formats including voice-to-text errors
 */
function extractQipNumber(title: string): number | null {
  const patterns = [
    /(?:QIP|qip)[-\s#]*(\d+)[:]/i, // Main pattern with colon
    /(?:QIP|qip)[-\s#]*(\d+)\b/i, // Without colon
    /^(\d+)[:.-]\s*/, // Starting with just number
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num < 10000) {
        return num;
      }
    }
  }
  return null;
}

/**
 * Fetch the latest QIP number from Snapshot proposals
 * Always queries the production qidao.eth space for consistency
 */
export async function getLatestQipNumber(): Promise<number> {
  try {
    // Always fetch from production space for QIP numbers
    const proposals = await getProposals("qidao.eth");

    let highestQipNumber = 0;

    // Find the highest QIP number from existing proposals
    for (const proposal of proposals) {
      const qipNumber = extractQipNumber(proposal.title);
      if (qipNumber !== null && qipNumber > highestQipNumber) {
        highestQipNumber = qipNumber;
        console.log(`Found QIP-${qipNumber} in: "${proposal.title}"`);
      }
    }

    // If no QIP found, start from 0 (will return 1 as next)
    if (highestQipNumber === 0) {
      console.warn("No existing QIP proposals found, starting from QIP-1");
    }

    console.log(`Latest QIP number: ${highestQipNumber}, next will be: ${highestQipNumber + 1}`);
    return highestQipNumber;
  } catch (error) {
    console.error("Failed to fetch latest QIP number:", error);
    return 0; // Return 0 so next will be 1
  }
}

export async function getProposalById(proposalId: string) {
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

  const url = "https://hub.snapshot.org/graphql";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      console.error("GraphQL errors:", data.errors);
      return null;
    }

    return data.data.proposal;
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return null;
  }
}
