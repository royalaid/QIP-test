import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileJson,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyToClipboard, formatQIPAsMarkdown, formatQIPAsJSON, downloadFile, generateExportFilename } from "@/utils/qipExport";
  import { type QIPExportData } from "@/services/qipClient";
import { type QIPData } from '@/hooks/useQIPData';
import { QIPClient } from '@/services/qipClient';
import { config } from '@/config/env';

interface ExportMenuProps {
  qipData: QIPData | null;
  registryAddress?: string;
  rpcUrl?: string;
  className?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  qipData,
  registryAddress = config.qipRegistryAddress,
  rpcUrl = config.baseRpcUrl,
  className = ''
}) => {
  const [isLoadingExport, setIsLoadingExport] = useState(false);

  const handleCopyMarkdown = async () => {
    if (!qipData) return;
    const markdown = formatQIPAsMarkdown(qipData, true);
    await copyToClipboard(markdown);
  };

  const handleDownloadMarkdown = () => {
    if (!qipData) return;
    const markdown = formatQIPAsMarkdown(qipData, true);
    const filename = generateExportFilename(qipData.qipNumber, 'md', qipData.version);
    downloadFile(markdown, filename, 'text/markdown');
  };

  const handleCopyJSON = async () => {
    if (!qipData) return;

    setIsLoadingExport(true);
    try {
      // Try to fetch full export data from contract if possible
      let exportData: QIPExportData | null = null;
      if (registryAddress) {
        try {
          const qipClient = new QIPClient(registryAddress as `0x${string}`, rpcUrl);
          exportData = await qipClient.exportQIP(BigInt(qipData.qipNumber));
        } catch (error) {
          console.warn("Could not fetch export data from contract:", error);
        }
      }

      const jsonData = formatQIPAsJSON(qipData, exportData, registryAddress);
      if (jsonData) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        await copyToClipboard(jsonString);
      }
    } finally {
      setIsLoadingExport(false);
    }
  };

  const handleDownloadJSON = async () => {
    if (!qipData) return;

    setIsLoadingExport(true);
    try {
      // Try to fetch full export data from contract if possible
      let exportData: QIPExportData | null = null;
      if (registryAddress) {
        try {
          const qipClient = new QIPClient(registryAddress as `0x${string}`, rpcUrl);
          exportData = await qipClient.exportQIP(BigInt(qipData.qipNumber));
        } catch (error) {
          console.warn("Could not fetch export data from contract:", error);
        }
      }

      const jsonData = formatQIPAsJSON(qipData, exportData, registryAddress);
      if (jsonData) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const filename = generateExportFilename(qipData.qipNumber, "json", qipData.version);
        downloadFile(jsonString, filename, "application/json");
      }
    } finally {
      setIsLoadingExport(false);
    }
  };


  if (!qipData) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyMarkdown}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Markdown
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleCopyJSON} disabled={isLoadingExport}>
          <Copy className="mr-2 h-4 w-4" />
          {isLoadingExport ? 'Copying...' : 'Copy JSON'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDownloadMarkdown}>
          <FileText className="mr-2 h-4 w-4" />
          Download Markdown
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDownloadJSON} disabled={isLoadingExport}>
          <FileJson className="mr-2 h-4 w-4" />
          {isLoadingExport ? 'Downloading...' : 'Download JSON'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};