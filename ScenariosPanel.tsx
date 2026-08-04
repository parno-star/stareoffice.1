import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Plus,
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  Eye,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import ScenarioEditorDialog from "./ScenarioEditorDialog.tsx";
import ScenarioDetailDialog from "./ScenarioDetailDialog.tsx";

type Props = {
  allUsers: Array<Doc<"users">>;
  currentUserId: Id<"users"> | null;
  isAdmin: boolean;
};

type StatusFilter =
  | "all"
  | "draft"
  | "pending"
  | "approved"
  | "applied"
  | "rejected"
  | "cancelled";

const STATUS_STYLES: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
    icon: Workflow,
  },
  pending: {
    label: "Menunggu",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  applied: {
    label: "Diterapkan",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    icon: Rocket,
  },
  rejected: {
    label: "Ditolak",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    icon: XCircle,
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-muted text-muted-foreground",
    icon: XCircle,
  },
};

export default function ScenariosPanel({
  allUsers,
  currentUserId,
  isAdmin,
}: Props) {
  const scenarios = useQuery(api.orgAdvanced.scenarios.listScenarios, {});
  const stats = useQuery(api.orgAdvanced.scenarios.getStats, {});
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"orgScenarios"> | null>(null);

  const filtered = useMemo(() => {
    if (!scenarios) return [];
    if (filter === "all") return scenarios;
    return scenarios.filter((s) => s.scenario.status === filter);
  }, [scenarios, filter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatChip
          label="Draft"
          value={stats?.draft ?? 0}
          tone="bg-muted/50 text-muted-foreground"
        />
        <StatChip
          label="Menunggu"
          value={stats?.pending ?? 0}
          tone="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        />
        <StatChip
          label="Disetujui"
          value={stats?.approved ?? 0}
          tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        />
        <StatChip
          label="Diterapkan"
          value={stats?.applied ?? 0}
          tone="bg-sky-500/15 text-sky-700 dark:text-sky-400"
        />
        <StatChip
          label="Perlu Persetujuan Anda"
          value={stats?.myPendingApprovals ?? 0}
          tone="bg-violet-500/15 text-violet-700 dark:text-violet-400"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="pending">Menunggu</TabsTrigger>
            <TabsTrigger value="approved">Disetujui</TabsTrigger>
            <TabsTrigger value="applied">Diterapkan</TabsTrigger>
            <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>
        {isAdmin ? (
          <Button size="sm" onClick={() => setEditorOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Skenario Baru
          </Button>
        ) : null}
      </div>

      {scenarios === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Workflow />
            </EmptyMedia>
            <EmptyTitle>
              {filter === "all"
                ? "Belum ada skenario"
                : `Belum ada skenario ${STATUS_STYLES[filter]?.label ?? filter}`}
            </EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? "Buat draft skenario reorganisasi untuk mensimulasikan perubahan sebelum diterapkan."
                : "Skenario aktif akan muncul di sini."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin ? (
            <EmptyContent>
              <Button size="sm" onClick={() => setEditorOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                Buat Skenario
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <ScenarioCard
              key={s.scenario._id}
              summary={s}
              currentUserId={currentUserId}
              onOpen={() => setDetailId(s.scenario._id)}
            />
          ))}
        </div>
      )}

      <ScenarioEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        allUsers={allUsers}
        onCreated={(scenarioId) => {
          setEditorOpen(false);
          setDetailId(scenarioId);
        }}
      />

      <ScenarioDetailDialog
        scenarioId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        allUsers={allUsers}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 text-xl font-bold tabular-nums", "")}>{value}</p>
        <div
          className={cn(
            "mt-2 h-1.5 w-full rounded-full",
            tone,
          )}
        />
      </CardContent>
    </Card>
  );
}

function ScenarioCard({
  summary,
  currentUserId,
  onOpen,
}: {
  summary: {
    scenario: Doc<"orgScenarios">;
    creator: Doc<"users"> | null;
    changeCount: number;
    approvals: Array<{
      approval: Doc<"orgScenarioApprovals">;
      approver: Doc<"users"> | null;
    }>;
  };
  currentUserId: Id<"users"> | null;
  onOpen: () => void;
}) {
  const s = summary.scenario;
  const style = STATUS_STYLES[s.status] ?? STATUS_STYLES.draft;
  const Icon = style.icon;
  const approvedCount = summary.approvals.filter(
    (a) => a.approval.decision === "approved",
  ).length;
  const progress =
    summary.approvals.length > 0
      ? Math.round((approvedCount / summary.approvals.length) * 100)
      : 0;
  const waitingForMe =
    s.status === "pending" &&
    summary.approvals.some(
      (a) =>
        a.approval.approverId === currentUserId &&
        a.approval.decision === "pending",
    ) &&
    summary.approvals
      .filter((a) => a.approval.order <
        (summary.approvals.find(
          (x) => x.approval.approverId === currentUserId,
        )?.approval.order ?? 0))
      .every((a) => a.approval.decision === "approved");

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
        waitingForMe ? "border-violet-500/50 ring-1 ring-violet-500/30" : "",
      )}
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("gap-1 border-0", style.className)}>
                <Icon className="size-3" />
                {style.label}
              </Badge>
              {waitingForMe ? (
                <Badge className="gap-1 border-0 bg-violet-500/15 text-violet-700 dark:text-violet-400">
                  <AlertCircle className="size-3" />
                  Menunggu Anda
                </Badge>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {summary.changeCount} perubahan
              </span>
              {s.effectiveDate ? (
                <span className="text-[11px] text-muted-foreground">
                  · berlaku {s.effectiveDate}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 truncate text-base font-semibold">{s.name}</p>
            {s.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {s.description}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Oleh {summary.creator?.name ?? "—"} ·{" "}
                {formatDistanceToNow(new Date(s._creationTime ? s._creationTime : Date.now()), {
                  addSuffix: true,
                  locale: idLocale,
                })}
              </span>
              {summary.approvals.length > 0 ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  {approvedCount}/{summary.approvals.length} approver
                </span>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <Eye className="size-4" />
            Detail
          </Button>
        </div>
        {summary.approvals.length > 0 ? (
          <div className="mt-3">
            <div className="flex items-center gap-1">
              {summary.approvals.map((a) => (
                <div
                  key={a.approval._id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    a.approval.decision === "approved"
                      ? "bg-emerald-500"
                      : a.approval.decision === "rejected"
                        ? "bg-rose-500"
                        : "bg-muted",
                  )}
                  title={`${a.approver?.name ?? "—"}: ${a.approval.decision}`}
                />
              ))}
            </div>
            {s.status === "pending" ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {progress}% disetujui
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Re-export status styles for detail dialog use.
export { STATUS_STYLES };
