import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Loader2, Upload, X, Hash, ScanLine, FileText, Plus, Settings2, ChevronRight, ClipboardCheck, AlertCircle, Eye } from "lucide-react";
import LetterEditor from "./LetterEditor.tsx";
import LetterTemplatePicker from "./LetterTemplatePicker.tsx";
import LetterPreviewDialog, { buildPreviewDetail } from "./LetterPreviewDialog.tsx";
import EmployeePicker, { EmployeeMultiPicker } from "./EmployeePicker.tsx";
import type { PickedEmployee } from "./EmployeePicker.tsx";
import LetterheadManagerDialog from "./LetterheadManagerDialog.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";

import { DEFAULT_PREFIXES } from "../_lib/constants.ts";
import { substituteLetterVariables, formatVariableDate } from "../_lib/letterVariables.ts";
import { memoLineFromSettings } from "../_lib/memoLine.ts";

const LETTER_TYPES = [
  { value: "masuk", label: "Surat Masuk" },
  { value: "keluar", label: "Surat Keluar" },
  { value: "memo", label: "Nota" },
];

const CATEGORIES = [
  { value: "undangan", label: "Undangan" },
  { value: "permohonan", label: "Permohonan" },
  { value: "pemberitahuan", label: "Pemberitahuan" },
  { value: "balasan", label: "Balasan" },
  { value: "keputusan", label: "Keputusan" },
  { value: "edaran", label: "Surat Edaran" },
  { value: "memo", label: "Nota" },
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

interface LetterFormDialogProps {
  open: boolean;
  onClose: () => void;
  editId?: Id<"letters"> | null;
  defaultType?: string;
}

interface AttachmentItem {
  file: File;
  storageId?: Id<"_storage">;
  uploading: boolean;
}

export default function LetterFormDialog({ open, onClose, editId, defaultType = "keluar" }: LetterFormDialogProps) {
  const { user } = useAuth();
  const letterheads = useQuery(api.letters.listLetterheads);
  const companyPrefixes = useQuery(api.letters.listCompanyPrefixes);
  // Judul area kop nota (per tenant) untuk pratinjau saat jenis = Nota.
  const memoSettings = useQuery(api.letterMemoSettings.get, {});

  const createLetter = useMutation(api.letters.createLetter);
  const updateLetter = useMutation(api.letters.updateLetter);
  const generateUploadUrl = useMutation(api.letters.generateUploadUrl);
  const saveAttachment = useMutation(api.letters.saveAttachment);
  const generateLetterNumber = useMutation(api.letters.generateLetterNumber);
  const generateLetterNumberWithPrefix = useMutation(api.letters.generateLetterNumberWithPrefix);
  const generateAgendaNumber = useMutation(api.letters.generateAgendaNumber);
  const submitForApproval = useMutation(api.letters.submitForApproval);
  const saveDraftApprovers = useMutation(api.letters.saveDraftApprovers);

  // Fetch existing letter data when editing (use getLetterWithExtras for full data incl. ccUsers, fromUser, toUser)
  const existingLetter = useQuery(
    api.letters.getLetterWithExtras,
    editId ? { letterId: editId } : "skip",
  );
  // Daftar departemen untuk pilihan pengiriman massal per departemen.
  const departments = useQuery(api.users.listDepartments, {});
  // Penerima massal tersimpan (saat mengedit konsep) agar dapat dipulihkan ke form.
  const existingRecipients = useQuery(
    api.letters.getLetterRecipients,
    editId ? { letterId: editId } : "skip",
  );

  // Autosave: `activeLetterId` melacak draf yang sedang dikerjakan agar autosave
  // & tombol Simpan/Ajukan memakai surat yang sama (tidak membuat duplikat).
  const [activeLetterId, setActiveLetterId] = useState<Id<"letters"> | null>(editId ?? null);

  const [type, setType] = useState(defaultType);
  const [subject, setSubject] = useState("");
  const [place, setPlace] = useState("");
  const [letterNumber, setLetterNumber] = useState("");
  const [agendaNumber, setAgendaNumber] = useState("");
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split("T")[0]);
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("pemberitahuan");
  const [classification, setClassification] = useState("biasa");
  // Metode tanda tangan: "digital" (default, gambar TTD tampil) atau
  // "basah" (ruang TTD dikosongkan untuk ditandatangani manual; QR tetap tampil).
  const [signatureMethod, setSignatureMethod] = useState<"digital" | "basah">("digital");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [selectedPrefix2, setSelectedPrefix2] = useState("");
  // Mode penomoran: "auto" = sistem memberi nomor otomatis saat dikirim,
  // "manual" = pengguna mengetik nomor sendiri. Sakelar tegas menggantikan
  // aturan lama "kosong = otomatis" agar niat pengguna jelas.
  const [numberMode, setNumberMode] = useState<"auto" | "manual">("auto");
  // Mode Nomor Agenda: sama seperti nomor surat, default otomatis.
  const [agendaMode, setAgendaMode] = useState<"auto" | "manual">("auto");
  const categoryPrefixes = useQuery(api.letters.listCategoryPrefixes);
  // Pratinjau nomor otomatis berikutnya (read-only, tidak menaikkan urutan).
  // Ditampilkan saat kolom nomor dikosongkan agar pengguna tahu nomor yang akan
  // diberikan sistem saat surat dikirim.
  const nextNumberPreview = useQuery(api.letters.previewNextLetterNumber, {
    letterType: type,
    prefixOverride: selectedPrefix || undefined,
    prefix2Override: selectedPrefix2 || undefined,
  });
  // Peringatan nomor ganda: cek apakah nomor manual sudah dipakai surat lain.
  // Hanya diperiksa saat mode manual dan kolom terisi. Mengabaikan surat yang
  // sedang diedit sendiri.
  const duplicateCheck = useQuery(
    api.letters.checkDuplicateLetterNumber,
    numberMode === "manual" && letterNumber.trim().length > 0
      ? { letterNumber: letterNumber.trim(), excludeLetterId: activeLetterId ?? undefined }
      : "skip",
  );
  // Pratinjau Nomor Agenda otomatis berikutnya (read-only).
  const nextAgendaPreview = useQuery(api.letters.previewNextAgendaNumber, { letterType: type });
  const allPrefixes = [...DEFAULT_PREFIXES, ...(companyPrefixes?.map((p) => p.code) ?? [])]
    .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
  const allCategoryPrefixes = categoryPrefixes?.map((p) => p.code) ?? [];

  // Pengirim – bisa pilih dari direktori atau ketik manual
  const [fromPicked, setFromPicked] = useState<PickedEmployee | null>(null);
  const [fromNameManual, setFromNameManual] = useState(user?.profile.name ?? "");
  const [fromOrganization, setFromOrganization] = useState("");

  // Penerima – bisa pilih dari direktori atau ketik manual
  const [toPicked, setToPicked] = useState<PickedEmployee | null>(null);
  const [toNameManual, setToNameManual] = useState("");
  const [toJobTitle, setToJobTitle] = useState("");
  const [toOrganization, setToOrganization] = useState("");
  const [toAddress, setToAddress] = useState("");

  // Pengiriman massal (hanya untuk surat internal/memo).
  //   "single"     → satu penerima (toPicked) seperti biasa
  //   "individual" → banyak penerima dipilih satu per satu
  //   "department" → seluruh anggota satu departemen
  //   "all"        → seluruh karyawan organisasi
  const [recipientMode, setRecipientMode] = useState<"single" | "individual" | "department" | "all">("single");
  const [recipientUsers, setRecipientUsers] = useState<PickedEmployee[]>([]);
  const [recipientDepartment, setRecipientDepartment] = useState<string>("");

  // Tembusan (CC)
  const [ccUsers, setCcUsers] = useState<PickedEmployee[]>([]);
  const [ccExternal, setCcExternal] = useState<string[]>([]);
  const [ccExternalInput, setCcExternalInput] = useState("");

  const [content, setContent] = useState("<p>Dengan hormat,</p><p></p><p>Demikian surat ini kami sampaikan. Atas perhatiannya kami ucapkan terima kasih.</p>");
  const [notes, setNotes] = useState("");
  const [letterheadId, setLetterheadId] = useState<string>("none");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Surat fisik masuk
  const [isPhysical, setIsPhysical] = useState(false);
  const [physicalFile, setPhysicalFile] = useState<File | null>(null);
  const [physicalStorageId, setPhysicalStorageId] = useState<Id<"_storage"> | null>(null);
  const [physicalUploading, setPhysicalUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showLetterheadManager, setShowLetterheadManager] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Ditandai true setelah data surat lama selesai dimuat ke form (mode edit),
  // agar autosave tidak jalan sebelum form terisi lengkap.
  const [populated, setPopulated] = useState(!editId);

  // Alur persetujuan inline (untuk surat keluar/internal/memo)
  // pemeriksa[0] = Pemeriksa Utama (langkah terakhir sebelum penyetuju),
  // pemeriksa[1..] = pemeriksa tambahan (mendahului pemeriksa utama).
  const [pemeriksa, setPemeriksa] = useState<PickedEmployee[]>([]);
  const [penyetuju, setPenyetuju] = useState<PickedEmployee | null>(null);
  const [showAddPemeriksa, setShowAddPemeriksa] = useState(false);
  const [showAddCcUser, setShowAddCcUser] = useState(false);

  // Surat keluar → penerima diisi manual (pihak eksternal), tanpa direktori
  const isOutgoing = type === "keluar";
  // Surat internal & memo → pengirim/penerima wajib dari direktori karyawan (dalam organisasi yang sama)
  const isInternal = type === "internal" || type === "memo";

  // Populate form fields when existing letter data is loaded.
  // Hanya sekali per pembukaan agar tulisan pengguna tidak tertimpa saat
  // autosave menulis ke server di latar (existingLetter bersifat reaktif).
  const hasPopulatedRef = useRef(false);
  useEffect(() => {
    if (!editId || !existingLetter) return;
    if (hasPopulatedRef.current) return;
    hasPopulatedRef.current = true;
    const l = existingLetter.letter;
    setType(l.type ?? defaultType);
    setSubject(l.subject ?? "");
    setPlace(l.place ?? "");
    setLetterNumber(l.letterNumber ?? "");
    // Surat yang sudah punya nomor tersimpan dianggap mode manual agar tidak
    // tertimpa; yang belum bernomor tetap otomatis.
    setNumberMode(l.letterNumber ? "manual" : "auto");
    setAgendaNumber(l.agendaNumber ?? "");
    // Surat yang sudah punya nomor agenda dianggap manual agar tidak tertimpa.
    setAgendaMode(l.agendaNumber ? "manual" : "auto");
    setLetterDate(l.letterDate ? new Date(l.letterDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    if (l.receivedAt) setReceivedAt(new Date(l.receivedAt).toISOString().split("T")[0]);
    setCategory(l.category ?? "pemberitahuan");
    setClassification(l.classification ?? "biasa");
    setSignatureMethod(l.signatureMethod === "basah" ? "basah" : "digital");
    setFromNameManual(l.fromName ?? "");
    setFromOrganization(l.fromOrganization ?? "");
    setToNameManual(l.toName ?? "");
    setToJobTitle(l.toJobTitle ?? "");
    setToOrganization(l.toOrganization ?? "");
    setToAddress(l.toAddress ?? "");
    setContent(l.content ?? "");
    setNotes(l.notes ?? "");
    setLetterheadId(l.letterheadId ?? "none");
    setIsPhysical(l.isPhysical ?? false);
    // Pengirim dari direktori jika ada
    if (existingLetter.fromUser) {
      setFromPicked({ _id: existingLetter.fromUser._id, name: existingLetter.fromUser.name ?? "", jobTitle: existingLetter.fromUser.jobTitle ?? "" });
    } else if (existingLetter.author) {
      setFromPicked({ _id: existingLetter.author._id, name: existingLetter.author.name ?? "", jobTitle: existingLetter.author.jobTitle ?? "" });
    }
    // Penerima dari direktori jika ada
    if (existingLetter.toUser) {
      setToPicked({ _id: existingLetter.toUser._id, name: existingLetter.toUser.name ?? "", jobTitle: existingLetter.toUser.jobTitle ?? "" });
    }
    // Tembusan CC
    if (existingLetter.ccUsers && existingLetter.ccUsers.length > 0) {
      setCcUsers(existingLetter.ccUsers.map((u) => ({ _id: u._id, name: u.name ?? "", jobTitle: u.jobTitle ?? "" })));
    }
    if (l.ccExternal && l.ccExternal.length > 0) {
      setCcExternal(l.ccExternal);
    }
    // Populate pemeriksa & penyetuju dari approvals yang tersimpan
    if (existingLetter.approvals && existingLetter.approvals.length > 0) {
      const approvals = existingLetter.approvals;
      // Penyetuju = role penyetuju (order tertinggi)
      const penyetujuApproval = approvals.find(
        (a) => "approvalRole" in a && a.approvalRole === "penyetuju",
      );
      if (penyetujuApproval?.approver) {
        setPenyetuju({
          _id: penyetujuApproval.approver._id,
          name: penyetujuApproval.approver.name ?? "",
          jobTitle: penyetujuApproval.approver.jobTitle ?? "",
        });
      }
      // Pemeriksa = semua role pemeriksa_1, pemeriksa_2, dst — urutkan: pemeriksa_2+ dulu, pemeriksa_1 terakhir
      const pemerikasaApprovals = approvals.filter(
        (a) => "approvalRole" in a && typeof a.approvalRole === "string" && a.approvalRole.startsWith("pemeriksa_"),
      );
      // pemeriksa_1 = index 0 (Pemeriksa Utama), pemeriksa_2+ = tambahan
      const utama = pemerikasaApprovals.find((a) => "approvalRole" in a && a.approvalRole === "pemeriksa_1");
      const tambahan = pemerikasaApprovals
        .filter((a) => "approvalRole" in a && a.approvalRole !== "pemeriksa_1")
        .sort((a, b) => a.order - b.order);
      const sorted = utama ? [utama, ...tambahan] : tambahan;
      setPemeriksa(
        sorted
          .filter((a) => a.approver)
          .map((a) => ({
            _id: a.approver!._id,
            name: a.approver!.name ?? "",
            jobTitle: a.approver!.jobTitle ?? "",
          })),
      );
    }
    setPopulated(true);
  }, [editId, existingLetter, defaultType]);

  // Pulihkan pilihan penerima massal saat mengedit konsep (sekali saja).
  const hasPopulatedRecipientsRef = useRef(false);
  useEffect(() => {
    if (!editId || !existingRecipients) return;
    if (hasPopulatedRecipientsRef.current) return;
    hasPopulatedRecipientsRef.current = true;
    const mode = existingRecipients.mode;
    if (mode === "individual" || mode === "department" || mode === "all") {
      setRecipientMode(mode);
      if (mode === "department" && existingRecipients.department) {
        setRecipientDepartment(existingRecipients.department);
      }
      if (mode === "individual") {
        setRecipientUsers(
          existingRecipients.recipients.map((r) => ({
            _id: r.userId,
            name: r.name,
            jobTitle: r.jobTitle ?? undefined,
            department: r.department ?? undefined,
          })),
        );
      }
    }
  }, [editId, existingRecipients]);

  // Default kop surat untuk surat BARU: pilih kop default (bertanda ★) bila ada,
  // atau kop pertama sebagai cadangan. Hanya berlaku saat membuat surat baru
  // (bukan mode edit) dan hanya sekali, agar tidak menimpa pilihan pengguna.
  // Bila belum ada kop surat sama sekali, tetap "none" (Tanpa Kop Surat).
  const hasSetDefaultLetterheadRef = useRef(false);
  useEffect(() => {
    if (editId) return; // mode edit memakai pilihan tersimpan
    if (hasSetDefaultLetterheadRef.current) return;
    if (!letterheads || letterheads.length === 0) return;
    hasSetDefaultLetterheadRef.current = true;
    const preferred =
      letterheads.find((lh) => lh.isDefault) ?? letterheads[0];
    setLetterheadId(preferred._id);
  }, [editId, letterheads]);

  // Effective toName: for outgoing letters always manual; otherwise prefer picked employee
  const effectiveToName = isOutgoing ? toNameManual : (toPicked ? toPicked.name : toNameManual);
  // Effective fromName: prefer picked employee name, fallback to manual
  const effectiveFromName = fromPicked ? fromPicked.name : fromNameManual;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newItems: AttachmentItem[] = files.map((f) => ({ file: f, uploading: true }));
    setAttachments((prev) => [...prev, ...newItems]);

    for (let i = 0; i < newItems.length; i++) {
      try {
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": files[i].type },
          body: files[i],
        });
        const { storageId } = await resp.json() as { storageId: Id<"_storage"> };
        setAttachments((prev) =>
          prev.map((a) =>
            a.file === files[i] ? { ...a, storageId, uploading: false } : a,
          ),
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a.file !== files[i]));
        toast.error(`Gagal mengunggah ${files[i].name}`);
      }
    }
    e.target.value = "";
  }, [generateUploadUrl]);

  const handlePhysicalFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhysicalFile(file);
    setPhysicalUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
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

  const removeAttachment = (file: File) => {
    setAttachments((prev) => prev.filter((a) => a.file !== file));
  };

  const handleSave = async (asDraft: boolean) => {
    if (!subject.trim()) { toast.error("Perihal surat wajib diisi"); return; }
    // Apakah surat ini memakai pengiriman massal (banyak penerima)?
    const isBulk = isInternal && recipientMode !== "single";
    if (isInternal) {
      if (!fromPicked) { toast.error("Pilih pengirim dari direktori karyawan"); return; }
      if (!isBulk) {
        if (!toPicked) { toast.error("Pilih penerima dari direktori karyawan"); return; }
      } else if (recipientMode === "individual") {
        if (recipientUsers.length === 0) { toast.error("Pilih minimal satu penerima"); return; }
      } else if (recipientMode === "department") {
        if (!recipientDepartment) { toast.error("Pilih departemen tujuan"); return; }
      }
    } else {
      if (!effectiveFromName.trim()) { toast.error("Pengirim wajib diisi"); return; }
      if (!effectiveToName.trim()) { toast.error("Penerima wajib diisi"); return; }
    }
    setSaving(true);
    try {
      const lhId = letterheadId === "none" ? undefined : letterheadId as Id<"letterheads">;
      const toUserId = isOutgoing || isBulk ? undefined : (toPicked ? toPicked._id : undefined);
      const fromUserId = fromPicked ? fromPicked._id : undefined;
      const ccUserIds = ccUsers.map((c) => c._id);
      const ccExternalList = ccExternal.length > 0 ? ccExternal : undefined;

      // Untuk pengiriman massal, "Kepada" pada surat menampilkan label grup.
      const bulkToName =
        recipientMode === "all"
          ? "Seluruh Karyawan"
          : recipientMode === "department"
            ? `Departemen ${recipientDepartment}`
            : `${recipientUsers.length} Penerima`;

      // Argumen penerima massal yang dikirim ke backend.
      const recipientArgs = isInternal
        ? {
            recipientMode,
            recipientDepartment: recipientMode === "department" ? recipientDepartment : undefined,
            recipientUserIds: recipientMode === "individual" ? recipientUsers.map((u) => u._id) : undefined,
          }
        : { recipientMode: "single" as const };

      const effectiveFromOrganization = isInternal
        ? (fromPicked?.department || undefined)
        : (fromOrganization || undefined);
      const effectiveToOrganization = isInternal
        ? (isBulk ? undefined : toPicked?.department || undefined)
        : (toOrganization || undefined);
      const effectiveToJobTitle = isInternal
        ? (isBulk ? undefined : toPicked?.jobTitle || undefined)
        : (toJobTitle || undefined);
      const effectiveToAddress = isInternal ? undefined : (toAddress || undefined);

      // Nomor surat: mode manual pakai input pengguna, mode otomatis dibiarkan
      // kosong agar sistem memberi nomor saat dikirim.
      let finalLetterNumber = numberMode === "manual" ? (letterNumber.trim() || undefined) : undefined;
      if (!finalLetterNumber && !asDraft) {
        try {
          finalLetterNumber = selectedPrefix
            ? await generateLetterNumberWithPrefix({ letterType: type, prefixOverride: selectedPrefix, prefix2Override: selectedPrefix2 || undefined })
            : await generateLetterNumber({ letterType: type });
        } catch {
          // non-fatal
        }
      }

      // Nomor agenda: mode manual pakai input; mode otomatis diberi nomor urut
      // saat surat difinalkan (bukan draft).
      let finalAgendaNumber = agendaMode === "manual" ? (agendaNumber.trim() || undefined) : undefined;
      if (!finalAgendaNumber && agendaMode === "auto" && !asDraft) {
        try {
          finalAgendaNumber = await generateAgendaNumber({ letterType: type });
        } catch {
          // non-fatal
        }
      }

      // Nama "Kepada" final: label grup untuk pengiriman massal, selainnya biasa.
      const finalToName = isBulk ? bulkToName : effectiveToName;

      // Mail merge: ganti placeholder {variabel} pada isi surat dengan data form.
      const finalContent = substituteLetterVariables(content, {
        nomor_surat: finalLetterNumber ?? "",
        tanggal: formatVariableDate(letterDate),
        perihal: subject,
        nama_penerima: finalToName,
        jabatan_penerima: effectiveToJobTitle ?? "",
        instansi_penerima: effectiveToOrganization ?? "",
        nama_pengirim: effectiveFromName,
        jabatan_pengirim: fromPicked?.jobTitle ?? "",
        tempat: place.trim(),
      });

      let letterId: Id<"letters">;

      if (activeLetterId) {
        await updateLetter({
          letterId: activeLetterId,
          type,
          subject,
          place: place.trim() || undefined,
          letterNumber: finalLetterNumber,
          agendaNumber: finalAgendaNumber,
          letterDate,
          receivedAt: type === "masuk" ? receivedAt : undefined,
          category,
          classification,
          signatureMethod,
          fromName: effectiveFromName,
          fromUserId,
          fromOrganization: effectiveFromOrganization,
          toName: finalToName,
          toUserId,
          toJobTitle: effectiveToJobTitle,
          toOrganization: effectiveToOrganization,
          toAddress: effectiveToAddress,
          content: finalContent,
          notes: notes || undefined,
          letterheadId: lhId,
          ccUserIds,
          ccExternal: ccExternalList,
          physicalDocStorageId: physicalStorageId ?? undefined,
          physicalDocFileName: physicalFile?.name,
          ...recipientArgs,
        });
        letterId = activeLetterId;
      } else {
        letterId = await createLetter({
          type,
          subject,
          place: place.trim() || undefined,
          letterNumber: finalLetterNumber,
          agendaNumber: finalAgendaNumber,
          letterDate,
          receivedAt: type === "masuk" ? receivedAt : undefined,
          category,
          classification,
          signatureMethod,
          fromName: effectiveFromName,
          fromUserId,
          fromOrganization: effectiveFromOrganization,
          toName: finalToName,
          toUserId,
          toJobTitle: effectiveToJobTitle,
          toOrganization: effectiveToOrganization,
          toAddress: effectiveToAddress,
          content: finalContent,
          notes: notes || undefined,
          letterheadId: lhId,
          ccUserIds,
          ccExternal: ccExternalList,
          isPhysical: isPhysical || undefined,
          physicalDocStorageId: physicalStorageId ?? undefined,
          physicalDocFileName: physicalFile?.name,
          ...recipientArgs,
        });
        setActiveLetterId(letterId);
      }
      // Save uploaded attachments
      const uploaded = attachments.filter((a) => a.storageId && !a.uploading);
      for (const att of uploaded) {
        if (!att.storageId) continue;
        await saveAttachment({ letterId, storageId: att.storageId, fileName: att.file.name, fileSize: att.file.size, fileType: att.file.type });
      }

      // Save draft approvers so they persist on edit
      if (asDraft && (pemeriksa.length > 0 || penyetuju)) {
        const steps: { userId: Id<"users">; role: string; label: string; order: number }[] = [];
        let order = 1;
        pemeriksa.slice(1).forEach((p, i) => {
          steps.push({ userId: p._id, role: `pemeriksa_${i + 2}`, label: `Pemeriksa ${i + 2}`, order: order++ });
        });
        if (pemeriksa[0]) {
          steps.push({ userId: pemeriksa[0]._id, role: "pemeriksa_1", label: "Pemeriksa Utama", order: order++ });
        }
        if (penyetuju) {
          steps.push({ userId: penyetuju._id, role: "penyetuju", label: "Penyetuju", order: order++ });
        }
        try {
          await saveDraftApprovers({ letterId, approverSteps: steps });
        } catch {
          // non-fatal
        }
      }

      toast.success(asDraft ? "Surat disimpan sebagai konsep" : "Surat berhasil disimpan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan surat");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!subject.trim()) { toast.error("Perihal surat wajib diisi"); return; }
    if (isInternal) {
      if (!fromPicked) { toast.error("Pilih pengirim dari direktori karyawan"); return; }
      if (!toPicked) { toast.error("Pilih penerima dari direktori karyawan"); return; }
    } else {
      if (!effectiveFromName.trim()) { toast.error("Pengirim wajib diisi"); return; }
      if (!effectiveToName.trim()) { toast.error("Penerima wajib diisi"); return; }
    }
    if (pemeriksa.length === 0) { toast.error("Pemeriksa wajib dipilih untuk mengajukan surat"); return; }
    if (!penyetuju) { toast.error("Penyetuju wajib dipilih untuk mengajukan surat"); return; }

    setSaving(true);
    try {
      const lhId = letterheadId === "none" ? undefined : letterheadId as Id<"letterheads">;
      const toUserId = isOutgoing ? undefined : (toPicked ? toPicked._id : undefined);
      const fromUserId = fromPicked ? fromPicked._id : undefined;
      const ccUserIds = ccUsers.map((c) => c._id);
      const ccExternalList = ccExternal.length > 0 ? ccExternal : undefined;
      const effectiveFromOrganization = isInternal ? (fromPicked?.department || undefined) : (fromOrganization || undefined);
      const effectiveToOrganization = isInternal ? (toPicked?.department || undefined) : (toOrganization || undefined);
      const effectiveToJobTitle = isInternal ? (toPicked?.jobTitle || undefined) : (toJobTitle || undefined);
      const effectiveToAddress = isInternal ? undefined : (toAddress || undefined);

      let finalLetterNumber = numberMode === "manual" ? (letterNumber.trim() || undefined) : undefined;
      if (!finalLetterNumber) {
        try {
          finalLetterNumber = selectedPrefix
            ? await generateLetterNumberWithPrefix({ letterType: type, prefixOverride: selectedPrefix, prefix2Override: selectedPrefix2 || undefined })
            : await generateLetterNumber({ letterType: type });
        } catch {
          // non-fatal
        }
      }

      let finalAgendaNumber = agendaMode === "manual" ? (agendaNumber.trim() || undefined) : undefined;
      if (!finalAgendaNumber && agendaMode === "auto") {
        try {
          finalAgendaNumber = await generateAgendaNumber({ letterType: type });
        } catch {
          // non-fatal
        }
      }

      // Mail merge: ganti placeholder {variabel} pada isi surat dengan data form.
      const finalContent = substituteLetterVariables(content, {
        nomor_surat: finalLetterNumber ?? "",
        tanggal: formatVariableDate(letterDate),
        perihal: subject,
        nama_penerima: effectiveToName,
        jabatan_penerima: effectiveToJobTitle ?? "",
        instansi_penerima: effectiveToOrganization ?? "",
        nama_pengirim: effectiveFromName,
        jabatan_pengirim: fromPicked?.jobTitle ?? "",
        tempat: place.trim(),
      });

      let letterId: Id<"letters">;
      if (activeLetterId) {
        await updateLetter({
          letterId: activeLetterId, type, subject, letterNumber: finalLetterNumber, agendaNumber: finalAgendaNumber,
          letterDate, receivedAt: type === "masuk" ? receivedAt : undefined, category, classification, signatureMethod,
          fromName: effectiveFromName, fromUserId, fromOrganization: effectiveFromOrganization,
          toName: effectiveToName, toUserId, toJobTitle: effectiveToJobTitle,
          toOrganization: effectiveToOrganization, toAddress: effectiveToAddress,
          content: finalContent, notes: notes || undefined, letterheadId: lhId,
          ccUserIds, ccExternal: ccExternalList,
          physicalDocStorageId: physicalStorageId ?? undefined, physicalDocFileName: physicalFile?.name,
        });
        letterId = activeLetterId;
      } else {
        letterId = await createLetter({
          type, subject, letterNumber: finalLetterNumber, agendaNumber: finalAgendaNumber,
          letterDate, receivedAt: type === "masuk" ? receivedAt : undefined, category, classification, signatureMethod,
          fromName: effectiveFromName, fromUserId, fromOrganization: effectiveFromOrganization,
          toName: effectiveToName, toUserId, toJobTitle: effectiveToJobTitle,
          toOrganization: effectiveToOrganization, toAddress: effectiveToAddress,
          content: finalContent, notes: notes || undefined, letterheadId: lhId,
          ccUserIds, ccExternal: ccExternalList,
          isPhysical: isPhysical || undefined,
          physicalDocStorageId: physicalStorageId ?? undefined, physicalDocFileName: physicalFile?.name,
        });
        setActiveLetterId(letterId);
      }

      const uploaded = attachments.filter((a) => a.storageId && !a.uploading);
      for (const att of uploaded) {
        if (!att.storageId) continue;
        await saveAttachment({ letterId, storageId: att.storageId, fileName: att.file.name, fileSize: att.file.size, fileType: att.file.type });
      }

      const steps: { userId: Id<"users">; role: string; label: string; order: number }[] = [];
      let order = 1;
      for (let i = 1; i < pemeriksa.length; i++) {
        steps.push({ userId: pemeriksa[i]._id, role: `pemeriksa_${i + 1}`, label: "Pemeriksa", order: order++ });
      }
      steps.push({ userId: pemeriksa[0]._id, role: "pemeriksa_1", label: "Pemeriksa", order: order++ });
      steps.push({ userId: penyetuju._id, role: "penyetuju", label: "Penyetuju", order: order++ });

      await submitForApproval({ letterId, approverIds: [], approverSteps: steps });

      toast.success("Surat disimpan dan diajukan untuk persetujuan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan surat");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Autosave sebagai Konsep -------------------------------------------
  // Menyimpan draf secara otomatis di latar setelah pengguna berhenti mengetik.
  // Tidak menghasilkan nomor surat otomatis dan tidak mengganti variabel;
  // itu hanya dilakukan saat pengguna menekan Simpan/Ajukan secara eksplisit.

  // Kumpulan nilai yang menjadi pemicu autosave. Diserialkan agar debounce
  // hanya berjalan saat ada perubahan nyata.
  const autoSaveKey = useMemo(
    () =>
      JSON.stringify({
        type, subject, place, letterNumber, agendaNumber, letterDate, receivedAt,
        category, classification, signatureMethod,
        fromName: effectiveFromName, fromUserId: fromPicked?._id ?? null,
        fromOrganization,
        toName: effectiveToName, toUserId: toPicked?._id ?? null,
        toJobTitle, toOrganization, toAddress,
        content, notes, letterheadId,
        ccUserIds: ccUsers.map((c) => c._id), ccExternal,
        recipientMode,
        recipientDepartment,
        recipientUserIds: recipientUsers.map((u) => u._id),
      }),
    [
      type, subject, place, letterNumber, agendaNumber, letterDate, receivedAt,
      category, classification, signatureMethod, effectiveFromName, fromPicked, fromOrganization,
      effectiveToName, toPicked, toJobTitle, toOrganization, toAddress, content,
      notes, letterheadId, ccUsers, ccExternal, recipientMode, recipientDepartment,
      recipientUsers,
    ],
  );

  const [debouncedAutoSaveKey] = useDebounce(autoSaveKey, 1500);
  // Simpan snapshot terakhir yang sudah tersimpan agar tidak menyimpan ulang
  // data yang sama (mis. saat form baru dibuka dan diisi otomatis).
  const lastSavedKeyRef = useRef<string | null>(null);
  // Cegah autosave tumpang tindih.
  const autoSaveInFlightRef = useRef(false);

  useEffect(() => {
    if (!open || !populated || saving) return;
    // Minimal perlu perihal terisi sebelum autosave aktif.
    if (!subject.trim()) return;
    // Untuk surat internal/memo, pengirim wajib dari direktori; tunggu dipilih.
    if (isInternal && !fromPicked) return;
    // Jangan menyimpan ulang data yang belum berubah.
    if (lastSavedKeyRef.current === debouncedAutoSaveKey) return;
    if (autoSaveInFlightRef.current) return;

    const runAutoSave = async () => {
      autoSaveInFlightRef.current = true;
      setAutoSaveStatus("saving");
      try {
        const lhId = letterheadId === "none" ? undefined : (letterheadId as Id<"letterheads">);
        const isBulk = isInternal && recipientMode !== "single";
        const toUserId = isOutgoing || isBulk ? undefined : (toPicked?._id ?? undefined);
        const fromUserId = fromPicked?._id ?? undefined;
        const ccUserIds = ccUsers.map((c) => c._id);
        const ccExternalList = ccExternal.length > 0 ? ccExternal : undefined;
        const bulkToName =
          recipientMode === "all"
            ? "Seluruh Karyawan"
            : recipientMode === "department"
              ? `Departemen ${recipientDepartment}`
              : `${recipientUsers.length} Penerima`;
        const recipientArgs = isInternal
          ? {
              recipientMode,
              recipientDepartment: recipientMode === "department" ? recipientDepartment : undefined,
              recipientUserIds: recipientMode === "individual" ? recipientUsers.map((u) => u._id) : undefined,
            }
          : { recipientMode: "single" as const };
        const effectiveFromOrganization = isInternal ? (fromPicked?.department || undefined) : (fromOrganization || undefined);
        const effectiveToOrganization = isInternal ? (isBulk ? undefined : toPicked?.department || undefined) : (toOrganization || undefined);
        const effectiveToJobTitle = isInternal ? (isBulk ? undefined : toPicked?.jobTitle || undefined) : (toJobTitle || undefined);
        const effectiveToAddress = isInternal ? undefined : (toAddress || undefined);
        const finalToName = isBulk ? bulkToName : effectiveToName;
        // Nomor surat hanya disimpan bila diketik manual; tidak dibuat otomatis.
        const draftLetterNumber = numberMode === "manual" ? (letterNumber.trim() || undefined) : undefined;
        const draftAgendaNumber = agendaMode === "manual" ? (agendaNumber.trim() || undefined) : undefined;

        if (activeLetterId) {
          await updateLetter({
            letterId: activeLetterId,
            type,
            subject,
            place: place.trim() || undefined,
            letterNumber: draftLetterNumber,
            agendaNumber: draftAgendaNumber,
            letterDate,
            receivedAt: type === "masuk" ? receivedAt : undefined,
            category,
            classification,
            signatureMethod,
            fromName: effectiveFromName,
            fromUserId,
            fromOrganization: effectiveFromOrganization,
            toName: finalToName,
            toUserId,
            toJobTitle: effectiveToJobTitle,
            toOrganization: effectiveToOrganization,
            toAddress: effectiveToAddress,
            content,
            notes: notes || undefined,
            letterheadId: lhId,
            ccUserIds,
            ccExternal: ccExternalList,
            ...recipientArgs,
          });
        } else {
          const newId = await createLetter({
            type,
            subject,
            place: place.trim() || undefined,
            letterNumber: draftLetterNumber,
            agendaNumber: draftAgendaNumber,
            letterDate,
            receivedAt: type === "masuk" ? receivedAt : undefined,
            category,
            classification,
            signatureMethod,
            fromName: effectiveFromName,
            fromUserId,
            fromOrganization: effectiveFromOrganization,
            toName: finalToName,
            toUserId,
            toJobTitle: effectiveToJobTitle,
            toOrganization: effectiveToOrganization,
            toAddress: effectiveToAddress,
            content,
            notes: notes || undefined,
            letterheadId: lhId,
            ccUserIds,
            ccExternal: ccExternalList,
            isPhysical: isPhysical || undefined,
            ...recipientArgs,
          });
          setActiveLetterId(newId);
        }
        lastSavedKeyRef.current = debouncedAutoSaveKey;
        setAutoSaveStatus("saved");
      } catch {
        // Autosave gagal tidak mengganggu; pengguna tetap bisa simpan manual.
        setAutoSaveStatus("error");
      } finally {
        autoSaveInFlightRef.current = false;
      }
    };

    void runAutoSave();
  }, [
    debouncedAutoSaveKey, open, populated, saving, subject, isInternal, fromPicked,
    isOutgoing, recipientMode, recipientDepartment, recipientUsers, toPicked, ccUsers,
    ccExternal, fromOrganization, toJobTitle, toOrganization, toAddress, effectiveToName,
    effectiveFromName, letterheadId, numberMode, letterNumber, agendaMode, agendaNumber,
    type, place, letterDate, receivedAt, category, classification, signatureMethod, content, notes,
    isPhysical, activeLetterId, createLetter, updateLetter,
  ]);

  // Data pratinjau dari isian form saat ini (belum disimpan). Placeholder
  // {variabel} diganti agar pratinjau mencerminkan hasil akhir. Nomor otomatis
  // memakai pratinjau nomor berikutnya bila mode otomatis.
  const selectedLetterhead =
    letterheadId !== "none"
      ? (letterheads?.find((lh) => lh._id === letterheadId) ?? null)
      : null;
  const previewLetterNumber =
    numberMode === "manual" ? letterNumber.trim() : (nextNumberPreview ?? "");
  const previewIsBulk = isInternal && recipientMode !== "single";
  const previewToName = previewIsBulk
    ? (recipientMode === "all"
        ? "Seluruh Karyawan"
        : recipientMode === "department"
          ? `Departemen ${recipientDepartment}`
          : `${recipientUsers.length} Penerima`)
    : effectiveToName;
  const previewContent = substituteLetterVariables(content, {
    nomor_surat: previewLetterNumber,
    tanggal: formatVariableDate(letterDate),
    perihal: subject,
    nama_penerima: previewToName,
    jabatan_penerima: isInternal ? (toPicked?.jobTitle ?? "") : toJobTitle,
    instansi_penerima: isInternal ? (toPicked?.department ?? "") : toOrganization,
    nama_pengirim: effectiveFromName,
    jabatan_pengirim: fromPicked?.jobTitle ?? "",
    tempat: place.trim(),
  });
  const previewDetail = buildPreviewDetail({
    type,
    subject: subject || "(Tanpa perihal)",
    letterNumber: previewLetterNumber || undefined,
    letterDate,
    place: place.trim() || undefined,
    category,
    classification,
    signatureMethod,
    fromName: effectiveFromName,
    fromJobTitle: fromPicked?.jobTitle,
    fromDepartment: fromPicked?.department,
    toName: previewToName || "(Tanpa penerima)",
    toJobTitle: isInternal ? toPicked?.jobTitle : (toJobTitle || undefined),
    toOrganization: isInternal ? toPicked?.department : (toOrganization || undefined),
    toAddress: isInternal ? undefined : (toAddress || undefined),
    content: previewContent,
    letterhead: selectedLetterhead,
    memoHeaderTitle: memoSettings?.headerTitle,
    memoLogoUrl: memoSettings?.logoUrl,
    memoLine: memoLineFromSettings(memoSettings),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {type === "memo"
              ? (editId ? "Edit Nota" : "Buat Nota Baru")
              : (editId ? "Edit Surat" : "Buat Surat Baru")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Row 1: Type + Category + Classification */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Jenis Surat *</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setIsPhysical(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LETTER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kategori *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Klasifikasi *</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metode Tanda Tangan: Digital (gambar TTD tampil) vs Basah (kosong, TTD manual) */}
          <div className="space-y-1.5">
            <Label>Metode Tanda Tangan</Label>
            <div className="flex gap-1 rounded-md border p-0.5 sm:max-w-md">
              <button
                type="button"
                onClick={() => setSignatureMethod("digital")}
                className={cn(
                  "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  signatureMethod === "digital"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Digital
              </button>
              <button
                type="button"
                onClick={() => setSignatureMethod("basah")}
                className={cn(
                  "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  signatureMethod === "basah"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Basah (Manual)
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {signatureMethod === "digital"
                ? "Gambar tanda tangan digital ditampilkan otomatis pada surat."
                : "Ruang tanda tangan dikosongkan untuk ditandatangani manual (basah). QR keaslian tetap ditampilkan."}
            </p>
          </div>

          {/* Row 2: Prefix 1 + Prefix 2 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prefix 1 — Kode Unit / Perusahaan</Label>
              <Select value={selectedPrefix || "default"} onValueChange={(v) => setSelectedPrefix(v === "default" ? "" : v)}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="(default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">(default)</SelectItem>
                  {allPrefixes.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prefix 2 — Kategori Surat</Label>
              <Select value={selectedPrefix2 || "default"} onValueChange={(v) => setSelectedPrefix2(v === "default" ? "" : v)}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="(tidak ada)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">(tidak ada)</SelectItem>
                  {allCategoryPrefixes.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(selectedPrefix || selectedPrefix2) && (
            <p className="text-xs text-muted-foreground -mt-2">
              Nomor urut dihitung terpisah untuk prefix <strong>{[selectedPrefix, selectedPrefix2].filter(Boolean).join(" / ")}</strong>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nomor Surat</Label>
              {/* Sakelar tegas: Otomatis vs Manual */}
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => setNumberMode("auto")}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    numberMode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setNumberMode("manual")}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    numberMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Manual
                </button>
              </div>

              {numberMode === "auto" ? (
                <p className="text-[11px] text-muted-foreground">
                  Sistem memberi nomor otomatis saat surat dikirim
                  {nextNumberPreview ? (
                    <>
                      {" "}(contoh berikutnya:{" "}
                      <span className="font-mono font-medium text-foreground">{nextNumberPreview}</span>).
                    </>
                  ) : (
                    <>.</>
                  )}
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input value={letterNumber} onChange={(e) => setLetterNumber(e.target.value)} placeholder="Ketik nomor surat" className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const num = selectedPrefix
                            ? await generateLetterNumberWithPrefix({ letterType: type, prefixOverride: selectedPrefix, prefix2Override: selectedPrefix2 || undefined, preview: true })
                            : await generateLetterNumber({ letterType: type, preview: true });
                          setLetterNumber(num);
                        } catch {
                          toast.error("Gagal generate nomor surat");
                        }
                      }}
                      title="Isi dengan contoh nomor otomatis"
                    >
                      <Hash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Peringatan nomor ganda */}
                  {duplicateCheck?.duplicate ? (
                    <p className="flex items-start gap-1 text-[11px] text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                      <span>
                        Nomor ini sudah dipakai surat lain
                        {duplicateCheck.subject ? <> (&ldquo;{duplicateCheck.subject}&rdquo;)</> : null}. Pastikan tidak duplikat.
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Ketik nomor sendiri, atau tekan tombol untuk menyalin contoh nomor otomatis.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nomor Agenda</Label>
              {/* Sakelar tegas: Otomatis vs Manual (default otomatis) */}
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => setAgendaMode("auto")}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    agendaMode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaMode("manual")}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    agendaMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Manual
                </button>
              </div>

              {agendaMode === "auto" ? (
                <p className="text-[11px] text-muted-foreground">
                  Nomor registrasi internal, terisi urut otomatis saat surat dikirim
                  {nextAgendaPreview ? (
                    <>
                      {" "}(berikutnya:{" "}
                      <span className="font-mono font-medium text-foreground">{nextAgendaPreview}</span>).
                    </>
                  ) : (
                    <>.</>
                  )}
                </p>
              ) : (
                <>
                  <Input value={agendaNumber} onChange={(e) => setAgendaNumber(e.target.value)} placeholder="No. agenda" />
                  <p className="text-[11px] text-muted-foreground">
                    Nomor registrasi internal untuk pengarsipan. Ketik sendiri sesuai buku agenda kantor.
                  </p>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Surat *</Label>
              <DateField value={letterDate} onChange={(v) => setLetterDate(v)} />
              <p className="text-[11px] text-muted-foreground">
                Otomatis terisi hari ini. Ubah bila perlu.
              </p>
            </div>
          </div>

          {/* Tanggal terima (surat masuk) */}
          {type === "masuk" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tanggal Diterima</Label>
                <DateField value={receivedAt} onChange={(v) => setReceivedAt(v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Penerimaan</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!isPhysical ? "default" : "outline"}
                    onClick={() => setIsPhysical(false)}
                    className="flex-1 gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Digital
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isPhysical ? "default" : "outline"}
                    onClick={() => setIsPhysical(true)}
                    className="flex-1 gap-1.5"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Surat Fisik
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Upload dokumen fisik */}
          {type === "masuk" && isPhysical && (
            <div className="space-y-2 rounded-lg border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Upload Scan / Foto Surat Fisik
                </p>
              </div>
              {physicalFile ? (
                <div className="flex items-center gap-3 rounded border bg-background px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{physicalFile.name}</span>
                  {physicalUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setPhysicalFile(null); setPhysicalStorageId(null); }}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>Klik untuk unggah (PDF, JPG, PNG)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handlePhysicalFileChange}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                Upload scan atau foto surat fisik yang diterima dari pihak eksternal.
              </p>
            </div>
          )}

          {/* Perihal + Tempat */}
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div className="space-y-1.5">
              <Label>Perihal / Subjek *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Perihal surat..." />
            </div>
            <div className="space-y-1.5">
              <Label>Tempat</Label>
              <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Bandung" />
            </div>
          </div>

          {/* From / To */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Pengirim */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pengirim</p>
                {fromPicked && (
                  <Badge variant="secondary" className="text-[10px]">Dari Direktori</Badge>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{isInternal ? "Pilih Karyawan *" : "Cari Karyawan"}</Label>
                <EmployeePicker
                  value={fromPicked}
                  onChange={(emp) => {
                    setFromPicked(emp);
                    if (emp) setFromNameManual(emp.name);
                  }}
                  placeholder="Cari dari direktori karyawan..."
                />
              </div>
              {isInternal ? (
                fromPicked && (
                  <div className="space-y-1.5">
                    <Label>Departemen / Bagian</Label>
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      {fromPicked.department
                        ? fromPicked.department
                        : <span className="text-muted-foreground italic">Belum ada departemen di data karyawan</span>}
                    </div>
                  </div>
                )
              ) : (
                <>
                  {!fromPicked && (
                    <div className="space-y-1.5">
                      <Label>Nama Manual *</Label>
                      <Input
                        value={fromNameManual}
                        onChange={(e) => setFromNameManual(e.target.value)}
                        placeholder="Ketik nama jika bukan karyawan internal"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Instansi / Organisasi</Label>
                    <Input value={fromOrganization} onChange={(e) => setFromOrganization(e.target.value)} placeholder="Nama instansi" />
                  </div>
                </>
              )}
            </div>

            {/* Penerima */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Penerima</p>
                {isOutgoing ? (
                  <Badge variant="outline" className="text-[10px]">Pihak Eksternal</Badge>
                ) : toPicked && (
                  <Badge variant="secondary" className="text-[10px]">Dari Direktori</Badge>
                )}
              </div>

              {isOutgoing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Jabatan</Label>
                    <Input
                      value={toJobTitle}
                      onChange={(e) => setToJobTitle(e.target.value)}
                      placeholder="Contoh: Kepala Dinas Pendidikan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nama Penerima *</Label>
                    <Input
                      value={toNameManual}
                      onChange={(e) => setToNameManual(e.target.value)}
                      placeholder="Nama penerima / 'di Tempat'"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nama Instansi / Organisasi</Label>
                    <Input
                      value={toOrganization}
                      onChange={(e) => setToOrganization(e.target.value)}
                      placeholder="Nama instansi tujuan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alamat</Label>
                    <Textarea
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder="Alamat lengkap instansi tujuan..."
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <>
                  {isInternal && (
                    <div className="space-y-1.5">
                      <Label>Kirim Kepada</Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([
                          { v: "single", label: "Perorangan" },
                          { v: "individual", label: "Beberapa Orang" },
                          { v: "department", label: "Per Departemen" },
                          { v: "all", label: "Seluruh Karyawan" },
                        ] as const).map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setRecipientMode(opt.v)}
                            className={`cursor-pointer rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                              recipientMode === opt.v
                                ? "border-primary bg-primary text-primary-foreground"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Penerima tunggal (mode default / non-internal) */}
                  {(!isInternal || recipientMode === "single") && (
                    <div className="space-y-1.5">
                      <Label>{isInternal ? "Pilih Karyawan *" : "Cari Karyawan"}</Label>
                      <EmployeePicker
                        value={toPicked}
                        onChange={(emp) => {
                          setToPicked(emp);
                          if (emp) setToNameManual(emp.name);
                        }}
                        placeholder="Cari dari direktori karyawan..."
                      />
                    </div>
                  )}

                  {/* Beberapa orang: pilih banyak karyawan */}
                  {isInternal && recipientMode === "individual" && (
                    <div className="space-y-1.5">
                      <Label>Pilih Penerima * ({recipientUsers.length})</Label>
                      <EmployeeMultiPicker
                        value={recipientUsers}
                        onChange={setRecipientUsers}
                        placeholder="Tambah penerima..."
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Setiap orang menerima surat ini di kotak masuknya masing-masing.
                      </p>
                    </div>
                  )}

                  {/* Per departemen */}
                  {isInternal && recipientMode === "department" && (
                    <div className="space-y-1.5">
                      <Label>Departemen Tujuan *</Label>
                      <Select value={recipientDepartment || undefined} onValueChange={setRecipientDepartment}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih departemen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(departments ?? []).map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {departments && departments.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Belum ada departemen pada data karyawan.
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Semua karyawan pada departemen ini akan menerima surat.
                      </p>
                    </div>
                  )}

                  {/* Seluruh karyawan */}
                  {isInternal && recipientMode === "all" && (
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Surat akan dikirim ke <strong>seluruh karyawan</strong> di organisasi Anda.
                    </div>
                  )}

                  {!isInternal && !toPicked && (
                    <div className="space-y-1.5">
                      <Label>Nama Manual *</Label>
                      <Input
                        value={toNameManual}
                        onChange={(e) => setToNameManual(e.target.value)}
                        placeholder="Ketik nama penerima manual"
                      />
                    </div>
                  )}
                  {isInternal && recipientMode === "single" && toPicked && (
                    <div className="space-y-1.5">
                      <Label>Departemen / Bagian</Label>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        {toPicked.department
                          ? toPicked.department
                          : <span className="text-muted-foreground italic">Belum ada departemen di data karyawan</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tembusan (CC) */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tembusan (CC)</p>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Internal (dari direktori)</p>
              <div className="space-y-2">
                {ccUsers.length === 0 ? (
                  /* Belum ada: picker + tombol + */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <EmployeePicker
                          value={null}
                          onChange={(emp) => {
                            if (emp) {
                              setCcUsers([emp]);
                              setShowAddCcUser(false);
                            }
                          }}
                          placeholder="Cari penerima tembusan internal..."
                        />
                      </div>
                      <button
                        type="button"
                        title="Tambah tembusan internal"
                        onClick={() => setShowAddCcUser(true)}
                        className="cursor-pointer flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    {showAddCcUser && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <EmployeePicker
                            value={null}
                            onChange={(emp) => {
                              if (emp) setCcUsers(prev => [...prev, emp]);
                              setShowAddCcUser(false);
                            }}
                            placeholder="Cari penerima tembusan tambahan..."
                          />
                        </div>
                        <button
                          type="button"
                          disabled
                          className="flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground opacity-30 shrink-0"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Sudah ada: kartu per baris + tombol + di baris terakhir */
                  <div className="space-y-2">
                    {ccUsers.map((u, i) => {
                      const isLast = i === ccUsers.length - 1 && !showAddCcUser;
                      return (
                        <div key={u._id} className="flex items-center gap-2">
                          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 min-h-[40px]">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight">{u.name}</p>
                              <p className="text-xs text-muted-foreground leading-tight">{u.jobTitle ?? u.department ?? ""}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCcUsers(prev => prev.filter((_, j) => j !== i))}
                              className="cursor-pointer text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                          {isLast ? (
                            <button
                              type="button"
                              title="Tambah tembusan internal"
                              onClick={() => setShowAddCcUser(true)}
                              className="cursor-pointer flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                            >
                              <Plus className="size-4" />
                            </button>
                          ) : (
                            <div className="w-[40px] shrink-0" />
                          )}
                        </div>
                      );
                    })}
                    {showAddCcUser && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <EmployeePicker
                            value={null}
                            onChange={(emp) => {
                              if (emp) setCcUsers(prev => [...prev, emp]);
                              setShowAddCcUser(false);
                            }}
                            placeholder="Cari penerima tembusan tambahan..."
                          />
                        </div>
                        <button
                          type="button"
                          disabled
                          className="flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground opacity-30 shrink-0"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Eksternal – manual */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Eksternal (isi manual)</p>
              <div className="flex gap-2">
                <Input
                  value={ccExternalInput}
                  onChange={(e) => setCcExternalInput(e.target.value)}
                  placeholder="Nama / instansi / jabatan eksternal..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = ccExternalInput.trim();
                      if (val && !ccExternal.includes(val)) {
                        setCcExternal((prev) => [...prev, val]);
                      }
                      setCcExternalInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2"
                  onClick={() => {
                    const val = ccExternalInput.trim();
                    if (val && !ccExternal.includes(val)) {
                      setCcExternal((prev) => [...prev, val]);
                    }
                    setCcExternalInput("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {ccExternal.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ccExternal.map((ext) => (
                    <Badge key={ext} variant="outline" className="text-[11px] gap-1 pr-1">
                      {ext}
                      <button
                        type="button"
                        onClick={() => setCcExternal((prev) => prev.filter((x) => x !== ext))}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {ccUsers.length === 0 && ccExternal.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Kosongkan jika tidak ada tembusan</p>
            )}
          </div>

          {/* Alur Persetujuan inline – hanya untuk surat keluar/internal/memo */}
          {type !== "masuk" && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Alur Persetujuan</p>
                <span className="text-xs text-muted-foreground">(opsional — isi jika ingin langsung diajukan)</span>
              </div>

              {/* Visualisasi alur */}
              {(pemeriksa.length > 0 || penyetuju) && (
                <div className="flex items-center gap-1.5 flex-wrap pb-1">
                  {pemeriksa.length > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {pemeriksa.length > 1 ? `${pemeriksa.length} Pemeriksa` : "Pemeriksa"}
                    </Badge>
                  )}
                  {pemeriksa.length > 0 && penyetuju && <ChevronRight className="size-3 text-muted-foreground" />}
                  {penyetuju && (
                    <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">Penyetuju</Badge>
                  )}
                </div>
              )}

              {/* ── Pemeriksa ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge className="text-[10px] h-5 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Pemeriksa *</Badge>
                  {pemeriksa.length > 1 && <span className="text-[10px] text-muted-foreground">({pemeriksa.length} pemeriksa)</span>}
                </div>

                {/* Picker utama (baris 0) — tombol + muncul setelah dipilih */}
                {pemeriksa.length === 0 ? (
                  /* Belum ada pilihan: picker + tombol + di kanan */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <EmployeePicker
                          value={null}
                          onChange={(emp) => {
                            if (emp) {
                              setPemeriksa([emp]);
                              setShowAddPemeriksa(false);
                            }
                          }}
                          placeholder="Cari pemeriksa utama..."
                        />
                      </div>
                      <button
                        type="button"
                        title="Tambah pemeriksa"
                        onClick={() => setShowAddPemeriksa(true)}
                        className="cursor-pointer flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    {showAddPemeriksa && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <EmployeePicker
                            value={null}
                            onChange={(emp) => {
                              if (emp) setPemeriksa(prev => [...prev, emp]);
                              setShowAddPemeriksa(false);
                            }}
                            placeholder="Cari pemeriksa tambahan..."
                          />
                        </div>
                        <button
                          type="button"
                          title="Tambah pemeriksa"
                          disabled
                          className="flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground opacity-30 shrink-0"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Sudah ada pemeriksa: render setiap baris */
                  <div className="space-y-2">
                    {/* Kartu pemeriksa yang sudah dipilih */}
                    {pemeriksa.map((p, i) => {
                      const isLast = i === pemeriksa.length - 1 && !showAddPemeriksa;
                      return (
                        <div key={p._id} className="flex items-center gap-2">
                          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 min-h-[40px]">
                            <Badge variant="outline" className="shrink-0 text-[10px] w-5 h-5 flex items-center justify-center p-0">
                              {i === 0 ? "★" : i + 1}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight">{p.name}</p>
                              <p className="text-xs text-muted-foreground leading-tight">{p.jobTitle ?? p.department ?? ""}</p>
                              {i === 0 && <p className="text-[10px] text-amber-600 leading-tight">Pemeriksa Utama</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPemeriksa(prev => prev.filter((_, j) => j !== i))}
                              className="cursor-pointer text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                          {/* Tombol + hanya di baris terakhir kartu (saat picker tambahan belum terbuka) */}
                          {isLast ? (
                            <button
                              type="button"
                              title="Tambah pemeriksa"
                              onClick={() => setShowAddPemeriksa(true)}
                              className="cursor-pointer flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                            >
                              <Plus className="size-4" />
                            </button>
                          ) : (
                            /* Spacer agar lebar kolom konsisten */
                            <div className="w-[40px] shrink-0" />
                          )}
                        </div>
                      );
                    })}

                    {/* Picker tambahan — muncul saat tombol + diklik, dengan tombol + di kanannya */}
                    {showAddPemeriksa && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <EmployeePicker
                            value={null}
                            onChange={(emp) => {
                              if (emp) setPemeriksa(prev => [...prev, emp]);
                              setShowAddPemeriksa(false);
                            }}
                            placeholder="Cari pemeriksa tambahan..."
                          />
                        </div>
                        {/* Tombol + di sebelah picker baru (nonaktif, akan aktif setelah dipilih) */}
                        <button
                          type="button"
                          title="Tambah pemeriksa"
                          disabled
                          className="flex items-center justify-center h-[40px] w-[40px] rounded border border-dashed text-muted-foreground opacity-30 shrink-0"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {pemeriksa.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">★ = Pemeriksa Utama. Pemeriksa lainnya hanya dapat memberi catatan.</p>
                )}
              </div>

              {/* Penyetuju */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge className="text-[10px] h-5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">Penyetuju *</Badge>
                </div>
                <EmployeePicker
                  value={penyetuju}
                  onChange={setPenyetuju}
                  placeholder="Cari penyetuju..."
                />
              </div>

              {(pemeriksa.length === 0 || !penyetuju) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Isi Pemeriksa dan Penyetuju untuk menggunakan tombol <strong>Simpan &amp; Ajukan</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Kop surat / Kop nota */}
          {type === "memo" ? (
            /* Untuk Nota, kop surat tidak dipakai saat mencetak. Yang tampil di
               dokumen adalah "Kop Nota" (judul + garis) yang diatur di
               Pengaturan → Kop Nota. Jadi di sini kita tampilkan pratinjau Kop
               Nota tersebut, bukan pemilih kop surat, agar tidak membingungkan. */
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Kop Nota</Label>
                <span className="text-[10px] text-muted-foreground">Diatur di Pengaturan → Kop Nota</span>
              </div>
              {(() => {
                const line = memoLineFromSettings(memoSettings);
                const title = (memoSettings?.headerTitle ?? "").trim() || "NOTA";
                const logoUrl = memoSettings?.logoUrl ?? null;
                return (
                  <div className="rounded border bg-white p-3">
                    <div
                      className="py-2"
                      style={{
                        borderTopStyle: line.topShow ? "solid" : "none",
                        borderTopWidth: line.topShow ? line.topWidth : 0,
                        borderTopColor: line.topColor,
                        borderBottomStyle: line.bottomShow ? "solid" : "none",
                        borderBottomWidth: line.bottomShow ? line.bottomWidth : 0,
                        borderBottomColor: line.bottomColor,
                      }}
                    >
                      {logoUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain shrink-0" />
                          <p className="flex-1 text-center text-base font-bold text-gray-900">{title}</p>
                          <div className="h-10 w-10 shrink-0" aria-hidden />
                        </div>
                      ) : (
                        <p className="text-center text-base font-bold text-gray-900">{title}</p>
                      )}
                    </div>
                  </div>
                );
              })()}
              <p className="text-[11px] text-muted-foreground">
                Nota tidak memakai kop surat berlogo. Ubah judul dan garis Kop Nota di tab Pengaturan → Kop Nota.
              </p>
            </div>
          ) : (
          <div className="space-y-1.5 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Kop Surat</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowLetterheadManager(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Kelola Kop Surat
              </Button>
            </div>
            {letterheads && letterheads.length > 0 ? (
              <>
                <Select value={letterheadId} onValueChange={setLetterheadId}>
                  <SelectTrigger><SelectValue placeholder="Pilih kop surat (opsional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Kop Surat</SelectItem>
                    {letterheads.map((lh) => (
                      <SelectItem key={lh._id} value={lh._id}>{lh.name}{lh.isDefault ? " ★" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {letterheadId !== "none" && (() => {
                  const lh = letterheads.find((l) => l._id === letterheadId);
                  if (!lh) return null;
                  return (
                    <div
                      className="rounded border p-2.5 mt-1"
                      style={{ borderColor: lh.accentColor ?? "#1e40af" }}
                    >
                      <div className="flex items-start gap-2">
                        {lh.logoUrl ? (
                          <img src={lh.logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain border shrink-0" />
                        ) : (
                          <div
                            className="h-8 w-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: lh.accentColor ?? "#1e40af" }}
                          >
                            {lh.organizationName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-xs" style={{ color: lh.accentColor ?? "#1e40af" }}>{lh.organizationName}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{lh.organizationAddress}</p>
                          {lh.organizationPhone && <p className="text-[10px] text-muted-foreground">Telp: {lh.organizationPhone}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="rounded border border-dashed p-3 text-center">
                <p className="text-xs text-muted-foreground">Belum ada kop surat.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs mt-1"
                  onClick={() => setShowLetterheadManager(true)}
                >
                  + Buat kop surat sekarang
                </Button>
              </div>
            )}
          </div>
          )}

          {/* Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Isi Surat *</Label>
              <LetterTemplatePicker
                category={type}
                hasExistingContent={content.replace(/<[^>]*>/g, "").trim().length > 0}
                onSelect={setContent}
              />
            </div>
            <LetterEditor content={content} onChange={setContent} paperMode autoSaveStatus={autoSaveStatus} autoSaveActive={!!activeLetterId} previewDetail={previewDetail} />
            <p className="text-xs text-muted-foreground">
              Garis merah putus-putus menandai batas halaman sesuai hasil cetak.
            </p>
          </div>

          {/* Lampiran */}
          <div className="space-y-2">
            <Label>Lampiran</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Upload className="size-4" />
              <span>Klik untuk unggah lampiran</span>
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div key={att.file.name} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{att.file.name}</span>
                    {att.uploading ? (
                      <Loader2 className="ml-2 size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <button type="button" onClick={() => removeAttachment(att.file)} className="ml-2 cursor-pointer text-muted-foreground hover:text-destructive">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label>Catatan Internal</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan (tidak muncul di surat)..." rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:items-center">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button variant="secondary" onClick={() => setShowPreview(true)} disabled={saving} className="gap-1.5">
            <Eye className="size-4" />
            Pratinjau
          </Button>
          <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Simpan Konsep
          </Button>
          {type !== "masuk" && (
            <Button
              onClick={handleSaveAndSubmit}
              disabled={saving || pemeriksa.length === 0 || !penyetuju}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
              Simpan &amp; Ajukan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <LetterheadManagerDialog
        open={showLetterheadManager}
        onClose={() => setShowLetterheadManager(false)}
      />

      {showPreview && (
        <LetterPreviewDialog
          onClose={() => setShowPreview(false)}
          detail={previewDetail}
        />
      )}
    </Dialog>
  );
}
