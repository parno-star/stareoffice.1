import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Loader2, ChevronRight, AlertCircle, CheckCircle2,
  Zap, Clock, AlertTriangle,
} from "lucide-react";

interface ApprovalDialogProps {
  letterId: Id<"letters">;
  letterType?: string;
  open: boolean;
  onClose: () => void;
}

type UrgencyLevel = "normal" | "segera" | "sangat_segera";

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    value: "normal",
    label: "Normal",
    desc: "Proses sesuai antrian",
    icon: <Clock className="size-4" />,
    color: "border-border bg-muted/30 text-foreground",
  },
  {
    value: "segera",
    label: "Segera",
    desc: "Prioritas tinggi",
    icon: <Zap className="size-4 text-amber-500" />,
    color: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  },
  {
    value: "sangat_segera",
    label: "Sangat Segera",
    desc: "Darurat / mendesak",
    icon: <AlertTriangle className="size-4 text-red-500" />,
    color: "border-red-300 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
  },
];

const ROLE_COLORS: Record<string, string> = {
  pemeriksa_1: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  pemeriksa_2: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  pemeriksa_3: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  penyetuju: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export default function ApprovalDialog({ letterId, open, onClose }: ApprovalDialogProps) {
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const existingLetter = useQuery(
    api.letters.getLetterWithExtras,
    open ? { letterId } : "skip",
  );
  const submitForApproval = useMutation(api.letters.submitForApproval);

  // Reset saat dialog ditutup
  useEffect(() => {
    if (!open) {
      setUrgency("normal");
      setDeadline("");
      setNote("");
    }
  }, [open]);

  const approvals = existingLetter?.approvals ?? [];
  const chain = approvals
    .filter((a) => "approvalRole" in a && a.approvalRole !== "konseptor")
    .sort((a, b) => (("order" in a ? (a.order as number) : 0) - ("order" in b ? (b.order as number) : 0)));

  const hasApprovers = chain.length > 0;

  const handleSubmit = async () => {
    if (!hasApprovers) {
      toast.error("Pemeriksa dan penyetuju belum ditentukan. Edit konsep surat terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const steps = chain.map((a, i) => ({
        userId: ("approverId" in a ? a.approverId : "") as Id<"users">,
        role: ("approvalRole" in a ? a.approvalRole : "") as string,
        label: ("approvalLabel" in a ? (a.approvalLabel as string) : "Penyetuju") ?? "Penyetuju",
        order: i + 1,
      }));

      await submitForApproval({
        letterId,
        approverIds: [],
        approverSteps: steps,
        urgency,
        approvalDeadline: deadline ? new Date(deadline).toISOString() : undefined,
        submissionNote: note.trim() || undefined,
      });
      toast.success("Surat berhasil diajukan untuk persetujuan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengajukan surat");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSaving(false);
    }
  };

  const isLoading = existingLetter === undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan untuk Persetujuan</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">

            {/* 1. Rantai persetujuan */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Rantai Persetujuan</Label>
              {hasApprovers ? (
                <div className="space-y-2">
                  {/* Flow bar — nama karyawan */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {chain.map((a, i) => {
                      const role = ("approvalRole" in a ? a.approvalRole : "") as string;
                      const name = (a as { approver?: { name?: string } }).approver?.name
                        ?? ("userName" in a ? (a.userName as string) : "") ?? "";
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] font-medium ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}>
                            {name}
                          </Badge>
                          {i < chain.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                  {/* Daftar detail */}
                  <div className="space-y-1.5">
                    {chain.map((a, i) => {
                      const role = ("approvalRole" in a ? a.approvalRole : "") as string;
                      const label = ("approvalLabel" in a ? (a.approvalLabel as string) : role) ?? role;
                      const name = (a as { approver?: { name?: string } }).approver?.name
                        ?? ("userName" in a ? (a.userName as string) : "") ?? "";
                      const jobTitle = (a as { approver?: { jobTitle?: string } }).approver?.jobTitle
                        ?? ("userJobTitle" in a ? (a.userJobTitle as string | undefined) : undefined);
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                          <Badge variant="secondary" className="shrink-0 text-xs w-6 h-6 flex items-center justify-center rounded-full font-bold p-0">
                            {i + 1}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Badge className={`text-[9px] ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}>{label}</Badge>
                            </div>
                            <p className="text-sm font-medium mt-0.5">{name}</p>
                            {jobTitle && <p className="text-xs text-muted-foreground">{jobTitle}</p>}
                          </div>
                          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Untuk mengubah rantai, edit konsep surat terlebih dahulu.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Belum ada rantai persetujuan</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Buka form edit konsep dan tentukan Pemeriksa serta Penyetuju terlebih dahulu.</p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Tingkat urgensi */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tingkat Urgensi</Label>
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`cursor-pointer flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                      urgency === opt.value
                        ? `${opt.color} border-current ring-2 ring-offset-1 ring-current/30`
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.icon}
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                    <span className="text-[10px] leading-tight opacity-80">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Batas waktu */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Batas Waktu Persetujuan <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="text-sm"
              />
              {deadline && (
                <p className="text-xs text-muted-foreground">
                  Persetujuan diharapkan selesai sebelum{" "}
                  <strong>{new Date(deadline).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</strong>
                </p>
              )}
            </div>

            {/* 4. Catatan pengajuan */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Catatan untuk Pemeriksa <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan atau instruksi khusus untuk pemeriksa pertama..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving || !hasApprovers || isLoading}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Kirim untuk Persetujuan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
