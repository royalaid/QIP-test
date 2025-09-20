import { QIPExportData } from "@/services/qipClient";
import { type QIPData } from "../hooks/useQIPData";
import { toast } from "sonner";

export interface QIPExportJSON {
  metadata: {
    exportedAt: string;
    contractAddress: string;
    chain: string;
    exportVersion: string;
  };
  qip: {
    qipNumber: number;
    title: string;
    chain: string;
    status: string;
    statusId?: string;
    author: string;
    implementor: string;
    implementationDate: string;
    snapshotProposalId: string;
    created: string;
    lastUpdated: string;
    version: number;
    ipfsUrl: string;
    contentHash: string;
    content: string;
  };
  versions?: Array<{
    version: number;
    contentHash: string;
    ipfsUrl: string;
    timestamp: string;
    changeNote: string;
  }>;
  transactions?: string[];
}

/**
 * Format QIP data as markdown with frontmatter
 */
export function formatQIPAsMarkdown(qipData: QIPData | null, includeMetadata: boolean = true): string {
  if (!qipData) return "";

  // Build frontmatter
  const frontmatter = [
    "---",
    `qip: ${qipData.qipNumber}`,
    `title: ${qipData.title}`,
    `chain: ${qipData.chain}`,
    `status: ${qipData.status}`,
    `author: ${qipData.author}`,
    `implementor: ${qipData.implementor || "None"}`,
    `implementation-date: ${qipData.implementationDate || "None"}`,
    `proposal: ${qipData.proposal || "None"}`,
    `created: ${qipData.created}`,
  ];

  // Add optional metadata if requested
  if (includeMetadata) {
    frontmatter.push(`version: ${qipData.version || 1}`, `ipfs: ${qipData.ipfsUrl || ""}`);
  }

  frontmatter.push("---", "");

  // Combine frontmatter with content
  let markdown = frontmatter.join("\n") + (qipData.content || "");

  // Add export metadata as comments if requested
  if (includeMetadata) {
    const exportDate = new Date().toISOString();
    markdown += "\n\n";
    markdown += "<!-- Export Metadata -->\n";
    markdown += `<!-- Exported from QIP Registry at ${exportDate} -->\n`;
    if (qipData.version && qipData.version > 1) {
      markdown += `<!-- Version ${qipData.version} -->\n`;
    }
  }

  return markdown;
}

/**
 * Format QIP data as JSON export
 */
export function formatQIPAsJSON(
  qipData: QIPData | null,
  exportData?: QIPExportData | null,
  contractAddress?: string
): QIPExportJSON | null {
  if (!qipData) return null;

  const exportJSON: QIPExportJSON = {
    metadata: {
      exportedAt: new Date().toISOString(),
      contractAddress: contractAddress || "",
      chain: "Base",
      exportVersion: "1.0",
    },
    qip: {
      qipNumber: qipData.qipNumber,
      title: qipData.title,
      chain: qipData.chain,
      status: qipData.status,
      author: qipData.author,
      implementor: qipData.implementor || "None",
      implementationDate: qipData.implementationDate || "None",
      snapshotProposalId: qipData.proposal || "None",
      created: qipData.created,
      lastUpdated: new Date(qipData.lastUpdated || Date.now()).toISOString(),
      version: qipData.version || 1,
      ipfsUrl: qipData.ipfsUrl || "",
      contentHash: qipData.contentHash || "",
      content: qipData.content || "",
    },
  };

  // Add version history if available from export data
  if (exportData && exportData.versions.length > 0) {
    exportJSON.versions = exportData.versions.map((v, index) => ({
      version: index + 1,
      contentHash: v.contentHash,
      ipfsUrl: v.ipfsUrl,
      timestamp: new Date(Number(v.timestamp) * 1000).toISOString(),
      changeNote: v.changeNote,
    }));
  }

  return exportJSON;
}

/**
 * Trigger file download
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard with toast notification
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", {
      duration: 2000,
      position: "bottom-right",
    });
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    toast.error("Failed to copy to clipboard", {
      duration: 3000,
      position: "bottom-right",
    });
    return false;
  }
}

/**
 * Validate imported JSON data
 */
export function validateImportData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if it's an object
  if (typeof data !== "object" || data === null) {
    errors.push("Invalid data format: expected JSON object");
    return { valid: false, errors };
  }

  // Check for required QIP fields
  const qip = data.qip;
  if (!qip) {
    errors.push("Missing required field: qip");
    return { valid: false, errors };
  }

  // Validate required QIP fields
  const requiredFields = ["title", "chain", "content"];
  for (const field of requiredFields) {
    if (!qip[field]) {
      errors.push(`Missing required QIP field: ${field}`);
    }
  }

  // Validate chain value
  const validChains = [
    "Ethereum",
    "Base",
    "Polygon PoS",
    "Linea",
    "BNB",
    "Metis",
    "Optimism",
    "Arbitrum",
    "Avalanche",
    "Polygon zkEVM",
    "Gnosis",
    "Kava",
  ];
  if (qip.chain && !validChains.includes(qip.chain)) {
    errors.push(`Invalid chain: ${qip.chain}. Must be one of: ${validChains.join(", ")}`);
  }

  // Validate status if provided
  if (qip.status) {
    const validStatuses = ["Draft", "Ready for Snapshot", "Posted to Snapshot"];
    if (!validStatuses.includes(qip.status)) {
      errors.push(`Invalid status: ${qip.status}. Must be one of: ${validStatuses.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert imported JSON to format expected by ProposalEditor
 */
export function convertImportToEditorFormat(importData: QIPExportJSON): {
  title: string;
  chain: string;
  content: string;
  implementor: string;
  qipNumber?: number;
} {
  const qip = importData.qip;

  return {
    title: qip.title,
    chain: qip.chain,
    content: qip.content,
    implementor: qip.implementor !== "None" ? qip.implementor : "",
    qipNumber: qip.qipNumber,
  };
}

/**
 * Generate a comprehensive QIP archive filename
 */
export function generateExportFilename(qipNumber: number, format: "md" | "json" | "archive", version?: number): string {
  const date = new Date().toISOString().split("T")[0];
  const versionStr = version && version > 1 ? `-v${version}` : "";

  switch (format) {
    case "md":
      return `QIP-${qipNumber}${versionStr}-${date}.md`;
    case "json":
      return `QIP-${qipNumber}${versionStr}-export-${date}.json`;
    case "archive":
      return `QIP-${qipNumber}-archive-${date}.zip`;
    default:
      return `QIP-${qipNumber}-${date}.txt`;
  }
}
