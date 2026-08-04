import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Hash, Settings, RefreshCw, Info, Plus, Pencil, Trash2,
  Upload, X, Star, Building2, Phone, Mail, Globe, Palette,
  CheckCircle, Loader2, FileText, Inbox, Send, Tag, LayoutTemplate,
} from "lucide-react";
import LetterContentTemplateTab from "./LetterContentTemplateTab.tsx";



type Letterhead = Doc<"letterheads"> & { logoUrl?: string | null };

// ─── Constants ───────────────────────────────────────────────────────────────

const LETTER_TYPES = [
  { value: "keluar",   label: "Surat Keluar",  icon: Send },
  { value: "masuk",    label: "Surat Masuk",   icon: Inbox },
  { value: "memo",     label: "Nota",           icon: FileText },
];

const FORMAT_VARIABLES = ["{PREFIX}", "{PREFIX2}", "{SEQ3}", "{SEQ4}", "{MM}", "{BULAN}", "{YYYY}", "{YY}"];

const FORMAT_EXAMPLES = [
  { format: "{PREFIX}/{SEQ3}/{BULAN}/{YYYY}",         desc: "SEKR/001/IV/2025" },
  { format: "{PREFIX}/{PREFIX2}/{SEQ3}/{BULAN}/{YYYY}", desc: "SEKR/UND/001/IV/2025" },
  { format: "{PREFIX}/{SEQ3}/{MM}/{YYYY}",             desc: "SEKR/001/04/2025" },
  { format: "{SEQ4}/{YYYY}",                           desc: "0001/2025" },
  { format: "{PREFIX}-{SEQ3}-{YY}",                   desc: "SKL-001-25" },
];

// ─── Letterhead Form ──────────────────────────────────────────────────────────

function LetterheadForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Letterhead | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createLetterhead = useMutation(api.letters.createLetterhead);
  const updateLetterhead = useMutation(api.letters.updateLetterhead);
  const generateUploadUrl = useMutation(api.letters.generateUploadUrl);

  const [name, setName] = useState(initial?.name ?? "");
  const [orgName, setOrgName] = useState(initial?.organizationName ?? "");
  const [address, setAddress] = useState(initial?.organizationAddress ?? "");
  const [phone, setPhone] = useState(initial?.organizationPhone ?? "");
  const [email, setEmail] = useState(initial?.organizationEmail ?? "");
  const [website, setWebsite] = useState(initial?.organizationWebsite ?? "");
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? "#1e40af");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [showTopLine, setShowTopLine] = useState(initial?.showTopLine ?? true);
  const [showBottomLine, setShowBottomLine] = useState(initial?.showBottomLine ?? true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logoUrl ?? null);
  const [logoStorageId, setLogoStorageId] = useState<Id<"_storage"> | null>(
    initial?.logoStorageId ?? null,
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await resp.json() as { storageId: Id<"_storage"> };
      setLogoStorageId(storageId);
    } catch {
      toast.error("Gagal mengunggah logo");
      setLogoFile(null);
      setLogoPreview(initial?.logoUrl ?? null);
    } finally {
      setLogoUploading(false);
    }
    e.target.value = "";
  }, [generateUploadUrl, initial?.logoUrl]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nama kop surat wajib diisi"); return; }
    if (!orgName.trim()) { toast.error("Nama instansi wajib diisi"); return; }
    if (!address.trim()) { toast.error("Alamat wajib diisi"); return; }
    setSaving(true);
    try {
      if (initial) {
        await updateLetterhead({
          letterheadId: initial._id,
          name, organizationName: orgName, organizationAddress: address,
          organizationPhone: phone || undefined, organizationEmail: email || undefined,
          organizationWebsite: website || undefined, accentColor, isDefault,
          showTopLine, showBottomLine,
          logoStorageId: logoStorageId ?? undefined, logoFileName: logoFile?.name,
        });
        toast.success("Kop surat berhasil diperbarui");
      } else {
        await createLetterhead({
          name, organizationName: orgName, organizationAddress: address,
          organizationPhone: phone || undefined, organizationEmail: email || undefined,
          organizationWebsite: website || undefined, accentColor, isDefault,
          showTopLine, showBottomLine,
          logoStorageId: logoStorageId ?? undefined, logoFileName: logoFile?.name,
        });
        toast.success("Kop surat berhasil dibuat");
      }
      onSave();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Live preview */}
      <div className="rounded-lg border-2 p-4" style={{ borderColor: accentColor }}>
        {showTopLine && <div className="mb-2" style={{ height: 2.5, background: accentColor }} />}
        <div className="flex items-start gap-3">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded object-contain border shrink-0" />
          ) : (
            <div
              className="h-14 w-14 rounded flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {orgName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: accentColor }}>{orgName || "Nama Instansi"}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{address || "Alamat instansi..."}</p>
            {(phone || email) && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {phone && `Telp: ${phone}`}{phone && email && " | "}{email && `Email: ${email}`}
              </p>
            )}
          </div>
        </div>
        {showBottomLine && <div className="mt-2" style={{ height: 1.2, background: accentColor }} />}
        <p className="text-[9px] text-muted-foreground mt-1 text-right">Preview Kop Surat</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Nama Template Kop *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Kop Resmi, Kop Dinas" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Nama Instansi *</Label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="PT. Contoh Indonesia" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Alamat *</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Contoh No.1, Kota, Provinsi" />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telepon</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="021-XXXXXXX" />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@instansi.go.id" />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://instansi.go.id" />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Warna Aksen</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-14 rounded border cursor-pointer" />
            <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 font-mono text-xs flex-1" />
          </div>
        </div>

        {/* Logo */}
        <div className="col-span-2 space-y-2">
          <Label>Logo Instansi</Label>
          <div className="flex items-center gap-3">
            {logoPreview && (
              <div className="relative">
                <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded border object-contain" />
                <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); setLogoStorageId(null); }}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white p-0.5 shadow">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{logoPreview ? "Ganti Logo" : "Upload Logo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={logoUploading} />
            </label>
          </div>
        </div>

        {/* Default */}
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm">Jadikan kop surat default</span>
          </label>
        </div>

        {/* Garis pembatas */}
        <div className="col-span-2 space-y-2">
          <Label>Garis Pembatas</Label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showTopLine} onChange={(e) => setShowTopLine(e.target.checked)} className="rounded" />
            <span className="text-sm">Tampilkan garis atas</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showBottomLine} onChange={(e) => setShowBottomLine(e.target.checked)} className="rounded" />
            <span className="text-sm">Tampilkan garis bawah</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || logoUploading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Simpan Perubahan" : "Buat Kop Surat"}
        </Button>
      </div>
    </div>
  );
}

// ─── Letterhead Tab ───────────────────────────────────────────────────────────

function LetterheadTab() {
  const letterheads = useQuery(api.letters.listLetterheads) as Letterhead[] | undefined;
  const deleteLetterhead = useMutation(api.letters.deleteLetterhead);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<Letterhead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Letterhead | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLetterhead({ letterheadId: deleteTarget._id });
      toast.success("Kop surat dihapus");
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menghapus");
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); setEditing(null); }}>
            ← Kembali
          </Button>
          <h3 className="font-semibold">{mode === "create" ? "Buat Kop Surat Baru" : "Edit Kop Surat"}</h3>
        </div>
        <LetterheadForm
          initial={mode === "edit" ? editing : null}
          onSave={() => { setMode("list"); setEditing(null); }}
          onCancel={() => { setMode("list"); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Kelola template kop surat yang digunakan pada surat resmi.
          </p>
        </div>
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus className="h-4 w-4 mr-1.5" /> Buat Kop Surat
        </Button>
      </div>

      {!letterheads ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : letterheads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-10 w-10 opacity-25" />
          <p className="font-medium text-sm">Belum ada kop surat</p>
          <p className="text-xs mt-1 mb-4">Buat kop surat untuk digunakan pada surat resmi</p>
          <Button size="sm" onClick={() => setMode("create")}>
            <Plus className="h-4 w-4 mr-1.5" /> Buat Kop Surat Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {letterheads.map((lh) => (
            <div key={lh._id} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
              {lh.logoUrl ? (
                <img src={lh.logoUrl} alt="Logo" className="h-12 w-12 rounded object-contain border shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded flex items-center justify-center text-white font-bold shrink-0 text-base"
                  style={{ backgroundColor: lh.accentColor ?? "#1e40af" }}>
                  {lh.organizationName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm truncate">{lh.name}</p>
                  {lh.isDefault && (
                    <Badge variant="secondary" className="text-[9px] gap-0.5 shrink-0">
                      <Star className="h-2.5 w-2.5 text-amber-500" /> Default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{lh.organizationName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{lh.organizationAddress}</p>
              </div>
              <div
                className="h-8 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: lh.accentColor ?? "#1e40af" }}
              />
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => { setEditing(lh); setMode("edit"); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(lh)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>{letterheads.length} kop surat tersedia. Pilih kop surat saat membuat surat baru.</span>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kop Surat?</AlertDialogTitle>
            <AlertDialogDescription>
              Kop surat <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Surat yang sudah menggunakan kop ini tidak akan terpengaruh.
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

// ─── Letter Number Config Tab ─────────────────────────────────────────────────

function LetterNumberTab({ excludeMemo, memoOnly }: { excludeMemo?: boolean; memoOnly?: boolean }) {
  const configs = useQuery(api.letters.listLetterNumberConfigs);
  const generatePreview = useMutation(api.letters.generateLetterNumber);
  const upsertConfig = useMutation(api.letters.upsertLetterNumberConfig);

  // Company prefixes (PREFIX1)
  const companyPrefixes = useQuery(api.letters.listCompanyPrefixes);
  const addCompanyPrefix = useMutation(api.letters.addCompanyPrefix);
  const deleteCompanyPrefix = useMutation(api.letters.deleteCompanyPrefix);
  const updateCompanyPrefix = useMutation(api.letters.updateCompanyPrefix);
  const seedBuiltIn = useMutation(api.letters.seedBuiltInPrefixes);

  // Category prefixes (PREFIX2)
  const categoryPrefixes = useQuery(api.letters.listCategoryPrefixes);
  const addCategoryPrefix = useMutation(api.letters.addCategoryPrefix);
  const deleteCategoryPrefix = useMutation(api.letters.deleteCategoryPrefix);
  const updateCategoryPrefix = useMutation(api.letters.updateCategoryPrefix);
  const seedBuiltInCategory = useMutation(api.letters.seedBuiltInCategoryPrefixes);

  // Seed built-in prefixes once on load
  const [seeded, setSeeded] = useState(false);
  if (companyPrefixes !== undefined && categoryPrefixes !== undefined && !seeded) {
    setSeeded(true);
    void seedBuiltIn();
    void seedBuiltInCategory();
  }

  const [editType, setEditType] = useState<string | null>(null);
  const [format, setFormat] = useState("{PREFIX}/{SEQ3}/{BULAN}/{YYYY}");
  const [prefix, setPrefix] = useState("");
  const [prefix2, setPrefix2] = useState("");
  const [resetPeriod, setResetPeriod] = useState("yearly");
  const [lastSequence, setLastSequence] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Company prefix form state
  const [cpCode, setCpCode] = useState("");
  const [cpLabel, setCpLabel] = useState("");
  const [cpSaving, setCpSaving] = useState(false);
  const [cpEditingId, setCpEditingId] = useState<string | null>(null);
  const [cpEditCode, setCpEditCode] = useState("");
  const [cpEditLabel, setCpEditLabel] = useState("");
  const [cpDeletingId, setCpDeletingId] = useState<string | null>(null);

  // Category prefix form state
  const [catCode, setCatCode] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catEditCode, setCatEditCode] = useState("");
  const [catEditLabel, setCatEditLabel] = useState("");
  const [catDeletingId, setCatDeletingId] = useState<string | null>(null);

  const allCompanyCodes = companyPrefixes?.map((p) => p.code) ?? [];
  const allCategoryCodes = categoryPrefixes?.map((p) => p.code) ?? [];

  const handleAddCompanyPrefix = async () => {
    const trimmed = cpCode.trim().toUpperCase();
    if (!trimmed) return;
    setCpSaving(true);
    try {
      await addCompanyPrefix({ code: trimmed, label: cpLabel.trim() || undefined });
      toast.success(`Prefix "${trimmed}" ditambahkan`);
      setCpCode("");
      setCpLabel("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menambahkan prefix");
    } finally {
      setCpSaving(false);
    }
  };

  const handleUpdateCompanyPrefix = async (id: string) => {
    const trimmed = cpEditCode.trim().toUpperCase();
    if (!trimmed) return;
    try {
      await updateCompanyPrefix({ prefixId: id as Parameters<typeof updateCompanyPrefix>[0]["prefixId"], code: trimmed, label: cpEditLabel.trim() || undefined });
      toast.success("Prefix diperbarui");
      setCpEditingId(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal memperbarui prefix");
    }
  };

  const handleDeleteCompanyPrefix = async (id: string) => {
    try {
      await deleteCompanyPrefix({ prefixId: id as Parameters<typeof deleteCompanyPrefix>[0]["prefixId"] });
      toast.success("Prefix dihapus");
      setCpDeletingId(null);
    } catch {
      toast.error("Gagal menghapus prefix");
    }
  };

  const handleAddCategoryPrefix = async () => {
    const trimmed = catCode.trim().toUpperCase();
    if (!trimmed) return;
    setCatSaving(true);
    try {
      await addCategoryPrefix({ code: trimmed, label: catLabel.trim() || undefined });
      toast.success(`Prefix kategori "${trimmed}" ditambahkan`);
      setCatCode("");
      setCatLabel("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menambahkan prefix");
    } finally {
      setCatSaving(false);
    }
  };

  const handleUpdateCategoryPrefix = async (id: string) => {
    const trimmed = catEditCode.trim().toUpperCase();
    if (!trimmed) return;
    try {
      await updateCategoryPrefix({ prefixId: id as Parameters<typeof updateCategoryPrefix>[0]["prefixId"], code: trimmed, label: catEditLabel.trim() || undefined });
      toast.success("Prefix kategori diperbarui");
      setCatEditingId(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal memperbarui prefix");
    }
  };

  const handleDeleteCategoryPrefix = async (id: string) => {
    try {
      await deleteCategoryPrefix({ prefixId: id as Parameters<typeof deleteCategoryPrefix>[0]["prefixId"] });
      toast.success("Prefix kategori dihapus");
      setCatDeletingId(null);
    } catch {
      toast.error("Gagal menghapus prefix");
    }
  };

  // Filter types based on props
  const visibleTypes = LETTER_TYPES.filter((t) => {
    if (memoOnly) return t.value === "memo";
    if (excludeMemo) return t.value !== "memo";
    return true;
  });

  const openEdit = (letterType: string) => {
    const existing = configs?.find((c) => c.letterType === letterType);
    setEditType(letterType);
    setFormat(existing?.format ?? "{PREFIX}/{SEQ3}/{BULAN}/{YYYY}");
    setPrefix(existing?.prefix ?? "");
    setPrefix2(existing?.prefix2 ?? "");
    setResetPeriod(existing?.resetPeriod ?? "yearly");
    setLastSequence(existing?.lastSequence ?? 0);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!editType) return;
    try {
      const result = await generatePreview({ letterType: editType, preview: true });
      setPreview(result);
    } catch {
      toast.error("Gagal generate preview");
    }
  };

  const handleSave = async () => {
    if (!editType) return;
    setSaving(true);
    try {
      await upsertConfig({ letterType: editType, format, prefix: prefix || undefined, prefix2: prefix2 || undefined, resetPeriod, lastSequence });
      toast.success("Konfigurasi penomoran disimpan");
      setEditType(null);
    } catch {
      toast.error("Gagal menyimpan konfigurasi");
    } finally {
      setSaving(false);
    }
  };

  if (editType !== null) {
    const typeLabel = LETTER_TYPES.find((t) => t.value === editType)?.label ?? editType;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditType(null)}>← Kembali</Button>
          <h3 className="font-semibold">Konfigurasi Penomoran — {typeLabel}</h3>
        </div>

        <div className="space-y-4">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format Nomor Surat</Label>
            <Input
              value={format}
              onChange={(e) => { setFormat(e.target.value); setPreview(null); }}
              placeholder="{PREFIX}/{SEQ3}/{BULAN}/{YYYY}"
              className="font-mono"
            />
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> Klik variabel untuk menambahkan:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FORMAT_VARIABLES.map((v) => (
                  <button key={v} type="button"
                    onClick={() => { setFormat((f) => f + v); setPreview(null); }}
                    className="text-xs bg-background hover:bg-primary hover:text-primary-foreground border px-2 py-1 rounded font-mono cursor-pointer transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Contoh format (klik untuk pakai):</p>
              {FORMAT_EXAMPLES.map((ex) => (
                <button key={ex.format} type="button"
                  onClick={() => { setFormat(ex.format); setPreview(null); }}
                  className="flex items-center gap-2 w-full text-xs text-left hover:bg-muted px-3 py-2 rounded-lg transition-colors">
                  <code className="font-mono text-primary">{ex.format}</code>
                  <span className="text-muted-foreground">→ {ex.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Prefix 1 & 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prefix 1 — Kode Unit / Perusahaan</Label>
              <Select value={prefix || "none"} onValueChange={(v) => { setPrefix(v === "none" ? "" : v); setPreview(null); }}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="(tidak ada)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(tidak ada)</SelectItem>
                  {allCompanyCodes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Digunakan untuk variabel {"{PREFIX}"}.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Prefix 2 — Kategori Surat</Label>
              <Select value={prefix2 || "none"} onValueChange={(v) => { setPrefix2(v === "none" ? "" : v); setPreview(null); }}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="(tidak ada)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(tidak ada)</SelectItem>
                  {allCategoryCodes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Digunakan untuk variabel {"{PREFIX2}"}.</p>
            </div>
          </div>

          {/* Reset & Sequence */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Reset Urutan</Label>
              <Select value={resetPeriod} onValueChange={(v) => { setResetPeriod(v); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Setiap Bulan</SelectItem>
                  <SelectItem value="yearly">Setiap Tahun</SelectItem>
                  <SelectItem value="never">Tidak Pernah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Urutan Saat Ini</Label>
              <Input type="number" min={0} value={lastSequence}
                onChange={(e) => setLastSequence(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Nomor urut berikutnya: {lastSequence + 1}</p>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Button type="button" size="sm" variant="secondary" onClick={handlePreview} className="gap-1.5 shrink-0">
              <RefreshCw className="h-3.5 w-3.5" /> Generate Preview
            </Button>
            {preview ? (
              <code className="text-sm font-mono bg-primary/10 text-primary px-3 py-1.5 rounded flex-1 text-center">
                {preview}
              </code>
            ) : (
              <span className="text-xs text-muted-foreground italic">Klik "Generate Preview" untuk melihat contoh nomor</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => setEditType(null)} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Konfigurasi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {memoOnly
          ? "Atur format penomoran otomatis untuk nota. Nomor akan digenerate otomatis saat nota dibuat."
          : "Atur format penomoran otomatis untuk setiap jenis surat. Nomor akan digenerate otomatis saat surat dibuat."}
      </p>

      <div className="grid gap-3">
        {visibleTypes.map((lt) => {
          const cfg = configs?.find((c) => c.letterType === lt.value);
          const Icon = lt.icon;
          return (
            <div key={lt.value} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{lt.label}</p>
                {cfg ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      Format: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">{cfg.format}</code>
                      {cfg.prefix && <span className="ml-2">Prefix: <strong>{cfg.prefix}</strong></span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Urutan terakhir: <strong>{cfg.lastSequence}</strong>
                      &ensp;·&ensp;Reset:
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {cfg.resetPeriod === "monthly" ? "Bulanan" : cfg.resetPeriod === "yearly" ? "Tahunan" : "Tidak Pernah"}
                      </Badge>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">Belum dikonfigurasi — menggunakan format default</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(lt.value)} className="gap-1.5 shrink-0">
                <Settings className="h-3.5 w-3.5" /> Atur
              </Button>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Variabel yang tersedia: <code>{FORMAT_VARIABLES.join(", ")}</code>. Nomor urut akan direset sesuai periode yang dipilih.</span>
      </div>

      <Separator />

      {/* ── Prefix Perusahaan ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Prefiks / Kode Unit / Kode Perusahaan</h3>
        </div>
        <p className="text-xs text-muted-foreground">Kelola daftar prefiks yang tersedia sebagai pilihan pada konfigurasi penomoran dan form surat. Untuk <strong>surat internal</strong> gunakan <strong>Kode Unit</strong>, untuk <strong>surat eksternal</strong> gunakan <strong>Kode Perusahaan</strong>.</p>

        {/* Form tambah */}
        <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Kode Prefix *</Label>
              <Input value={cpCode} onChange={(e) => setCpCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCompanyPrefix(); } }}
                placeholder="cth: SEKR, HRD, DIR" className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Keterangan (opsional)</Label>
              <Input value={cpLabel} onChange={(e) => setCpLabel(e.target.value)}
                placeholder="cth: Sekretariat" className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={() => void handleAddCompanyPrefix()} disabled={!cpCode.trim() || cpSaving}>
            {cpSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Tambah Prefix 1
          </Button>
        </div>

        {/* Daftar */}
        {!companyPrefixes ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : companyPrefixes.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1.5">
            {companyPrefixes.map((p) => (
              <div key={p._id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
                {cpEditingId === p._id ? (
                  <>
                    <Input value={cpEditCode} onChange={(e) => setCpEditCode(e.target.value.toUpperCase())}
                      className="h-7 w-24 font-mono text-xs uppercase" />
                    <Input value={cpEditLabel} onChange={(e) => setCpEditLabel(e.target.value)}
                      placeholder="Keterangan..." className="h-7 flex-1 text-xs" />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => void handleUpdateCompanyPrefix(p._id)}>Simpan</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCpEditingId(null)}>Batal</Button>
                  </>
                ) : (
                  <>
                    <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-mono font-semibold text-xs">{p.code}</span>
                    {p.isBuiltIn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border font-medium">Prefix Unit</span>
                    )}
                    {p.label && <span className="text-xs text-muted-foreground flex-1 truncate">— {p.label}</span>}
                    {!p.label && <span className="flex-1" />}
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => { setCpEditingId(p._id); setCpEditCode(p.code); setCpEditLabel(p.label ?? ""); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setCpDeletingId(p._id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!cpDeletingId} onOpenChange={(v) => { if (!v) setCpDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Prefix?</AlertDialogTitle>
            <AlertDialogDescription>
              Prefix ini akan dihapus dari daftar. Surat yang sudah menggunakan prefix ini tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => cpDeletingId && void handleDeleteCompanyPrefix(cpDeletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />

      {/* ── Prefix Kategori Surat (PREFIX2) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Prefix Kategori Surat (PREFIX2)</h3>
        </div>
        <p className="text-xs text-muted-foreground">Kelola daftar kode kategori surat seperti <strong>UND</strong> (Undangan), <strong>PMH</strong> (Permohonan), <strong>PBT</strong> (Pemberitahuan), dsb. Gunakan variabel {"{PREFIX2}"} pada format nomor surat.</p>

        {/* Form tambah */}
        <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Kode Prefix Kategori *</Label>
              <Input value={catCode} onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCategoryPrefix(); } }}
                placeholder="cth: UND, PMH, PBT" className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Keterangan (opsional)</Label>
              <Input value={catLabel} onChange={(e) => setCatLabel(e.target.value)}
                placeholder="cth: Undangan" className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={() => void handleAddCategoryPrefix()} disabled={!catCode.trim() || catSaving}>
            {catSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Tambah Prefix 2
          </Button>
        </div>

        {/* Daftar */}
        {!categoryPrefixes ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : categoryPrefixes.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1.5">
            {categoryPrefixes.map((p) => (
              <div key={p._id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
                {catEditingId === p._id ? (
                  <>
                    <Input value={catEditCode} onChange={(e) => setCatEditCode(e.target.value.toUpperCase())}
                      className="h-7 w-24 font-mono text-xs uppercase" />
                    <Input value={catEditLabel} onChange={(e) => setCatEditLabel(e.target.value)}
                      placeholder="Keterangan..." className="h-7 flex-1 text-xs" />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => void handleUpdateCategoryPrefix(p._id)}>Simpan</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCatEditingId(null)}>Batal</Button>
                  </>
                ) : (
                  <>
                    <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono font-semibold text-xs">{p.code}</span>
                    {p.isBuiltIn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium">Bawaan</span>
                    )}
                    {p.label && <span className="text-xs text-muted-foreground flex-1 truncate">— {p.label}</span>}
                    {!p.label && <span className="flex-1" />}
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => { setCatEditingId(p._id); setCatEditCode(p.code); setCatEditLabel(p.label ?? ""); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setCatDeletingId(p._id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!catDeletingId} onOpenChange={(v) => { if (!v) setCatDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Prefix Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Prefix kategori ini akan dihapus. Surat yang sudah menggunakan prefix ini tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => catDeletingId && void handleDeleteCategoryPrefix(catDeletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Memo (Nota) Header Tab ────────────────────────────────────────────────────

function MemoHeaderTab() {
  const settings = useQuery(api.letterMemoSettings.get, {});
  const updateSettings = useMutation(api.letterMemoSettings.update);
  const generateUploadUrl = useMutation(api.letters.generateUploadUrl);

  const [title, setTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Gaya garis atas & bawah. null = belum diinisialisasi dari server.
  const [topShow, setTopShow] = useState<boolean | null>(null);
  const [topColor, setTopColor] = useState<string | null>(null);
  const [topWidth, setTopWidth] = useState<number | null>(null);
  const [bottomShow, setBottomShow] = useState<boolean | null>(null);
  const [bottomColor, setBottomColor] = useState<string | null>(null);
  const [bottomWidth, setBottomWidth] = useState<number | null>(null);

  // Logo opsional kop nota. `initialized` menandai bahwa nilai awal server sudah
  // dimuat agar kita bisa membedakan "belum dimuat" dari "sengaja tanpa logo".
  const [logoInitialized, setLogoInitialized] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoStorageId, setLogoStorageId] = useState<Id<"_storage"> | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | undefined>(undefined);
  const [logoUploading, setLogoUploading] = useState(false);

  // Isi nilai awal dari server sekali saat data tersedia.
  if (settings !== undefined && title === null) {
    setTitle(settings.headerTitle);
    setTopShow(settings.topLineShow);
    setTopColor(settings.topLineColor);
    setTopWidth(settings.topLineWidth);
    setBottomShow(settings.bottomLineShow);
    setBottomColor(settings.bottomLineColor);
    setBottomWidth(settings.bottomLineWidth);
  }
  if (settings !== undefined && !logoInitialized) {
    setLogoInitialized(true);
    setLogoUrl(settings.logoUrl);
    setLogoStorageId(settings.logoStorageId);
  }

  const handleLogoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUrl(URL.createObjectURL(file));
    setLogoFileName(file.name);
    setLogoUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await resp.json()) as { storageId: Id<"_storage"> };
      setLogoStorageId(storageId);
    } catch {
      toast.error("Gagal mengunggah logo");
      setLogoUrl(settings?.logoUrl ?? null);
      setLogoStorageId(settings?.logoStorageId ?? null);
    } finally {
      setLogoUploading(false);
    }
    e.target.value = "";
  }, [generateUploadUrl, settings?.logoUrl, settings?.logoStorageId]);

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoStorageId(null);
    setLogoFileName(undefined);
  };

  const value = title ?? "";
  const effective = value.trim() || "NOTA";
  const tShow = topShow ?? true;
  const tColor = topColor ?? "#1f2937";
  const tWidth = topWidth ?? 4;
  const bShow = bottomShow ?? true;
  const bColor = bottomColor ?? "#1f2937";
  const bWidth = bottomWidth ?? 2;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Tentukan perlakuan logo: hapus bila sebelumnya ada tapi kini kosong,
      // kirim storage id bila ada. Bila tidak berubah, biarkan backend
      // mempertahankan logo yang tersimpan.
      const removeLogo = !logoStorageId && !!settings?.logoStorageId;
      await updateSettings({
        headerTitle: value.trim(),
        topLineShow: tShow,
        topLineColor: tColor,
        topLineWidth: tWidth,
        bottomLineShow: bShow,
        bottomLineColor: bColor,
        bottomLineWidth: bWidth,
        logoStorageId: logoStorageId ?? undefined,
        logoFileName,
        removeLogo,
      });
      toast.success("Pengaturan kop nota disimpan");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const PRESETS = ["NOTA", "NOTA DINAS", "MEMO", "MEMORANDUM", "NOTA INTERNAL"];

  // Palet warna lengkap untuk garis kop nota.
  const PALETTE = [
    "#000000", "#1f2937", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#ffffff",
    "#7f1d1d", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5",
    "#7c2d12", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74",
    "#78350f", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d",
    "#365314", "#4d7c0f", "#65a30d", "#84cc16", "#a3e635", "#bef264",
    "#14532d", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac",
    "#134e4a", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4",
    "#164e63", "#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9",
    "#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
    "#312e81", "#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc",
    "#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd",
    "#701a75", "#a21caf", "#c026d3", "#d946ef", "#e879f9", "#f0abfc",
    "#831843", "#be185d", "#db2777", "#ec4899", "#f472b6", "#f9a8d4",
  ];

  const renderColorField = (
    current: string,
    onPick: (c: string) => void,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={current}
          onChange={(e) => onPick(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <Input value={current} onChange={(e) => onPick(e.target.value)} className="flex-1" />
      </div>
      <div className="grid grid-cols-9 gap-1.5">
        {PALETTE.map((c) => {
          const selected = current.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              title={c}
              aria-label={c}
              className={cn(
                "h-6 w-full cursor-pointer rounded border transition-transform hover:scale-110",
                selected ? "ring-2 ring-primary ring-offset-1" : "",
              )}
              style={{ backgroundColor: c }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Nota tidak menggunakan kop surat instansi. Sebagai gantinya, area kop
        menampilkan sebuah judul dengan garis atas dan bawah. Atur teks judul serta
        tampilan garisnya sesuai kebutuhan instansi Anda.
      </p>

      {/* Pratinjau area kop nota */}
      <div className="rounded-lg border bg-white p-4 text-black">
        <div
          className="py-2"
          style={{
            borderTopStyle: tShow ? "solid" : "none",
            borderTopWidth: tShow ? tWidth : 0,
            borderTopColor: tColor,
            borderBottomStyle: bShow ? "solid" : "none",
            borderBottomWidth: bShow ? bWidth : 0,
            borderBottomColor: bColor,
          }}
        >
          {logoUrl ? (
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain shrink-0" />
              <p className="flex-1 text-center text-lg font-bold">{effective}</p>
              <div className="h-12 w-12 shrink-0" aria-hidden />
            </div>
          ) : (
            <p className="text-center text-lg font-bold">{effective}</p>
          )}
        </div>
        <p className="mt-1 text-right text-[9px] text-muted-foreground">Pratinjau Kop Nota</p>
      </div>

      {/* Judul */}
      <div className="space-y-2">
        <Label>Judul Kop Nota</Label>
        <Input
          value={value}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="cth: NOTA, NOTA DINAS, MEMO"
        />
        <p className="text-xs text-muted-foreground">
          Dikosongkan akan memakai judul default <strong>NOTA</strong>.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTitle(p)}
              className="cursor-pointer rounded border bg-background px-2 py-1 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Logo (opsional) */}
      <div className="space-y-2">
        <Label>Logo Kop Nota (opsional)</Label>
        <p className="text-xs text-muted-foreground">
          Bila diisi, logo tampil di sisi kiri judul pada nota. Kosongkan bila
          nota tidak memerlukan logo.
        </p>
        {logoUrl ? (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <img src={logoUrl} alt="Logo kop nota" className="h-14 w-14 object-contain rounded border shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{logoFileName ?? "Logo tersimpan"}</p>
              {logoUploading && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Mengunggah...
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <label className="cursor-pointer rounded border bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
                Ganti
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
              <Button type="button" size="icon-sm" variant="ghost" onClick={handleRemoveLogo} title="Hapus logo" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            {logoUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            <span>{logoUploading ? "Mengunggah..." : "Klik untuk unggah logo"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </label>
        )}
      </div>

      {/* Garis Atas */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Garis Atas</Label>
          <Switch checked={tShow} onCheckedChange={setTopShow} />
        </div>
        {tShow && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Warna</Label>
              {renderColorField(tColor, setTopColor)}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ketebalan: {tWidth}px</Label>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={tWidth}
                onChange={(e) => setTopWidth(Number(e.target.value))}
                className="h-9 w-full cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Garis Bawah */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Garis Bawah</Label>
          <Switch checked={bShow} onCheckedChange={setBottomShow} />
        </div>
        {bShow && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Warna</Label>
              {renderColorField(bColor, setBottomColor)}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ketebalan: {bWidth}px</Label>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={bWidth}
                onChange={(e) => setBottomWidth(Number(e.target.value))}
                className="h-9 w-full cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-2">
        <Button onClick={handleSave} disabled={saving || settings === undefined}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan
        </Button>
      </div>
    </div>
  );
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────

export default function LetterSettingsPanel() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Pengaturan Surat & Nota</h2>
          <p className="text-sm text-muted-foreground">Konfigurasi penomoran otomatis, kop surat, dan pengaturan umum</p>
        </div>
      </div>

      <Tabs defaultValue="nomor">
        <TabsList className="w-full">
          <TabsTrigger value="nomor" className="flex-1 gap-1.5">
            <Hash className="h-4 w-4" /> Penomoran Surat
          </TabsTrigger>
          <TabsTrigger value="nomor-memo" className="flex-1 gap-1.5">
            <FileText className="h-4 w-4" /> Penomoran Nota
          </TabsTrigger>
          <TabsTrigger value="kop" className="flex-1 gap-1.5">
            <Building2 className="h-4 w-4" /> Kop Surat
          </TabsTrigger>
          <TabsTrigger value="kop-nota" className="flex-1 gap-1.5">
            <FileText className="h-4 w-4" /> Kop Nota
          </TabsTrigger>
          <TabsTrigger value="template-isi" className="flex-1 gap-1.5">
            <LayoutTemplate className="h-4 w-4" /> Template Isi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nomor" className="mt-4">
          <LetterNumberTab excludeMemo />
        </TabsContent>

        <TabsContent value="nomor-memo" className="mt-4">
          <LetterNumberTab memoOnly />
        </TabsContent>

        <TabsContent value="kop" className="mt-4">
          <LetterheadTab />
        </TabsContent>

        <TabsContent value="kop-nota" className="mt-4">
          <MemoHeaderTab />
        </TabsContent>

        <TabsContent value="template-isi" className="mt-4">
          <LetterContentTemplateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
