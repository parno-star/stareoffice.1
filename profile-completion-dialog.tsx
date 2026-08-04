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
import { Textarea } from "@/components/ui/textarea.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { UserPen } from "lucide-react";
import {
  dateInputToMonthDay,
  monthDayToDateInput,
} from "@/pages/celebrations/_lib/celebrations-utils.ts";
import {
  isMasaKerjaLabel,
  isUsiaLabel,
} from "@/pages/directory/_lib/directory-columns.ts";

// Roles that edit their own profile directly (no HR approval needed).
const DIRECT_EDIT_ROLES = ["super_admin", "admin", "hr_manager"];

// Built-in profile fields an employee may complete themselves. Order controls
// how they appear in the dialog.
type BuiltinKind = "text" | "textarea" | "date" | "jobSelect" | "deptSelect";
type BuiltinFieldDef = {
  key:
    | "name"
    | "jobTitle"
    | "department"
    | "phone"
    | "location"
    | "birthday"
    | "dateOfBirth"
    | "startDate"
    | "bio";
  label: string;
  kind: BuiltinKind;
  placeholder?: string;
  hint?: string;
};

const BUILTIN_FIELDS: BuiltinFieldDef[] = [
  { key: "name", label: "Nama Lengkap", kind: "text", placeholder: "John Smith" },
  { key: "jobTitle", label: "Jabatan", kind: "jobSelect" },
  { key: "department", label: "Departemen", kind: "deptSelect" },
  { key: "phone", label: "Telepon", kind: "text", placeholder: "+62 812 3456 7890" },
  { key: "location", label: "Lokasi", kind: "text", placeholder: "Kantor Pusat - Lantai 3" },
  {
    key: "birthday",
    label: "Tanggal Ulang Tahun",
    kind: "date",
    hint: "Ketik manual (dd/mm/yyyy) atau pilih dari kalender.",
  },
  {
    key: "dateOfBirth",
    label: "Tanggal Lahir",
    kind: "date",
    hint: "Tanggal lahir lengkap dengan tahun.",
  },
  {
    key: "startDate",
    label: "Mulai Bekerja",
    kind: "date",
    hint: "Digunakan untuk anniversary kerja.",
  },
  {
    key: "bio",
    label: "Tentang Saya",
    kind: "textarea",
    placeholder: "Ceritakan singkat tentang peran dan tanggung jawab Anda...",
  },
];

/**
 * Non-blocking, skippable prompt shown to already-active employees whose
 * profile is missing self-editable information. Only fields that are (a) empty
 * AND (b) employee-editable are shown. Once every such field is filled (or a
 * change request is pending approval), the dialog stops appearing.
 */
export default function ProfileCompletionGate() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const pendingChange = useQuery(api.users.getMyPendingProfileChange, {});
  const customFieldDefs = useQuery(api.directoryFields.list, {});

  // Only recognized, active employees get this prompt.
  const eligible =
    !!currentUser &&
    !!currentUser.role &&
    currentUser.accountStatus === "active";

  const needsApproval =
    !!currentUser && !DIRECT_EDIT_ROLES.includes(currentUser.role ?? "");

  // A pending change means data is already on its way to being completed – do
  // not nag the employee again until it is resolved.
  const hasPendingChange =
    needsApproval && !!pendingChange && pendingChange.status === "pending";

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

  const missingBuiltins = useMemo(() => {
    if (!currentUser) return [];
    // Jabatan, Departemen, and Mulai Bekerja are HR-managed: only direct-edit
    // roles (HR/admin/super admin) may fill them themselves.
    const hrOnlyKeys = new Set(["jobTitle", "department", "startDate"]);
    return BUILTIN_FIELDS.filter((f) => {
      if (needsApproval && hrOnlyKeys.has(f.key)) return false;
      const raw = (currentUser[f.key] ?? "").toString().trim();
      return raw.length === 0;
    });
  }, [currentUser, needsApproval]);

  const missingCustomFields = useMemo(() => {
    if (!currentUser) return [];
    const values = currentUser.customFields ?? {};
    return editableCustomFields.filter(
      (def) => (values[def._id] ?? "").toString().trim().length === 0,
    );
  }, [currentUser, editableCustomFields]);

  const hasMissing =
    missingBuiltins.length > 0 || missingCustomFields.length > 0;

  // Data still loading, ineligible, complete, or already pending → render nothing.
  if (
    currentUser === undefined ||
    pendingChange === undefined ||
    customFieldDefs === undefined
  ) {
    return null;
  }
  if (!eligible || hasPendingChange || !hasMissing) {
    return null;
  }

  return (
    <ProfileCompletionDialog
      currentUser={currentUser}
      needsApproval={needsApproval}
      missingBuiltins={missingBuiltins}
      missingCustomFields={missingCustomFields}
    />
  );
}

function ProfileCompletionDialog({
  currentUser,
  needsApproval,
  missingBuiltins,
  missingCustomFields,
}: {
  currentUser: Doc<"users">;
  needsApproval: boolean;
  missingBuiltins: BuiltinFieldDef[];
  missingCustomFields: Doc<"directoryFields">[];
}) {
  const updateProfile = useMutation(api.users.updateMyProfile);
  const departments = useQuery(api.organization.listDepartments, {});
  const positionDirectory = useQuery(api.positionDirectory.list, {});

  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local editable state for only the missing built-in fields.
  const [builtinValues, setBuiltinValues] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const f of missingBuiltins) init[f.key] = "";
      return init;
    },
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const def of missingCustomFields) init[def._id] = "";
      return init;
    },
  );

  const setBuiltin = (key: string, value: string) =>
    setBuiltinValues((prev) => ({ ...prev, [key]: value }));
  const setCustom = (id: string, value: string) =>
    setCustomValues((prev) => ({ ...prev, [id]: value }));

  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of positionDirectory ?? []) {
      if (p.isActive && p.fullName.trim()) set.add(p.fullName.trim());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  }, [positionDirectory]);

  const hasAnyInput =
    Object.values(builtinValues).some((v) => v.trim().length > 0) ||
    Object.values(customValues).some((v) => v.trim().length > 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: {
        name?: string;
        jobTitle?: string;
        department?: string;
        phone?: string;
        location?: string;
        bio?: string;
        birthday?: string;
        dateOfBirth?: string;
        startDate?: string;
        customFields?: Record<string, string>;
      } = {};

      for (const f of missingBuiltins) {
        const raw = (builtinValues[f.key] ?? "").trim();
        if (raw.length === 0) continue;
        if (f.key === "birthday") {
          payload.birthday = dateInputToMonthDay(raw);
        } else {
          payload[f.key] = raw;
        }
      }

      if (missingCustomFields.length > 0) {
        const customFields: Record<string, string> = {};
        for (const def of missingCustomFields) {
          const raw = (customValues[def._id] ?? "").trim();
          if (raw.length > 0) customFields[def._id] = raw;
        }
        if (Object.keys(customFields).length > 0) {
          payload.customFields = customFields;
        }
      }

      await updateProfile(payload);
      if (needsApproval) {
        toast.success(
          "Data telah dikirim untuk diverifikasi oleh HR Manager.",
        );
      } else {
        toast.success("Data profil berhasil dilengkapi.");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan data.");
      } else {
        toast.error("Gagal menyimpan data.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <UserPen className="size-5 text-primary" />
          </div>
          <DialogTitle>Lengkapi Data Profil Anda</DialogTitle>
          <DialogDescription>
            {needsApproval
              ? "Beberapa data profil Anda masih kosong. Melengkapinya membantu rekan kerja mengenal Anda. Perubahan akan diverifikasi HR Manager terlebih dahulu."
              : "Beberapa data profil Anda masih kosong. Melengkapinya membantu rekan kerja mengenal Anda. Anda bisa melakukannya nanti."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {missingBuiltins.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              {f.kind === "textarea" ? (
                <Textarea
                  rows={3}
                  placeholder={f.placeholder}
                  value={builtinValues[f.key] ?? ""}
                  onChange={(e) => setBuiltin(f.key, e.target.value)}
                />
              ) : f.kind === "date" ? (
                <DateField
                  value={
                    f.key === "birthday"
                      ? monthDayToDateInput(builtinValues[f.key] || undefined)
                      : builtinValues[f.key] ?? ""
                  }
                  onChange={(val) => setBuiltin(f.key, val)}
                />
              ) : f.kind === "jobSelect" ? (
                <Select
                  value={builtinValues[f.key] || "__empty__"}
                  onValueChange={(val) =>
                    setBuiltin(f.key, val === "__empty__" ? "" : val)
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Pilih jabatan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
                    {jobTitleOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.kind === "deptSelect" ? (
                <Select
                  value={builtinValues[f.key] || "__empty__"}
                  onValueChange={(val) =>
                    setBuiltin(f.key, val === "__empty__" ? "" : val)
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Pilih departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
                    {(departments ?? []).map((d) => (
                      <SelectItem
                        key={d.department._id}
                        value={d.department.name}
                      >
                        {d.department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={builtinValues[f.key] ?? ""}
                  onChange={(e) => setBuiltin(f.key, e.target.value)}
                />
              )}
              {f.hint && (
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              )}
            </div>
          ))}

          {missingCustomFields.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data Tambahan
              </p>
              {missingCustomFields.map((def) => (
                <CustomFieldInput
                  key={def._id}
                  def={def}
                  value={customValues[def._id] ?? ""}
                  onChange={(val) => setCustom(def._id, val)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Nanti saja
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !hasAnyInput}
          >
            {saving
              ? "Menyimpan..."
              : needsApproval
                ? "Kirim untuk Verifikasi"
                : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const options =
    def.type === "select"
      ? (def.options ?? "")
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      : [];

  return (
    <div className="space-y-2">
      <Label>{def.label}</Label>
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
    </div>
  );
}
