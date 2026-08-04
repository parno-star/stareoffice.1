import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { UserPlus } from "lucide-react";
import { ROLE_VALUES, ROLE_LABELS } from "@/convex/roles";

// Roles an admin can assign to a new employee. super_admin (platform owner) and
// admin (single admin per org, managed via Transfer Admin) are excluded.
const ASSIGNABLE_ROLES = ROLE_VALUES.filter(
  (r) => r !== "super_admin" && r !== "admin",
);

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  nip: z.string().optional(),
  email: z.string().min(1, "Email wajib diisi").email("Email tidak valid"),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  dateOfBirth: z.string().optional(),
  managerId: z.string().optional(),
  role: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: Id<"users">) => void;
};

export default function AddEmployeeDialog({ open, onOpenChange, onCreated }: Props) {
  const createEmployee = useMutation(api.users.createEmployeeByAdmin);
  const allUsers = useQuery(api.organization.listAll, {});
  const positionDirectory = useQuery(api.positionDirectory.list, {});
  const departments = useQuery(api.organization.listDepartments, {});
  const [saving, setSaving] = useState(false);
  // Whether the currently-selected role was auto-filled from the chosen jabatan.
  const [roleFromJabatan, setRoleFromJabatan] = useState(false);

  // Source job title options from the "Nama Jabatan" master data
  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of positionDirectory ?? []) {
      if (p.isActive && p.fullName.trim()) set.add(p.fullName.trim());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  }, [positionDirectory]);

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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      nip: "",
      email: "",
      jobTitle: "",
      department: "",
      phone: "",
      location: "",
      startDate: "",
      dateOfBirth: "",
      managerId: "none",
      role: "employee",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const id = await createEmployee({
        name: values.name,
        nip: values.nip || undefined,
        email: values.email || undefined,
        jobTitle: values.jobTitle || undefined,
        department: values.department || undefined,
        phone: values.phone || undefined,
        location: values.location || undefined,
        startDate: values.startDate || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        managerId:
          values.managerId && values.managerId !== "none"
            ? (values.managerId as Id<"users">)
            : undefined,
        role: values.role || "employee",
      });
      toast.success(`Karyawan "${values.name}" berhasil ditambahkan`);
      form.reset();
      setRoleFromJabatan(false);
      onOpenChange(false);
      onCreated?.(id);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan karyawan");
      } else {
        toast.error("Gagal menambahkan karyawan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Tambah Karyawan Baru
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Nama */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Budi Santoso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* NIP */}
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

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="budi@perusahaan.com" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Email dipakai untuk mencocokkan akun karyawan saat login.
                    Pastikan benar agar tidak terjadi data ganda.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Peran / Hak Akses */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peran / Hak Akses</FormLabel>
                  <Select
                    value={field.value || "employee"}
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Manual change means the role no longer follows the jabatan.
                      setRoleFromJabatan(false);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Pilih peran" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {roleFromJabatan
                      ? "Peran terisi otomatis dari jabatan yang dipilih. Anda tetap bisa mengubahnya di sini."
                      : "Peran menentukan menu & akses karyawan. Karyawan langsung aktif dengan peran ini saat pertama kali masuk—tanpa pendaftaran ulang."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Jabatan */}
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jabatan</FormLabel>
                    <Select
                      value={field.value ? field.value : "__empty__"}
                      onValueChange={(val) => {
                        const jobTitle = val === "__empty__" ? "" : val;
                        field.onChange(jobTitle);
                        // Auto-fill the role from the jabatan's default role.
                        const defaultRole = jobTitle
                          ? jobTitleToDefaultRole.get(jobTitle.toLowerCase())
                          : undefined;
                        if (defaultRole) {
                          form.setValue("role", defaultRole, {
                            shouldDirty: true,
                          });
                          setRoleFromJabatan(true);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
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
                )}
              />

              {/* Departemen */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departemen</FormLabel>
                    <Select
                      value={field.value ? field.value : "__empty__"}
                      onValueChange={(val) => field.onChange(val === "__empty__" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Pilih departemen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__empty__">-- Tidak ada --</SelectItem>
                        {(departments ?? []).map((d) => (
                          <SelectItem key={d.department._id} value={d.department.name}>
                            {d.department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Telepon */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. Telepon</FormLabel>
                    <FormControl>
                      <Input placeholder="08123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lokasi */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Input placeholder="Jakarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tanggal Mulai */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Mulai Kerja</FormLabel>
                    <FormControl>
                      <DateField
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tanggal Lahir (lengkap dengan tahun) */}
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Atasan */}
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atasan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih atasan..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">— Tanpa Atasan —</SelectItem>
                        {(allUsers ?? []).map((u) => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.name ?? "Tanpa Nama"}{u.jobTitle ? ` · ${u.jobTitle}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Tambah Karyawan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
