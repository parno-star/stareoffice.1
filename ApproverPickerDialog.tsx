import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Search, UserPlus, Check } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (id: Id<"users">) => void;
  selectedIds: Id<"users">[];
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ApproverPickerDialog({
  open,
  onClose,
  onAdd,
  selectedIds,
}: Props) {
  const users = useQuery(api.users.listEmployees, {});
  const departments = useQuery(api.users.listDepartments, {});

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (department !== "all" && u.department !== department) return false;
      if (!q) return true;
      return (
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, department]);

  // Group by department
  const grouped = useMemo(() => {
    const map = new Map<string, Array<Doc<"users">>>();
    for (const u of filtered) {
      const key = u.department ?? "Tanpa Departemen";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    // Sort inside each dept by jobTitle then name
    for (const list of map.values()) {
      list.sort((a, b) => {
        const t = (a.jobTitle ?? "").localeCompare(b.jobTitle ?? "", "id");
        if (t !== 0) return t;
        return (a.name ?? "").localeCompare(b.name ?? "", "id");
      });
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "id"),
    );
  }, [filtered]);

  const handleAdd = (id: Id<"users">) => {
    onAdd(id);
  };

  const handleClose = () => {
    setSearch("");
    setDepartment("all");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Pilih Pejabat Penyetuju
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="px-6 py-3 border-b shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Cari nama, jabatan, atau departemen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Departemen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Departemen</SelectItem>
              {(departments ?? []).map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-2">
            {users === undefined ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Memuat daftar pejabat...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Tidak ditemukan pejabat yang cocok.
              </div>
            ) : (
              grouped.map(([dept, list]) => (
                <div key={dept} className="mb-3 last:mb-0">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {dept}
                    <span className="ml-1.5 font-normal normal-case">
                      ({list.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {list.map((u) => {
                      const isSelected = selectedIds.includes(u._id);
                      return (
                        <button
                          key={u._id}
                          type="button"
                          disabled={isSelected}
                          onClick={() => handleAdd(u._id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                            isSelected
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-pointer hover:bg-muted/60",
                          )}
                        >
                          <Avatar className="size-9 shrink-0">
                            {u.avatarUrl ? (
                              <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {u.name ?? "—"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.jobTitle ?? "Tanpa jabatan"}
                            </p>
                          </div>
                          {isSelected ? (
                            <Badge
                              variant="secondary"
                              className="shrink-0 gap-1 text-xs"
                            >
                              <Check className="size-3" />
                              Terpilih
                            </Badge>
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-primary">
                              Tambah
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-3 shrink-0 text-xs text-muted-foreground">
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length} penyetuju dipilih`
              : "Klik pejabat untuk menambahkannya ke rantai persetujuan"}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer font-medium text-foreground hover:underline"
          >
            Selesai
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
