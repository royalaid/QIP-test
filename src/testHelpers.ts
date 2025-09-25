import { keccak256, toHex } from 'viem';

// QCI Status enum
export enum QCIStatus {
  Draft,
  ReviewPending,
  VotePending,
  Approved,
  Rejected,
  Implemented,
  Superseded,
  Withdrawn
}

// Sample QCI templates
export const QCITemplates = {
  technicalUpgrade: {
    title: 'Protocol Technical Upgrade',
    networks: ['Polygon', 'Ethereum', 'Base', 'Arbitrum'],
    contentTemplate: (qciNumber: number) => `# QCI-${qciNumber}: Protocol Technical Upgrade

## Summary
This proposal aims to upgrade the protocol's core smart contracts to improve efficiency and add new features.

## Motivation
Current implementation has limitations that prevent scaling and optimal performance.

## Specification
- Upgrade core contracts to version 2.0
- Implement new gas optimization techniques
- Add support for batch operations
- Improve error handling

## Implementation
The implementation will be carried out in phases:
1. Testnet deployment and testing
2. Security audit
3. Mainnet deployment with timelock
4. Migration of existing positions

## Security Considerations
- Full audit by certified security firm required
- Bug bounty program will be enhanced
- Gradual rollout with monitoring

## Timeline
- Development: 4 weeks
- Testing: 2 weeks
- Audit: 3 weeks
- Deployment: 1 week
`
  },
  
  economicProposal: {
    title: 'Economic Parameter Adjustment',
    networks: ['Polygon', 'Base'],
    contentTemplate: (qciNumber: number) => `# QCI-${qciNumber}: Economic Parameter Adjustment

## Summary
Adjust protocol economic parameters to optimize for current market conditions.

## Proposed Changes
- Interest rate model adjustment
- Collateral factor modifications
- Fee structure optimization

## Impact Analysis
Expected outcomes:
- Increased protocol revenue
- Better risk management
- Improved user experience

## Implementation
Changes will be implemented through governance timelock with a 48-hour delay.
`
  },
  
  governanceProposal: {
    title: 'Governance Process Enhancement',
    networks: ['Multi-Chain'],
    contentTemplate: (qciNumber: number) => `# QCI-${qciNumber}: Governance Process Enhancement

## Summary
Improve the governance process to increase participation and efficiency.

## Proposed Changes
- Reduce proposal threshold
- Implement delegation incentives
- Add quadratic voting option
- Create governance committee

## Benefits
- Higher participation rates
- More diverse representation
- Faster decision making
- Better proposal quality

## Implementation Timeline
- Community discussion: 2 weeks
- Snapshot vote: 1 week
- Implementation: 2 weeks
`
  },
  
  newFeature: {
    title: 'New Feature Implementation',
    networks: ['Base', 'Ethereum'],
    contentTemplate: (qciNumber: number) => `# QCI-${qciNumber}: New Feature Implementation

## Summary
Add new functionality to expand protocol capabilities.

## Feature Description
Implement cross-chain messaging to enable seamless multi-chain operations.

## Technical Specification
- Use LayerZero for cross-chain communication
- Implement message verification
- Add replay protection
- Support for 5 initial chains

## Security Model
- Multi-sig validation
- Time delays for critical operations
- Emergency pause functionality

## Rollout Plan
1. Beta testing with limited users
2. Gradual increase in limits
3. Full production release
`
  }
};

// Generate realistic QCI content
export function generateQCIContent(
  qciNumber: number,
  template: keyof typeof QCITemplates = 'technicalUpgrade'
): {
  title: string;
  network: string;
  content: string;
  contentHash: `0x${string}`;
  ipfsUrl: string;
} {
  const selectedTemplate = QCITemplates[template];
  const network = selectedTemplate.networks[Math.floor(Math.random() * selectedTemplate.networks.length)];
  const content = selectedTemplate.contentTemplate(qciNumber);
  const contentHash = keccak256(toHex(content));
  
  // Generate fake IPFS hash (in real scenario, would upload to IPFS)
  const ipfsUrl = `ipfs://Qm${generateRandomString(44)}`;
  
  return {
    title: `${selectedTemplate.title} - QCI ${qciNumber}`,
    network,
    content,
    contentHash,
    ipfsUrl
  };
}

// Generate random string for fake IPFS hashes
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simulate different user personas
export const TestPersonas = {
  activeGovernor: {
    name: 'Active Governor',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    behavior: 'Creates well-structured proposals, actively participates in discussions',
    qciTypes: ['technicalUpgrade', 'economicProposal']
  },
  
  technicalContributor: {
    name: 'Technical Contributor',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    behavior: 'Focuses on technical improvements and security',
    qciTypes: ['technicalUpgrade', 'newFeature']
  },
  
  communityMember: {
    name: 'Community Member',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    behavior: 'Proposes user-facing improvements and governance changes',
    qciTypes: ['governanceProposal', 'newFeature']
  }
};

// Helper to format QCI status
export function formatQCIStatus(status: QCIStatus): string {
  const statusEmojis = {
    [QCIStatus.Draft]: '📝',
    [QCIStatus.ReviewPending]: '👀',
    [QCIStatus.VotePending]: '🗳️',
    [QCIStatus.Approved]: '✅',
    [QCIStatus.Rejected]: '❌',
    [QCIStatus.Implemented]: '🚀',
    [QCIStatus.Superseded]: '🔄',
    [QCIStatus.Withdrawn]: '🚫'
  };
  
  return `${statusEmojis[status]} ${QCIStatus[status]}`;
}

// Helper to generate a timeline of QCI events
export function generateQCITimeline(qciNumber: number): string[] {
  const events = [
    `Created QCI-${qciNumber} as Draft`,
    'Author updated content with community feedback',
    'Moved to ReviewPending by editor',
    'Final revision submitted',
    'Snapshot proposal created',
    'Voting period started',
    'Voting period ended - Proposal passed',
    'Implementation started',
    'Implementation completed and verified'
  ];
  
  return events;
}

// Helper to simulate IPFS content
export function simulateIPFSContent(qciNumber: number, version: number = 1): {
  cid: string;
  content: string;
  size: number;
} {
  const content = QCITemplates.technicalUpgrade.contentTemplate(qciNumber);
  const versionNote = version > 1 ? `\n\n---\n_Version ${version}: Updated based on community feedback_` : '';
  const fullContent = content + versionNote;
  
  return {
    cid: `Qm${generateRandomString(44)}`,
    content: fullContent,
    size: Buffer.from(fullContent).length
  };
}

// Batch QCI creation helper
export async function createBatchQCIs(
  registry: any,
  startNumber: number,
  count: number
): Promise<{ qciNumber: number; txHash: string }[]> {
  const results = [];
  
  for (let i = 0; i < count; i++) {
    const qciNumber = startNumber + i;
    const qciData = generateQCIContent(qciNumber, 'technicalUpgrade');
    
    const txHash = await registry.write.createQCI([
      qciData.title,
      qciData.network,
      qciData.contentHash,
      qciData.ipfsUrl
    ]);
    
    results.push({ qciNumber, txHash });
  }
  
  return results;
}

// Export test scenarios
export const TestScenarios = {
  // Scenario 1: Complete lifecycle of a QCI
  completeLifecycle: {
    description: 'Test full QCI lifecycle from Draft to Implemented',
    steps: [
      'Create QCI as Draft',
      'Update content based on feedback',
      'Move to ReviewPending',
      'Link Snapshot proposal',
      'Update status to Approved',
      'Set implementation details',
      'Mark as Implemented'
    ]
  },
  
  // Scenario 2: Rejected proposal
  rejectedProposal: {
    description: 'Test rejection flow',
    steps: [
      'Create QCI',
      'Move to ReviewPending',
      'Link Snapshot proposal',
      'Update status to Rejected'
    ]
  },
  
  // Scenario 3: Withdrawn proposal
  withdrawnProposal: {
    description: 'Test withdrawal by author',
    steps: [
      'Create QCI',
      'Author requests withdrawal',
      'Editor updates status to Withdrawn'
    ]
  },
  
  // Scenario 4: Superseded proposal
  supersededProposal: {
    description: 'Test superseding an old proposal',
    steps: [
      'Create original QCI',
      'Implement original QCI',
      'Create new QCI with improvements',
      'Mark original as Superseded'
    ]
  }
};