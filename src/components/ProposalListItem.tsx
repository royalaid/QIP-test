import React from 'react';
import { Link } from 'react-router-dom';
import Author from './Author';
import { useQueryClient } from '@tanstack/react-query';
import { QIPClient } from '../services/qipClient';
import { getIPFSService } from '../services/getIPFSService';
import { config } from '../config/env';
import { CACHE_TIMES } from '../config/queryClient';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
// Proposal list item component

const statusColor:any = {
    Draft: '#757575',
    'Ready for Snapshot': '#FFEB3B',
    'Posted to Snapshot': '#4CAF50',
    // Legacy mappings for backward compatibility
    Review: '#FFEB3B',
    'Review Pending': '#FFEB3B',
    Vote: '#FFEB3B',
    'Vote Pending': '#FFEB3B',
    Rejected: '#F44336',
    Approved: '#4CAF50',
    Implemented: '#4CAF50',
    Superseded: '#9E9E9E',
    Withdrawn: '#9E9E9E',
    Templates: '#757575',
};

const ProposalListItem = (props: any) => {
    const { proposals } = props;
    const queryClient = useQueryClient();
    const ipfsService = getIPFSService();
    
    // Track ongoing prefetches to avoid duplicates
    const prefetchingRef = React.useRef<Set<number>>(new Set());
    
    // Prefetch QIP data on hover
    const handleMouseEnter = async (qipNumber: number) => {
        const registryAddress = config.qipRegistryAddress;
        if (!registryAddress) return;
        
        // Avoid duplicate prefetches
        if (prefetchingRef.current.has(qipNumber)) {
            console.log('[ProposalListItem] Already prefetching QIP:', qipNumber);
            return;
        }
        
        // Check if already cached
        const cacheKey = ['qip', qipNumber, registryAddress];
        const cached = queryClient.getQueryData(cacheKey);
        
        if (!cached) {
            console.debug(`[ProposalListItem] Prefetching QIP ${qipNumber} on hover`);
            prefetchingRef.current.add(qipNumber);
            
            // Prefetch the QIP data
            try {
                await queryClient.prefetchQuery({
                    queryKey: cacheKey,
                    queryFn: async () => {
                        const qipClient = new QIPClient(registryAddress, config.baseRpcUrl, false);
                        
                        let qip;
                        try {
                            qip = await qipClient.getQIP(BigInt(qipNumber));
                        } catch (error: any) {
                            // Handle non-existent QIPs gracefully
                            if (error?.message?.includes('returned no data') || error?.message?.includes('0x')) {
                                console.debug(`[ProposalListItem] QIP ${qipNumber} does not exist in contract`);
                                return null;
                            }
                            throw error;
                        }
                        
                        if (!qip || qip.qipNumber === 0n) return null;
                        
                        // Also prefetch IPFS content
                        const ipfsContent = await ipfsService.fetchQIP(qip.ipfsUrl);
                        const { frontmatter, content } = ipfsService.parseQIPMarkdown(ipfsContent);
                        
                        // Cache IPFS separately
                        queryClient.setQueryData(['ipfs', qip.ipfsUrl], {
                            raw: ipfsContent,
                            frontmatter,
                            body: content,
                            cid: qip.ipfsUrl,
                        });
                        
                        const implDate = qip.implementationDate > 0n 
                            ? new Date(Number(qip.implementationDate) * 1000).toISOString().split('T')[0]
                            : 'None';
                        
                        return {
                            qipNumber,
                            title: qip.title,
                            network: qip.network,
                            status: qipClient.getStatusString(qip.status),
                            author: frontmatter.author || qip.author,
                            implementor: qip.implementor,
                            implementationDate: implDate,
                            // Filter out TBU and other placeholders
                            proposal: (qip.snapshotProposalId && 
                                      qip.snapshotProposalId !== 'TBU' && 
                                      qip.snapshotProposalId !== 'tbu' &&
                                      qip.snapshotProposalId !== 'None') 
                                      ? qip.snapshotProposalId 
                                      : 'None',
                            created: frontmatter.created || new Date(Number(qip.createdAt) * 1000).toISOString().split('T')[0],
                            content,
                            ipfsUrl: qip.ipfsUrl,
                            contentHash: qip.contentHash,
                            version: Number(qip.version),
                            source: 'blockchain' as const,
                            lastUpdated: Date.now()
                        };
                    },
                    staleTime: CACHE_TIMES.STALE_TIME.QIP_DETAIL,
                    gcTime: CACHE_TIMES.GC_TIME.QIP_DETAIL,
                });
            } catch (error) {
                console.error('[ProposalListItem] Prefetch error for QIP:', qipNumber, error);
            } finally {
                // Remove from prefetching set
                prefetchingRef.current.delete(qipNumber);
            }
        } else {
            console.log('[ProposalListItem] QIP already cached:', qipNumber);
        }
    };

    // Helper function to get data from proposal (handles both markdown and blockchain structures)
    const getProposalData = (proposal: any) => {
        // Check if this is a blockchain QIP (has qipNumber) or markdown QIP (has frontmatter)
        const isBlockchainQIP = proposal.qipNumber !== undefined;
        
        if (isBlockchainQIP) {
            return {
                qip: proposal.qipNumber,
                title: proposal.title,
                author: proposal.author,
                status: proposal.status,
                shortDescription: proposal.content?.substring(0, 200) || ''
            };
        } else {
            // Markdown QIP structure
            return {
                qip: proposal.frontmatter?.qip,
                title: proposal.frontmatter?.title,
                author: proposal.frontmatter?.author,
                status: proposal.frontmatter?.status,
                shortDescription: proposal.frontmatter?.shortDescription || ''
            };
        }
    };

    return (
        <div className="space-y-3">
            {proposals.map((proposal: any, index: number) => {
                const data = getProposalData(proposal);
                
                return (
                  <Card key={index} className="hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <Link to={`/qips/${data.qip}`} className="block" onMouseEnter={() => handleMouseEnter(data.qip)}>
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <CardDescription className="text-sm font-medium">
                            QIP-{data.qip}
                          </CardDescription>
                          <span
                            style={{ backgroundColor: statusColor[data.status] }}
                            className="text-white text-xs px-2 py-1 rounded-full font-medium"
                          >
                            {data.status}
                          </span>
                        </div>
                        <CardTitle className="text-xl">
                          {data.title}
                        </CardTitle>
                      </CardHeader>
                      {data.shortDescription && (
                        <CardContent>
                          <p className="text-muted-foreground text-sm line-clamp-2">
                            {data.shortDescription}
                          </p>
                        </CardContent>
                      )}
                    </Link>
                  </Card>
                );
            })}
        </div>
    );
};

export default ProposalListItem;
