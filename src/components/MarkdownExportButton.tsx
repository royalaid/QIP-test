import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { copyToClipboard, formatQCIAsMarkdown } from '@/utils/qciExport';
import { type QCIData } from '@/hooks/useQCIData';

interface MarkdownExportButtonProps {
  qciData: QCIData | null;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const MarkdownExportButton: React.FC<MarkdownExportButtonProps> = ({
  qciData,
  variant = 'ghost',
  size = 'icon',
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!qciData) return;

    const markdown = formatQCIAsMarkdown(qciData, true);
    const success = await copyToClipboard(markdown);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!qciData) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleCopy}
            variant={variant}
            size={size}
            className={className}
            aria-label="Copy QCI as Markdown"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? 'Copied!' : 'Copy as Markdown'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};