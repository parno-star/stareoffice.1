import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Clock, CheckCircle2, XCircle, AlertTriangle, PenLine, Trash2 } from "lucide-react";
import SignaturePad from "@/pages/letters/_components/SignaturePad.tsx";
import LetterQRCode from "@/pages/letters/_components/LetterQRCode.tsx";
import { ConvexError } from "convex/values";
import {
  dateInputToMonthDay,
  monthDayToDateInput,
} from "@/pages/celebrations/_lib/celebrations-utils.ts";
import {
  isMasaKerjaLabel,
  isUsiaLabel,
} from "@/pages/directory/_lib/directory-columns.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";

const schema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  birthday: z.string().optional(), // YYYY-MM-DD from date input, we'll extract MM-DD
  dateOfBirth: z.string().optional(), // full YYYY-MM-DD date of birth
  startDate: z.string().optional(), // YYYY-MM-DD
});

type FormValues = z.infer<typeof schema>;

const FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  jobTitle: "Jabatan",
  department: "Departemen",
  phone: "Telepon",
  location: "Lokasi",
  bio: "Tentang Saya",
  birthday: "Ulang Tahun",
  dateOfBirth: "Tanggal Lahir",
  startDate: "Mulai Bekerja",
};

export default function EditProfileDialog({
  currentUser,
}: {
  currentUser: Doc<"users">;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const updateProfile = useMutation(api.users.updateMyProfile);
  const updateMySignature = useMutation(api.users.updateMySignature);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const pendingChange = useQuery(api.users.getMyPendingProfileChange, {});
  const departments = useQuery(api.organization.listDepartments, {});
  const positionDirectory = useQuery(api.positionDirectory.list, {});
  const customFieldDefs = useQuery(api.directoryFields.list, {});

  // Custom directory fields the employee is allowed to edit. Computed fields
  // (Masa Kerja / Usia) are excluded because they are derived, never stored.
  const editableCustomFields = useMemo(
    () =>
      (customFieldDefs ?? []).filter(
        (f) =>
          f.employeeEditable &&
          !isMasaKerjaLabel(f.label) &&
          !isUsiaLabel(f.label),
      ),
    [customFieldDefs],
  );

  // Source job title options from the "Nama Jabatan" master data (composed
  // position directory entries). The user's current title is always kept
  // selectable so existing values are never lost.
  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of positionDirectory ?? []) {
      if (p.isActive && p.fullName.trim()) set.add(p.fullName.trim());
    }
    if (currentUser.jobTitle && currentUser.jobTitle.trim()) {
      set.add(currentUser.jobTitle.trim());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  }, [positionDirectory, currentUser.jobTitle]);

  // Roles that edit directly (no approval needed)
  const directEditRoles = ["super_admin", "admin", "hr_manager"];
  const needsApproval = !directEditRoles.includes(currentUser.role ?? "");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentUser.name ?? "",
      jobTitle: currentUser.jobTitle ?? "",
      department: currentUser.department ?? "",
      phone: currentUser.phone ?? "",
      location: currentUser.location ?? "",
      bio: currentUser.bio ?? "",
      birthday: monthDayToDateInput(currentUser.birthday),
      dateOfBirth: currentUser.dateOfBirth ?? "",
      startDate: currentUser.startDate ?? "",
    },
  });

  // Custom field values keyed by directoryFields._id, seeded from the user.
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => ({ ...(currentUser.customFields ?? {}) }),
  );

  const setCustomValue = (fieldId: string, value: string) =>
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const birthdayMMDD = values.birthday
        ? dateInputToMonthDay(values.birthday)
        : "";
      // Only send custom values for fields the employee may edit.
      const customFields: Record<string, string> = {};
      for (const def of editableCustomFields) {
        customFields[def._id] = (customValues[def._id] ?? "").trim();
      }
      await updateProfile({
        name: values.name,
        jobTitle: values.jobTitle ?? "",
        department: values.department ?? "",
        phone: values.phone ?? "",
        location: values.location ?? "",
        bio: values.bio ?? "",
        birthday: birthdayMMDD,
        dateOfBirth: values.dateOfBirth ?? "",
        startDate: values.startDate ?? "",
        customFields,
      });
      if (needsApproval) {
        toast.success("Permintaan perubahan profil telah dikirim untuk diverifikasi oleh HR Manager");
      } else {
        toast.success("Profil berhasil diperbarui");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui profil");
      } else {
        toast.error("Gagal memperbarui profil");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignature = async (data: string) => {
    setSavingSignature(true);
    try {
      await updateMySignature({ signatureData: data });
      toast.success("Tanda tangan berhasil disimpan");
      setSignatureDialogOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan tanda tangan");
      } else {
        toast.error("Gagal menyimpan tanda tangan");
      }
    } finally {
      setSavingSignature(false);
    }
  };

  const handleRemoveSignature = async () => {
    try {
      await updateMySignature({ signatureData: undefined });
      toast.success("Tanda tangan dihapus");
    } catch {
      toast.error("Gagal menghapus tanda tangan");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Pending change status banner */}
      {needsApproval && pendingChange && (
        <PendingStatusBanner
          status={pendingChange.status}
          changes={pendingChange.changes}
          rejectionReason={pendingChange.rejectionReason}
          fieldLabels={pendingChange.fieldLabels}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="gap-2">
            <Pencil className="size-4" />
            Edit Profil Saya
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profil</DialogTitle>
            <DialogDescription>
              {needsApproval
                ? "Perubahan data profil akan dikirim ke HR Manager untuk verifikasi sebelum diterapkan."
                : "Perbarui informasi Anda agar rekan kerja dapat menemukan Anda dengan mudah."}
            </DialogDescription>
          </DialogHeader>

          {needsApproval && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Perubahan data membutuhkan persetujuan HR Manager. Data tidak akan berubah sampai disetujui.
              </span>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {!needsApproval && (
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => {
                    const currentVal = field.value || "";
                    const selectValue = currentVal || "__empty__";
                    return (
                      <FormItem>
                        <FormLabel>Jabatan</FormLabel>
                        <Select
                          value={selectValue}
                          onValueChange={(val) => field.onChange(val === "__empty__" ? "" : val)}
                        >
                          <FormControl>
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue placeholder="Pilih jabatan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
                            {jobTitleOptions.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                )}

                {!needsApproval && (
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => {
                    const deptNames = (departments ?? []).map((d) => d.department.name);
                    const currentVal = field.value || "";
                    const showCurrent = currentVal && !deptNames.includes(currentVal);
                    const selectValue = currentVal || "__empty__";
                    return (
                      <FormItem>
                        <FormLabel>Departemen</FormLabel>
                        <Select
                          value={selectValue}
                          onValueChange={(val) => field.onChange(val === "__empty__" ? "" : val)}
                        >
                          <FormControl>
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue placeholder="Pilih departemen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
                            {showCurrent && (
                              <SelectItem value={currentVal}>{currentVal}</SelectItem>
                            )}
                            {(departments ?? []).map((d) => (
                              <SelectItem key={d.department._id} value={d.department.name}>
                                {d.department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telepon</FormLabel>
                      <FormControl>
                        <Input placeholder="+62 812 3456 7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lokasi</FormLabel>
                      <FormControl>
                        <Input placeholder="Kantor Pusat - Lantai 3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Ulang Tahun</FormLabel>
                      <FormControl>
                        <DateField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Ketik manual (dd/mm/yyyy) atau pilih dari kalender. Tahun
                        bisa diedit langsung.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!needsApproval && (
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mulai Bekerja</FormLabel>
                      <FormControl>
                        <DateField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Digunakan untuk anniversary kerja.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}
              </div>

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Lahir</FormLabel>
                    <FormControl>
                      <DateField
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Tanggal lahir lengkap dengan tahun.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tentang Saya</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ceritakan singkat tentang peran dan tanggung jawab Anda..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editableCustomFields.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data Tambahan
                  </p>
                  {editableCustomFields.map((def) => (
                    <CustomFieldInput
                      key={def._id}
                      def={def}
                      value={customValues[def._id] ?? ""}
                      onChange={(val) => setCustomValue(def._id, val)}
                    />
                  ))}
                </div>
              )}

              {/* Digital signature (default) section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2">
                  <PenLine className="size-4 text-primary" />
                  <p className="text-sm font-semibold">Tanda Tangan Digital</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tanda tangan ini otomatis muncul pada surat resmi di mana Anda menjadi{" "}
                  <span className="font-medium">pengirim</span>. Disimpan langsung, tidak perlu persetujuan.
                </p>
                {currentUser.defaultSignature ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center rounded-lg border bg-white p-3">
                      <img
                        src={currentUser.defaultSignature}
                        alt="Tanda tangan default"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer gap-1.5"
                        onClick={() => setSignatureDialogOpen(true)}
                      >
                        <PenLine className="size-3.5" />
                        Perbarui
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => void handleRemoveSignature()}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer gap-1.5"
                    onClick={() => setSignatureDialogOpen(true)}
                  >
                    <PenLine className="size-3.5" />
                    Tambah Tanda Tangan
                  </Button>
                )}

                {/* QR preview (contoh, informatif). Tidak berfungsi sebagai
                    verifikasi di sini — hanya memberi tahu pengguna bahwa
                    QR akan muncul otomatis pada surat mereka nanti. */}
                <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
                  <div className="shrink-0 rounded bg-white p-1.5">
                    <LetterQRCode code="CONTOH" size={64} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Contoh QR verifikasi.</span>{" "}
                    Pada surat resmi di mana Anda menjadi pengirim, sebuah QR code seperti ini
                    akan muncul otomatis di samping tanda tangan Anda untuk verifikasi keaslian.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Mengirim..."
                    : needsApproval
                      ? "Kirim untuk Verifikasi"
                      : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Signature dialog */}
      <Dialog
        open={signatureDialogOpen}
        onOpenChange={(o) => { if (!savingSignature) setSignatureDialogOpen(o); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tanda Tangan Digital</DialogTitle>
          </DialogHeader>
          <SignaturePad
            showRole={false}
            onSave={(data) => { void handleSaveSignature(data); }}
            onCancel={() => setSignatureDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomFieldInput({
  def,
  value,
  onChange,
}: {
  def: Doc<"directoryFields">;
  value: string;
  onChange: (value: string) => void;
}) {
  // Parse select options from the stored comma-separated string.
  const options =
    def.type === "select"
      ? (def.options ?? "")
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      : [];

  return (
    <FormItem>
      <FormLabel>{def.label}</FormLabel>
      {def.type === "date" ? (
        <DateField value={value} onChange={onChange} />
      ) : def.type === "select" ? (
        <Select
          value={value || "__empty__"}
          onValueChange={(val) => onChange(val === "__empty__" ? "" : val)}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder={`Pilih ${def.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={def.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Masukkan ${def.label.toLowerCase()}`}
        />
      )}
    </FormItem>
  );
}

function PendingStatusBanner({
  status,
  changes,
  rejectionReason,
  fieldLabels,
}: {
  status: string;
  changes: Record<string, string>;
  rejectionReason?: string;
  fieldLabels?: Record<string, string>;
}) {
  const labelFor = (key: string) =>
    fieldLabels?.[key] ?? FIELD_LABELS[key] ?? key;
  if (status === "pending") {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 p-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Menunggu Verifikasi HR Manager
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              Perubahan:{" "}
              {Object.keys(changes)
                .map((k) => labelFor(k))
                .join(", ")}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            Pending
          </Badge>
        </CardContent>
      </Card>
    );
  }

  if (status === "rejected") {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <CardContent className="flex items-start gap-3 p-3">
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Perubahan Ditolak
            </p>
            {rejectionReason && (
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                Alasan: {rejectionReason}
              </p>
            )}
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              Silakan edit ulang dan kirim kembali.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Ditolak
          </Badge>
        </CardContent>
      </Card>
    );
  }

  if (status === "approved") {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardContent className="flex items-start gap-3 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Perubahan Terakhir Disetujui
            </p>
            <p className="mt-0.5 text-xs text-green-700 dark:text-green-300">
              Data profil telah diperbarui sesuai permintaan.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Disetujui
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return null;
}
