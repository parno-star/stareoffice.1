import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ChevronRight, ChevronDown, Users as UsersIcon } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  colorForDepartment,
  COLOR_CLASSES,
  getInitials,
} from "../_lib/directory-utils.ts";

type TreeNode = {
  entry: DirectoryEntry;
  children: Array<TreeNode>;
};

function buildTree(entries: Array<DirectoryEntry>): Array<TreeNode> {
  const byId = new Map<Id<"users">, DirectoryEntry>();
  for (const e of entries) byId.set(e.user._id, e);
  const childrenByParent = new Map<Id<"users">, Array<DirectoryEntry>>();
  for (const e of entries) {
    if (e.user.managerId && byId.has(e.user.managerId)) {
      const list = childrenByParent.get(e.user.managerId) ?? [];
      list.push(e);
      childrenByParent.set(e.user.managerId, list);
    }
  }

  const buildNode = (entry: DirectoryEntry): TreeNode => {
    const children = (childrenByParent.get(entry.user._id) ?? [])
      .slice()
      .sort((a, b) =>
        (a.user.name ?? "").localeCompare(b.user.name ?? "", "id", {
          sensitivity: "base",
        }),
      );
    return {
      entry,
      children: children.map(buildNode),
    };
  };

  const roots = entries.filter(
    (e) => !e.user.managerId || !byId.has(e.user.managerId),
  );
  roots.sort((a, b) =>
    (a.user.name ?? "").localeCompare(b.user.name ?? "", "id", {
      sensitivity: "base",
    }),
  );
  return roots.map(buildNode);
}

export default function DirectoryTreeView({
  entries,
  onSelect,
}: {
  entries: Array<DirectoryEntry>;
  onSelect: (id: Id<"users">) => void;
}) {
  const tree = useMemo(() => buildTree(entries), [entries]);

  return (
    <div className="rounded-xl border bg-background p-2 md:p-4">
      {tree.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Tidak ada hierarki untuk ditampilkan.
        </div>
      ) : (
        <ul className="space-y-1">
          {tree.map((node) => (
            <TreeNodeRow
              key={node.entry.user._id}
              node={node}
              depth={0}
              onSelect={onSelect}
              defaultExpanded
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  onSelect,
  defaultExpanded,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (id: Id<"users">) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <NodeCard
        user={node.entry.user}
        directReportCount={node.entry.directReportCount}
        depth={depth}
        expanded={expanded}
        hasChildren={hasChildren}
        onToggle={() => setExpanded((e) => !e)}
        onSelect={() => onSelect(node.entry.user._id)}
      />
      {hasChildren && expanded ? (
        <ul className="mt-1 space-y-1 border-l border-dashed border-muted-foreground/20 pl-4">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.entry.user._id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NodeCard({
  user,
  directReportCount,
  depth,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
}: {
  user: Doc<"users">;
  directReportCount: number;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const tone = COLOR_CLASSES[colorForDepartment(user.department)];
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-background p-2 transition-all hover:border-primary/40 hover:shadow-sm"
      style={{ marginLeft: depth > 0 ? 0 : undefined }}
    >
      <button
        onClick={onToggle}
        className={`flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted ${
          hasChildren ? "" : "invisible"
        }`}
        aria-label={expanded ? "Tutup" : "Buka"}
      >
        {expanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>

      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <Avatar className="size-9 shrink-0">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />
          ) : null}
          <AvatarFallback className={`${tone.chip} text-xs font-semibold`}>
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {user.name ?? "Tanpa Nama"}
            </p>
            {directReportCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                <UsersIcon className="size-3" />
                {directReportCount}
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {user.jobTitle ?? "—"}
          </p>
        </div>
        {user.department ? (
          <Badge
            variant="secondary"
            className={`hidden shrink-0 ${tone.chip} border-transparent sm:inline-flex`}
          >
            {user.department}
          </Badge>
        ) : null}
      </button>
    </div>
  );
}
