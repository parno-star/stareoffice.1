"use client";
import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Loader2, Upload, X, Hash, ScanLine, FileText, Inbox,
  User, Building2, CalendarDays, GitFork, Paperclip, AlertCircle,
  CheckCircle2, Clock, Flag, ArrowRightCircle,
} from "lucide-react";
import { EmployeeMultiPicker } from "./EmployeePicker.tsx";
import type { PickedEmployee } from "./EmployeePicker.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useConvex } from "convex/react";
import { useLetterArchive } from "../_hooks/useLetterArchive.ts";

const DISPOSITION_ACTIONS = [
  { value: "tindaklanjuti", label: "Harap Ditindaklanjuti" },
  { value: "tanggapi", label: "Mohon Ditanggapi" },
  { value: "pelajari", label: "Pelajari & Laporkan" },
  { value: "selesaikan", label: "Selesaikan Segera" },
  { value: "koordinasi", label: "Koordinasikan dengan Pihak Terkait" },
  { value: "arsipkan", label: "Arsipkan" },
  { value: "informasi", label: "Untuk Diketahui" },
];

const DISPOSITION_PRIORITIES = [
  { value: "normal", label: "Normal", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "segera", label: "Segera", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  { value: "sangat_segera", label: "Sangat Segera", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
];

const CATEGORIES = [
  { value: "undangan", label: "Undangan" },
  { value: "permohonan", label: "Permohonan" },
  { value: "pemberitahuan", label: "Pemberitahuan" },
  { value: "balasan", label: "Balasan" },
  { value: "keputusan", label: "Keputusan" },
  { value: "edaran", label: "Surat Edaran" },
  { value: "referensi", label: "Referensi" },
  { value: "lainnya", label: "Lainnya" },
];

const CLASSIFICATIONS = [
  { value: "biasa", label: "Biasa" },
  { value: "segera", label: "Segera" },
  { value: "sangat_segera", label: "Sangat Segera" },
  { value: "rahasia", label: "Rahasia" },
  { value: "sangat_rahasia", label: "Sangat Rahasia" },
];

const URGENCY_COLORS: Record<string, string> = {
  biasa: "bg-gray-100 text-gray-600 dark:bg-gray-800",
  segera: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  sangat_segera: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  rahasia: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  sangat_rahasia: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300",
};

interface AttachmentItem {
  file: File;
  storageId?: Id<"_storage">;
  uploading: boolean;
}

interface IncomingLetterDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function IncomingLetterDialog({ open, onClose }: IncomingLetterDialogProps) {
  const { user } = useAuth();
  const generateUploadUrl = useMutation(api.letters.generateUploadUrl);
  const saveAttachment = useMutation(api.letters.saveAttachment);
  const createLetter = useMutation(api.letters.createLetter);
  const receiveLetter = useMutation(api.letters.receiveLetter);
  const createDisposition = useMutation(api.letters.createDisposition);
  const convex = useConvex();
  const generateArchive = useLetterArchive();

  // ── Identitas Surat ────────────────────────────────────────────────────────
  const [letterNumber, setLetterNumber] = useState("");
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromOrganization, setFromOrganization] = useState("");
  const [category, setCategory] = useState("pemberitahuan");
  const [classification, setClassification] = useState("biasa");

  // ── Penerimaan ─────────────────────────────────────────────────────────────
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [agendaNumber, setAgendaNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState(user?.profile.name ?? "");
  const [isPhysical, setIsPhysical] = useState(false);
  const [physicalFile, setPhysicalFile] = useState<File | null>(null);
  const [physicalStorageId, setPhysicalStorageId] = useState<Id<"_storage"> | null>(null);
  const [physicalUploading, setPhysicalUploading] = useState(false);

  // ── Distribusi & Disposisi ─────────────────────────────────────────────────
  const [distributeNow, setDistributeNow] = useState(true);
  const [distributeTo, setDistributeTo] = useState<PickedEmployee[]>([]);
  const [dispositionNote, setDispositionNote] = useState("");
  const [dispositionDueDate, setDispositionDueDate] = useState("");
  const [dispositionPriority, setDispositionPriority] = useState("normal");
  const [dispositionAction, setDispositionAction] = useState("tindaklanjuti");

  // ── Tembusan ───────────────────────────────────────────────────────────────
  const [ccUsers, setCcUsers] = useState<PickedEmployee[]>([]);
  const [ccExternal, setCcExternal] = useState<string[]>([]);
  const [ccExternalInput, setCcExternalInput] = useState("");

  // ── Lampiran & Catatan ─────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  // ── File uploads ───────────────────────────────────────────────────────────
  const handlePhysicalFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhysicalFile(file);
    setPhysicalUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await resp.json() as { storageId: Id<"_storage"> };
      setPhysicalStorageId(storageId);
    } catch {
      toast.error("Gagal mengunggah dokumen fisik");
      setPhysicalFile(null);
    } finally {
      setPhysicalUploading(false);
    }
    e.target.value = "";
  }, [generateUploadUrl]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newItems: AttachmentItem[] = files.map((f) => ({ file: f, uploading: true }));
    setAttachments((prev) => [...prev, ...newItems]);
    for (let i = 0; i < newItems.length; i++) {
      try {
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": files[i].type }, body: files[i] });
        const { storageId } = await resp.json() as { storageId: Id<"_storage"> };
        setAttachments((prev) => prev.map((a) => a.file === files[i] ? { ...a, storageId, uploading: false } : a));
      } catch {
        setAttachments((prev) => prev.filter((a) => a.file !== files[i]));
        toast.error(`Gagal mengunggah ${files[i].name}`);
      }
    }
    e.target.value = "";
  }, [generateUploadUrl]);

  const addCcExternal = () => {
    const val = ccExternalInput.trim();
    if (val && !ccExternal.includes(val)) setCcExternal((prev) => [...prev, val]);
    setCcExternalInput("");
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (asDraft: boolean) => {
    if (!subject.trim()) { toast.error("Perihal surat wajib diisi"); return; }
    if (!fromName.trim()) { toast.error("Nama pengirim wajib diisi"); return; }
    if (!receivedBy.trim()) { toast.error("Diterima oleh wajib diisi"); return; }
    if (distributeNow && distributeTo.length === 0) {
      toast.error("Pilih minimal satu penerima distribusi atau nonaktifkan distribusi sekarang"); return;
    }

    setSaving(true);
    try {
      const ccUserIds = ccUsers.map((c) => c._id);

      const letterId = await createLetter({
        type: "masuk",
        subject: subject.trim(),
        letterNumber: letterNumber.trim() || undefined,
        agendaNumber: agendaNumber.trim() || undefined,
        letterDate,
        receivedAt,
        category,
        classification,
        fromName: fromName.trim(),
        fromOrganization: fromOrganization.trim() || undefined,
        toName: receivedBy.trim(),
        toUserId: undefined,
        toOrganization: undefined,
        content: "",
        notes: notes.trim() || undefined,
        letterheadId: undefined,
        ccUserIds: ccUserIds.length > 0 ? ccUserIds : undefined,
        ccExternal: ccExternal.length > 0 ? ccExternal : undefined,
        isPhysical: isPhysical || undefined,
        physicalDocStorageId: physicalStorageId ?? undefined,
        physicalDocFileName: physicalFile?.name,
      });

      // Mark as received (unless saving as draft)
      if (!asDraft) {
        await receiveLetter({ letterId, agendaNumber: agendaNumber.trim() || undefined });
      }

      // Save attachments
      for (const att of attachments.filter((a) => a.storageId && !a.uploading)) {
        if (att.storageId) {
          await saveAttachment({ letterId, storageId: att.storageId, fileName: att.file.name, fileSize: att.file.size, fileType: att.file.type });
        }
      }

      // Create initial disposition if requested
      if (!asDraft && distributeNow && distributeTo.length > 0) {
        const fullInstructions = [
          `[${DISPOSITION_ACTIONS.find(a => a.value === dispositionAction)?.label ?? dispositionAction}]`,
          dispositionNote.trim() || "Harap ditindaklanjuti.",
        ].join(" ");
        for (const target of distributeTo) {
          await createDisposition({
            letterId,
            toUserId: target._id,
            instructions: fullInstructions,
            dueDate: dispositionDueDate || undefined,
          });
        }
      }

      // Bekukan arsip PDF permanen (lembar registrasi) untuk surat masuk yang
      // sudah dicatat resmi. Konsep (draft) belum diarsipkan.
      if (!asDraft) {
        try {
          const fresh = await convex.query(api.letters.getLetterWithExtras, { letterId });
          if (fresh) {
            await generateArchive(letterId, {
              letter: fresh.letter,
              author: fresh.author,
              pic: fresh.pic,
              attachments: fresh.attachments,
              letterhead: fresh.letterhead,
              approvals: fresh.approvals,
              authorSignature: fresh.authorSignature,
            });
          }
        } catch {
          // Kegagalan arsip tidak membatalkan pencatatan surat masuk.
          toast.warning("Surat masuk dicatat, namun arsip PDF gagal dibuat. Coba lagi via tombol Buat Arsip PDF.");
        }
      }

      const msg = asDraft
        ? "Surat masuk disimpan sebagai konsep"
        : distributeNow
          ? `Surat masuk disimpan dan didistribusikan ke ${distributeTo.length} penerima`
          : "Surat masuk berhasil disimpan";
      toast.success(msg);
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal menyimpan");
      else toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Inbox className="size-5 text-teal-600" />
            Simpan dan Distribusikan Surat Masuk
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Catat identitas surat masuk, lalu distribusikan ke pejabat / unit yang bertanggung jawab.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* ── SECTION 1: Identitas Surat ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-bold">1</div>
              <h3 className="text-sm font-semibold">Identitas Surat</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nomor Surat Pengirim</Label>
                <Input placeholder="Nomor surat dari pengirim" value={letterNumber} onChange={(e) => setLetterNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Surat <span className="text-destructive">*</span></Label>
                <DateField value={letterDate} onChange={(v) => setLetterDate(v)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Perihal / Subjek <span className="text-destructive">*</span></Label>
              <Input placeholder="Perihal surat dari pengirim..." value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User className="size-3.5" /> Nama Pengirim <span className="text-destructive">*</span></Label>
                <Input placeholder="Nama pengirim / instansi" value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Building2 className="size-3.5" /> Instansi Pengirim</Label>
                <Input placeholder="Nama instansi / organisasi" value={fromOrganization} onChange={(e) => setFromOrganization(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Klasifikasi / Urgensi</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${URGENCY_COLORS[classification]}`}>
                        {CLASSIFICATIONS.find((c) => c.value === classification)?.label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICATIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${URGENCY_COLORS[c.value]}`}>
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── SECTION 2: Data Penerimaan ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">2</div>
              <h3 className="text-sm font-semibold">Data Penerimaan</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Tanggal Diterima</Label>
                <DateField value={receivedAt} onChange={(v) => setReceivedAt(v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Hash className="size-3.5" /> Nomor Agenda</Label>
                <Input placeholder="No. agenda" value={agendaNumber} onChange={(e) => setAgendaNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User className="size-3.5" /> Diterima Oleh <span className="text-destructive">*</span></Label>
                <Input placeholder="Nama penerima" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
              </div>
            </div>

            {/* Jenis: Digital / Fisik */}
            <div className="space-y-1.5">
              <Label>Jenis Dokumen</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPhysical(false)}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    !isPhysical ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <FileText className="size-4" /> Digital
                </button>
                <button
                  type="button"
                  onClick={() => setIsPhysical(true)}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    isPhysical ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <ScanLine className="size-4" /> Surat Fisik
                </button>
              </div>
            </div>

            {/* Upload scan surat fisik */}
            {isPhysical && (
              <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <ScanLine className="size-3.5" /> Upload Scan / Foto Surat Fisik
                </p>
                {physicalFile ? (
                  <div className="flex items-center gap-3 rounded border bg-background px-3 py-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{physicalFile.name}</span>
                    {physicalUploading
                      ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      : (
                        <button type="button" onClick={() => { setPhysicalFile(null); setPhysicalStorageId(null); }} className="cursor-pointer text-muted-foreground hover:text-destructive">
                          <X className="size-4" />
                        </button>
                      )}
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Upload className="size-4" />
                    <span>Klik untuk unggah (PDF, JPG, PNG)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handlePhysicalFileChange} />
                  </label>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── SECTION 3: Distribusi & Disposisi ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs font-bold">3</div>
                <h3 className="text-sm font-semibold">Distribusi & Disposisi</h3>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs select-none">
                <input
                  type="checkbox"
                  checked={distributeNow}
                  onChange={(e) => setDistributeNow(e.target.checked)}
                  className="rounded"
                />
                <span className="text-muted-foreground">Buat disposisi sekarang</span>
              </label>
            </div>

            {distributeNow ? (
              <div className="space-y-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3">

                {/* Penerima */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <GitFork className="size-3.5 text-violet-600" />
                    Penerima Disposisi <span className="text-destructive">*</span>
                  </Label>
                  <EmployeeMultiPicker
                    value={distributeTo}
                    onChange={setDistributeTo}
                    placeholder="Pilih pejabat / unit penerima disposisi..."
                  />
                  {distributeTo.length > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-green-500" />
                      Disposisi akan dibuat untuk {distributeTo.length} penerima
                    </p>
                  )}
                </div>

                {/* Jenis Tindak Lanjut */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <ArrowRightCircle className="size-3.5 text-violet-600" />
                    Jenis Tindak Lanjut
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DISPOSITION_ACTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setDispositionAction(a.value)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          dispositionAction === a.value
                            ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                            : "border-border text-muted-foreground hover:border-violet-400 hover:text-violet-600"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prioritas & Batas Waktu */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Flag className="size-3.5 text-violet-600" />
                      Prioritas
                    </Label>
                    <div className="flex gap-1.5">
                      {DISPOSITION_PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setDispositionPriority(p.value)}
                          className={`cursor-pointer flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                            dispositionPriority === p.value
                              ? `${p.color} border-current`
                              : "border-border text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-violet-600" />
                      Batas Waktu
                    </Label>
                    <DateField
                      value={dispositionDueDate}
                      onChange={(v) => setDispositionDueDate(v)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Instruksi tambahan */}
                <div className="space-y-1.5">
                  <Label>Instruksi / Catatan Tambahan</Label>
                  <Textarea
                    value={dispositionNote}
                    onChange={(e) => setDispositionNote(e.target.value)}
                    placeholder="Catatan khusus untuk penerima disposisi (opsional)..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Preview disposisi */}
                {distributeTo.length > 0 && (
                  <div className="rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-violet-950/30 p-2.5 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Preview Disposisi</p>
                    <p className="text-xs text-foreground">
                      <span className="font-medium">[{DISPOSITION_ACTIONS.find(a => a.value === dispositionAction)?.label}]</span>
                      {dispositionNote.trim() ? ` ${dispositionNote.trim()}` : " Harap ditindaklanjuti."}
                    </p>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      {dispositionDueDate && (
                        <span className="flex items-center gap-1"><Clock className="size-3" /> Batas: {new Date(dispositionDueDate).toLocaleDateString("id-ID")}</span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${DISPOSITION_PRIORITIES.find(p => p.value === dispositionPriority)?.color}`}>
                        <Flag className="size-3" />
                        {DISPOSITION_PRIORITIES.find(p => p.value === dispositionPriority)?.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-xs text-muted-foreground">Disposisi dapat dibuat nanti melalui fitur Disposisi pada detail surat.</p>
              </div>
            )}
          </div>

          <Separator />

          {/* ── SECTION 4: Tembusan ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold">4</div>
              <h3 className="text-sm font-semibold">Tembusan (CC)</h3>
              {(ccUsers.length + ccExternal.length) > 0 && (
                <Badge variant="secondary" className="text-[10px]">{ccUsers.length + ccExternal.length} penerima</Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Internal</Label>
              <EmployeeMultiPicker value={ccUsers} onChange={setCcUsers} placeholder="Tambah tembusan dari direktori karyawan..." />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Eksternal</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nama / jabatan eksternal..."
                  value={ccExternalInput}
                  onChange={(e) => setCcExternalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCcExternal(); } }}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" variant="secondary" className="h-8" onClick={addCcExternal}>Tambah</Button>
              </div>
              {ccExternal.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ccExternal.map((ext) => (
                    <Badge key={ext} variant="outline" className="text-[11px] gap-1 pr-1">
                      {ext}
                      <button type="button" onClick={() => setCcExternal((p) => p.filter((x) => x !== ext))} className="hover:text-destructive">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* ── SECTION 5: Lampiran & Catatan ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold">5</div>
              <h3 className="text-sm font-semibold">Lampiran & Catatan</h3>
            </div>

            {/* Lampiran */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Paperclip className="size-3.5" /> Lampiran</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                <Upload className="size-4" /> <span>Klik untuk mengunggah lampiran</span>
                <input type="file" multiple className="hidden" onChange={handleFileChange} />
              </label>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.file.name} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2 text-sm">
                      <span className="truncate flex-1">{att.file.name}</span>
                      {att.uploading
                        ? <Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />
                        : <button type="button" onClick={() => setAttachments((p) => p.filter((a) => a.file !== att.file))} className="ml-2 cursor-pointer text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catatan internal */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><AlertCircle className="size-3.5" /> Catatan Internal</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan untuk keperluan internal (tidak tampil di surat)..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan Konsep
          </Button>
          <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Inbox className="size-4" />}
            {distributeNow ? "Simpan & Distribusikan" : "Simpan Surat Masuk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
