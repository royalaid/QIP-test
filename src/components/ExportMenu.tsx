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
import { copyToClipboard, formatQCIAsMarkdown, formatQCIAsJSON, downloadFile, generateExportFilename } from "@/utils/qciExport";
  import { type QCIExportData } from "@/services/qciClient";
import { type QCIData } from '@/hooks/useQCIData';
import { QCIClient } from '@/services/qciClient';
import { config } from '@/config/env';

interface ExportMenuProps {
  qciData: QCIData | null;
  registryAddress?: string;
  rpcUrl?: string;
  className?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  qciData,
  registryAddress = config.qciRegistryAddress,
  rpcUrl = config.baseRpcUrl,
  className = ''
}) => {
  const [isLoadingExport, setIsLoadingExport] = useState(false);

  const handleCopyMarkdown = async () => {
    if (!qciData) return;
    const markdown = formatQCIAsMarkdown(qciData, true);
    await copyToClipboard(markdown);
  };

  const handleDownloadMarkdown = () => {
    if (!qciData) return;
    const markdown = formatQCIAsMarkdown(qciData, true);
    const filename = generateExportFilename(qciData.qciNumber, 'md', qciData.version);
    downloadFile(markdown, filename, 'text/markdown');
  };

  const handleCopyJSON = async () => {
    if (!qciData) return;

    setIsLoadingExport(true);
    try {
      // Try to fetch full export data from contract if possible
      let exportData: QCIExportData | null = null;
      if (registryAddress) {
        try {
          const qciClient = new QCIClient(registryAddress as `0x${string}`, rpcUrl);
          exportData = await qciClient.exportQCI(BigInt(qciData.qciNumber));
        } catch (error) {
          console.warn("Could not fetch export data from contract:", error);
        }
      }

      const jsonData = formatQCIAsJSON(qciData, exportData, registryAddress);
      if (jsonData) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        await copyToClipboard(jsonString);
      }
    } finally {
      setIsLoadingExport(false);
    }
  };

  const handleDownloadJSON = async () => {
    if (!qciData) return;

    setIsLoadingExport(true);
    try {
      // Try to fetch full export data from contract if possible
      let exportData: QCIExportData | null = null;
      if (registryAddress) {
        try {
          const qciClient = new QCIClient(registryAddress as `0x${string}`, rpcUrl);
          exportData = await qciClient.exportQCI(BigInt(qciData.qciNumber));
        } catch (error) {
          console.warn("Could not fetch export data from contract:", error);
        }
      }

      const jsonData = formatQCIAsJSON(qciData, exportData, registryAddress);
      if (jsonData) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const filename = generateExportFilename(qciData.qciNumber, "json", qciData.version);
        downloadFile(jsonString, filename, "application/json");
      }
    } finally {
      setIsLoadingExport(false);
    }
  };


  if (!qciData) return null;

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