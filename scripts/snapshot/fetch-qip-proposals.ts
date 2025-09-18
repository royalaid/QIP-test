#!/usr/bin/env bun

/**
 * Fetches QIP proposals from Snapshot.org for the QiDAO space
 * and caches them in a JSON file.
 *
 * Usage: bun run scripts/snapshot/fetch-qip-proposals.ts
 */

import fs from 'fs';
import path from 'path';

const SNAPSHOT_GRAPHQL_URL = 'https://hub.snapshot.org/graphql';
const QIDAO_SPACE = 'qidao.eth';
const OUTPUT_FILE = path.join(__dirname, 'qip-snapshot-cache.json');

interface SnapshotProposal {
  id: string;
  title: string;
  state: string;
  created: number;
  snapshot: string;
  choices: string[];
  scores: number[];
  scores_total: number;
  start: number;
  end: number;
}

interface QIPMapping {
  qipNumber: number;
  proposalId: string;
  title: string;
  created: number;
  state: string;
  url: string;
}

/**
 * Extract QIP number from proposal title
 * Supports formats like: "QIP-123", "QIP 123", "QIP #123", etc.
 */
function extractQIPNumber(title: string): number | null {
  const patterns = [
    /QIP[-\s#]*(\d+)/i,
    /^(\d+)[\s:.-]/,  // Starting with number
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Fetch all proposals from Snapshot GraphQL API
 */
async function fetchProposals(skip = 0, allProposals: SnapshotProposal[] = []): Promise<SnapshotProposal[]> {
  const query = `
    query Proposals($space: String!, $first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: OrderDirection!) {
      proposals(
        where: { space: $space }
        first: $first
        skip: $skip
        orderBy: $orderBy
        orderDirection: $orderDirection
      ) {
        id
        title
        state
        created
        snapshot
        choices
        scores
        scores_total
        start
        end
      }
    }
  `;

  const variables = {
    space: QIDAO_SPACE,
    first: 100,
    skip,
    orderBy: "created",
    orderDirection: "desc" as const
  };

  try {
    const response = await fetch(SNAPSHOT_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    const proposals = data.data.proposals as SnapshotProposal[];
    allProposals.push(...proposals);

    // If we got 100 proposals, there might be more
    if (proposals.length === 100) {
      console.log(`Fetched ${allProposals.length} proposals so far...`);
      return fetchProposals(skip + 100, allProposals);
    }

    return allProposals;
  } catch (error) {
    console.error('Error fetching proposals:', error);
    throw error;
  }
}

/**
 * Filter and map proposals to QIP format
 */
function filterAndMapQIPs(proposals: SnapshotProposal[]): QIPMapping[] {
  const qipMappings: QIPMapping[] = [];
  const seenQIPNumbers = new Set<number>();

  for (const proposal of proposals) {
    // Try to extract QIP number from title
    const qipNumber = extractQIPNumber(proposal.title);

    if (qipNumber !== null) {
      // Only keep the first (most recent) proposal for each QIP number
      if (!seenQIPNumbers.has(qipNumber)) {
        seenQIPNumbers.add(qipNumber);

        qipMappings.push({
          qipNumber,
          proposalId: proposal.id,
          title: proposal.title,
          created: proposal.created,
          state: proposal.state,
          url: `https://snapshot.org/#/${QIDAO_SPACE}/proposal/${proposal.id}`
        });
      }
    }
  }

  // Sort by QIP number
  qipMappings.sort((a, b) => a.qipNumber - b.qipNumber);

  return qipMappings;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Fetching QIP proposals from Snapshot...');
  console.log(`Space: ${QIDAO_SPACE}`);
  console.log('');

  try {
    // Fetch all proposals
    const proposals = await fetchProposals();
    console.log(`\n✅ Fetched ${proposals.length} total proposals`);

    // Filter and map to QIPs
    const qipMappings = filterAndMapQIPs(proposals);
    console.log(`📊 Found ${qipMappings.length} unique QIP proposals`);

    // Create output object with metadata
    const output = {
      space: QIDAO_SPACE,
      fetchedAt: new Date().toISOString(),
      totalProposals: proposals.length,
      qipCount: qipMappings.length,
      qips: qipMappings
    };

    // Write to cache file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);

    // Print summary
    console.log('\n📝 Summary:');
    console.log(`- Total proposals fetched: ${proposals.length}`);
    console.log(`- QIP proposals found: ${qipMappings.length}`);

    if (qipMappings.length > 0) {
      console.log(`- QIP number range: ${qipMappings[0].qipNumber} - ${qipMappings[qipMappings.length - 1].qipNumber}`);

      // Show sample
      console.log('\n🔍 Sample QIPs:');
      qipMappings.slice(0, 5).forEach(qip => {
        console.log(`  QIP-${qip.qipNumber}: ${qip.title.substring(0, 50)}${qip.title.length > 50 ? '...' : ''}`);
        console.log(`    ID: ${qip.proposalId}`);
        console.log(`    State: ${qip.state}`);
        console.log('');
      });
    }

    return output;
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

// Export for use in other scripts
export { fetchProposals, filterAndMapQIPs, extractQIPNumber };