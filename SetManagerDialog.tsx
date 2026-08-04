import { useState } from "react";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Check, X, Search, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { getInitials } from "../_lib/org-utils.ts";

export default function SetManagerDialog({
  employee,
  allUsers,
  open,
  onOpenChange,
}: {
  employee: Doc<"users"> | null;
  allUsers: Array<Doc<"users">>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setManager = useMutation(api.organization.setManager);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  if (!employee) return null;

  const currentManager = allUsers.find((u) => u._id === employee.managerId);

  const candidates = allUsers
    .filter((u) => u._id !== employee._id)
    .filter((u) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, 50);

  const handleSelect = async (managerId: Id<"users"> | null) => {
    setSaving(true);
    try {
      await setManager({ userId: employee._id, managerId });
      toast.success(
        managerId ? "Atasan berhasil diperbarui" : "Atasan berhasil dilepas",
      );
      onOpenChange(false);
      setQuery("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui atasan");
      } else {
        toast.error("Gagal memperbarui atasan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) {
          onOpenChange(v);
          if (!v) setQuery("");
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atur Atasan</DialogTitle>
          <DialogDescription>
            Pilih atasan langsung untuk{" "}
            <span className="font-medium text-foreground">
              {employee.name ?? "karyawan ini"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {currentManager ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <Avatar className="size-9">
              {currentManager.avatarUrl ? (
                <AvatarImage
                  src={currentManager.avatarUrl}
                  alt={currentManager.name ?? ""}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(currentManager.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Atasan saat ini</p>
              <p className="truncate text-sm font-semibold">
                {currentManager.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => handleSelect(null)}
              className="gap-1.5"
            >
              <X className="size-3.5" />
              Lepas
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
            <UserCircle2 className="size-5" />
            <span className="text-sm">Belum memiliki atasan</span>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, jabatan, atau departemen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            disabled={saving}
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada karyawan yang cocok
            </p>
          ) : (
            candidates.map((u) => {
              const isCurrent = u._id === employee.managerId;
              return (
                <button
                  key={u._id}
                  disabled={saving}
                  onClick={() => handleSelect(u._id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors",
                    "hover:border-primary/30 hover:bg-muted",
                    isCurrent && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Avatar className="size-9">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name ?? "Tanpa Nama"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.jobTitle ?? "—"}
                      {u.department ? ` • ${u.department}` : ""}
                    </p>
                  </div>
                  {isCurrent ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Check className="size-3" /> Terpilih
                    </Badge>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
