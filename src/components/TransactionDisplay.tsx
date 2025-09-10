import React from 'react';
import { ABIParser } from '../utils/abiParser';
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
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Transaction #{index + 1}
                  </span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {tx.chain}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contract:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{tx.contractAddress}</code>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Function:</span>
                    <code className="text-sm font-mono font-semibold">{tx.functionName}</code>
                  </div>

                  {tx.args.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Arguments:</span>
                      <div className="mt-1 space-y-1">
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
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Full Transaction String:</span>
                    <button
                      onClick={() => handleCopy(txString, index)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted/50"
                    >
                      {copiedIndex === index ? (
                        <>
                          <CheckCircle size={12} className="text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-1 rounded bg-muted/30 p-2">
                    <code className="text-xs font-mono break-all">{txString}</code>
                  </div>
                </div>
              </div>
            );
          } catch (error) {
            // If parsing fails, show raw transaction string
            return (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Transaction #{index + 1}
                  </span>
                  <button
                    onClick={() => handleCopy(txString, index)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    {copiedIndex === index ? (
                      <>
                        <CheckCircle size={12} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="rounded bg-muted/30 p-2">
                  <code className="text-xs font-mono break-all">{txString}</code>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};