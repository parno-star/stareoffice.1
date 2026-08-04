import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Check, Search, UserCheck } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: Id<"assets">;
  assetName: string;
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
}

export default function AssignAssetDialog({
  open,
  onOpenChange,
  assetId,
  assetName,
}: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search.trim(), 250);
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const users = useQuery(api.users.listEmployees, {
    search: debouncedSearch || undefined,
  });
  const assign = useMutation(api.assets.assign);

  const filtered = useMemo(() => users ?? [], [users]);

  const handleAssign = async () => {
    if (!selectedId) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await assign({
        assetId,
        userId: selectedId,
        note: note.trim() || undefined,
      });
      toast.success("Aset berhasil ditugaskan");
      onOpenChange(false);
      setSelectedId(null);
      setNote("");
      setSearch("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menugaskan aset");
      } else {
        toast.error("Gagal menugaskan aset");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tugaskan Aset</DialogTitle>
          <DialogDescription>
            Pilih karyawan yang akan menerima aset{" "}
            <span className="font-medium">{assetName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari karyawan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              disabled={submitting}
            />
          </div>

          <ScrollArea className="h-64 rounded-lg border">
            <div className="space-y-1 p-2">
              {users === undefined ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Memuat...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada karyawan ditemukan
                </div>
              ) : (
                filtered.map((u) => {
                  const selected = selectedId === u._id;
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => setSelectedId(u._id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                        selected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted",
                      )}
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={u.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {initialsOf(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {u.name ?? "Tanpa nama"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[u.jobTitle, u.department]
                            .filter(Boolean)
                            .join(" · ") || u.email || "-"}
                        </p>
                      </div>
                      {selected ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Label htmlFor="assign-note">Catatan (opsional)</Label>
            <Textarea
              id="assign-note"
              rows={2}
              placeholder="Kondisi saat diserahkan, kelengkapan, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selectedId}
            className="cursor-pointer gap-2"
          >
            <UserCheck className="size-4" />
            {submitting ? "Menugaskan..." : "Tugaskan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
