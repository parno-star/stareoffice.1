import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { Search, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AddRevieweeDialog({
  cycleId,
  open,
  onOpenChange,
}: {
  cycleId: Id<"feedback360Cycles">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 250);
  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: debouncedSearch || undefined } : "skip",
  );
  const addReviewee = useMutation(api.feedback360.cycles.addReviewee);
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(null);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [includeManager, setIncludeManager] = useState(true);
  const [includeReports, setIncludeReports] = useState(true);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => employees ?? [], [employees]);

  function reset() {
    setSearch("");
    setSelectedId(null);
    setIncludeSelf(true);
    setIncludeManager(true);
    setIncludeReports(true);
  }

  async function handleAdd() {
    if (!selectedId) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      await addReviewee({
        cycleId,
        revieweeId: selectedId,
        autoInviteSelf: includeSelf,
        autoInviteManager: includeManager,
        autoInviteReports: includeReports,
      });
      toast.success("Karyawan ditambahkan ke siklus");
      reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan");
      } else {
        toast.error("Gagal menambahkan");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Karyawan ke Siklus</DialogTitle>
          <DialogDescription>
            Pilih karyawan yang akan menerima feedback 360°. Reviewer otomatis
            akan diundang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama karyawan..."
              className="pl-9"
            />
          </div>

          <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-1">
            {employees === undefined ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Tidak ditemukan karyawan.
              </p>
            ) : (
              list.map((emp) => (
                <button
                  key={emp._id}
                  type="button"
                  onClick={() => setSelectedId(emp._id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md p-2 text-left transition-colors",
                    selectedId === emp._id
                      ? "bg-primary/10 ring-1 ring-primary/40"
                      : "hover:bg-muted",
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    {emp.avatarUrl ? <AvatarImage src={emp.avatarUrl} /> : null}
                    <AvatarFallback>
                      {initials(emp.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {emp.name ?? "Tanpa nama"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {emp.jobTitle ?? emp.department ?? "Karyawan"}
                    </p>
                  </div>
                  {selectedId === emp._id ? (
                    <UserCheck className="size-4 text-primary" />
                  ) : null}
                </button>
              ))
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Undangan reviewer otomatis</p>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">
                Penilaian diri sendiri
              </Label>
              <Switch
                checked={includeSelf}
                onCheckedChange={setIncludeSelf}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">
                Atasan langsung (jika ada)
              </Label>
              <Switch
                checked={includeManager}
                onCheckedChange={setIncludeManager}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">
                Semua bawahan langsung
              </Label>
              <Switch
                checked={includeReports}
                onCheckedChange={setIncludeReports}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Anda dapat menambahkan rekan (peer) secara manual dari laporan
              karyawan nanti. Karyawan juga dapat menominasikan rekan sendiri.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleAdd}
            disabled={saving || !selectedId}
            className="cursor-pointer"
          >
            {saving ? "Menambahkan..." : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
