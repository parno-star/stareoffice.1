import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  READINESS_LEVELS,
  BOX_META,
  getInitials,
  type BoxCode,
} from "../_lib/talent-utils.ts";
import { cn } from "@/lib/utils.ts";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Plus, Target, Trash2, Users } from "lucide-react";

type Props = {
  incumbentId: Id<"users">;
  incumbentName: string;
  canManage: boolean;
};

export default function SuccessionPanel({
  incumbentId,
  incumbentName,
  canManage,
}: Props) {
  const candidates = useQuery(api.talent.getSuccessionForUser, {
    userId: incumbentId,
  });
  const [addOpen, setAddOpen] = useState(false);
  const remove = useMutation(api.talent.removeSuccessionCandidate);

  async function handleRemove(planId: Id<"successionPlans">) {
    if (!window.confirm("Hapus kandidat ini?")) return;
    try {
      await remove({ planId });
      toast.success("Kandidat dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Succession Planning
          </CardTitle>
          <CardDescription>
            Kandidat pengganti untuk {incumbentName}.
          </CardDescription>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Tambah Kandidat
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates === undefined ? (
          <div className="flex items-center justify-center py-4">
            <Spinner />
          </div>
        ) : candidates.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Target />
              </EmptyMedia>
              <EmptyTitle>Belum ada kandidat</EmptyTitle>
              <EmptyDescription>
                Pilih calon pengganti dan tingkat kesiapannya.
              </EmptyDescription>
            </EmptyHeader>
            {canManage ? (
              <EmptyContent>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Tambah Kandidat
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          candidates
            .sort((a, b) => a.priority - b.priority)
            .map((c) => {
              const readiness = READINESS_LEVELS[c.readiness];
              const boxMeta = c.latestBoxCode
                ? BOX_META[c.latestBoxCode as BoxCode]
                : null;
              return (
                <div
                  key={c.plan?._id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Avatar className="size-10">
                    <AvatarImage
                      src={c.candidate?.avatarUrl}
                      alt={c.candidate?.name}
                    />
                    <AvatarFallback>
                      {getInitials(c.candidate?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {c.candidate?.name ?? "Karyawan dihapus"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · Prioritas {c.priority}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {readiness ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            readiness.tone,
                          )}
                        >
                          {readiness.label}
                        </span>
                      ) : null}
                      {boxMeta ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            boxMeta.chip,
                          )}
                        >
                          {boxMeta.label}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground truncate">
                        {c.candidate?.jobTitle ?? ""}
                      </span>
                    </div>
                    {c.strengths ? (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                        <strong>Kekuatan:</strong> {c.strengths}
                      </p>
                    ) : null}
                    {c.development ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <strong>Pengembangan:</strong> {c.development}
                      </p>
                    ) : null}
                  </div>
                  {canManage && c.plan ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        if (c.plan) handleRemove(c.plan._id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              );
            })
        )}
      </CardContent>

      {canManage ? (
        <AddCandidateDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          incumbentId={incumbentId}
        />
      ) : null}
    </Card>
  );
}

function AddCandidateDialog({
  open,
  onOpenChange,
  incumbentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incumbentId: Id<"users">;
}) {
  const [candidateId, setCandidateId] = useState<Id<"users"> | null>(null);
  const [readiness, setReadiness] = useState("ready_now");
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [priority, setPriority] = useState(1);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const users = useQuery(api.users.listEmployees, {
    search: search || undefined,
  });
  const upsert = useMutation(api.talent.upsertSuccessionCandidate);

  async function handleSave() {
    if (!candidateId) {
      toast.error("Pilih kandidat");
      return;
    }
    if (candidateId === incumbentId) {
      toast.error("Kandidat tidak bisa diri sendiri");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        incumbentId,
        candidateId,
        readiness,
        strengths: strengths || undefined,
        development: development || undefined,
        priority,
      });
      toast.success("Kandidat ditambahkan");
      setCandidateId(null);
      setStrengths("");
      setDevelopment("");
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string })?.message ?? "Gagal menyimpan"
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Kandidat Succession</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cari Karyawan</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama karyawan..."
            />
            <ScrollArea className="h-40 rounded-lg border">
              <div className="divide-y">
                {(users ?? [])
                  .filter((u) => u._id !== incumbentId)
                  .slice(0, 20)
                  .map((u) => {
                    const selected = candidateId === u._id;
                    return (
                      <button
                        type="button"
                        key={u._id}
                        onClick={() => setCandidateId(u._id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 cursor-pointer",
                          selected && "bg-primary/10",
                        )}
                      >
                        <Avatar className="size-8">
                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                          <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {u.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {u.jobTitle ?? "-"}{" "}
                            {u.department ? `• ${u.department}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </ScrollArea>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kesiapan</Label>
              <Select value={readiness} onValueChange={setReadiness}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(READINESS_LEVELS).map(([key, v]) => (
                    <SelectItem key={key} value={key}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas (1 = tertinggi)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Kekuatan</Label>
            <Textarea
              rows={2}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Area Pengembangan</Label>
            <Textarea
              rows={2}
              value={development}
              onChange={(e) => setDevelopment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
