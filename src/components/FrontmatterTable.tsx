import React from "react";
import { format } from "date-fns";

import Author from "./Author";
import InlineStatusEditor from "./InlineStatusEditor";
import { QCIStatus } from "../services/qciClient";
import { StatusBadge } from "./ui/status-badge";

interface Props {
  frontmatter: any;
  // Optional editing props
  qciNumber?: number;
  statusEnum?: QCIStatus;
  isAuthor?: boolean;
  isEditor?: boolean;
  onStatusUpdate?: () => void;
  registryAddress?: `0x${string}`;
  rpcUrl?: string;
  enableStatusEdit?: boolean;
}

const FrontmatterTable: React.FC<Props> = ({
  frontmatter,
  qciNumber,
  statusEnum,
  isAuthor = false,
  isEditor = false,
  onStatusUpdate,
  registryAddress,
  rpcUrl,
  enableStatusEdit = false,
}) => {
  // Assemble rows as [label, value]
  const rows: Array<[string, React.ReactNode]> = [];
  rows.push(["Author", <Author author={frontmatter.author} showName={true} />]);
  rows.push([
    "Status",
    enableStatusEdit && qciNumber && registryAddress ? (
      <InlineStatusEditor
        qciNumber={qciNumber}
        currentStatus={frontmatter.status}
        currentStatusEnum={statusEnum}
        isAuthor={isAuthor}
        isEditor={isEditor}
        onStatusUpdate={onStatusUpdate}
        registryAddress={registryAddress}
        rpcUrl={rpcUrl}
      />
    ) : (
      <StatusBadge status={frontmatter.status} size="sm" />
    ),
  ]);
  if (frontmatter.type) rows.push(["Type", frontmatter.type]);
  if (frontmatter.chain) rows.push(["Chain", frontmatter.chain]);
  rows.push(["Implementor", frontmatter.implementor || "TBD"]);
  rows.push(["Release", frontmatter.release || "TBD"]);
  if (frontmatter.created) rows.push(["Created", format(new Date(frontmatter.created), "yyyy-MM-dd")]);
  if (frontmatter.updated) rows.push(["Updated", format(new Date(frontmatter.updated), "yyyy-MM-dd")]);

  return (
    <div className="rounded-lg border bg-muted/30 dark:bg-zinc-800/50 overflow-hidden">
      <div className="grid grid-cols-[max-content,1fr]">
        {rows.map(([label, value], idx) => {
          const cellBase = "p-4 text-sm text-left";
          const leftCell = `font-semibold text-muted-foreground whitespace-nowrap ${cellBase}`;
          const rightCell = `${cellBase}`;
          const borderTop = idx === 0 ? "" : "border-t border-border";
          return (
            <React.Fragment key={idx}>
              <div className={`${leftCell} ${borderTop}`}>{label}</div>
              <div className={`${rightCell} ${borderTop}`}>{value}</div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default FrontmatterTable;
