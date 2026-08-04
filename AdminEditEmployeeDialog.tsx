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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  dateInputToMonthDay,
  monthDayToDateInput,
} from "@/pages/celebrations/_lib/celebrations-utils.ts";
import { Plus, Camera, Loader2, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import {
  computeAge,
  computeTenure,
  isMasaKerjaLabel,
  isUsiaLabel,
} from "../_lib/directory-columns.ts";
import EmployeeDocumentsManager from "./EmployeeDocumentsManager.tsx";
import { ROLE_LABELS, isRole } from "@/convex/roles";

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

const schema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  nip: z.string().max(50).optional(),
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  birthday: z.string().optional(),
  dateOfBirth: z.string().optional(),
  startDate: z.string().optional(),
  managerId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NO_MANAGER_VALUE = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Doc<"users">;
};

export default function AdminEditEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [addingDept, setAddingDept] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [creatingDept, setCreatingDept] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateEmployee = useMutation(api.users.updateEmployeeByAdmin);
  const createDepartment = useMutation(api.organization.createDepartment);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateAvatar = useMutation(api.users.updateEmployeeAvatarByAdmin);
  // Load other employees as possible managers (exclude the employee themselves)
  const employees = useQuery(api.users.listEmployees, {});
  const departments = useQuery(api.organization.listDepartments, {});
  const positionDirectory = useQuery(api.positionDirectory.list, {});
  const customFieldDefs = useQuery(api.directoryFields.list, {});

  // Local state for custom field values, keyed by field id.
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    (employee.customFields ?? {}) as Record<string, string>,
  );

  // Source job title options from the "Nama Jabatan" master data (composed
  // position directory entries). The employee's current title is always kept
  // selectable so existing values are never lost.
  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of positionDirectory ?? []) {
      if (p.isActive && p.fullName.trim()) set.add(p.fullName.trim());
    }
    if (employee.jobTitle && employee.jobTitle.trim()) {
      set.add(employee.jobTitle.trim());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  }, [positionDirectory, employee.jobTitle]);

  // Map each active Nama Jabatan to its configured auto-assignable default role.
  // super_admin/admin are never auto-assigned, so they are filtered out.
  const jobTitleToDefaultRole = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of positionDirectory ?? []) {
      if (!p.isActive || !p.fullName.trim()) continue;
      const role = p.defaultRole?.trim();
      if (role && role !== "super_admin" && role !== "admin") {
        map.set(p.fullName.trim().toLowerCase(), role);
      }
    }
    return map;
  }, [positionDirectory]);

  // Administrator / Super Admin roles are never auto-changed by a jabatan change.
  const isProtectedRole = employee.role === "admin" || employee.role === "super_admin";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: employee.name ?? "",
      nip: employee.nip ?? "",
      email: employee.email ?? "",
      jobTitle: employee.jobTitle ?? "",
      department: employee.department ?? "",
      phone: employee.phone ?? "",
      location: employee.location ?? "",
      bio: employee.bio ?? "",
      birthday: monthDayToDateInput(employee.birthday),
      dateOfBirth: employee.dateOfBirth ?? "",
      startDate: employee.startDate ?? "",
      managerId: employee.managerId ?? NO_MANAGER_VALUE,
    },
  });

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload gagal");
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
      await updateAvatar({ userId: employee._id, storageId });
      toast.success("Foto karyawan diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah foto");
      } else {
        toast.error("Gagal mengunggah foto");
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await updateAvatar({ userId: employee._id, storageId: null });
      toast.success("Foto karyawan dihapus");
    } catch {
      toast.error("Gagal menghapus foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreateDept = async () => {
    const name = newDept.trim();
    if (!name) return;
    setCreatingDept(true);
    try {
      // A color is required by the backend; use a neutral default.
      await createDepartment({ name, color: "#64748b" });
      form.setValue("department", name, { shouldDirty: true });
      setNewDept("");
      setAddingDept(false);
      toast.success(`Departemen "${name}" ditambahkan`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menambah departemen");
      } else {
        toast.error("Gagal menambah departemen");
      }
    } finally {
      setCreatingDept(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    // "Masa Kerja" and "Usia" are never stored — they are always computed live
    // (from the start date / date of birth) wherever they are displayed. So we
    // drop any value for them here.
    const computedCustomValues: Record<string, string> = { ...customValues };
    for (const def of customFieldDefs ?? []) {
      if (isMasaKerjaLabel(def.label) || isUsiaLabel(def.label)) {
        delete computedCustomValues[def._id];
      }
    }

    // Validate required custom fields (auto-computed Masa Kerja / Usia are exempt)
    for (const def of customFieldDefs ?? []) {
      if (isMasaKerjaLabel(def.label) || isUsiaLabel(def.label)) continue;
      if (def.required && !(computedCustomValues[def._id] ?? "").trim()) {
        toast.error(`Field "${def.label}" wajib diisi`);
        return;
      }
    }
    setSaving(true);
    try {
      const birthdayMMDD = values.birthday
        ? dateInputToMonthDay(values.birthday)
        : "";
      const managerId =
        !values.managerId || values.managerId === NO_MANAGER_VALUE
          ? null
          : (values.managerId as Id<"users">);

      await updateEmployee({
        userId: employee._id,
        name: values.name,
        nip: values.nip ?? "",
        email: values.email ?? "",
        jobTitle: values.jobTitle ?? "",
        department: values.department ?? "",
        phone: values.phone ?? "",
        location: values.location ?? "",
        bio: values.bio ?? "",
        birthday: birthdayMMDD,
        dateOfBirth: values.dateOfBirth ?? "",
        startDate: values.startDate ?? "",
        managerId,
        customFields: computedCustomValues,
      });
      toast.success("Data karyawan berhasil diperbarui");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui data");
      } else {
        toast.error("Gagal memperbarui data karyawan");
      }
    } finally {
      setSaving(false);
    }
  };

  const managerOptions = (employees ?? []).filter(
    (u) => u._id !== employee._id,
  );

  // Live-watch the start date so masa kerja recalculates as the admin edits it.
  const watchedStartDate = form.watch("startDate");
  const watchedDateOfBirth = form.watch("dateOfBirth");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Data Karyawan</DialogTitle>
          <DialogDescription>
            Perbarui informasi {employee.name ?? "karyawan"}. Perubahan akan
            langsung terlihat di seluruh sistem.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                {employee.avatarUrl ? (
                  <AvatarImage src={employee.avatarUrl} alt={employee.name ?? ""} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(employee.name).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatarFile(file);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {employee.avatarUrl ? "Ganti foto" : "Unggah foto"}
                  </Button>
                  {employee.avatarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRemoveAvatar()}
                      disabled={uploadingAvatar}
                      className="cursor-pointer text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Format JPG/PNG, maksimal 5MB.
                </p>
              </div>
            </div>

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

            <FormField
              control={form.control}
              name="nip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIP</FormLabel>
                  <FormControl>
                    <Input placeholder="199001012020011001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="nama@perusahaan.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
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
                      {addingDept ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newDept}
                            onChange={(e) => setNewDept(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleCreateDept();
                              }
                            }}
                            placeholder="Nama departemen baru"
                            autoFocus
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleCreateDept()}
                            disabled={creatingDept || !newDept.trim()}
                          >
                            {creatingDept ? "..." : "Simpan"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAddingDept(false);
                              setNewDept("");
                            }}
                            disabled={creatingDept}
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingDept(true)}
                          className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Plus className="size-3" />
                          Tambah departemen baru
                        </button>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => {
                  const currentVal = field.value || "";
                  const selectValue = currentVal || "__empty__";
                  const matchedRole = currentVal
                    ? jobTitleToDefaultRole.get(currentVal.trim().toLowerCase())
                    : undefined;
                  const changed = currentVal.trim() !== (employee.jobTitle ?? "").trim();
                  // Show a hint when picking a jabatan (that differs from the
                  // current one) whose default role would be applied on save.
                  const showRoleHint =
                    !isProtectedRole &&
                    changed &&
                    !!matchedRole &&
                    isRole(matchedRole) &&
                    matchedRole !== employee.role;
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
                      {showRoleHint && matchedRole && isRole(matchedRole) && (
                        <FormDescription className="text-xs text-primary">
                          Peran akan otomatis menjadi{" "}
                          <span className="font-medium">
                            {ROLE_LABELS[matchedRole]}
                          </span>{" "}
                          setelah disimpan. Anda bisa mengubahnya di tab Pengguna
                          &amp; Peran.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telepon</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+62 812 3456 7890"
                        {...field}
                      />
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
                      <Input
                        placeholder="Kantor Pusat - Lantai 3"
                        {...field}
                      />
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
                      Digunakan untuk menghitung masa kerja & anniversary.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    Tanggal lahir lengkap dengan tahun (untuk administrasi).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="managerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atasan Langsung</FormLabel>
                  <Select
                    value={field.value || NO_MANAGER_VALUE}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Pilih atasan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem
                        value={NO_MANAGER_VALUE}
                        className="cursor-pointer"
                      >
                        Tidak ada atasan
                      </SelectItem>
                      {managerOptions.map((u) => (
                        <SelectItem
                          key={u._id}
                          value={u._id}
                          className="cursor-pointer"
                        >
                          {u.name ?? "Tanpa Nama"}
                          {u.jobTitle ? ` — ${u.jobTitle}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    Menentukan jalur pelaporan dan persetujuan karyawan.
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
                  <FormLabel>Tentang</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ceritakan singkat tentang peran dan tanggung jawab..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {customFieldDefs && customFieldDefs.length > 0 && (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-semibold">Informasi Tambahan</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {customFieldDefs.map((def) => {
                    const value = customValues[def._id] ?? "";
                    const setValue = (v: string) =>
                      setCustomValues((prev) => ({ ...prev, [def._id]: v }));
                    const options = (def.options ?? "")
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean);
                    // "MASA KERJA" and "USIA" are calculated automatically (from
                    // the start date / date of birth), so they are shown as
                    // read-only computed values.
                    const isTenureField = isMasaKerjaLabel(def.label);
                    const isAgeField = isUsiaLabel(def.label);
                    const isComputedField = isTenureField || isAgeField;
                    const computedValue = isTenureField
                      ? computeTenure(watchedStartDate) ?? "Isi tanggal mulai bekerja"
                      : computeAge(watchedDateOfBirth) ?? "Isi tanggal lahir";
                    const computedHint = isTenureField
                      ? "Dihitung otomatis dari tanggal mulai bekerja."
                      : "Dihitung otomatis dari tanggal lahir.";
                    return (
                      <div key={def._id} className="space-y-1.5">
                        <Label>
                          {def.label}
                          {def.required && !isComputedField && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        {isComputedField ? (
                          <>
                            <Input
                              value={computedValue}
                              readOnly
                              disabled
                              className="bg-muted/50"
                            />
                            <p className="text-xs text-muted-foreground">
                              {computedHint}
                            </p>
                          </>
                        ) : def.type === "select" ? (
                          <Select
                            value={value || "__empty__"}
                            onValueChange={(v) =>
                              setValue(v === "__empty__" ? "" : v)
                            }
                          >
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue placeholder={`Pilih ${def.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">
                                -- Tidak ada --
                              </SelectItem>
                              {options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : def.type === "date" ? (
                          <DateField
                            value={value}
                            onChange={(v) => setValue(v)}
                          />
                        ) : (
                          <Input
                            type={def.type === "number" ? "number" : "text"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={def.label}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <EmployeeDocumentsManager userId={employee._id} />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
