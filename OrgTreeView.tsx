import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import type { OrgNode } from "../_lib/org-utils.ts";
import PersonCard from "./PersonCard.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  nodes: Array<OrgNode>;
  onSelectUser: (id: Id<"users">) => void;
  isAdmin: boolean;
  onEditManager: (user: Doc<"users">) => void;
  highlightUserId?: Id<"users"> | null;
};

function TreeNode({
  node,
  onSelectUser,
  isAdmin,
  onEditManager,
  highlightUserId,
}: {
  node: OrgNode;
  onSelectUser: (id: Id<"users">) => void;
  isAdmin: boolean;
  onEditManager: (user: Doc<"users">) => void;
  highlightUserId?: Id<"users"> | null;
}) {
  const hasChildren = node.children.length > 0;
  // Expand first 2 levels by default
  const [expanded, setExpanded] = useState(node.depth < 2);

  return (
    <div className="relative">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          disabled={!hasChildren}
          className={cn(
            "flex w-7 shrink-0 items-start justify-center pt-4",
            hasChildren
              ? "cursor-pointer text-muted-foreground hover:text-foreground"
              : "text-transparent",
          )}
          aria-label={expanded ? "Ciutkan" : "Perluas"}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <PersonCard
            user={node.user}
            directReportCount={node.children.length}
            onClick={() => onSelectUser(node.user._id)}
            isAdmin={isAdmin}
            onEditManager={() => onEditManager(node.user)}
            highlight={highlightUserId === node.user._id}
            positionLevel={node.positionLevel}
          />
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="ml-3.5 mt-2 space-y-2 border-l-2 border-dashed border-border/60 pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.user._id}
              node={child}
              onSelectUser={onSelectUser}
              isAdmin={isAdmin}
              onEditManager={onEditManager}
              highlightUserId={highlightUserId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OrgTreeView({
  nodes,
  onSelectUser,
  isAdmin,
  onEditManager,
  highlightUserId,
}: Props) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <TreeNode
          key={node.user._id}
          node={node}
          onSelectUser={onSelectUser}
          isAdmin={isAdmin}
          onEditManager={onEditManager}
          highlightUserId={highlightUserId}
        />
      ))}
    </div>
  );
}
