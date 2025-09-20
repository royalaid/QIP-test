import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileJson,
  Copy,
  Archive,
  Upload,
  MoreVertical
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
  onImport?: () => void;
  className?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  qipData,
  registryAddress = config.qipRegistryAddress,
  rpcUrl = config.baseRpcUrl,
  onImport,
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

  const handleExportJSON = async () => {
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

  const handleDownloadArchive = async () => {
    if (!qipData) return;

    setIsLoadingExport(true);
    try {
      // For now, we'll export as JSON with all data
      // In the future, this could be enhanced to create a ZIP file with all versions
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
        const filename = `QIP-${qipData.qipNumber}-complete-export.json`;
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

        <DropdownMenuItem onClick={handleDownloadMarkdown}>
          <FileText className="mr-2 h-4 w-4" />
          Download Markdown (.md)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportJSON} disabled={isLoadingExport}>
          <FileJson className="mr-2 h-4 w-4" />
          {isLoadingExport ? 'Exporting...' : 'Export as JSON'}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDownloadArchive} disabled={isLoadingExport}>
          <Archive className="mr-2 h-4 w-4" />
          {isLoadingExport ? 'Preparing...' : 'Download Full Archive'}
        </DropdownMenuItem>

        {onImport && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onImport}>
              <Upload className="mr-2 h-4 w-4" />
              Import from JSON
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};