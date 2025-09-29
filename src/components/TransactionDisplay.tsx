import React from 'react';
import { ABIParser } from '../utils/abiParser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';

interface TransactionDisplayProps {
  transactions: string[];
  className?: string;
}

export const TransactionDisplay: React.FC<TransactionDisplayProps> = ({ transactions, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getChainExplorerUrl = (chain: string, address: string): string | null => {
    const explorers: Record<string, string> = {
      'Ethereum': 'https://etherscan.io/address/',
      'Polygon': 'https://polygonscan.com/address/',
      'Base': 'https://basescan.org/address/',
      'Arbitrum': 'https://arbiscan.io/address/',
      'Optimism': 'https://optimistic.etherscan.io/address/',
      'BSC': 'https://bscscan.com/address/',
      'Avalanche': 'https://snowtrace.io/address/',
      'Metis': 'https://andromeda-explorer.metis.io/address/'
    };

    const explorerBase = explorers[chain];
    return explorerBase ? `${explorerBase}${address}` : null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground">Transactions</h3>
      <div className="space-y-3">
        {transactions.map((txString, index) => {
          try {
            const tx = ABIParser.parseTransaction(txString);
            const explorerUrl = getChainExplorerUrl(tx.chain, tx.contractAddress);

            return (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Transaction #{index + 1}
                    </CardTitle>
                    <Badge variant="secondary">
                      {tx.chain}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contract Address */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Contract:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono">{tx.contractAddress}</code>
                        {explorerUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            asChild
                          >
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Function Name */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Function:</span>
                    <code className="text-sm font-mono font-semibold">{tx.functionName}</code>
                  </div>

                  {/* Arguments */}
                  {tx.args.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Arguments:</span>
                      <div className="space-y-1">
                        {tx.args.map((arg, argIndex) => (
                          <div key={argIndex} className="rounded bg-muted/30 p-2">
                            <code className="text-xs font-mono break-all">
                              {typeof arg === 'object' ? JSON.stringify(arg) : String(arg)}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Full Transaction String */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Full Transaction String:</span>
                      <Button
                        onClick={() => handleCopy(txString, index)}
                        variant="ghost"
                        size="sm"
                        className="h-7"
                      >
                        {copiedIndex === index ? (
                          <>
                            <CheckCircle size={12} className="mr-1 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} className="mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded bg-muted/30 p-2">
                      <code className="text-xs font-mono break-all">{txString}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          } catch (error) {
            // If parsing fails, show raw transaction string
            return (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Transaction #{index + 1}
                  </CardTitle>
                  <CardDescription>
                    Unable to parse transaction format
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Raw Transaction String:</span>
                      <Button
                        onClick={() => handleCopy(txString, index)}
                        variant="ghost"
                        size="sm"
                        className="h-7"
                      >
                        {copiedIndex === index ? (
                          <>
                            <CheckCircle size={12} className="mr-1 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} className="mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded bg-muted/30 p-2">
                      <code className="text-xs font-mono break-all">{txString}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
        })}
      </div>
    </div>
  );
};