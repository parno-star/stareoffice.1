import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Crown, Trash2, Plus, Target, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { getInitials } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

const READINESS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  ready_now: {
    label: "Siap Sekarang",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  "1_year": {
    label: "Siap 1 Tahun",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  "2_3_years": {
    label: "Siap 2-3 Tahun",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  emergency: {
    label: "Darurat",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
};

export default function SuccessionDialog({
  incumbent,
  allUsers,
  open,
  onOpenChange,
  isAdmin,
}: {
  incumbent: Doc<"users"> | null;
  allUsers: Array<Doc<"users">>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
}) {
  const plans = useQuery(
    api.orgAdvanced.succession.listForIncumbent,
    incumbent ? { incumbentId: incumbent._id } : "skip",
  );
  const createPlan = useMutation(api.orgAdvanced.succession.createPlan);
  const updatePlan = useMutation(api.orgAdvanced.succession.updatePlan);
  const removePlan = useMutation(api.orgAdvanced.succession.removePlan);

  const [candidateId, setCandidateId] = useState<Id<"users"> | "">("");
  const [readiness, setReadiness] = useState<string>("1_year");
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    if (!incumbent) return [];
    return allUsers.filter(
      (u) =>
        u._id !== incumbent._id &&
        !(plans ?? []).some((p) => p.plan.candidateId === u._id),
    );
  }, [allUsers, incumbent, plans]);

  if (!incumbent) return null;

  const handleAdd = async () => {
    if (!candidateId) return;
    setSaving(true);
    try {
      await createPlan({
        incumbentId: incumbent._id,
        candidateId: candidateId as Id<"users">,
        readiness,
        strengths: strengths.trim() || undefined,
        development: development.trim() || undefined,
        priority: (plans?.length ?? 0) + 1,
      });
      toast.success("Kandidat ditambahkan");
      setCandidateId("");
      setStrengths("");
      setDevelopment("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan");
      } else {
        toast.error("Gagal menambahkan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (
    planId: Id<"successionPlans">,
    direction: "up" | "down",
  ) => {
    if (!plans) return;
    const idx = plans.findIndex((p) => p.plan._id === planId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= plans.length) return;
    const current = plans[idx].plan;
    const other = plans[targetIdx].plan;
    await Promise.all([
      updatePlan({ planId: current._id, priority: other.priority }),
      updatePlan({ planId: other._id, priority: current.priority }),
    ]);
  };

  const handleRemove = async (id: Id<"successionPlans">) => {
    await removePlan({ planId: id });
    toast.success("Kandidat dihapus");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4" /> Rencana Suksesi
          </DialogTitle>
          <DialogDescription>
            Kandidat pengganti untuk posisi{" "}
            <span className="font-medium text-foreground">
              {incumbent.jobTitle ?? incumbent.name}
            </span>
            {" "}({incumbent.name ?? "—"}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {!plans ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full rounded-lg border bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Crown className="size-4" />
              Belum ada kandidat suksesi
            </div>
          ) : (
            plans.map((p, idx) => {
              const meta = READINESS[p.plan.readiness] ?? {
                label: p.plan.readiness,
                color: "",
                bg: "",
              };
              return (
                <div
                  key={p.plan._id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    #{idx + 1}
                  </Badge>
                  <Avatar className="size-9">
                    {p.candidate?.avatarUrl ? (
                      <AvatarImage src={p.candidate.avatarUrl} alt={p.candidate.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(p.candidate?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">
                        {p.candidate?.name ?? "Tidak ditemukan"}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", meta.color, meta.bg)}
                      >
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.candidate?.jobTitle ?? "—"}
                      {p.candidate?.department ? ` · ${p.candidate.department}` : ""}
                    </p>
                    {p.plan.strengths ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        <span className="font-medium">Kekuatan:</span> {p.plan.strengths}
                      </p>
                    ) : null}
                    {p.plan.development ? (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        <span className="font-medium">Pengembangan:</span>{" "}
                        {p.plan.development}
                      </p>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === 0}
                        onClick={() => handleMove(p.plan._id, "up")}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === plans.length - 1}
                        onClick={() => handleMove(p.plan._id, "down")}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => handleRemove(p.plan._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">Tambah Kandidat</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Kandidat</Label>
                <Select
                  value={candidateId}
                  onValueChange={(v) => setCandidateId(v as Id<"users">)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kandidat..." />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name ?? "Tanpa Nama"}
                        {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kesiapan</Label>
                <Select value={readiness} onValueChange={setReadiness}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(READINESS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kekuatan (opsional)</Label>
              <Textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Area Pengembangan (opsional)</Label>
              <Textarea
                value={development}
                onChange={(e) => setDevelopment(e.target.value)}
                rows={2}
              />
            </div>
            <Input
              type="hidden"
              value={candidateId}
              onChange={() => undefined}
              tabIndex={-1}
            />
            <Button
              onClick={handleAdd}
              disabled={!candidateId || saving}
              size="sm"
              className="w-full gap-1.5"
            >
              <Plus className="size-4" />
              Tambahkan Kandidat
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
