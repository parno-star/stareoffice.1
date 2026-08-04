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
import { Trash2, Plus, Link2, User } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { getInitials } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

const RELATIONSHIP_LABELS: Record<string, { label: string; color: string }> = {
  dotted: { label: "Dotted Line", color: "text-amber-600 dark:text-amber-400" },
  project: { label: "Proyek", color: "text-sky-600 dark:text-sky-400" },
  mentor: { label: "Mentor", color: "text-violet-600 dark:text-violet-400" },
  functional: {
    label: "Fungsional",
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

export default function DottedLinesDialog({
  employee,
  allUsers,
  open,
  onOpenChange,
  isAdmin,
}: {
  employee: Doc<"users"> | null;
  allUsers: Array<Doc<"users">>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
}) {
  const lines = useQuery(
    api.orgAdvanced.dottedLines.listForUser,
    employee ? { userId: employee._id } : "skip",
  );
  const addLine = useMutation(api.orgAdvanced.dottedLines.addDottedLine);
  const removeLine = useMutation(api.orgAdvanced.dottedLines.removeDottedLine);

  const [managerId, setManagerId] = useState<Id<"users"> | "">("");
  const [relationshipType, setRelationshipType] = useState<string>("dotted");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    if (!employee) return [];
    return allUsers.filter(
      (u) =>
        u._id !== employee._id &&
        u._id !== employee.managerId &&
        !(lines ?? []).some((l) => l.row.managerId === u._id),
    );
  }, [allUsers, employee, lines]);

  if (!employee) return null;

  const handleAdd = async () => {
    if (!managerId) return;
    setSaving(true);
    try {
      await addLine({
        userId: employee._id,
        managerId: managerId as Id<"users">,
        relationshipType,
        note: note.trim() || undefined,
      });
      toast.success("Jalur sekunder ditambahkan");
      setManagerId("");
      setNote("");
      setRelationshipType("dotted");
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

  const handleRemove = async (id: Id<"dottedLineReports">) => {
    try {
      await removeLine({ id });
      toast.success("Jalur sekunder dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" /> Jalur Pelaporan Sekunder
          </DialogTitle>
          <DialogDescription>
            Atasan tambahan (dotted line, proyek, mentor) untuk{" "}
            <span className="font-medium text-foreground">{employee.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {!lines ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full rounded-lg border bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <User className="size-4" />
              Belum ada jalur sekunder
            </div>
          ) : (
            lines.map((l) => {
              const meta = RELATIONSHIP_LABELS[l.row.relationshipType] ?? {
                label: l.row.relationshipType,
                color: "",
              };
              return (
                <div
                  key={l.row._id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Avatar className="size-9">
                    {l.manager?.avatarUrl ? (
                      <AvatarImage src={l.manager.avatarUrl} alt={l.manager.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(l.manager?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">
                        {l.manager?.name ?? "Tidak ditemukan"}
                      </p>
                      <Badge variant="outline" className={cn("text-[10px]", meta.color)}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.manager?.jobTitle ?? "—"}
                      {l.row.note ? ` · ${l.row.note}` : ""}
                    </p>
                  </div>
                  {isAdmin ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => handleRemove(l.row._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">Tambah Jalur Sekunder</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Atasan Sekunder</Label>
                <Select
                  value={managerId}
                  onValueChange={(v) => setManagerId(v as Id<"users">)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih orang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name ?? "Tanpa Nama"}
                        {u.department ? ` · ${u.department}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipe</Label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Misal: kolaborasi proyek Alpha"
                rows={2}
              />
            </div>
            <Input
              type="hidden"
              value={managerId}
              onChange={() => undefined}
              tabIndex={-1}
            />
            <Button
              onClick={handleAdd}
              disabled={!managerId || saving}
              className="w-full gap-1.5"
              size="sm"
            >
              <Plus className="size-4" />
              Tambahkan
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
