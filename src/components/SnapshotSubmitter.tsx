import React, { useState, useEffect } from "react";
import { useEthersSigner } from "../utils/ethers";
import { createProposal, getProposals } from "../utils/snapshotClient";
import { Proposal } from "@snapshot-labs/snapshot.js/dist/src/sign/types";
import { ethers } from "ethers";
import { useQuery } from "@tanstack/react-query";
import { config } from "../config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

interface SnapshotSubmitterProps {
  frontmatter: any;
  html: string;
  rawMarkdown: string;
}

const SnapshotSubmitter: React.FC<SnapshotSubmitterProps> = ({ frontmatter, html, rawMarkdown }) => {
  const signer = useEthersSigner();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<React.ReactNode>(null);
  const [highestQip, setHighestQip] = useState<number | null>(null);

  const SNAPSHOT_SPACE = config.snapshotSpace;
  const isDefaultSpace = SNAPSHOT_SPACE === "qidao.eth";

  // Conditional validation based on space
  const requiresTokenBalance = isDefaultSpace;
  const requiresQipValidation = isDefaultSpace;

  const formatProposalBody = (rawMarkdown: string, frontmatter: any) => {
    // Remove frontmatter from the beginning of the markdown
    const content = rawMarkdown.replace(/^---[\s\S]*?---\n?/, "").trim();

    // Add frontmatter information to the proposal body
    const frontmatterInfo = [];
    if (frontmatter.network) frontmatterInfo.push(`**Network:** ${frontmatter.network}`);
    if (frontmatter.author) frontmatterInfo.push(`**Author:** ${frontmatter.author}`);
    if (frontmatter.implementor) frontmatterInfo.push(`**Implementor:** ${frontmatter.implementor}`);
    if (frontmatter['implementation-date']) frontmatterInfo.push(`**Implementation Date:** ${frontmatter['implementation-date']}`);
    if (frontmatter.created) frontmatterInfo.push(`**Created:** ${frontmatter.created}`);

    // Combine frontmatter info with content
    return frontmatterInfo.length > 0
      ? `${frontmatterInfo.join('\n')}\n\n${content}`
      : content;
  };

  const { data: proposals, isLoading: loadingProposals } = useQuery({
    queryKey: ["proposals", SNAPSHOT_SPACE],
    queryFn: () => getProposals(SNAPSHOT_SPACE),
  });

  useEffect(() => {
    if (proposals) {
      const qipNumbers = proposals.map((p: any) => {
        const match = p.title.match(/QIP(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      });
      console.log("qipNumbers", qipNumbers);
      setHighestQip(Math.max(0, ...qipNumbers));
    }
  }, [proposals]);

  const TOKEN_CONTRACT_ADDRESS = "0x1bffabc6dfcafb4177046db6686e3f135e8bc732";
  const REQUIRED_BALANCE = 150000;
  const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"];

  const fetchTokenBalance = async () => {
    if (!signer || !requiresTokenBalance) return REQUIRED_BALANCE; // Return valid balance for non-default spaces
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signer);
    const address = await signer.getAddress();
    const [balance, decimals] = await Promise.all([tokenContract.balanceOf(address), tokenContract.decimals()]);
    return Number(ethers.utils.formatUnits(balance, decimals));
  };

  const { data: tokenBalance = requiresTokenBalance ? 0 : REQUIRED_BALANCE, isLoading: checkingBalance } = useQuery({
    queryKey: ["tokenBalance", TOKEN_CONTRACT_ADDRESS, signer ? "connected" : "disconnected", requiresTokenBalance],
    queryFn: fetchTokenBalance,
    enabled: !!signer,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const isQipValid = requiresQipValidation ? highestQip !== null && frontmatter.qip === highestQip + 1 : true;
  const space = SNAPSHOT_SPACE;

  const handleSubmit = async () => {
    if (!signer) {
      setStatus("Please connect your wallet first.");
      return;
    }
    if (requiresQipValidation && !isQipValid) {
      setStatus(`Error: Invalid QIP number. The next QIP should be #${highestQip === null ? "..." : highestQip + 1}.`);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      // Always use Ethereum mainnet blocks for all Snapshot proposals
      const ethProvider = new ethers.providers.JsonRpcProvider("https://eth.llamarpc.com");
      const snapshotBlock = await ethProvider.getBlockNumber();
      console.log("Using Ethereum mainnet block for snapshot:", snapshotBlock);

      // Calculate timestamps right before submission
      const now = Math.floor(Date.now() / 1000);
      const startOffset = 86400; // Exactly 24 hours
      const endOffset = 345600; // Exactly 4 days

      const proposalOptions: Proposal = {
        space,
        type: "basic",
        title: `QIP${frontmatter.qip}: ${frontmatter.title}`,
        body: formatProposalBody(rawMarkdown, frontmatter),
        choices: ["For", "Against", "Abstain"],
        start: now + startOffset,
        end: now + endOffset,
        snapshot: snapshotBlock, // Use the correct block number
        discussion: "",
        plugins: JSON.stringify({}),
        app: "snapshot-v2",
        timestamp: now, // Add explicit timestamp
      };

      const receipt = await createProposal(signer, "https://hub.snapshot.org", proposalOptions);
      if (receipt && (receipt as any).id) {
        const proposalId = (receipt as any).id;
        const proposalUrl = `https://snapshot.org/#/${space}/proposal/${proposalId}`;
        setStatus(
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Proposal created successfully!</span>
            <a
              href={proposalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline"
            >
              View proposal <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        );
      } else {
        setStatus(`Proposal created: ${JSON.stringify(receipt)}`);
      }
    } catch (e: any) {
      console.error("Snapshot submission error:", e);
      if (e.error && e.error_description) {
        setStatus(`Error: ${e.error_description}`);
      } else if (e.code === "ACTION_REJECTED" || e.code === 4001) {
        setStatus("Transaction cancelled by user");
      } else {
        setStatus(`Error: ${e.message || "Failed to create proposal. Please try again."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          Submit to Snapshot
          {!isDefaultSpace && (
            <span className="text-base font-normal text-primary">
              ({SNAPSHOT_SPACE})
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Create a governance proposal on Snapshot for community voting
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Messages */}
        {status && (
          <div
            className={`p-4 rounded-lg border ${
              typeof status === "string" && (status.includes("Error") || status.includes("failed") || status.includes("cancelled"))
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
            }`}
          >
            <div className="flex items-start gap-2">
              {typeof status === "string" && (status.includes("Error") || status.includes("failed") || status.includes("cancelled")) ? (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                {status}
              </div>
            </div>
          </div>
        )}

        {/* Prerequisites Info */}
        <div className="space-y-2">
          {signer && requiresTokenBalance && tokenBalance >= REQUIRED_BALANCE && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Token balance: {tokenBalance.toLocaleString()} (meets requirement)</span>
            </div>
          )}

          {requiresQipValidation && isQipValid && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>QIP number validation passed</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            disabled={
              !signer ||
              (requiresTokenBalance && tokenBalance < REQUIRED_BALANCE) ||
              loading ||
              (requiresTokenBalance && checkingBalance) ||
              !isQipValid ||
              (requiresQipValidation && loadingProposals)
            }
            className="w-full"
            size="lg"
          >
            {loading
              ? "Submitting..."
              : (requiresTokenBalance && checkingBalance) || (requiresQipValidation && loadingProposals)
              ? "Checking prerequisites..."
              : !signer
              ? "Connect Wallet"
              : requiresQipValidation && !isQipValid
              ? `Invalid QIP Number (currently ${frontmatter.qip}, next is ${highestQip === null ? "..." : highestQip + 1})`
              : requiresTokenBalance && tokenBalance < REQUIRED_BALANCE
              ? `Insufficient Balance (${tokenBalance.toLocaleString()} / ${REQUIRED_BALANCE.toLocaleString()} required)`
              : !isDefaultSpace
              ? `Submit to ${SNAPSHOT_SPACE}`
              : "Submit to Snapshot"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SnapshotSubmitter;
