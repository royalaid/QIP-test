import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { copyToClipboard, formatQIPAsMarkdown } from '@/utils/qipExport';
import { type QIPData } from '@/hooks/useQIPData';

interface MarkdownExportButtonProps {
  qipData: QIPData | null;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const MarkdownExportButton: React.FC<MarkdownExportButtonProps> = ({
  qipData,
  variant = 'ghost',
  size = 'icon',
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!qipData) return;

    const markdown = formatQIPAsMarkdown(qipData, true);
    const success = await copyToClipboard(markdown);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!qipData) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleCopy}
            variant={variant}
            size={size}
            className={className}
            aria-label="Copy QIP as Markdown"
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