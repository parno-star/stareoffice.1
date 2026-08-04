import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Search, X, Plus, Mail, Paperclip, FileText, Users, UserPlus, Send, Loader2,
  Building2, UsersRound, CheckCircle2, AlertTriangle,
} from "lucide-react";

type Recipient = {
  key: string;
  name: string;
  email: string;
  source: "internal" | "external";
};

interface LetterEmailDialogProps {
  letterId: Id<"letters">;
  subject: string;
  content: string; // letter body HTML
  letterNumber?: string;
  fromName: string;
  fromOrganization?: string;
  verificationCode?: string;
  senderName: string; // current user name
  open: boolean;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Di atas ambang ini, pengiriman dilakukan bertahap di latar belakang dengan
// indikator progres agar tidak membebani sistem. Di bawahnya, dikirim langsung.
const BULK_THRESHOLD = 15;

export default function LetterEmailDialog({
  letterId,
  subject,
  content,
  letterNumber,
  fromName,
  verificationCode,
  open,
  onClose,
}: LetterEmailDialogProps) {
  const [search, setSearch] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpenSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [externalInput, setExternalInput] = useState("");
  const [quickDept, setQuickDept] = useState<string>("none");
  const [message, setMessage] = useState(
    `Dengan hormat,\n\nBersama ini kami sampaikan surat${letterNumber ? ` nomor ${letterNumber}` : ""} dengan perihal "${subject}". Isi lengkap surat terlampir pada email ini.\n\nTerima kasih.`,
  );
  const [sending, setSending] = useState(false);
  // Job pengiriman massal di latar belakang (bila penerima banyak).
  const [jobId, setJobId] = useState<Id<"letterEmailJobs"> | null>(null);

  const employees = useQuery(api.users.listEmployees, { search, department: "" });
  const departments = useQuery(api.users.listDepartments, {});
  const emailStatus = useQuery(api.letterEmailSettings.getStatus, {});
  const sendLetterEmail = useAction(api.lettersEmail.sendLetterEmail);
  const startLetterEmailJob = useAction(api.lettersEmail.startLetterEmailJob);
  // Progres job massal — dipoll otomatis lewat reaktivitas Convex.
  const jobProgress = useQuery(
    api.lettersEmailInternal.getLetterEmailJob,
    jobId ? { jobId } : "skip",
  );

  // Employees to draw from for quick-fill (department / all). Fetched without a
  // search term so we always pull the whole roster the user is allowed to see.
  const allEmployees = useQuery(api.users.listEmployees, { search: "", department: "" });

  const senderConfigured =
    !!emailStatus && emailStatus.emailEnabled && emailStatus.senderEmail.length > 0;

  const isSelected = (email: string) =>
    recipients.some((r) => r.email.toLowerCase() === email.toLowerCase());

  const addRecipient = (r: Recipient) => {
    if (isSelected(r.email)) {
      toast.info("Penerima sudah ditambahkan");
      return;
    }
    setRecipients((prev) => [...prev, r]);
  };

  const removeRecipient = (key: string) => {
    setRecipients((prev) => prev.filter((r) => r.key !== key));
  };

  const addExternal = () => {
    const email = externalInput.trim();
    if (!EMAIL_RE.test(email)) {
      toast.error("Format email tidak valid");
      return;
    }
    addRecipient({ key: `ext-${email}`, name: email, email, source: "external" });
    setExternalInput("");
  };

  // Bulk-adds a set of employees, skipping those without email or already added.
  const addEmployeeGroup = (
    group: Array<{ _id: string; name?: string; email?: string }>,
    label: string,
  ) => {
    const seen = new Set(recipients.map((r) => r.email.toLowerCase()));
    let added = 0;
    let skippedNoEmail = 0;
    const toAdd: Recipient[] = [];
    for (const emp of group) {
      const email = emp.email?.trim();
      if (!email) { skippedNoEmail += 1; continue; }
      const lc = email.toLowerCase();
      if (seen.has(lc)) continue;
      seen.add(lc);
      toAdd.push({
        key: `int-${emp._id}`,
        name: emp.name ?? email,
        email,
        source: "internal",
      });
      added += 1;
    }
    if (toAdd.length > 0) setRecipients((prev) => [...prev, ...toAdd]);
    if (added === 0) {
      toast.info(`Tidak ada penerima baru dari ${label}`);
    } else {
      toast.success(
        `${added} penerima dari ${label} ditambahkan${skippedNoEmail > 0 ? ` (${skippedNoEmail} tanpa email dilewati)` : ""}`,
      );
    }
  };

  const handleAddAllEmployees = () => {
    if (!allEmployees) return;
    addEmployeeGroup(allEmployees, "Seluruh Karyawan");
  };

  const handleAddDepartment = () => {
    if (!allEmployees || quickDept === "none") return;
    const group = allEmployees.filter((e) => e.department === quickDept);
    addEmployeeGroup(group, `Departemen ${quickDept}`);
  };

  // Includes any email that was typed in the "add other email" field but not yet
  // added as a chip, so a valid address is never silently dropped on send.
  const collectRecipients = (): Recipient[] => {
    const typed = externalInput.trim();
    if (typed.length === 0) return recipients;
    if (!EMAIL_RE.test(typed) || isSelected(typed)) return recipients;
    return [
      ...recipients,
      { key: `ext-${typed}`, name: typed, email: typed, source: "external" },
    ];
  };

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => !!e.email && !isSelected(e.email!)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, recipients]);

  // When a background job finishes, notify and reset send state so the user can
  // close the dialog. The dialog stays open while it runs to show progress.
  useEffect(() => {
    if (!jobId || !jobProgress) return;
    if (jobProgress.status === "completed" || jobProgress.status === "failed") {
      setSending(false);
      if (jobProgress.status === "completed") {
        const failNote =
          jobProgress.failedCount > 0 ? ` (${jobProgress.failedCount} gagal)` : "";
        toast.success(
          `Email terkirim ke ${jobProgress.sentCount} dari ${jobProgress.total} penerima${failNote}`,
        );
      } else {
        toast.error("Pengiriman email gagal. Periksa alamat pengirim terverifikasi dan coba lagi.");
      }
    }
  }, [jobId, jobProgress]);

  const resetAndClose = () => {
    setJobId(null);
    setExternalInput("");
    onClose();
  };

  const handleSend = async () => {
    const typed = externalInput.trim();
    // Guard against a half-typed, invalid email being silently dropped.
    if (typed.length > 0 && !EMAIL_RE.test(typed)) {
      toast.error("Ada email yang belum ditambahkan dengan format tidak valid. Perbaiki atau hapus dulu.");
      return;
    }
    const finalRecipients = collectRecipients();
    if (finalRecipients.length === 0) {
      toast.error("Tambahkan minimal satu penerima");
      return;
    }
    setSending(true);
    try {
      const emails = finalRecipients.map((r) => r.email);
      if (emails.length > BULK_THRESHOLD) {
        // Pengiriman bertahap di latar belakang dengan indikator progres.
        const { jobId: newJobId } = await startLetterEmailJob({
          letterId,
          recipients: emails,
          message,
        });
        setExternalInput("");
        setJobId(newJobId);
        toast.info(`Mengirim ke ${emails.length} penerima di latar belakang...`);
        // Biarkan dialog terbuka; progres akan tampil sampai selesai.
      } else {
        const result = await sendLetterEmail({ letterId, recipients: emails, message });
        setExternalInput("");
        toast.success(`Email berhasil dikirim ke ${result.sent} penerima`);
        resetAndClose();
      }
    } catch (err) {
      setSending(false);
      if (err instanceof ConvexError) {
        toast.error((err.data as { message?: string }).message ?? "Gagal mengirim email");
      } else {
        toast.error("Terjadi kesalahan saat mengirim email");
      }
    }
  };

  const jobRunning = !!jobId && jobProgress?.status === "processing";
  const jobDone = !!jobId && (jobProgress?.status === "completed" || jobProgress?.status === "failed");
  const jobDoneCount = jobProgress ? jobProgress.sentCount + jobProgress.failedCount : 0;
  const jobPct = jobProgress && jobProgress.total > 0
    ? Math.round((jobDoneCount / jobProgress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending && !jobRunning) resetAndClose(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" /> Kirim Surat via Email
          </DialogTitle>
          <DialogDescription>
            Kirim surat ini sebagai email ke karyawan atau alamat lain.
          </DialogDescription>
        </DialogHeader>

        {/* Sender info notice */}
        {emailStatus === undefined ? (
          <div className="mx-5 mt-4 h-12 shrink-0 animate-pulse rounded-lg border bg-muted/50" />
        ) : senderConfigured ? (
          <div className="mx-5 mt-4 flex shrink-0 items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Email dikirim dari alamat <strong>{emailStatus.senderEmail}</strong>. Balasan penerima
              akan diarahkan ke email Anda. Surat disertakan sebagai lampiran PDF.
            </span>
          </div>
        ) : (
          <div className="mx-5 mt-4 flex shrink-0 items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Pengiriman email belum diaktifkan. Super Admin perlu mengatur alamat pengirim di
              Super Admin → tab <strong>Email Surat</strong> terlebih dahulu.
            </span>
          </div>
        )}

        {/* Progres pengiriman massal di latar belakang */}
        {jobId && jobProgress && (
          <div className="mx-5 mt-4 shrink-0 rounded-lg border bg-card px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {jobRunning ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : jobProgress.status === "completed" ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-4 text-destructive" />
                )}
                {jobRunning
                  ? "Mengirim email di latar belakang..."
                  : jobProgress.status === "completed"
                    ? "Pengiriman selesai"
                    : "Pengiriman gagal"}
              </span>
              <span className="text-xs text-muted-foreground">
                {jobDoneCount} dari {jobProgress.total} ({jobPct}%)
              </span>
            </div>
            <Progress value={jobPct} className="h-2" />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600">Terkirim: {jobProgress.sentCount}</span>
              {jobProgress.failedCount > 0 && (
                <span className="text-destructive">Gagal: {jobProgress.failedCount}</span>
              )}
            </div>
            {jobDone && jobProgress.failedSample.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Contoh gagal: {jobProgress.failedSample.join(", ")}
              </p>
            )}
            {jobRunning && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Anda boleh menutup jendela ini; pengiriman tetap berjalan di latar belakang.
              </p>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-2">
          {/* LEFT: recipients + message */}
          <div className="space-y-4 p-5">
            {/* Recipients chips */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Users className="size-3.5" /> Penerima ({recipients.length})
                {recipients.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto cursor-pointer text-xs font-normal text-muted-foreground hover:text-destructive"
                    onClick={() => setRecipients([])}
                    disabled={sending || jobRunning}
                  >
                    Kosongkan
                  </button>
                )}
              </Label>
              {recipients.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Belum ada penerima. Pilih karyawan, isi cepat per departemen / seluruh karyawan, atau tambahkan email di bawah.
                </p>
              ) : (
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {recipients.map((r) => (
                    <span
                      key={r.key}
                      className="flex items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.source === "external" ? (
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">Luar</Badge>
                      ) : (
                        <Badge variant="secondary" className="px-1 py-0 text-[9px]">Internal</Badge>
                      )}
                      <button
                        type="button"
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => removeRecipient(r.key)}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Isi cepat: per departemen / seluruh karyawan */}
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-1.5 text-xs">
                <UsersRound className="size-3.5" /> Isi Cepat Penerima
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 gap-2">
                  <Select value={quickDept} onValueChange={setQuickDept}>
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Pilih departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pilih departemen...</SelectItem>
                      {(departments ?? []).map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 shrink-0"
                    onClick={handleAddDepartment}
                    disabled={quickDept === "none" || !allEmployees || sending || jobRunning}
                  >
                    <Building2 className="size-4" /> Tambah
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9"
                  onClick={handleAddAllEmployees}
                  disabled={!allEmployees || sending || jobRunning}
                >
                  <UsersRound className="size-4" /> Seluruh Karyawan
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Karyawan tanpa alamat email akan otomatis dilewati.
              </p>
            </div>

            {/* Search employees */}
            <div className="space-y-1.5">
              <Label>Cari Karyawan</Label>
              <div className="relative" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Ketik nama karyawan..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOpenSearch(true); }}
                  onFocus={() => setOpenSearch(true)}
                  onClick={() => setOpenSearch(true)}
                />
              </div>
              {openSearch && (
                <div className="max-h-44 overflow-y-auto rounded-lg border bg-card">
                  {filteredEmployees.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                      Tidak ada karyawan cocok atau semua sudah ditambahkan
                    </p>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <button
                        key={emp._id}
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addRecipient({
                            key: `int-${emp._id}`,
                            name: emp.name ?? emp.email ?? "Karyawan",
                            email: emp.email!,
                            source: "internal",
                          });
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{emp.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                        <Plus className="size-4 shrink-0 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* External email */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <UserPlus className="size-3.5" /> Tambah Email Lain
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="nama@contoh.com"
                  value={externalInput}
                  onChange={(e) => setExternalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternal(); } }}
                />
                <Button type="button" variant="secondary" onClick={addExternal}>
                  <Plus className="size-4" /> Tambah
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tekan "Tambah" atau Enter untuk menambahkan. Email yang sudah diketik tetap ikut terkirim saat menekan "Kirim Email".
              </p>
            </div>

            {/* Pesan pengantar */}
            <div className="space-y-1.5">
              <Label>Pesan Pengantar</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
              />
            </div>
          </div>

          {/* RIGHT: email preview */}
          <div className="border-t bg-muted/30 p-5 md:border-l md:border-t-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pratinjau Email
            </p>
            <div className="space-y-3 rounded-lg border bg-background p-4 text-sm shadow-sm">
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">Dari:</span> surat - star e-Office{senderConfigured ? ` <${emailStatus?.senderEmail}>` : ""}</p>
                <p className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Kepada:</span>
                  {recipients.length === 0
                    ? <span className="italic text-muted-foreground">(belum ada penerima)</span>
                    : recipients.length > 6
                      ? <span className="rounded bg-muted px-1.5 py-0.5">{recipients.length} penerima (dikirim terpisah)</span>
                      : recipients.map((r) => (
                          <span key={r.key} className="rounded bg-muted px-1.5 py-0.5">{r.email}</span>
                        ))}
                </p>
                <p><span className="text-muted-foreground">Subjek:</span> {letterNumber ? `[${letterNumber}] ` : ""}{subject}</p>
              </div>
              <Separator />
              {/* Pesan pengantar */}
              <div className="whitespace-pre-wrap text-sm">{message}</div>

              <Separator />
              {/* Isi surat di badan email */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Isi Surat
                </p>
                <div
                  className="prose prose-sm max-w-none rounded-md border bg-muted/40 p-3"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>

              {/* Attachment */}
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <Paperclip className="size-3.5 text-muted-foreground" />
                <FileText className="size-4 text-red-500" />
                <span className="font-medium">
                  Surat-{letterNumber ?? "tanpa-nomor"}.pdf
                </span>
                <span className="text-muted-foreground">(lampiran PDF)</span>
              </div>

              {verificationCode && (
                <p className="text-[11px] text-muted-foreground">
                  Kode verifikasi keaslian: <span className="font-mono">{verificationCode}</span>
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Setiap penerima menerima email terpisah — alamat penerima lain tidak saling terlihat.
              Nama pengirim: "surat - star e-Office". Dari: {fromName}.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          {jobDone ? (
            <Button onClick={resetAndClose}>Selesai</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={resetAndClose} disabled={sending || jobRunning}>
                {jobRunning ? "Tutup (tetap berjalan)" : "Batal"}
              </Button>
              <Button
                onClick={handleSend}
                disabled={
                  sending || jobRunning ||
                  (recipients.length === 0 && externalInput.trim().length === 0) ||
                  !senderConfigured
                }
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {sending ? "Mengirim..." : "Kirim Email"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
