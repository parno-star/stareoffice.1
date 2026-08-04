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
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  COLOR_TOKENS,
  type ColorToken,
  colorClasses,
  getInitials,
} from "@/pages/organization/_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";
import { Search } from "lucide-react";

const ICON_OPTIONS = ["🚀", "⚡", "🎯", "🔥", "🌟", "💡", "🛡️", "📊", "🎨", "🔧", "🧪", "🏆"];

export default function TeamEditorDialog({
  open,
  onOpenChange,
  editing,
  allUsers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Doc<"teams"> | null;
  allUsers: Array<Doc<"users">>;
}) {
  const createTeam = useMutation(api.organization.createTeam);
  const updateTeam = useMutation(api.organization.updateTeam);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ColorToken>("violet");
  const [icon, setIcon] = useState("🚀");
  const [leadId, setLeadId] = useState<string>("none");
  const [memberIds, setMemberIds] = useState<Array<string>>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setColor((editing.color as ColorToken) ?? "violet");
      setIcon(editing.icon ?? "🚀");
      setLeadId(editing.leadId ?? "none");
      setMemberIds([]);
    } else {
      setName("");
      setDescription("");
      setColor("violet");
      setIcon("🚀");
      setLeadId("none");
      setMemberIds([]);
    }
    setMemberQuery("");
  }, [open, editing]);

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const filteredUsers = allUsers
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .filter((u) => {
      if (!memberQuery.trim()) return true;
      const q = memberQuery.toLowerCase();
      return (
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateTeam({
          teamId: editing._id,
          name: name.trim() || undefined,
          description,
          color,
          icon,
          leadId: leadId === "none" ? null : (leadId as Id<"users">),
        });
        toast.success("Tim diperbarui");
      } else {
        await createTeam({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          leadId: leadId === "none" ? undefined : (leadId as Id<"users">),
          memberIds: memberIds.filter((id) => id !== leadId) as Array<Id<"users">>,
        });
        toast.success("Tim dibuat");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan tim");
      } else {
        toast.error("Gagal menyimpan tim");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Tim" : "Tambah Tim Baru"}</DialogTitle>
          <DialogDescription>
            Tim lintas departemen untuk kolaborasi atau proyek strategis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Nama Tim</Label>
            <Input
              id="team-name"
              placeholder="contoh: Squad Inovasi Produk"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Deskripsi</Label>
            <Textarea
              id="team-desc"
              placeholder="Tujuan & ruang lingkup tim..."
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
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Team Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih team lead" />
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
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {!editing ? (
            <div className="space-y-1.5">
              <Label>Anggota</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari karyawan..."
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
                {filteredUsers.map((u) => {
                  const checked = memberIds.includes(u._id);
                  return (
                    <label
                      key={u._id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50",
                        checked && "bg-primary/5",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMember(u._id)}
                      />
                      <Avatar className="size-7">
                        {u.avatarUrl ? (
                          <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {u.name ?? "Tanpa Nama"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {u.jobTitle ?? "—"}
                          {u.department ? ` • ${u.department}` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {memberIds.length} anggota dipilih. Lead akan otomatis masuk
                sebagai anggota.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Kelola anggota tim dari tombol &ldquo;Kelola Anggota&rdquo; pada
              kartu tim.
            </p>
          )}
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
            {saving ? "Menyimpan..." : editing ? "Simpan" : "Buat Tim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
