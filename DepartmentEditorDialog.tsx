import { useEffect, useState } from "react";
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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { COLOR_TOKENS, type ColorToken, colorClasses } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Doc<"departments"> | null;
  allUsers: Array<Doc<"users">>;
  existingDepartmentNames: ReadonlyArray<string>;
};

const ICON_OPTIONS = ["🏢", "💼", "🧑‍💻", "📣", "💰", "🎨", "🛠️", "📊", "⚖️", "🚀", "🛒", "🔧"];

export default function DepartmentEditorDialog({
  open,
  onOpenChange,
  editing,
  allUsers,
  existingDepartmentNames,
}: Props) {
  const createDepartment = useMutation(api.organization.createDepartment);
  const updateDepartment = useMutation(api.organization.updateDepartment);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ColorToken>("blue");
  const [icon, setIcon] = useState<string>("🏢");
  const [headId, setHeadId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setColor((editing.color as ColorToken) ?? "blue");
      setIcon(editing.icon ?? "🏢");
      setHeadId(editing.headId ?? "none");
    } else {
      setName("");
      setDescription("");
      setColor("blue");
      setIcon("🏢");
      setHeadId("none");
    }
  }, [open, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment({
          departmentId: editing._id,
          name: name.trim() || undefined,
          description,
          color,
          icon,
          headId: headId === "none" ? null : (headId as Id<"users">),
        });
        toast.success("Departemen diperbarui");
      } else {
        await createDepartment({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          headId: headId === "none" ? undefined : (headId as Id<"users">),
        });
        toast.success("Departemen dibuat");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Departemen" : "Tambah Departemen"}
          </DialogTitle>
          <DialogDescription>
            Kelola nama, kepala departemen, warna, dan ikon untuk tampilan bagan
            organisasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Nama Departemen</Label>
            <Input
              id="dept-name"
              placeholder="contoh: Teknologi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="existing-depts"
            />
            <datalist id="existing-depts">
              {existingDepartmentNames.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Harus sama persis dengan isian field &ldquo;Departemen&rdquo; pada
              profil karyawan.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dept-desc">Deskripsi</Label>
            <Textarea
              id="dept-desc"
              placeholder="Deskripsi singkat peran departemen..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="grid grid-cols-6 gap-1">
                {ICON_OPTIONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn(
                      "flex size-9 cursor-pointer items-center justify-center rounded-lg border text-lg transition-colors",
                      icon === i
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary/40",
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <div className="grid grid-cols-6 gap-1">
                {COLOR_TOKENS.map((c) => {
                  const cc = colorClasses(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-9 cursor-pointer rounded-lg border-2 transition-all",
                        cc.bgSolid,
                        color === c
                          ? "border-foreground scale-110"
                          : "border-transparent",
                      )}
                      aria-label={c}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Kepala Departemen</Label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kepala departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum ditetapkan</SelectItem>
                {allUsers
                  .slice()
                  .sort((a, b) =>
                    (a.name ?? "").localeCompare(b.name ?? ""),
                  )
                  .map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa Nama"}
                      {u.jobTitle ? ` — ${u.jobTitle}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || name.trim().length === 0}
          >
            {saving ? "Menyimpan..." : editing ? "Simpan" : "Buat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
