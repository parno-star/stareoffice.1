import { useState } from "react";
import { useQuery, useMutation, useConvex, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  X, Send, Archive, CheckCircle2, XCircle, Printer,
  Download, Paperclip, GitFork, Users, Edit, PenLine, ScanLine, FileText,
  Clock, CheckCheck, AlertCircle, RotateCcw, Trash2, ShieldAlert, QrCode, Copy, Mail, Snowflake, ChevronRight, ExternalLink,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import SignatureSection from "./_components/SignatureSection.tsx";
import LetterTimeline from "./_components/LetterTimeline.tsx";
import LetterQRCode from "./_components/LetterQRCode.tsx";
import LetterEmailDialog from "./_components/LetterEmailDialog.tsx";
import RecipientProgress from "./_components/RecipientProgress.tsx";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { LetterStatusBadge, LetterTypeBadge, ClassificationBadge } from "./_components/LetterStatusBadge.tsx";
import { formatJobTitle, formatJobTitleSentence } from "./_lib/formatJobTitle.ts";
import DispositionDialog from "./_components/DispositionDialog.tsx";
import ApprovalDialog from "./_components/ApprovalDialog.tsx";
import LetterFormDialog from "./_components/LetterFormDialog.tsx";
import LetterPrintView from "./LetterPrintView.tsx";
import { useLetterArchive } from "./_hooks/useLetterArchive.ts";
import { exportLetterToWord } from "./_lib/exportWord.ts";
import WordIcon from "./_components/WordIcon.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

interface LetterDetailPanelProps {
  letterId: Id<"letters">;
  onClose: () => void;
  // Which detail tab to open first. Defaults to "detail". The Proses tab opens
  // straight to "riwayat" so konseptors immediately see the tracking timeline.
  initialTab?: string;
}

export default function LetterDetailPanel({ letterId, onClose, initialTab }: LetterDetailPanelProps) {
  const detail = useQuery(api.letters.getLetterWithExtras, { letterId });
  const archivePdf = useQuery(api.letters.getLetterArchivePdfUrl, { letterId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const sendLetter = useMutation(api.letters.sendLetter);
  const sendLetterEmail = useAction(api.lettersEmail.sendLetterEmail);
  const startLetterEmailJob = useAction(api.lettersEmail.startLetterEmailJob);
  const archiveLetter = useMutation(api.letters.archiveLetter);
  const approveLetter = useMutation(api.letters.approveLetter);
  const rejectLetter = useMutation(api.letters.rejectLetter);
  const requestRevision = useMutation(api.letters.requestRevision);
  const returnToReviewer = useMutation(api.letters.returnToReviewer);
  const addReviewerNote = useMutation(api.letters.addReviewerNote);
  const freezeLetter = useMutation(api.letters.freezeLetter);
  const updateDisposition = useMutation(api.letters.updateDisposition);
  const deleteLetter = useMutation(api.letters.deleteLetter);
  const ensureVerificationCode = useMutation(api.letters.ensureVerificationCode);
  const convex = useConvex();
  const generateArchive = useLetterArchive();

  const [showDisposition, setShowDisposition] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [returnReviewerComment, setReturnReviewerComment] = useState("");
  const [showReturnReviewerForm, setShowReturnReviewerForm] = useState(false);
  const [freezeComment, setFreezeComment] = useState("");
  const [showFreezeForm, setShowFreezeForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteComment, setNoteComment] = useState("");
  const [acting, setActing] = useState(false);

  if (!detail) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b p-4">
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="size-4" /></Button>
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  const { letter, author, pic, attachments, dispositions, approvals, history, letterhead } = detail;
  const isDraft = letter.status === "draft";
  const isReview = letter.status === "review";
  const isSent = letter.status === "sent";
  const isApproved = letter.status === "approved";
  const isRejected = letter.status === "rejected";
  const isRevision = letter.status === "revision";
  const isFrozen = letter.status === "frozen";
  const isReceived = letter.status === "received";
  const isMasuk = letter.type === "masuk";
  // Surat "final" = sudah dikirim (surat keluar/internal) atau sudah diterima
  // (surat masuk). Hanya pada kondisi ini surat pasti lengkap & resmi sehingga
  // aman untuk dikirim via email atau diarsipkan.
  const isFinal = isSent || (isMasuk && isReceived);
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;
  // Pengirim surat adalah konseptor (pembuat surat). Dalam alur berjenjang,
  // penyetuju hanya menyetujui — pengiriman tetap tanggung jawab pembuat surat.
  // Admin/Super Admin tetap bisa mengirim sebagai pengawas sistem.
  const isAuthor = !!currentUser && letter.authorId === currentUser._id;
  // Surat berjenjang (punya rantai persetujuan) baru boleh dikirim setelah
  // berstatus "disetujui". Konsep berjenjang tidak boleh langsung dikirim.
  // Konsep tanpa alur persetujuan boleh langsung dikirim oleh pembuat/admin.
  const hasApprovalChain = approvals.length > 0;
  const canSend =
    (isApproved || (isDraft && !hasApprovalChain)) && (isAuthor || isAdmin);

  // Penerima murni surat (tujuan/tembusan) tidak perlu melihat proses internal
  // rantai persetujuan — bagi mereka proses sudah selesai saat surat diterima.
  // Kartu tetap tampil untuk pembuat, admin, dan siapa pun yang terlibat di
  // rantai persetujuan.
  const ccUserIds = (letter as { ccUserIds?: Array<string> }).ccUserIds ?? [];
  const isRecipient =
    !!currentUser &&
    (letter.toUserId === currentUser._id || ccUserIds.includes(currentUser._id));
  const isApprovalParticipant =
    !!currentUser &&
    approvals.some(
      (a) =>
        a.approverId === currentUser._id ||
        (!!currentUser.email &&
          a.approver?.email?.toLowerCase() === currentUser.email.toLowerCase()),
    );
  const showApprovalChain = !(isRecipient && !isAuthor && !isAdmin && !isApprovalParticipant);

  // Only the account selected as the approver for the current pending step may
  // approve/reject. Super admins / administrators cannot act on their behalf.
  // We match by user id, and fall back to email because an approval may point
  // to an imported (placeholder) directory record while the person signs in
  // with a separate real account that shares the same email.
  const myEmail = currentUser?.email?.toLowerCase();
  const myPendingApproval = currentUser
    ? approvals.find(
        (a) =>
          a.status === "pending" &&
          (a.approverId === currentUser._id ||
            (!!myEmail && a.approver?.email?.toLowerCase() === myEmail)),
      )
    : undefined;

  // The final approver (penyetuju) is the last step in the chain. When they are
  // acting, they get two return options instead of the single revision return:
  //  - return to the previous reviewer (pemeriksa) with a correction note, or
  //  - freeze the letter (send back to konseptor as a cancelled dead archive).
  const maxOrder = approvals.reduce((m, a) => Math.max(m, a.order), 0);
  const isFinalApprover = !!myPendingApproval && myPendingApproval.order === maxOrder;
  const hasPreviousReviewer = !!myPendingApproval && myPendingApproval.order > 1;
  // True when current pending approver is a supporting reviewer (can only add note)
  const isHeadReviewer = !!myPendingApproval && myPendingApproval.approvalRole === "pemeriksa_1";
  const isSupportingReviewer = !!myPendingApproval && !isFinalApprover && myPendingApproval.approvalRole !== "pemeriksa_1";

  const handleSend = async () => {
    setActing(true);
    try {
      await sendLetter({ letterId });
      toast.success("Surat berhasil dikirim");
      // Bekukan arsip PDF permanen. Ambil data terbaru (berisi kode verifikasi
      // & status terkirim) agar arsip sesuai dokumen resmi.
      try {
        const fresh = await convex.query(api.letters.getLetterWithExtras, { letterId });
        if (fresh) {
          await generateArchive(letterId, {
            letter: fresh.letter,
            author: fresh.author,
            pic: fresh.pic,
            fromUser: fresh.fromUser,
            attachments: fresh.attachments,
            letterhead: fresh.letterhead,
            approvals: fresh.approvals,
            authorSignature: fresh.authorSignature,
            ccUsers: fresh.ccUsers,
          });
          toast.success("Arsip PDF surat tersimpan");
        }
      } catch {
        // Kegagalan arsip tidak membatalkan pengiriman surat.
        toast.warning("Surat terkirim, namun arsip PDF gagal dibuat. Coba lagi via tombol Unduh PDF.");
      }
      // Kirim email otomatis ke penerima resmi (yang memiliki alamat email).
      // Kegagalan/pelewatan email tidak membatalkan pengiriman surat.
      await autoSendEmailOnSend();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  // Setelah surat berhasil dikirim, kirimkan email otomatis ke penerima resmi
  // yang punya alamat email. Bila pengiriman email belum diaktifkan Super Admin
  // atau tidak ada penerima ber-email, surat tetap terkirim dan langkah ini
  // hanya menampilkan pemberitahuan singkat (tidak menggagalkan apa pun).
  const autoSendEmailOnSend = async () => {
    try {
      const status = await convex.query(api.letterEmailSettings.getStatus, {});
      const senderConfigured = !!status && status.emailEnabled && status.senderEmail.length > 0;
      if (!senderConfigured) {
        toast.info("Email otomatis dilewati: pengiriman email belum diaktifkan Super Admin.");
        return;
      }

      const info = await convex.query(api.letters.getOfficialRecipientEmails, { letterId });
      if (info.emails.length === 0) {
        if (info.totalRecipients > 0) {
          toast.info("Email otomatis dilewati: penerima surat belum memiliki alamat email.");
        }
        return;
      }

      const skippedNote =
        info.withoutEmail > 0 ? ` (${info.withoutEmail} penerima tanpa email dilewati)` : "";
      const emailMessage =
        `Dengan hormat,\n\nBersama ini kami sampaikan surat` +
        `${detail?.letter.letterNumber ? ` nomor ${detail.letter.letterNumber}` : ""}` +
        ` dengan perihal "${detail?.letter.subject ?? ""}". Isi lengkap surat terlampir pada email ini.\n\nTerima kasih.`;

      // Penerima banyak dikirim bertahap di latar belakang; sedikit dikirim langsung.
      if (info.emails.length > 15) {
        await startLetterEmailJob({ letterId, recipients: info.emails, message: emailMessage });
        toast.info(
          `Mengirim email ke ${info.emails.length} penerima resmi di latar belakang${skippedNote}.`,
        );
      } else {
        const result = await sendLetterEmail({
          letterId,
          recipients: info.emails,
          message: emailMessage,
        });
        toast.success(`Email otomatis terkirim ke ${result.sent} penerima resmi${skippedNote}.`);
      }
    } catch (err) {
      // Email gagal tidak membatalkan pengiriman surat — beri tahu saja.
      const msg =
        err instanceof ConvexError
          ? (err.data as { message?: string }).message ?? "Gagal"
          : "Terjadi kesalahan";
      toast.warning(`Surat terkirim, namun email otomatis gagal: ${msg}`);
    }
  };

  // Unduh arsip PDF permanen (dibuat saat surat dikirim).
  const handleDownloadArchive = () => {
    if (!archivePdf) return;
    const a = document.createElement("a");
    a.href = archivePdf.url;
    a.download = archivePdf.fileName;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  // Ekspor konsep/surat ke berkas Word (.docx) asli yang bisa diedit ulang.
  const handleExportWord = async () => {
    try {
      await exportLetterToWord({
        letter: detail.letter,
        author: detail.author,
        pic: detail.pic,
        fromUser: detail.fromUser,
        attachments: detail.attachments,
        letterhead: detail.letterhead,
        approvals: detail.approvals,
        authorSignature: detail.authorSignature,
        ccUsers: detail.ccUsers,
      });
      toast.success("Surat diekspor ke Word");
    } catch (err) {
      console.error("Gagal mengekspor ke Word:", err);
      toast.error("Gagal mengekspor ke Word");
    }
  };

  // Buat/regenerasi arsip PDF secara manual (mis. surat lama tanpa arsip).
  const handleBuildArchive = async () => {
    setActing(true);
    try {
      const fresh = await convex.query(api.letters.getLetterWithExtras, { letterId });
      if (!fresh) throw new Error("Surat tidak ditemukan");
      await generateArchive(letterId, {
        letter: fresh.letter,
        author: fresh.author,
        pic: fresh.pic,
        fromUser: fresh.fromUser,
        attachments: fresh.attachments,
        letterhead: fresh.letterhead,
        approvals: fresh.approvals,
        authorSignature: fresh.authorSignature,
        ccUsers: fresh.ccUsers,
      });
      toast.success("Arsip PDF surat tersimpan");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Gagal membuat arsip PDF");
    } finally { setActing(false); }
  };

  // Unduh berkas lampiran. URL diambil saat diklik agar tetap valid, lalu
  // browser mengunduh berkas menggunakan tautan sementara dari penyimpanan.
  const handleDownloadAttachment = async (attachmentId: Id<"letterAttachments">) => {
    try {
      const res = await convex.query(api.letters.getAttachmentUrl, { attachmentId });
      if (!res) {
        toast.error("Berkas lampiran tidak dapat diakses");
        return;
      }
      const a = document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch {
      toast.error("Gagal mengunduh lampiran");
    }
  };

  const handleArchive = async () => {
    setActing(true);
    try {
      await archiveLetter({ letterId });
      toast.success("Surat diarsipkan");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try {
      await approveLetter({ letterId, comment: approvalComment || undefined });
      toast.success("Surat disetujui");
      setApprovalComment("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) { toast.error("Masukkan alasan penolakan"); return; }
    setActing(true);
    try {
      await rejectLetter({ letterId, comment: rejectComment });
      toast.success("Surat ditolak");
      setRejectComment("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleRequestRevision = async () => {
    if (!revisionComment.trim()) { toast.error("Masukkan catatan koreksi"); return; }
    setActing(true);
    try {
      await requestRevision({ letterId, comment: revisionComment });
      toast.success("Surat dikembalikan ke konseptor untuk revisi");
      setRevisionComment("");
      setShowRevisionForm(false);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleAddReviewerNote = async () => {
    setActing(true);
    try {
      await addReviewerNote({ letterId, comment: noteComment || undefined });
      toast.success("Catatan diberikan, surat diteruskan ke pemeriksa berikutnya");
      setNoteComment("");
      setShowNoteForm(false);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleReturnToReviewer = async () => {
    if (!returnReviewerComment.trim()) { toast.error("Masukkan catatan koreksi"); return; }
    setActing(true);
    try {
      await returnToReviewer({ letterId, comment: returnReviewerComment });
      toast.success("Surat dikembalikan ke pemeriksa");
      setReturnReviewerComment("");
      setShowReturnReviewerForm(false);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleFreeze = async () => {
    setActing(true);
    try {
      await freezeLetter({ letterId, comment: freezeComment || undefined });
      toast.success("Surat dibekukan dan dikembalikan ke konseptor");
      setFreezeComment("");
      setShowFreezeForm(false);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleCompleteDisposition = async (dispositionId: Id<"letterDispositions">) => {
    try {
      await updateDisposition({ dispositionId: dispositionId, markCompleted: true });
      toast.success("Disposisi ditandai selesai");
    } catch { toast.error("Gagal memperbarui disposisi"); }
  };

  const handleDelete = async () => {
    setActing(true);
    try {
      await deleteLetter({ letterId });
      toast.success("Surat berhasil dihapus");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-3">
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
          <div className="min-w-[10rem] flex-1">
            <h2 className="line-clamp-1 text-sm font-semibold">{letter.subject}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <LetterTypeBadge type={letter.type} />
              <LetterStatusBadge status={letter.status} />
              {letter.classification !== "biasa" && <ClassificationBadge classification={letter.classification} />}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-1 ml-auto">
            {/* Tombol Edit hanya untuk surat yang belum final (draft/rejected/revision).
                Surat final dikunci total demi integritas GCG, termasuk untuk super_admin. */}
            {(isDraft || isRejected || isRevision) && (
              <>
                {(isDraft || isRevision) && (
                  <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
                    <Edit className="size-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setShowApproval(true)}>
                  <Users className="size-4" />
                  <span className="hidden sm:inline">{isDraft ? "Ajukan" : "Ajukan Ulang"}</span>
                </Button>
              </>
            )}

            {canSend && (
              <Button size="sm" onClick={handleSend} disabled={acting}>
                <Send className="size-4" />
                <span className="hidden sm:inline">Kirim</span>
              </Button>
            )}
            {/* Buat arsip PDF untuk surat lama/terkirim/masuk yang belum punya arsip. */}
            {!archivePdf && (isSent || (isMasuk && isReceived)) && (isAuthor || isAdmin) && (
              <Button size="sm" variant="secondary" onClick={handleBuildArchive} disabled={acting}>
                <FileText className="size-4" />
                <span className="hidden sm:inline">Buat Arsip PDF</span>
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setShowDisposition(true)}>
              <GitFork className="size-4" />
              <span className="hidden sm:inline">Disposisi</span>
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { void ensureVerificationCode({ letterId }); setShowPrint(true); }} title="Cetak / Export">
              <Printer className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { void handleExportWord(); }} title="Ekspor ke Word (.docx)">
              <WordIcon className="size-4" />
            </Button>
            {archivePdf && (
              <Button size="icon-sm" variant="ghost" onClick={handleDownloadArchive} title="Unduh Arsip PDF">
                <Download className="size-4" />
              </Button>
            )}
            {/* Kirim email & Arsipkan hanya untuk surat final (sudah dikirim, atau
                surat masuk yang sudah diterima). Mencegah pengiriman email atau
                pengarsipan pada surat yang masih konsep/dalam persetujuan. */}
            {isFinal && (
              <Button size="icon-sm" variant="ghost" onClick={() => { void ensureVerificationCode({ letterId }); setShowEmail(true); }} title="Kirim via Email">
                <Mail className="size-4" />
              </Button>
            )}
            {isFinal && !isFrozen && (
              <Button size="icon-sm" variant="ghost" onClick={handleArchive} disabled={acting} title="Arsipkan">
                <Archive className="size-4" />
              </Button>
            )}
            {/* Hapus: konseptor bisa hapus draft miliknya, admin/super_admin bisa hapus apa saja */}
            {(isSuperAdmin || currentUser?.role === "admin" || (isDraft && letter.authorId === currentUser?._id)) && (
              <Button size="icon-sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={acting} title="Hapus Surat" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue={initialTab ?? "detail"}>
            <div className="sticky top-0 z-10 border-b bg-background px-4 py-1">
              <TabsList className="h-8">
                <TabsTrigger value="detail" className="text-xs">Detail</TabsTrigger>
                <TabsTrigger value="isi" className="text-xs">Isi Surat</TabsTrigger>
                <TabsTrigger value="disposisi" className="text-xs">
                  Disposisi {dispositions.length > 0 && <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{dispositions.length}</Badge>}
                </TabsTrigger>
                {showApprovalChain && (
                <TabsTrigger value="persetujuan" className="text-xs">
                  Persetujuan {approvals.length > 0 && <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{approvals.length}</Badge>}
                </TabsTrigger>
                )}
                <TabsTrigger value="lampiran" className="text-xs">
                  Lampiran {attachments.length > 0 && <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{attachments.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="riwayat" className="text-xs">Riwayat</TabsTrigger>
                <TabsTrigger value="ttd" className="text-xs flex items-center gap-1">
                  <PenLine className="h-3 w-3" />TTD
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB: Detail */}
            <TabsContent value="detail" className="p-4 space-y-4">
              {/* Super admin banner */}
              {isSuperAdmin && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span>Mode Super Admin aktif. Surat yang sudah final (terkirim/disetujui/arsip) tetap terkunci dan tidak dapat diedit demi integritas dokumen. Koreksi dilakukan melalui Surat Ralat.</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Baris 1: Tanggal (kiri) — Nomor Surat (kanan). Nomor selalu
                    ditampilkan agar bisa dipantau selama proses; jika belum
                    bernomor tampilkan penanda. */}
                <InfoRow label="Tanggal Surat" value={format(new Date(letter.letterDate), "d MMMM yyyy", { locale: localeId })} />
                <InfoRow label="Nomor Surat" value={letter.letterNumber ?? "Belum ada nomor"} />
                {letter.place && <InfoRow label="Tempat" value={letter.place} />}
                {/* Baris 2: Dibuat oleh (kiri) — Kategori (kanan, tepat di bawah Nomor). */}
                <InfoRow label="Dibuat oleh" value={author?.name ?? "-"} sub={author?.jobTitle ? formatJobTitle(author.jobTitle) : author?.department} />
                <InfoRow label="Kategori" value={letter.category.charAt(0).toUpperCase() + letter.category.slice(1)} />
                {pic && <InfoRow label="PIC" value={pic.name ?? "-"} sub={formatJobTitle(pic.jobTitle)} />}
                {letter.agendaNumber && (
                  <InfoRow label="Nomor Agenda" value={letter.agendaNumber} />
                )}
              </div>

              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pengirim</p>
                  <p className="font-medium">{letter.fromName}</p>
                  {detail.fromUser?.jobTitle && <p className="text-sm text-muted-foreground">{formatJobTitle(detail.fromUser.jobTitle)}</p>}
                  {letter.fromOrganization && <p className="text-sm text-muted-foreground">{letter.fromOrganization}</p>}
                  {letter.fromAddress && <p className="text-xs text-muted-foreground">{letter.fromAddress}</p>}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Penerima</p>
                  <p className="font-medium">{letter.toName}</p>
                  {letter.toJobTitle && <p className="text-sm text-muted-foreground">{formatJobTitleSentence(letter.toJobTitle)}</p>}
                  {letter.toOrganization && <p className="text-sm text-muted-foreground">{letter.toOrganization}</p>}
                  {letter.toAddress && <p className="text-xs text-muted-foreground">{letter.toAddress}</p>}
                </div>
              </div>

              {letter.notes && (
                <div className="rounded-lg border bg-yellow-50 p-3 dark:bg-yellow-950/20">
                  <p className="text-xs font-semibold text-yellow-700">Catatan Internal</p>
                  <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-200">{letter.notes}</p>
                </div>
              )}

              {/* Tembusan CC */}
              {((detail.ccUsers && detail.ccUsers.length > 0) || (letter.ccExternal && letter.ccExternal.length > 0)) && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tembusan</p>
                  <div className="space-y-1.5">
                    {detail.ccUsers && detail.ccUsers.map((u, i) => (
                      <div key={u._id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs">{i + 1}.</span>
                        <span className="font-medium">{u.name}</span>
                        {u.jobTitle && <span className="text-muted-foreground text-xs">— {formatJobTitle(u.jobTitle)}</span>}
                        <Badge variant="secondary" className="text-[9px] ml-auto">Internal</Badge>
                      </div>
                    ))}
                    {letter.ccExternal && letter.ccExternal.map((ext, i) => (
                      <div key={ext} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs">{(detail.ccUsers?.length ?? 0) + i + 1}.</span>
                        <span className="font-medium">{ext}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">Eksternal</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daftar penerima massal + progres baca (hanya untuk surat massal) */}
              <RecipientProgress letterId={letter._id} />

              {/* Rantai Persetujuan — disembunyikan untuk penerima murni surat. */}
              {showApprovalChain && (
              <div className="rounded-lg border overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                  <Users className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rantai Persetujuan</p>
                  {approvals.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">{approvals.length} langkah</Badge>
                  )}
                </div>
                {approvals.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <Users className="mx-auto mb-2 size-8 opacity-20" />
                    <p className="font-medium text-xs">Belum ada rantai persetujuan</p>
                    {isDraft && (
                      <p className="text-xs mt-1 opacity-70">Pemeriksa dan penyetuju akan tampil di sini setelah surat diajukan.</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 space-y-0">
                    {approvals.map((a, idx) => {
                      const isMe = currentUser?._id === a.approverId;
                      const role = ("approvalRole" in a ? a.approvalRole : "") as string;
                      const roleLabel = "approvalLabel" in a && a.approvalLabel ? (a.approvalLabel as string) : null;
                      const roleBadgeClass: Record<string, string> = {
                        konseptor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                        pemeriksa_1: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                        pemeriksa_2: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                        pemeriksa_3: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                        penyetuju: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
                      };
                      const statusInfo = {
                        approved: { icon: <CheckCheck className="size-3.5" />, ring: "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400", line: "bg-green-400", label: "Disetujui" },
                        rejected: { icon: <XCircle className="size-3.5" />, ring: "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400", line: "bg-border", label: "Ditolak" },
                        pending: { icon: <Clock className="size-3.5" />, ring: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400", line: "bg-border", label: "Menunggu" },
                        waiting: { icon: <span className="text-[10px] font-bold">{a.order}</span>, ring: "border-muted bg-muted/50 text-muted-foreground", line: "bg-border", label: "Belum giliran" },
                      };
                      const si = statusInfo[a.status as keyof typeof statusInfo] ?? statusInfo.waiting;
                      const isPenyetuju = role === "penyetuju";
                      return (
                        <div key={a._id} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1">
                            <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 z-10 ${si.ring}`}>
                              {si.icon}
                            </div>
                            {idx < approvals.length - 1 && (
                              <div className={`w-0.5 flex-1 my-1 min-h-3 ${si.line}`} />
                            )}
                          </div>
                          <div className={`flex-1 rounded-lg border px-3 py-2 mb-2 ${isPenyetuju ? "border-green-200 bg-green-50/40 dark:bg-green-950/10" : "bg-background"} ${isMe && a.status === "pending" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" : ""}`}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold leading-tight">{a.approver?.name ?? "-"}</p>
                                  {isMe && <Badge variant="secondary" className="text-[9px] py-0">Anda</Badge>}
                                </div>
                                {a.approver?.jobTitle && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{formatJobTitle(a.approver.jobTitle)}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {roleLabel && (
                                  <Badge className={`text-[9px] py-0 ${roleBadgeClass[role] ?? "bg-muted text-muted-foreground"}`}>
                                    {roleLabel}
                                  </Badge>
                                )}
                                <span className={`text-[10px] font-medium ${
                                  a.status === "approved" ? "text-green-600 dark:text-green-400" :
                                  a.status === "rejected" ? "text-red-600 dark:text-red-400" :
                                  a.status === "pending" ? "text-yellow-600 dark:text-yellow-400" :
                                  "text-muted-foreground"
                                }`}>{si.label}</span>
                              </div>
                            </div>
                            {"comment" in a && a.comment && (
                              <p className="mt-1.5 text-xs italic text-muted-foreground border-t pt-1.5">
                                &ldquo;{a.comment as string}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Surat fisik */}
              {letter.isPhysical && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <ScanLine className="h-3.5 w-3.5" />
                    Surat Fisik
                  </p>
                  {letter.receivedAt && (
                    <p className="text-xs text-muted-foreground">Diterima: {format(new Date(letter.receivedAt), "d MMMM yyyy", { locale: localeId })}</p>
                  )}
                  {detail.physicalDocUrl && letter.physicalDocFileName && (
                    <a
                      href={detail.physicalDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary underline hover:no-underline"
                    >
                      <FileText className="h-4 w-4" />
                      {letter.physicalDocFileName}
                    </a>
                  )}
                </div>
              )}

              {/* QR Verifikasi keaslian surat */}
              {letter.verificationCode && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-md bg-white p-1.5">
                      <LetterQRCode code={letter.verificationCode} size={76} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <QrCode className="size-3.5" /> Verifikasi Keaslian
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pindai QR atau bagikan kode ini untuk membuktikan surat asli tanpa membuka isinya.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{letter.verificationCode}</code>
                        <a
                          href={`/verifikasi-surat/${letter.verificationCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline cursor-pointer"
                        >
                          Buka Verifikasi <ExternalLink className="size-3" />
                        </a>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Salin tautan verifikasi"
                          onClick={() => {
                            const url = `${window.location.origin}/verifikasi-surat/${letter.verificationCode}`;
                            void navigator.clipboard.writeText(url);
                            toast.success("Tautan verifikasi disalin");
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval action — only shown to the account selected as the
                  approver for the current pending step. Super admins /
                  administrators cannot act on their behalf. */}
              {isReview && myPendingApproval && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:bg-yellow-950/20 space-y-3">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    Tindakan Persetujuan (Langkah {myPendingApproval.order})
                  </p>
                  <Textarea
                    placeholder="Komentar / catatan koreksi..."
                    value={approvalComment}
                    onChange={(e) => {
                      setApprovalComment(e.target.value);
                      setRejectComment(e.target.value);
                      setRevisionComment(e.target.value);
                      setReturnReviewerComment(e.target.value);
                      setFreezeComment(e.target.value);
                    }}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleApprove} disabled={acting} className="flex-1 min-w-[120px]">
                      <CheckCircle2 className="size-4" /> Setujui
                    </Button>
                    {isFinalApprover ? (
                      <>
                        {hasPreviousReviewer && (
                          <Button size="sm" variant="secondary" onClick={handleReturnToReviewer} disabled={acting} className="flex-1 min-w-[120px] bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300">
                            <RotateCcw className="size-4" /> Kembalikan ke Pemeriksa
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={handleFreeze} disabled={acting} className="flex-1 min-w-[120px] bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200">
                          <Snowflake className="size-4" /> Bekukan (ke Konseptor)
                        </Button>
                      </>
                    ) : isSupportingReviewer ? (
                      <Button size="sm" onClick={handleAddReviewerNote} disabled={acting} className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white">
                        <ChevronRight className="size-4" /> Teruskan
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={handleRequestRevision} disabled={acting} className="flex-1 min-w-[120px] bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300">
                        <RotateCcw className="size-4" /> Kembalikan untuk Revisi
                      </Button>
                    )}
                    {!isSupportingReviewer && (
                      <Button size="sm" variant="destructive" onClick={handleReject} disabled={acting} className="flex-1 min-w-[120px]">
                        <XCircle className="size-4" /> Tolak
                      </Button>
                    )}
                  </div>
                  {isFinalApprover ? (
                    <p className="text-[11px] text-yellow-700/80 dark:text-yellow-300/70">
                      Kembalikan ke Pemeriksa: surat kembali ke pemeriksa untuk diperiksa ulang. Bekukan: surat dibatalkan menjadi arsip mati dan dikembalikan ke konseptor — tidak bisa diajukan ulang.
                    </p>
                  ) : (
                    <p className="text-[11px] text-yellow-700/80 dark:text-yellow-300/70">
                      Kembalikan untuk Revisi: surat kembali ke konseptor untuk diperbaiki, lalu diajukan lagi. Tolak: surat dihentikan.
                    </p>
                  )}
                </div>
              )}

              {/* Review in progress but not the current user's turn */}
              {isReview && !myPendingApproval && approvals.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3 dark:bg-yellow-950/20 flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <Clock className="size-4 shrink-0" />
                  <span>
                    Surat sedang menunggu persetujuan. Lihat tab Persetujuan untuk memantau alurnya.
                  </span>
                </div>
              )}
            </TabsContent>

            {/* TAB: Isi Surat */}
            <TabsContent value="isi" className="p-4">
              {letterhead && (
                <div className="mb-4 rounded-lg border p-4" style={{ borderColor: letterhead.accentColor ?? undefined, borderTopWidth: 4 }}>
                  <div className="flex items-start gap-3">
                    {letterhead.logoUrl && (
                      <img src={letterhead.logoUrl} alt="Logo" className="h-14 w-14 object-contain shrink-0" />
                    )}
                    <div>
                      <p className="text-lg font-bold" style={{ color: letterhead.accentColor ?? undefined }}>{letterhead.organizationName}</p>
                      <p className="text-sm text-muted-foreground">{letterhead.organizationAddress}</p>
                      {(letterhead.organizationPhone || letterhead.organizationEmail || letterhead.organizationWebsite) && (
                        <p className="text-xs text-muted-foreground">
                          {[
                            letterhead.organizationPhone ? `Telp: ${letterhead.organizationPhone}` : null,
                            letterhead.organizationEmail ? `Email: ${letterhead.organizationEmail}` : null,
                            letterhead.organizationWebsite ? `Website: ${letterhead.organizationWebsite}` : null,
                          ].filter(Boolean).join(" | ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator className="my-3" />
                </div>
              )}
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: letter.content }}
              />
            </TabsContent>

            {/* TAB: Disposisi */}
            <TabsContent value="disposisi" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{dispositions.length} disposisi</p>
                <Button size="sm" variant="secondary" onClick={() => setShowDisposition(true)}>
                  <GitFork className="size-4" /> Tambah Disposisi
                </Button>
              </div>
              {dispositions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Belum ada disposisi</p>
              ) : (
                dispositions.map((d, i) => (
                  <div key={d._id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">→ {d.toUser?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{formatJobTitle(d.toUser?.jobTitle)}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={d.status === "completed" ? "border-green-300 text-green-700" : d.status === "read" ? "border-blue-300 text-blue-700" : "border-yellow-300 text-yellow-700"}
                      >
                        {d.status === "completed" ? "Selesai" : d.status === "read" ? "Dibaca" : "Menunggu"}
                      </Badge>
                    </div>
                    <p className="text-sm">{d.instructions}</p>
                    {d.dueDate && <p className="text-xs text-muted-foreground">Batas: {format(new Date(d.dueDate), "d MMMM yyyy", { locale: localeId })}</p>}
                    {d.completionNote && <p className="text-xs italic text-muted-foreground">Catatan: {d.completionNote}</p>}
                    {d.status !== "completed" && (
                      <Button size="sm" variant="ghost" onClick={() => handleCompleteDisposition(d._id)}>
                        <CheckCircle2 className="size-3.5" /> Tandai Selesai
                      </Button>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB: Persetujuan */}
            <TabsContent value="persetujuan" className="p-4 space-y-4">

              {/* My Action Banner — shown only to the selected approver when
                  it's their turn */}
              {myPendingApproval && (
                <div id="approve-action-section" className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertCircle className="size-4 shrink-0" />
                    <p className="text-sm font-semibold">Giliran Anda untuk menyetujui surat ini (Langkah {myPendingApproval.order})</p>
                  </div>

                  {isSupportingReviewer ? (
                    // Supporting reviewer: can only add a note and forward
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan untuk pemeriksa berikutnya (opsional)</label>
                        <Textarea
                          value={noteComment}
                          onChange={(e) => setNoteComment(e.target.value)}
                          placeholder="Catatan atau temuan untuk pemeriksa berikutnya..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                          onClick={handleAddReviewerNote}
                          disabled={acting}
                        >
                          <ChevronRight className="size-4" />
                          Teruskan ke Pemeriksa Berikutnya
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Sebagai pemeriksa tambahan, Anda dapat memberikan catatan lalu meneruskan surat ke pemeriksa berikutnya.
                      </p>
                    </div>
                  ) : !showRejectForm && !showRevisionForm && !showReturnReviewerForm && !showFreezeForm ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan persetujuan (opsional)</label>
                        <Textarea
                          value={approvalComment}
                          onChange={(e) => setApprovalComment(e.target.value)}
                          placeholder="Catatan atau komentar..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                          onClick={handleApprove}
                          disabled={acting}
                        >
                          <CheckCheck className="size-4" />
                          Setujui Surat
                        </Button>
                        {isFinalApprover ? (
                          <>
                            {hasPreviousReviewer && (
                              <Button
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                                onClick={() => setShowReturnReviewerForm(true)}
                                disabled={acting}
                              >
                                <RotateCcw className="size-4" />
                                Kembalikan ke Pemeriksa
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-slate-600 hover:bg-slate-700 text-white gap-1.5"
                              onClick={() => setShowFreezeForm(true)}
                              disabled={acting}
                            >
                              <Snowflake className="size-4" />
                              Bekukan (ke Konseptor)
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                            onClick={() => setShowRevisionForm(true)}
                            disabled={acting}
                          >
                            <RotateCcw className="size-4" />
                            Kembalikan untuk Revisi
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowRejectForm(true)}
                          disabled={acting}
                        >
                          <XCircle className="size-4" />
                          Tolak
                        </Button>
                      </div>
                      {isFinalApprover ? (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          <strong>Kembalikan ke Pemeriksa</strong> mengirim surat kembali ke pemeriksa untuk diperiksa ulang. <strong>Bekukan</strong> membatalkan surat menjadi arsip mati dan mengembalikannya ke konseptor — surat tidak dapat diajukan ulang. <strong>Tolak</strong> menghentikan surat.
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          <strong>Kembalikan untuk Revisi</strong> mengembalikan surat ke konseptor untuk diperbaiki lalu diajukan ulang. <strong>Tolak</strong> menghentikan surat.
                        </p>
                      )}
                    </div>
                  ) : showRevisionForm ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan koreksi untuk konseptor *</label>
                        <Textarea
                          value={revisionComment}
                          onChange={(e) => setRevisionComment(e.target.value)}
                          placeholder="Tuliskan hal yang perlu diperbaiki konseptor..."
                          rows={3}
                          className="text-sm border-orange-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                          onClick={handleRequestRevision}
                          disabled={acting || !revisionComment.trim()}
                        >
                          <RotateCcw className="size-4" />
                          Kirim untuk Revisi
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowRevisionForm(false); setRevisionComment(""); }}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : showReturnReviewerForm ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan koreksi untuk pemeriksa *</label>
                        <Textarea
                          value={returnReviewerComment}
                          onChange={(e) => setReturnReviewerComment(e.target.value)}
                          placeholder="Tuliskan hal yang perlu diperiksa ulang oleh pemeriksa..."
                          rows={3}
                          className="text-sm border-orange-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                          onClick={handleReturnToReviewer}
                          disabled={acting || !returnReviewerComment.trim()}
                        >
                          <RotateCcw className="size-4" />
                          Kirim ke Pemeriksa
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowReturnReviewerForm(false); setReturnReviewerComment(""); }}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : showFreezeForm ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-slate-300 bg-slate-100 dark:bg-slate-900/40 dark:border-slate-700 p-2.5 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <Snowflake className="size-3.5 shrink-0 mt-0.5" />
                        <span>Surat akan <strong>dibatalkan dan dibekukan (arsip mati)</strong>, dikembalikan ke konseptor, dan <strong>tidak dapat diajukan ulang</strong>. Konseptor harus membuat konsep baru dari awal. Riwayat surat tetap tersimpan.</span>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan untuk konseptor (opsional)</label>
                        <Textarea
                          value={freezeComment}
                          onChange={(e) => setFreezeComment(e.target.value)}
                          placeholder="Alasan pembekuan surat..."
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-slate-600 hover:bg-slate-700 text-white gap-1.5"
                          onClick={handleFreeze}
                          disabled={acting}
                        >
                          <Snowflake className="size-4" />
                          Konfirmasi Bekukan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowFreezeForm(false); setFreezeComment(""); }}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Alasan penolakan *</label>
                        <Textarea
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          placeholder="Tuliskan alasan penolakan..."
                          rows={3}
                          className="text-sm border-destructive"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleReject}
                          disabled={acting || !rejectComment.trim()}
                        >
                          <XCircle className="size-4" />
                          Konfirmasi Tolak
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowRejectForm(false); setRejectComment(""); }}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{approvals.length} penyetuju</p>
                {(isDraft || isRejected || isRevision) && (
                  <Button size="sm" variant="secondary" onClick={() => setShowApproval(true)}>
                    <Users className="size-4" />
                    {isDraft ? "Ajukan Persetujuan" : "Ajukan Ulang"}
                  </Button>
                )}
              </div>

              {approvals.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 size-8 opacity-30" />
                  <p>Belum ada rantai persetujuan</p>
                  {isDraft && <p className="text-xs mt-1">Klik "Ajukan Persetujuan" untuk memulai alur persetujuan</p>}
                </div>
              ) : (
                <div className="relative space-y-0">
                  {approvals.map((a, idx) => {
                    const isMe = currentUser?._id === a.approverId;
                    return (
                      <div key={a._id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold z-10 ${
                            a.status === "approved" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30" :
                            a.status === "rejected" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30" :
                            a.status === "pending" ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30" :
                            "border-muted bg-muted text-muted-foreground"
                          }`}>
                            {a.status === "approved" ? <CheckCheck className="size-3.5" /> :
                             a.status === "rejected" ? <XCircle className="size-3.5" /> :
                             a.status === "pending" ? <Clock className="size-3.5" /> :
                             <span>{a.order}</span>}
                          </div>
                          {idx < approvals.length - 1 && (
                            <div className={`w-0.5 flex-1 my-1 min-h-4 ${a.status === "approved" ? "bg-green-400" : "bg-border"}`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 rounded-lg border p-3 mb-2 ${isMe && a.status === "pending" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {a.approver?.name ?? "-"}
                                {isMe && <Badge variant="secondary" className="text-[9px] py-0">Anda</Badge>}
                                {"approvalLabel" in a && a.approvalLabel && (
                                  <Badge className={`text-[9px] py-0 ${{
                                    konseptor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                                    pemeriksa_1: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                                    pemeriksa_2: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                                    penyetuju: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
                                  }[("approvalRole" in a ? a.approvalRole : "") as string] ?? "bg-muted text-muted-foreground"}`}>
                                    {a.approvalLabel as string}
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatJobTitle(a.approver?.jobTitle)}</p>
                            </div>
                            <Badge variant="outline" className={`shrink-0 text-xs ${
                              a.status === "approved" ? "border-green-300 bg-green-50 text-green-700" :
                              a.status === "rejected" ? "border-red-300 bg-red-50 text-red-700" :
                              a.status === "pending" ? "border-yellow-300 bg-yellow-50 text-yellow-700" :
                              "border-gray-300 text-gray-500"
                            }`}>
                              {a.status === "approved" ? "✓ Disetujui" :
                               a.status === "rejected" ? "✗ Ditolak" :
                               a.status === "pending" ? "⏳ Menunggu" : "Belum giliran"}
                            </Badge>
                          </div>
                          {a.comment && (
                            <p className="mt-2 text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                              "{a.comment}"
                            </p>
                          )}
                          {a.actedAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {format(new Date(a.actedAt), "d MMM yyyy HH:mm", { locale: localeId })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Overall status summary */}
              {approvals.length > 0 && (
                <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
                  isApproved ? "bg-green-50 text-green-700 dark:bg-green-950/30 border border-green-200" :
                  isRejected ? "bg-red-50 text-red-700 dark:bg-red-950/30 border border-red-200" :
                  isFrozen ? "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-300" :
                  isRevision ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 border border-orange-200" :
                  isReview ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 border border-yellow-200" :
                  "bg-muted border"
                }`}>
                  {isApproved && <><CheckCheck className="size-4" /> Surat telah disetujui semua penyetuju</>}
                  {isRejected && <><XCircle className="size-4" /> Surat ditolak — dapat diajukan ulang</>}
                  {isFrozen && <><Snowflake className="size-4" /> Surat dibekukan (arsip mati) — dibatalkan penyetuju dan tidak dapat diajukan ulang</>}
                  {isRevision && <><RotateCcw className="size-4" /> Dikembalikan untuk revisi — perbaiki lalu ajukan ulang</>}
                  {isReview && <><Clock className="size-4" /> Menunggu persetujuan ({approvals.filter(a => a.status === "approved").length}/{approvals.length} disetujui)</>}
                  {isDraft && <><RotateCcw className="size-4" /> Surat dalam status draft</>}
                </div>
              )}
            </TabsContent>

            {/* TAB: Lampiran */}
            <TabsContent value="lampiran" className="p-4 space-y-2">
              {attachments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada lampiran</p>
              ) : (
                attachments.map((att) => (
                  <div key={att._id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{att.fileName}</p>
                      <p className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB · {att.fileType}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" title="Unduh" onClick={() => { void handleDownloadAttachment(att._id); }}>
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB: Riwayat */}
            <TabsContent value="riwayat" className="p-4">
              <LetterTimeline history={history} letterStatus={letter.status} />
            </TabsContent>

            {/* TAB: Tanda Tangan Digital */}
            <TabsContent value="ttd" className="p-4">
              <SignatureSection letterId={letterId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

            {/* Dialogs */}
      {showDisposition && (
        <DispositionDialog letterId={letterId} open={showDisposition} onClose={() => setShowDisposition(false)} />
      )}
      {showApproval && (
        <ApprovalDialog letterId={letterId} letterType={letter.type} open={showApproval} onClose={() => setShowApproval(false)} />
      )}
      {showEdit && (
        <LetterFormDialog open={showEdit} onClose={() => setShowEdit(false)} editId={letterId} defaultType={letter.type} />
      )}
      {showPrint && (
        <LetterPrintView letter={detail} onClose={() => setShowPrint(false)} />
      )}
      {showEmail && (
        <LetterEmailDialog
          letterId={letterId}
          subject={letter.subject}
          content={letter.content}
          letterNumber={letter.letterNumber ?? undefined}
          fromName={letter.fromName}
          fromOrganization={letter.fromOrganization ?? undefined}
          verificationCode={letter.verificationCode ?? undefined}
          senderName={currentUser?.name ?? author?.name ?? "Pengguna"}
          open={showEmail}
          onClose={() => setShowEmail(false)}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Hapus Surat
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDraft
                ? <>Surat konsep <strong>{letter.subject}</strong> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.</>
                : <>Tindakan ini tidak dapat dibatalkan. Surat <strong>{letter.subject}</strong> beserta semua data terkait (lampiran, disposisi, persetujuan, riwayat, tanda tangan) akan dihapus secara permanen dari sistem.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={acting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {acting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
