import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_VALUES, type Role } from "@/convex/roles.ts";
import { ROLE_COLORS } from "@/pages/settings/users/_lib/role-ui.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { CheckCircle2, Loader2 } from "lucide-react";

// Roles users can self-request (exclude super_admin and admin)
const REQUESTABLE_ROLES: ReadonlyArray<Role> = ROLE_VALUES.filter(
  (r) => r !== "super_admin" && r !== "admin",
);

// Group for display
const ROLE_REQUEST_GROUPS = [
  {
    label: "HR & People",
    roles: ["hr_staff", "ld_specialist", "payroll_officer"] as Role[],
  },
  {
    label: "Finance & Operations",
    roles: ["finance_staff", "approver"] as Role[],
  },
  {
    label: "Management",
    roles: ["director", "department_head", "team_lead"] as Role[],
  },
  {
    label: "IT",
    roles: ["it_support"] as Role[],
  },
  {
    label: "End User",
    roles: ["employee", "contractor"] as Role[],
  },
] as const;

interface RoleRequestDialogProps {
  open: boolean;
  onClose: () => void;
  isResubmit?: boolean;
}

export default function RoleRequestDialog({ open, onClose, isResubmit = false }: RoleRequestDialogProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitRequest = useMutation(api.roleRequests.submitRequest);
  const resubmitRequest = useMutation(api.roleRequests.resubmitRequest);

  const handleSubmit = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    try {
      const fn = isResubmit ? resubmitRequest : submitRequest;
      await fn({ requestedRole: selectedRole, reason: reason.trim() || undefined });
      toast.success("Permintaan peran berhasil dikirim. Menunggu persetujuan administrator.");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim permintaan");
      } else {
        toast.error("Terjadi kesalahan, coba lagi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isResubmit ? "Ajukan Ulang Permintaan Peran" : "Selamat Datang di Star e-Office!"}
          </DialogTitle>
          <DialogDescription>
            {isResubmit
              ? "Pilih peran yang sesuai dengan posisi Anda dan ajukan kembali ke administrator."
              : "Akun Anda telah dibuat. Pilih peran yang sesuai dengan posisi Anda di organisasi untuk melanjutkan. Permintaan ini akan ditinjau oleh administrator."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {ROLE_REQUEST_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.roles
                  .filter((r) => REQUESTABLE_ROLES.includes(r))
                  .map((role) => {
                    const active = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-all",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-muted-foreground/40 hover:bg-accent/50",
                        )}
                      >
                        <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40">
                          {active && (
                            <div className="size-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{ROLE_LABELS[role]}</span>
                            {active && <CheckCircle2 className="size-3.5 text-primary" />}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {ROLE_DESCRIPTIONS[role]}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn("mt-1.5 text-[10px]", ROLE_COLORS[role])}
                          >
                            {ROLE_LABELS[role]}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Alasan / Keterangan{" "}
              <span className="text-muted-foreground">(opsional)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Contoh: Saya adalah staf HR yang bertanggung jawab atas rekrutmen..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">{reason.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!selectedRole || submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Mengirim...</>
            ) : (
              "Kirim Permintaan Peran"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
