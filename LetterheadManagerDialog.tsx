import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Loader2, Plus, Pencil, Trash2, Upload, X, Star, Building2,
  Phone, Mail, Globe, Palette, CheckCircle,
} from "lucide-react";

type Letterhead = Doc<"letterheads"> & { logoUrl?: string | null };

// ---------- Form ----------
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
          name,
          organizationName: orgName,
          organizationAddress: address,
          organizationPhone: phone || undefined,
          organizationEmail: email || undefined,
          organizationWebsite: website || undefined,
          accentColor,
          isDefault,
          showTopLine,
          showBottomLine,
          logoStorageId: logoStorageId ?? undefined,
          logoFileName: logoFile?.name,
        });
        toast.success("Kop surat berhasil diperbarui");
      } else {
        await createLetterhead({
          name,
          organizationName: orgName,
          organizationAddress: address,
          organizationPhone: phone || undefined,
          organizationEmail: email || undefined,
          organizationWebsite: website || undefined,
          accentColor,
          isDefault,
          showTopLine,
          showBottomLine,
          logoStorageId: logoStorageId ?? undefined,
          logoFileName: logoFile?.name,
        });
        toast.success("Kop surat berhasil dibuat");
      }
      onSave();
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="rounded-lg border-2 p-4 space-y-1" style={{ borderColor: accentColor }}>
        {showTopLine && <hr style={{ borderColor: accentColor, borderTopWidth: 2.5 }} className="mb-2" />}
        <div className="flex items-start gap-3">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded object-contain border" />
          ) : (
            <div
              className="h-12 w-12 rounded flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {orgName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: accentColor }}>
              {orgName || "Nama Instansi"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {address || "Alamat instansi..."}
            </p>
            {(phone || email) && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {phone && `Telp: ${phone}`}{phone && email && " | "}{email && `Email: ${email}`}
              </p>
            )}
          </div>
        </div>
        {showBottomLine && <hr style={{ borderColor: accentColor, borderTopWidth: 1.2 }} className="mt-2" />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Nama Kop */}
        <div className="col-span-2 space-y-1">
          <Label>Nama Template Kop *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Kop Resmi, Kop Dinas, dll." />
        </div>

        {/* Nama Instansi */}
        <div className="col-span-2 space-y-1">
          <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Nama Instansi / Organisasi *</Label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="cth: PT. Contoh Indonesia" />
        </div>

        {/* Alamat */}
        <div className="col-span-2 space-y-1">
          <Label>Alamat *</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Contoh No.1, Kota, Provinsi" />
        </div>

        {/* Telp */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Telepon</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="021-XXXXXXX" />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@instansi.go.id" />
        </div>

        {/* Website */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1"><Globe className="h-3 w-3" /> Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://instansi.go.id" />
        </div>

        {/* Accent Color */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Warna Aksen</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 w-14 rounded border cursor-pointer"
            />
            <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 font-mono text-xs" />
          </div>
        </div>

        {/* Logo */}
        <div className="col-span-2 space-y-1">
          <Label>Logo Instansi</Label>
          <div className="flex items-center gap-3">
            {logoPreview && (
              <div className="relative">
                <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded border object-contain" />
                <button
                  type="button"
                  onClick={() => { setLogoPreview(null); setLogoFile(null); setLogoStorageId(null); }}
                  className="absolute -top-1 -right-1 rounded-full bg-destructive text-white p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{logoPreview ? "Ganti Logo" : "Upload Logo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={logoUploading} />
            </label>
          </div>
        </div>

        {/* Default */}
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-sm">Jadikan kop surat default</span>
          </label>
        </div>

        {/* Garis atas & bawah */}
        <div className="col-span-2 space-y-2">
          <Label>Garis Pembatas</Label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTopLine}
              onChange={(e) => setShowTopLine(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Tampilkan garis atas</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showBottomLine}
              onChange={(e) => setShowBottomLine(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Tampilkan garis bawah</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || logoUploading}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {initial ? "Simpan Perubahan" : "Buat Kop Surat"}
        </Button>
      </div>
    </div>
  );
}

// ---------- Main Dialog ----------
export default function LetterheadManagerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const letterheads = useQuery(api.letters.listLetterheads) as Letterhead[] | undefined;
  const deleteLetterhead = useMutation(api.letters.deleteLetterhead);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<Letterhead | null>(null);

  const handleDelete = async (lh: Letterhead) => {
    if (!confirm(`Hapus kop surat "${lh.name}"?`)) return;
    try {
      await deleteLetterhead({ letterheadId: lh._id });
      toast.success("Kop surat dihapus");
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  const title =
    mode === "create" ? "Buat Kop Surat Baru" :
    mode === "edit" ? "Edit Kop Surat" :
    "Manajemen Kop Surat";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setMode("list"); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {mode === "list" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMode("create")}>
                <Plus className="mr-1.5 h-4 w-4" /> Buat Kop Surat
              </Button>
            </div>

            {!letterheads ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : letterheads.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                <p className="text-sm">Belum ada kop surat</p>
                <p className="text-xs mt-1">Buat kop surat untuk digunakan pada surat resmi</p>
              </div>
            ) : (
              <div className="space-y-2">
                {letterheads.map((lh) => (
                  <div key={lh._id} className="flex items-center gap-3 rounded-lg border p-3">
                    {lh.logoUrl ? (
                      <img src={lh.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain border shrink-0" />
                    ) : (
                      <div
                        className="h-10 w-10 rounded flex items-center justify-center text-white font-bold shrink-0 text-sm"
                        style={{ backgroundColor: lh.accentColor ?? "#1e40af" }}
                      >
                        {lh.organizationName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{lh.name}</p>
                        {lh.isDefault && (
                          <Badge variant="secondary" className="text-[9px] gap-0.5">
                            <Star className="h-2.5 w-2.5 text-amber-500" /> Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lh.organizationName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{lh.organizationAddress}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => { setEditing(lh); setMode("edit"); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(lh)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {letterheads && letterheads.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                <span>{letterheads.length} kop surat tersedia. Pilih kop surat saat membuat surat.</span>
              </div>
            )}
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <LetterheadForm
            initial={mode === "edit" ? editing : null}
            onSave={() => setMode("list")}
            onCancel={() => setMode("list")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
