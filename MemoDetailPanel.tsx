import { useState } from "react";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  X, Send, Archive, CheckCircle2, XCircle, Printer,
  Paperclip, Edit, Users, Clock, CheckCheck, AlertCircle, Trash2, RotateCcw,
  Download, FileText,
} from "lucide-react";
import { useLetterArchive } from "./_hooks/useLetterArchive.ts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { LetterStatusBadge, ClassificationBadge } from "./_components/LetterStatusBadge.tsx";
import ApprovalDialog from "./_components/ApprovalDialog.tsx";
import LetterFormDialog from "./_components/LetterFormDialog.tsx";
import RecipientProgress from "./_components/RecipientProgress.tsx";
import LetterPrintView from "./LetterPrintView.tsx";
import { memoLineFromSettings } from "./_lib/memoLine.ts";

interface MemoDetailPanelProps {
  letterId: Id<"letters">;
  onClose: () => void;
}

export default function MemoDetailPanel({ letterId, onClose }: MemoDetailPanelProps) {
  const detail = useQuery(api.letters.getLetterWithExtras, { letterId });
  const archivePdf = useQuery(api.letters.getLetterArchivePdfUrl, { letterId });
  const memoSettings = useQuery(api.letterMemoSettings.get, {});
  const currentUser = useQuery(api.users.getCurrentUser);
  const sendLetter = useMutation(api.letters.sendLetter);
  const sendLetterEmail = useAction(api.lettersEmail.sendLetterEmail);
  const startLetterEmailJob = useAction(api.lettersEmail.startLetterEmailJob);
  const archiveLetter = useMutation(api.letters.archiveLetter);
  const approveLetter = useMutation(api.letters.approveLetter);
  const rejectLetter = useMutation(api.letters.rejectLetter);
  const requestRevision = useMutation(api.letters.requestRevision);
  const deleteLetter = useMutation(api.letters.deleteLetter);
  const convex = useConvex();
  const generateArchive = useLetterArchive();

  const [showApproval, setShowApproval] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
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

  const { letter, author, attachments, approvals, history } = detail;
  const isDraft = letter.status === "draft";
  const isRejected = letter.status === "rejected";
  const isRevision = letter.status === "revision";
  const isApproved = letter.status === "approved";
  const isSent = letter.status === "sent";
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;
  const isAuthor = !!currentUser && letter.authorId === currentUser._id;
  const canSend = (isApproved || isDraft) && (isAuthor || isAdmin);

  const myPendingApproval = currentUser
    ? approvals.find((a) => a.approverId === currentUser._id && a.status === "pending")
    : undefined;

  const handleSend = async () => {
    setActing(true);
    try {
      await sendLetter({ letterId });
      toast.success("Nota berhasil dikirim");
      // Bekukan arsip PDF permanen. Ambil data terbaru agar arsip sesuai dokumen resmi.
      try {
        const fresh = await convex.query(api.letters.getLetterWithExtras, { letterId });
        if (fresh) {
          const ms = await convex.query(api.letterMemoSettings.get, {});
          await generateArchive(letterId, {
            letter: fresh.letter,
            author: fresh.author,
            pic: fresh.pic,
            attachments: fresh.attachments,
            letterhead: fresh.letterhead,
            approvals: fresh.approvals,
            authorSignature: fresh.authorSignature,
            memoHeaderTitle: ms?.headerTitle,
            memoLogoUrl: ms?.logoUrl,
            memoLine: memoLineFromSettings(ms),
          });
          toast.success("Arsip PDF nota tersimpan");
        }
      } catch {
        toast.warning("Nota terkirim, namun arsip PDF gagal dibuat. Coba lagi via tombol Buat Arsip PDF.");
      }
      // Kirim email otomatis ke penerima resmi (yang memiliki alamat email).
      // Kegagalan/pelewatan email tidak membatalkan pengiriman memo.
      await autoSendEmailOnSend();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  // Setelah memo berhasil dikirim, kirimkan email otomatis ke penerima resmi
  // yang punya alamat email. Bila pengiriman email belum diaktifkan Super Admin
  // atau tidak ada penerima ber-email, memo tetap terkirim dan langkah ini
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
          toast.info("Email otomatis dilewati: penerima nota belum memiliki alamat email.");
        }
        return;
      }

      const skippedNote =
        info.withoutEmail > 0 ? ` (${info.withoutEmail} penerima tanpa email dilewati)` : "";
      const emailMessage =
        `Dengan hormat,\n\nBersama ini kami sampaikan nota` +
        `${detail?.letter.letterNumber ? ` nomor ${detail.letter.letterNumber}` : ""}` +
        ` dengan perihal "${detail?.letter.subject ?? ""}". Isi lengkap nota terlampir pada email ini.\n\nTerima kasih.`;

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
      // Email gagal tidak membatalkan pengiriman memo — beri tahu saja.
      const msg =
        err instanceof ConvexError
          ? (err.data as { message?: string }).message ?? "Gagal"
          : "Terjadi kesalahan";
      toast.warning(`Nota terkirim, namun email otomatis gagal: ${msg}`);
    }
  };

  // Unduh arsip PDF permanen (dibuat saat memo dikirim).
  const handleDownloadArchive = () => {
    if (!archivePdf) return;
    const a = document.createElement("a");
    a.href = archivePdf.url;
    a.download = archivePdf.fileName;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  // Buat/regenerasi arsip PDF secara manual (mis. memo lama tanpa arsip).
  const handleBuildArchive = async () => {
    setActing(true);
    try {
      const fresh = await convex.query(api.letters.getLetterWithExtras, { letterId });
      if (!fresh) throw new Error("Nota tidak ditemukan");
      const ms = await convex.query(api.letterMemoSettings.get, {});
      await generateArchive(letterId, {
        letter: fresh.letter,
        author: fresh.author,
        pic: fresh.pic,
        attachments: fresh.attachments,
        letterhead: fresh.letterhead,
        approvals: fresh.approvals,
        authorSignature: fresh.authorSignature,
        memoHeaderTitle: ms?.headerTitle,
        memoLogoUrl: ms?.logoUrl,
        memoLine: memoLineFromSettings(ms),
      });
      toast.success("Arsip PDF nota tersimpan");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Gagal membuat arsip PDF");
    } finally { setActing(false); }
  };

  const handleArchive = async () => {
    setActing(true);
    try {
      await archiveLetter({ letterId });
      toast.success("Nota diarsipkan");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try {
      await approveLetter({ letterId, comment: approvalComment || undefined });
      toast.success("Nota disetujui");
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
      toast.success("Nota ditolak");
      setRejectComment("");
      setShowRejectForm(false);
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
      toast.success("Nota dikembalikan ke konseptor untuk revisi");
      setRevisionComment("");
      setShowRevisionForm(false);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  const handleDelete = async () => {
    setActing(true);
    try {
      await deleteLetter({ letterId });
      toast.success("Nota berhasil dihapus");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally { setActing(false); }
  };

  // Parse ccExternal from letter
  const ccExternalList = (letter as { ccExternal?: string[] }).ccExternal ?? [];

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
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] border-violet-400 text-violet-600 bg-violet-50 dark:bg-violet-950">Nota</Badge>
              <LetterStatusBadge status={letter.status} />
              {letter.classification !== "biasa" && <ClassificationBadge classification={letter.classification} />}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1 ml-auto">
            {(isDraft || isRejected || isRevision) && (
              <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
                <Edit className="size-4" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            {isSuperAdmin && !isDraft && !isRejected && !isRevision && (
              <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
                <Edit className="size-4" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            {(isDraft || isRejected || isRevision) && (
              <Button size="sm" variant="secondary" onClick={() => setShowApproval(true)}>
                <Users className="size-4" />
                <span className="hidden sm:inline">{isDraft ? "Ajukan" : "Ajukan Ulang"}</span>
              </Button>
            )}
            {myPendingApproval && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { setShowRejectForm(false); setApprovalComment(""); }}
                  disabled={acting}
                >
                  <CheckCircle2 className="size-4" />
                  <span className="hidden sm:inline">Setujui</span>
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setShowRejectForm(true)} disabled={acting}>
                  <XCircle className="size-4" />
                  <span className="hidden sm:inline">Tolak</span>
                </Button>
              </>
            )}
            {canSend && (
              <Button size="sm" onClick={handleSend} disabled={acting}>
                <Send className="size-4" />
                <span className="hidden sm:inline">Kirim</span>
              </Button>
            )}
            {/* Buat arsip PDF untuk memo lama/terkirim yang belum punya arsip. */}
            {!archivePdf && isSent && (isAuthor || isAdmin) && (
              <Button size="sm" variant="secondary" onClick={handleBuildArchive} disabled={acting}>
                <FileText className="size-4" />
                <span className="hidden sm:inline">Buat Arsip PDF</span>
              </Button>
            )}
            {archivePdf && (
              <Button size="sm" variant="secondary" onClick={handleDownloadArchive} title="Unduh Arsip PDF">
                <Download className="size-4" />
                <span className="hidden sm:inline">Unduh Arsip PDF</span>
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={() => setShowPrint(true)} title="Cetak">
              <Printer className="size-4" />
            </Button>
            {/* Arsipkan hanya untuk memo yang sudah dikirim (final). */}
            {isSent && (
              <Button size="icon-sm" variant="ghost" onClick={handleArchive} disabled={acting} title="Arsipkan">
                <Archive className="size-4" />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={acting}
                title="Hapus (Super Admin)"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Inline approve/reject actions for pending approver */}
        {myPendingApproval && (
          <div className="shrink-0 border-b bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Clock className="size-4" /> Nota ini menunggu persetujuan Anda
            </p>
            {!showRejectForm && !showRevisionForm ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Komentar persetujuan (opsional)"
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove} disabled={acting}>
                    <CheckCheck className="size-4" /> Setujui
                  </Button>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowRevisionForm(true)} disabled={acting}>
                    <RotateCcw className="size-4" /> Kembalikan untuk Revisi
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowRejectForm(true)} disabled={acting}>
                    <XCircle className="size-4" /> Tolak
                  </Button>
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
                  Kembalikan untuk Revisi: nota kembali ke konseptor untuk diperbaiki lalu diajukan lagi. Tolak: nota dihentikan.
                </p>
              </div>
            ) : showRevisionForm ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Catatan koreksi untuk konseptor (wajib)"
                  value={revisionComment}
                  onChange={(e) => setRevisionComment(e.target.value)}
                  rows={2}
                  className="text-sm border-orange-400"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleRequestRevision} disabled={acting || !revisionComment.trim()}>
                    <RotateCcw className="size-4" /> Kirim untuk Revisi
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowRevisionForm(false); setRevisionComment(""); }}>Batal</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Alasan penolakan (wajib)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={2}
                  className="text-sm border-destructive"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={acting || !rejectComment.trim()}>
                    <AlertCircle className="size-4" /> Konfirmasi Tolak
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowRejectForm(false); setRejectComment(""); }}>Batal</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="detail">
            <div className="sticky top-0 z-10 border-b bg-background px-4 py-1">
              <TabsList className="h-8">
                <TabsTrigger value="detail" className="text-xs">Detail</TabsTrigger>
                <TabsTrigger value="isi" className="text-xs">Isi Nota</TabsTrigger>
                <TabsTrigger value="persetujuan" className="text-xs">
                  Persetujuan {approvals.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{approvals.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lampiran" className="text-xs">
                  Lampiran {attachments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{attachments.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Detail */}
            <TabsContent value="detail" className="p-4 space-y-4">
              {/* Metadata card */}
              <div className="rounded-lg border bg-card">
                <div className="grid grid-cols-2 gap-0 divide-x divide-y rounded-lg overflow-hidden">
                  {[
                    { label: "Nomor Nota", value: letter.letterNumber ?? "—" },
                    { label: "Tanggal", value: format(new Date(letter.letterDate), "d MMMM yyyy", { locale: localeId }) },
                    { label: "Dari", value: letter.fromName },
                    { label: "Kepada", value: letter.toName },
                    { label: "Kategori", value: letter.category },
                    { label: "Klasifikasi", value: letter.classification === "biasa" ? "Biasa" : letter.classification },
                  ].map((row) => (
                    <div key={row.label} className="px-4 py-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{row.label}</p>
                      <p className="text-sm font-medium mt-0.5">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tembusan */}
              {((detail.ccUsers && detail.ccUsers.length > 0) || ccExternalList.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tembusan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.ccUsers?.map((u) => (
                      <Badge key={u._id} variant="secondary">{u.name}</Badge>
                    ))}
                    {ccExternalList.map((ext) => (
                      <Badge key={ext} variant="outline">{ext}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Daftar penerima massal + progres baca (hanya untuk memo massal) */}
              <RecipientProgress letterId={letter._id} />

              {/* Dibuat oleh */}
              {author && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-sm font-bold">
                    {author.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dibuat oleh</p>
                    <p className="text-sm font-medium">{author.name}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Isi Nota */}
            <TabsContent value="isi" className="p-4">
              {letter.content ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-card p-5"
                  dangerouslySetInnerHTML={{ __html: letter.content }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">Tidak ada isi nota</p>
              )}
            </TabsContent>

            {/* Tab: Persetujuan */}
            <TabsContent value="persetujuan" className="p-4 space-y-3">
              {approvals.length === 0 ? (
                <div className="rounded-lg border bg-muted/40 p-6 text-center">
                  <p className="text-sm text-muted-foreground">Belum ada alur persetujuan</p>
                  {(isDraft || isRejected || isRevision) && (
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShowApproval(true)}>
                      <Users className="size-4" /> Ajukan Persetujuan
                    </Button>
                  )}
                </div>
              ) : (
                  approvals.map((ap, idx) => {
                    const approver = ap.approver;
                    return (
                    <div key={ap._id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{approver?.name ?? "Approver"}</p>
                        {ap.comment && <p className="mt-1 text-xs italic text-muted-foreground">{ap.comment}</p>}
                      </div>
                      <Badge
                        variant={ap.status === "approved" ? "default" : ap.status === "rejected" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {ap.status === "approved" ? "Disetujui" : ap.status === "rejected" ? "Ditolak" : "Menunggu"}
                      </Badge>
                    </div>
                    );
                  })
              )}
            </TabsContent>

            {/* Tab: Lampiran */}
            <TabsContent value="lampiran" className="p-4 space-y-2">
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Tidak ada lampiran</p>
              ) : (
              attachments.map((att) => (
                  <div key={att._id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                    <Paperclip className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{att.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {att.fileType} · {Math.round(att.fileSize / 1024)} KB
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      {showApproval && (
        <ApprovalDialog
          letterId={letterId}
          letterType="memo"
          open={showApproval}
          onClose={() => setShowApproval(false)}
        />
      )}
      {showEdit && (
        <LetterFormDialog
          open={showEdit}
          onClose={() => setShowEdit(false)}
          editId={letterId}
          defaultType="memo"
        />
      )}
      {showPrint && (
        <LetterPrintView
          letter={{ ...detail, memoHeaderTitle: memoSettings?.headerTitle, memoLogoUrl: memoSettings?.logoUrl, memoLine: memoLineFromSettings(memoSettings) }}
          onClose={() => setShowPrint(false)}
        />
      )}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Nota Permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Nota "<strong>{letter.subject}</strong>" akan dihapus secara permanen dan tidak dapat dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
