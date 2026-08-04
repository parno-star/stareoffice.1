import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus, Pencil, Trash2, Loader2, FileText, Sparkles } from "lucide-react";
import LetterEditor from "./LetterEditor.tsx";
import { CONTENT_TEMPLATE_CATEGORY_LABELS } from "../_lib/letterVariables.ts";

type ContentTemplate = Doc<"letterContentTemplates">;

const CATEGORY_OPTIONS = [
  { value: "umum", label: "Umum" },
  { value: "keluar", label: "Surat Keluar" },
  { value: "masuk", label: "Surat Masuk" },
  { value: "memo", label: "Nota" },
];

const DEFAULT_BODY =
  "<p>Dengan hormat,</p><p></p><p>______________</p><p></p><p>Demikian surat ini kami sampaikan. Atas perhatiannya kami ucapkan terima kasih.</p>";

// ─── Form ──────────────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: ContentTemplate | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const createTpl = useMutation(api.letterContentTemplates.create);
  const updateTpl = useMutation(api.letterContentTemplates.update);

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "umum");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? DEFAULT_BODY);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nama template wajib diisi"); return; }
    if (content.replace(/<[^>]*>/g, "").trim().length === 0) {
      toast.error("Isi template wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await updateTpl({
          id: initial._id,
          name,
          category,
          description: description || undefined,
          content,
        });
        toast.success("Template diperbarui");
      } else {
        await createTpl({
          name,
          category,
          description: description || undefined,
          content,
        });
        toast.success("Template dibuat");
      }
      onDone();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>← Kembali</Button>
        <h3 className="font-semibold">{initial ? "Edit Template" : "Buat Template Baru"}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Nama Template *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Undangan Rapat" />
        </div>
        <div className="space-y-1">
          <Label>Kategori</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Keterangan (opsional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Isi Template *</Label>
        <p className="text-xs text-muted-foreground">
          Gunakan tombol <span className="font-medium">Variabel</span> di editor untuk menyisipkan placeholder
          seperti <code className="rounded bg-muted px-1 py-0.5">{"{nama_penerima}"}</code>. Placeholder ini
          otomatis terisi dari data surat saat template dipakai dan surat disimpan.
        </p>
        <LetterEditor content={content} onChange={setContent} paperMode />
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Simpan Perubahan" : "Buat Template"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export default function LetterContentTemplateTab() {
  const templates = useQuery(api.letterContentTemplates.list, {});
  const removeTpl = useMutation(api.letterContentTemplates.remove);
  const seedDefaults = useMutation(api.letterContentTemplates.seedDefaults);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ContentTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplate | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTpl({ id: deleteTarget._id });
      toast.success("Template dihapus");
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menghapus");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedDefaults({});
      if (res.created > 0) toast.success(`${res.created} template contoh ditambahkan`);
      else toast.info("Template contoh sudah ada");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menambahkan contoh");
    } finally {
      setSeeding(false);
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <TemplateForm
        initial={mode === "edit" ? editing : null}
        onDone={() => { setMode("list"); setEditing(null); }}
        onCancel={() => { setMode("list"); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Template badan surat siap pakai. Pengguna dapat memilihnya saat membuat surat.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Contoh
          </Button>
          <Button size="sm" onClick={() => setMode("create")}>
            <Plus className="h-4 w-4 mr-1.5" /> Buat Template
          </Button>
        </div>
      </div>

      {!templates ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-25" />
          <p className="font-medium text-sm">Belum ada template isi surat</p>
          <p className="text-xs mt-1 mb-4">Buat template atau tambahkan contoh bawaan untuk memulai</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seeding}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Tambah Contoh
            </Button>
            <Button size="sm" onClick={() => setMode("create")}>
              <Plus className="h-4 w-4 mr-1.5" /> Buat Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl._id} className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="font-semibold text-sm">{tpl.name}</p>
                  {tpl.category && (
                    <Badge variant="secondary" className="text-[10px]">
                      {CONTENT_TEMPLATE_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                    </Badge>
                  )}
                  {!tpl.isActive && (
                    <Badge variant="outline" className="text-[10px]">Nonaktif</Badge>
                  )}
                </div>
                {tpl.description && (
                  <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                )}
                <div
                  className="prose prose-xs mt-1.5 max-h-12 max-w-none overflow-hidden text-xs text-muted-foreground [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
                  dangerouslySetInnerHTML={{ __html: tpl.content }}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => { setEditing(tpl); setMode("edit"); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(tpl)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Template <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Surat yang sudah dibuat tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
