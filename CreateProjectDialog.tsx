import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { PROJECT_COLORS } from "../_lib/utils.ts";
import { cn } from "@/lib/utils.ts";

export default function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0].value);
  const [memberIds, setMemberIds] = useState<Set<Id<"users">>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const employees = useQuery(api.users.listEmployees, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const createProject = useMutation(api.projects.createProject);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama proyek wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        memberIds: Array.from(memberIds),
      });
      toast.success("Proyek berhasil dibuat");
      setOpen(false);
      setName("");
      setDescription("");
      setColor(PROJECT_COLORS[0].value);
      setMemberIds(new Set());
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal membuat proyek");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMember = (id: Id<"users">) => {
    const next = new Set(memberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMemberIds(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="size-4" />
          Proyek Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Proyek Baru</DialogTitle>
          <DialogDescription>
            Kelompokkan tugas dan tim untuk mencapai tujuan bersama.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Proyek</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Peluncuran Produk Q1"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Deskripsi</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan dan konteks proyek..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Warna</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "size-8 rounded-full cursor-pointer transition-all",
                    c.className,
                    color === c.value
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      : "opacity-70 hover:opacity-100",
                  )}
                  aria-label={c.value}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Anggota Tim</Label>
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {employees === undefined ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Memuat karyawan...
                </div>
              ) : employees.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Tidak ada karyawan lain
                </div>
              ) : (
                employees
                  .filter((u) => u._id !== currentUser?._id)
                  .map((u) => (
                    <label
                      key={u._id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={memberIds.has(u._id)}
                        onCheckedChange={() => toggleMember(u._id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {u.name ?? "Tanpa nama"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.department ?? u.jobTitle ?? "-"}
                        </div>
                      </div>
                    </label>
                  ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Anda akan otomatis menjadi pemilik proyek.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Buat Proyek"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
