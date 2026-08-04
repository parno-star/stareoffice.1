import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Loader2, Search } from "lucide-react";
import { useQuery } from "convex/react";

interface DispositionDialogProps {
  letterId: Id<"letters">;
  open: boolean;
  onClose: () => void;
}

export default function DispositionDialog({ letterId, open, onClose }: DispositionDialogProps) {
  const [search, setSearch] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpenSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const employees = useQuery(api.users.listEmployees, { search, department: "" });
  const createDisposition = useMutation(api.letters.createDisposition);

  const handleSubmit = async () => {
    if (!selectedUserId) { toast.error("Pilih penerima disposisi"); return; }
    if (!instructions.trim()) { toast.error("Instruksi wajib diisi"); return; }
    setSaving(true);
    try {
      await createDisposition({
        letterId,
        toUserId: selectedUserId,
        instructions,
        dueDate: dueDate || undefined,
      });
      toast.success("Disposisi berhasil dikirim");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim disposisi");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = employees?.find((e) => e._id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Disposisi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search employees */}
          <div className="space-y-1.5">
            <Label>Penerima Disposisi *</Label>
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari nama karyawan..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedUserId(null); setOpenSearch(true); }}
                onFocus={() => setOpenSearch(true)}
                onClick={() => setOpenSearch(true)}
              />
            </div>
            {selectedUser && (
              <div className="rounded-lg border bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                {selectedUser.name} — {selectedUser.jobTitle ?? selectedUser.department ?? ""}
              </div>
            )}
            {!selectedUser && employees && employees.length > 0 && openSearch && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-card shadow-md">
                {employees.slice(0, 8).map((emp) => (
                  <button
                    key={emp._id}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={(e) => { e.preventDefault(); setSelectedUserId(emp._id); setSearch(emp.name ?? ""); setOpenSearch(false); }}
                  >
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.jobTitle ?? ""} {emp.department ? `· ${emp.department}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Instruksi */}
          <div className="space-y-1.5">
            <Label>Instruksi / Catatan *</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Contoh: Harap ditindaklanjuti sesuai prosedur dan dilaporkan hasilnya..."
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label>Batas Waktu (opsional)</Label>
            <DateField value={dueDate} onChange={(v) => setDueDate(v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedUserId}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Kirim Disposisi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
