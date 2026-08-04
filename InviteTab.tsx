import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  KeyRound, Copy, Check, RefreshCw, Loader2, Mail, Search,
  Send, Users, LogIn,
} from "lucide-react";

// ---- Invite code card (org admins share this with new members) ----------
function InviteCodeCard() {
  const getCode = useMutation(api.organizations.getMyInviteCode);
  const regenerate = useMutation(api.organizations.regenerateInviteCode);
  const [code, setCode] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // Load (and lazily create) the invite code once when the card mounts.
  useEffect(() => {
    let active = true;
    getCode({})
      .then((res) => {
        if (!active) return;
        setCode(res.code);
        setOrgName(res.orgName);
      })
      .catch(() => {
        /* non-admins or no org: card simply stays empty */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getCode]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Kode undangan disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin kode");
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await regenerate({});
      setCode(res.code);
      toast.success("Kode undangan diperbarui");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memperbarui kode");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (!code) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Kode undangan hanya tersedia untuk admin organisasi.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-primary" />
          Kode Undangan Organisasi
        </CardTitle>
        <CardDescription className="text-xs">
          Cadangan untuk calon anggota yang belum ada di Direktori Karyawan.
          Bagikan kode ini {orgName ? `"${orgName}"` : ""}, mereka memasukkannya
          saat mendaftar, lalu Anda setujui di tab Persetujuan Akun. Untuk
          karyawan yang sudah ada di direktori, gunakan Kirim Undangan via Email
          di bawah — mereka aktif otomatis tanpa persetujuan.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border bg-background px-4 py-2.5 font-mono text-2xl font-bold tracking-[0.3em]">
            {code}
          </div>
          <Button variant="secondary" className="gap-2 cursor-pointer" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
          <Button
            variant="ghost"
            className="gap-2 cursor-pointer"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Ganti Kode
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mengganti kode akan menonaktifkan kode lama. Kode lama tidak bisa
          dipakai lagi untuk bergabung.
        </p>
      </CardContent>
    </Card>
  );
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Send invite email card --------------------------------------------
function SendInviteCard() {
  const directory = useQuery(api.organization.listAll, {});
  const sendInvites = useAction(api.userInvites.sendInvites);

  // Selected directory emails (set of lowercase emails).
  const [selectedDir, setSelectedDir] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Directory members that actually have an email address.
  const members = useMemo(() => {
    const list = (directory ?? []).filter(
      (u) => u.email && EMAIL_RE.test(u.email),
    );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const hay = `${u.name ?? ""} ${u.email ?? ""} ${u.department ?? ""} ${u.jobTitle ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [directory, search]);

  // Count of directory members WITHOUT an email — they cannot be invited until
  // an admin adds their email in the directory.
  const missingEmailCount = useMemo(() => {
    return (directory ?? []).filter((u) => !u.email || !EMAIL_RE.test(u.email))
      .length;
  }, [directory]);

  const toggleDir = (email: string) => {
    const key = email.toLowerCase();
    setSelectedDir((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const recipients = useMemo(() => {
    return Array.from(selectedDir);
  }, [selectedDir]);

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error("Pilih minimal satu karyawan dari direktori");
      return;
    }
    setSending(true);
    try {
      const res = await sendInvites({
        recipients,
        personalMessage: message.trim() || undefined,
        appUrl: window.location.origin,
      });
      toast.success(`Undangan terkirim ke ${res.sent} karyawan`);
      setSelectedDir(new Set());
      setMessage("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim undangan");
      } else {
        toast.error("Terjadi kesalahan saat mengirim undangan");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-primary" />
          Kirim Undangan via Email
        </CardTitle>
        <CardDescription className="text-xs">
          Pilih karyawan dari direktori. Mereka cukup masuk menggunakan email
          yang terdaftar — akun langsung aktif, tanpa daftar ulang dan tanpa
          persetujuan admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-4 pt-2">
        {/* Directory picker */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <Users className="size-3.5" />
            Dari Direktori Karyawan
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, atau departemen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-lg border">
            {directory === undefined ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : members.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {search
                  ? "Tidak ada karyawan yang cocok."
                  : "Belum ada karyawan dengan email di direktori. Tambahkan karyawan beserta emailnya di Direktori Karyawan terlebih dahulu."}
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="divide-y">
                  {members.map((u) => {
                    const email = (u.email ?? "").toLowerCase();
                    const checked = selectedDir.has(email);
                    return (
                      <button
                        type="button"
                        key={u._id}
                        onClick={() => toggleDir(email)}
                        className="flex w-full cursor-pointer items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <Avatar className="size-8">
                          <AvatarImage src={u.avatarUrl} />
                          <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u.name ?? "Tanpa Nama"}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        {u.department ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {u.department}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
          {missingEmailCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {missingEmailCount} karyawan belum memiliki email dan tidak dapat
              diundang. Tambahkan email mereka di Direktori Karyawan agar bisa
              diundang.
            </p>
          )}
        </div>

        {/* Optional personal message */}
        <div className="space-y-2">
          <Label htmlFor="invite-message" className="text-xs font-medium">
            Pesan Tambahan (opsional)
          </Label>
          <Textarea
            id="invite-message"
            placeholder="Halo, silakan masuk menggunakan email kantor Anda untuk mulai menggunakan sistem."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{recipients.length}</span>{" "}
            karyawan dipilih
          </p>
          <Button
            type="button"
            className="gap-2 cursor-pointer"
            onClick={handleSend}
            disabled={sending || recipients.length === 0}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? "Mengirim..." : "Kirim Undangan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Sign-in instructions card (for employees without an email invite) ----
function SignInInstructionsCard() {
  const [copied, setCopied] = useState(false);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const instructions = [
    "Cara masuk ke Star e-Office:",
    "",
    `1. Buka ${appUrl || "aplikasi Star e-Office"}`,
    "2. Klik tombol Masuk / Sign In.",
    "3. Masuk menggunakan EMAIL KANTOR Anda (email yang sama dengan yang terdaftar di data karyawan).",
    "4. Akun Anda langsung aktif — tidak perlu daftar ulang, tidak perlu kode, dan tidak perlu menunggu persetujuan.",
    "",
    "Penting: gunakan email yang sama persis dengan data karyawan Anda. Jika ragu, tanyakan ke admin.",
  ].join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      toast.success("Instruksi masuk disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin instruksi");
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <LogIn className="size-4 text-primary" />
          Instruksi Masuk untuk Karyawan
        </CardTitle>
        <CardDescription className="text-xs">
          Untuk karyawan yang sudah ada di direktori tapi tidak menerima email
          undangan. Salin teks di bawah, lalu kirim lewat WhatsApp atau chat.
          Mereka cukup masuk dengan email kantornya dan akun langsung aktif.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
{instructions}
        </pre>
        <Button
          type="button"
          variant="secondary"
          className="gap-2 cursor-pointer"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          {copied ? "Tersalin" : "Salin Instruksi Masuk"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Main tab component ------------------------------------------------
export default function InviteTab() {
  return (
    <div className="space-y-6">
      <InviteCodeCard />
      <SendInviteCard />
      <SignInInstructionsCard />
    </div>
  );
}
