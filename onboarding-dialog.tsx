import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth.ts";
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
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Loader2,
  Building2,
  ArrowLeft,
  CheckCircle2,
  Rocket,
  Clock,
  Check,
  HelpCircle,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

type OnboardingStep =
  | "welcome"
  | "choice"
  | "email_mismatch"
  | "profile"
  | "create_org"
  | "select_plan"
  | "success_created";

type OnboardingDialogProps = {
  open: boolean;
  /** Called when the user dismisses the dialog (X, Escape, or clicking outside). */
  onClose?: () => void;
};

export default function OnboardingDialog({
  open,
  onClose,
}: OnboardingDialogProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [submitting, setSubmitting] = useState(false);
  const { removeUser } = useAuth();

  // Profile fields (admin of the new org)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Create new org fields
  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");

  // Plan selection & payment fields
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const plans = useQuery(api.membership.listActive, {});
  const trialInfo = useQuery(api.trialSettings.getPublicInfo, {});
  const completeWithNewOrg = useMutation(api.onboardUser.completeWithNewOrg);

  // Whether new-org registration is currently enabled (super admin toggle).
  const registrationEnabled = trialInfo?.registrationEnabled ?? true;
  const trialDurationDays = trialInfo?.durationDays ?? 30;

  // Self-service plans exclude Enterprise (contact sales only)
  const selectablePlans = (plans ?? []).filter((p) => p.slug !== "enterprise");
  const selectedPlan = selectablePlans.find((p) => p._id === selectedPlanId);

  const isProfileValid =
    fullName.trim().length >= 2 && phone.trim().length >= 8;

  const isNewOrgValid =
    orgName.trim().length >= 2 &&
    orgAddress.trim().length >= 5 &&
    orgEmail.trim().length >= 5 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmail.trim());

  // Trial is free — the plan is only the tier they intend to subscribe to
  // later, so no upfront payment reference is required to start.
  const isPlanStepValid = Boolean(selectedPlan);

  const handleSignOut = async () => {
    try {
      await removeUser();
    } catch {
      /* ignore */
    }
    window.location.replace("/");
  };

  const handleSubmitCreateOrg = async () => {
    if (!selectedPlan) {
      toast.error("Pilih paket terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await completeWithNewOrg({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        orgName: orgName.trim(),
        orgAddress: orgAddress.trim(),
        orgEmail: orgEmail.trim(),
        orgPhone: orgPhone.trim() || undefined,
        orgWebsite: orgWebsite.trim() || undefined,
        selectedPlanId: selectedPlan._id,
        // Trial start requires no upfront payment.
        paymentMethod: "free",
      });
      setStep("success_created");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal membuat organisasi");
      } else {
        toast.error("Terjadi kesalahan, coba lagi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Exit onboarding WITHOUT deleting anything. The account stays intact and
    // the dialog reappears on next login. Abandoned stubs are cleaned up later
    // by the scheduled cleanup (see convex/onboardingCleanup.ts).
    setStep("welcome");
    onClose?.();
  };

  const stepNumber =
    step === "profile"
      ? 1
      : step === "create_org"
        ? 2
        : step === "select_plan"
          ? 3
          : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      >
        {/* Progress bar (only during the create-org flow) */}
        {stepNumber > 0 && (
          <div className="flex gap-1.5 pt-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  s <= stepNumber ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        )}

        {/* ─── Welcome Step ─── */}
        {step === "welcome" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
                <Rocket className="size-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-2xl">
                Selamat Datang di Star e-Office!
              </DialogTitle>
              <DialogDescription className="text-base">
                Email Anda belum terdaftar di organisasi mana pun. Mari
                lanjutkan untuk menyiapkan akses Anda.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button onClick={() => setStep("choice")} className="w-full">
                Lanjutkan
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-muted-foreground"
              >
                Nanti Saja
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ─── Step 1: Profile Data ─── */}
        {step === "profile" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Data Diri</DialogTitle>
              <DialogDescription>
                Lengkapi data diri Anda untuk melanjutkan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="onb-fullname">
                  Nama Lengkap{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="onb-fullname"
                  placeholder="Contoh: Ahmad Suryadi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="onb-phone">
                  No. Handphone{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="onb-phone"
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="onb-address">Alamat</Label>
                <Textarea
                  id="onb-address"
                  placeholder="Contoh: Jl. Merdeka No. 10, Jakarta Pusat"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("choice")}
                className="w-full gap-1.5 text-muted-foreground sm:w-auto"
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <div className="flex flex-col gap-2 sm:w-auto">
                <Button
                  onClick={() => setStep("create_org")}
                  disabled={!isProfileValid}
                  className="w-full sm:w-auto"
                >
                  Lanjutkan
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="w-full text-muted-foreground sm:w-auto"
                >
                  Nanti Saja
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* ─── Step: Choose Path (email not recognized) ─── */}
        {step === "choice" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <HelpCircle className="size-7 text-primary" />
              </div>
              <DialogTitle className="text-xl">
                Bagaimana Anda ingin melanjutkan?
              </DialogTitle>
              <DialogDescription>
                Email Anda tidak ditemukan di organisasi yang sudah terdaftar.
                Pilih salah satu opsi di bawah.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-3">
              <button
                type="button"
                onClick={() => setStep("email_mismatch")}
                className="flex cursor-pointer items-start gap-4 rounded-xl border-2 border-transparent bg-muted/50 p-4 text-left transition-all hover:border-muted-foreground/20 hover:bg-muted"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">
                    Sepertinya email saya salah
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Organisasi saya sudah terdaftar. Saya mungkin masuk dengan
                    email yang keliru.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep(registrationEnabled ? "profile" : "choice")}
                disabled={!registrationEnabled}
                className={cn(
                  "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                  registrationEnabled
                    ? "cursor-pointer border-primary/20 bg-primary/5 hover:border-primary hover:bg-primary/10"
                    : "cursor-not-allowed border-transparent bg-muted/40 opacity-60",
                )}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                  <Building2 className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">
                    Daftar organisasi baru
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Daftarkan perusahaan/organisasi Anda dan menjadi
                    Administrator. Mulai dengan masa uji coba (trial) gratis.
                  </p>
                  {registrationEnabled ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Rocket className="size-3.5" />
                      Langsung aktif — mode trial{" "}
                      {trialInfo ? `${trialDurationDays} hari` : ""}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs font-medium text-muted-foreground">
                      Pendaftaran organisasi baru sedang dinonaktifkan.
                    </div>
                  )}
                </div>
              </button>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("welcome")}
                className="w-full gap-1.5 text-muted-foreground sm:w-auto"
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-muted-foreground sm:w-auto"
              >
                Nanti Saja
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ─── Step: Email Mismatch (safeguard) ─── */}
        {step === "email_mismatch" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="size-8 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl">
                Periksa Kembali Email Anda
              </DialogTitle>
              <DialogDescription className="text-base">
                Jika organisasi Anda sudah terdaftar, email Anda seharusnya
                sudah didaftarkan oleh admin. Silakan keluar lalu masuk kembali
                menggunakan email yang benar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Tips:</p>
                <ul className="mt-1.5 space-y-1">
                  <li>
                    - Pastikan email yang Anda gunakan sama persis dengan yang
                    diberikan admin organisasi Anda.
                  </li>
                  <li>
                    - Jika ragu, tanyakan ke admin/HR organisasi Anda email mana
                    yang terdaftar.
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("choice")}
                className="w-full gap-1.5 text-muted-foreground sm:w-auto"
              >
                <ArrowLeft className="size-4" />
                Batalkan
              </Button>
              <Button
                onClick={() => void handleSignOut()}
                className="w-full gap-1.5 sm:w-auto"
              >
                <LogOut className="size-4" />
                Keluar & Masuk Ulang
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ─── Step 3a: Create New Organisation ─── */}
        {step === "create_org" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Buat Organisasi Baru
              </DialogTitle>
              <DialogDescription>
                Isi data organisasi Anda. Setelah memilih paket, pendaftaran
                akan ditinjau oleh Super Admin sebelum diaktifkan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="onb-org-name">
                  Nama Organisasi{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="onb-org-name"
                  placeholder="Contoh: PT Maju Jaya Indonesia"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="onb-org-address">
                  Alamat Organisasi{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="onb-org-address"
                  placeholder="Contoh: Jl. Industri No. 5, Surabaya"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="onb-org-email">
                    Email Organisasi{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="onb-org-email"
                    placeholder="admin@perusahaan.co.id"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="onb-org-phone">Telepon Organisasi</Label>
                  <Input
                    id="onb-org-phone"
                    placeholder="021-12345678"
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                    type="tel"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="onb-org-website">Website</Label>
                <Input
                  id="onb-org-website"
                  placeholder="https://www.perusahaan.co.id"
                  value={orgWebsite}
                  onChange={(e) => setOrgWebsite(e.target.value)}
                />
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary">
                  Langkah berikutnya: pilih paket langganan. Pendaftaran
                  organisasi baru memerlukan persetujuan Super Admin sebelum
                  aktif.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("profile")}
                className="w-full gap-1.5 text-muted-foreground sm:w-auto"
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <div className="flex flex-col gap-2 sm:w-auto">
                <Button
                  onClick={() => setStep("select_plan")}
                  disabled={!isNewOrgValid}
                  className="w-full sm:w-auto"
                >
                  Lanjut Pilih Paket
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="w-full text-muted-foreground sm:w-auto"
                >
                  Nanti Saja
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* ─── Step 4: Select Plan & Payment ─── */}
        {step === "select_plan" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Pilih Paket Trial</DialogTitle>
              <DialogDescription>
                Pilih paket yang ingin Anda coba. Selama {trialDurationDays} hari
                pertama semua gratis — tanpa pembayaran. Anda bisa berlangganan
                kapan saja sebelum trial berakhir.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Plan options */}
              {plans === undefined ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 w-full animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
              ) : selectablePlans.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada paket yang tersedia. Silakan hubungi administrator.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectablePlans.map((plan) => {
                    const paid = plan.pricePerUserMonth > 0;
                    const active = selectedPlanId === plan._id;
                    return (
                      <button
                        key={plan._id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan._id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                          active
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            active
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {active && (
                            <Check
                              className="size-3 text-primary-foreground"
                              strokeWidth={3}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{plan.name}</span>
                            {plan.isPopular && (
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                                Populer
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {plan.description}
                          </p>
                          <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="text-lg font-bold">
                              {plan.price}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {plan.priceUnit}
                            </span>
                          </div>
                        </div>
                        {!paid && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            Gratis
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Trial explainer — no upfront payment during trial */}
              {selectedPlan && (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <Rocket className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      Mulai gratis selama {trialDurationDays} hari
                    </p>
                  </div>
                  <ul className="space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0" />
                      Organisasi langsung aktif — tanpa menunggu persetujuan.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0" />
                      Tidak ada pembayaran di awal. Berlangganan kapan saja
                      sebelum trial berakhir.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0" />
                      Setelah trial berakhir, akses menjadi hanya-baca hingga
                      Anda berlangganan.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("create_org")}
                className="w-full gap-1.5 text-muted-foreground sm:w-auto"
                disabled={submitting}
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <div className="flex flex-col gap-2 sm:w-auto">
                <Button
                  onClick={handleSubmitCreateOrg}
                  disabled={!isPlanStepValid || submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Membuat...
                    </>
                  ) : (
                    "Buat Organisasi Trial"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full text-muted-foreground sm:w-auto"
                >
                  Nanti Saja
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* ─── Success: Trial organisation created (instantly active) ─── */}
        {step === "success_created" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-2xl">
                Organisasi Anda Siap!
              </DialogTitle>
              <DialogDescription className="text-base">
                Organisasi trial Anda langsung aktif. Anda kini menjadi
                Administrator dan bisa mulai menggunakan platform sekarang juga.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-semibold">Langkah selanjutnya:</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Rocket className="mt-0.5 size-4 shrink-0 text-primary" />
                    Mulai jelajahi fitur dan undang karyawan Anda
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                    Masa trial gratis berlaku selama {trialDurationDays} hari
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    Berlangganan kapan saja sebelum trial berakhir agar akses
                    tetap penuh
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Mulai Sekarang
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
