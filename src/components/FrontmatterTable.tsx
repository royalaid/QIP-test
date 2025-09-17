import React from "react";
import { format } from "date-fns";

import Author from "./Author";
import InlineStatusEditor from "./InlineStatusEditor";
import { QIPStatus } from "../services/qipClient";

// Status color mapping
const statusColor: any = {
  Draft: "#757575",
  "Ready for Snapshot": "#FFEB3B",
  "Posted to Snapshot": "#4CAF50",
};

interface Props {
  frontmatter: any;
  // Optional editing props
  qipNumber?: number;
  statusEnum?: QIPStatus;
  isAuthor?: boolean;
  isEditor?: boolean;
  onStatusUpdate?: () => void;
  registryAddress?: `0x${string}`;
  rpcUrl?: string;
  enableStatusEdit?: boolean;
}

const FrontmatterTable: React.FC<Props> = ({
  frontmatter,
  qipNumber,
  statusEnum,
  isAuthor = false,
  isEditor = false,
  onStatusUpdate,
  registryAddress,
  rpcUrl,
  enableStatusEdit = false
}) => {
  return (
    <table className="border border-collapse bg-muted/30 dark:bg-zinc-800/50 min-w-full divide-y divide-border">
      <tbody className="bg-card divide-y divide-border">
        <tr>
          <th className="py-3 px-6 text-left font-bold">Author</th>
          <td className="py-3 px-6">
            <Author author={frontmatter.author} showName={true} />
          </td>
        </tr>
        <tr>
          <th className="py-3 px-6 text-left font-bold">Status</th>
          <td className="py-3 px-6">
            {enableStatusEdit && qipNumber && registryAddress ? (
              <InlineStatusEditor
                qipNumber={qipNumber}
                currentStatus={frontmatter.status}
                currentStatusEnum={statusEnum}
                isAuthor={isAuthor}
                isEditor={isEditor}
                onStatusUpdate={onStatusUpdate}
                registryAddress={registryAddress}
                rpcUrl={rpcUrl}
              />
            ) : (
              <span
                style={{
                  backgroundColor: statusColor[frontmatter.status] || "#757575",
                }}
                className="text-white text-xs px-3 py-1 rounded-full font-medium inline-block"
              >
                {frontmatter.status}
              </span>
            )}
          </td>
        </tr>
        {frontmatter.type && (
          <tr>
            <th className="py-3 px-6 text-left font-bold">Type</th>
            <td className="py-3 px-6">{frontmatter.type}</td>
          </tr>
        )}
        {frontmatter.network && (
          <tr>
            <th className="py-3 px-6 text-left font-bold">Network</th>
            <td className="py-3 px-6">{frontmatter.network}</td>
          </tr>
        )}
        <tr>
          <th className="py-3 px-6 text-left font-bold">Implementor</th>
          <td className="py-3 px-6">{frontmatter.implementor || "TBD"}</td>
        </tr>
        <tr>
          <th className="py-3 px-6 text-left font-bold">Release</th>
          <td className="py-3 px-6">{frontmatter.release || "TBD"}</td>
        </tr>
        {frontmatter.created && (
          <tr>
            <th className="py-3 px-6 text-left font-bold">Created</th>
            <td className="py-3 px-6">
              {format(new Date(frontmatter.created), "yyyy-MM-dd")}
            </td>
          </tr>
        )}
        {frontmatter.updated && (
          <tr>
            <th className="py-3 px-6 text-left font-bold">Updated</th>
            <td className="py-3 px-6">
              {format(new Date(frontmatter.created), "yyyy-MM-dd")}
            </td>
          </tr>
        )}
      </tbody>

      <tfoot>
        <tr className="bg-muted/30 dark:bg-zinc-800/50"></tr>
      </tfoot>
    </table>
  );
};

export default FrontmatterTable;
