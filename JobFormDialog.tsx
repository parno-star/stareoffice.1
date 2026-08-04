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
import { Label } from "@/components/ui/label.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  EMPLOYMENT_TYPE_CONFIG,
  LEVEL_CONFIG,
  type EmploymentType,
  type JobLevel,
} from "../_lib/job-utils.ts";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  mode?: "create" | "edit";
  job?: Doc<"jobPostings"> | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_CONFIG) as Array<EmploymentType>;
const LEVELS = Object.keys(LEVEL_CONFIG) as Array<JobLevel>;

export default function JobFormDialog({
  mode = "create",
  job = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("fulltime");
  const [level, setLevel] = useState<JobLevel>("mid");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const employees = useQuery(
    api.users.listEmployees,
    open ? { department: "all" } : "skip",
  );
  const createJob = useMutation(api.jobs.create);
  const updateJob = useMutation(api.jobs.update);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && job) {
      setTitle(job.title);
      setDepartment(job.department);
      setLocation(job.location);
      setEmploymentType(job.employmentType as EmploymentType);
      setLevel(job.level as JobLevel);
      setDescription(job.description);
      setResponsibilities(job.responsibilities);
      setRequirements(job.requirements);
      setSalaryMin(job.salaryMin ? String(job.salaryMin) : "");
      setSalaryMax(job.salaryMax ? String(job.salaryMax) : "");
      setClosingDate(job.closingDate ?? "");
      setHiringManagerId(job.hiringManagerId ?? "none");
    } else if (mode === "create") {
      setTitle("");
      setDepartment("");
      setLocation("Kantor Pusat");
      setEmploymentType("fulltime");
      setLevel("mid");
      setDescription("");
      setResponsibilities("- Tanggung jawab pertama\n- Tanggung jawab kedua");
      setRequirements("- Persyaratan pertama\n- Persyaratan kedua");
      setSalaryMin("");
      setSalaryMax("");
      setClosingDate("");
      setHiringManagerId("none");
    }
  }, [open, mode, job]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul lowongan wajib diisi");
      return;
    }
    if (!department.trim()) {
      toast.error("Departemen wajib diisi");
      return;
    }
    if (!location.trim()) {
      toast.error("Lokasi kerja wajib diisi");
      return;
    }
    if (description.trim().length < 20) {
      toast.error("Deskripsi lowongan terlalu singkat");
      return;
    }

    const min = salaryMin ? Number(salaryMin) : undefined;
    const max = salaryMax ? Number(salaryMax) : undefined;
    if (min !== undefined && !Number.isFinite(min)) {
      toast.error("Gaji minimum tidak valid");
      return;
    }
    if (max !== undefined && !Number.isFinite(max)) {
      toast.error("Gaji maksimum tidak valid");
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      toast.error("Gaji minimum tidak boleh lebih besar dari maksimum");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        department: department.trim(),
        location: location.trim(),
        employmentType,
        level,
        description: description.trim(),
        responsibilities: responsibilities.trim(),
        requirements: requirements.trim(),
        salaryMin: min,
        salaryMax: max,
        closingDate: closingDate || undefined,
        hiringManagerId:
          hiringManagerId === "none"
            ? undefined
            : (hiringManagerId as Id<"users">),
      };

      if (mode === "edit" && job) {
        await updateJob({ id: job._id, ...payload });
        toast.success("Lowongan diperbarui");
      } else {
        await createJob(payload);
        toast.success("Lowongan berhasil dipublikasikan");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan lowongan");
      } else {
        toast.error("Gagal menyimpan lowongan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const defaultTrigger =
    mode === "edit" ? (
      <Button size="sm" variant="ghost" className="gap-2 cursor-pointer">
        <Pencil className="size-4" />
        Edit Lowongan
      </Button>
    ) : (
      <Button className="gap-2 cursor-pointer">
        <Plus className="size-4" />
        Posting Lowongan
      </Button>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) setOpen(v);
      }}
    >
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Lowongan" : "Posting Lowongan Internal"}
          </DialogTitle>
          <DialogDescription>
            Bagikan peluang karier internal agar karyawan dapat melamar dari
            portal ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="job-title">Judul Posisi</Label>
            <Input
              id="job-title"
              placeholder="Senior Frontend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job-dept">Departemen</Label>
              <Input
                id="job-dept"
                placeholder="Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={submitting}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-location">Lokasi</Label>
              <Input
                id="job-location"
                placeholder="Kantor Jakarta / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={submitting}
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipe Pekerjaan</Label>
              <Select
                value={employmentType}
                onValueChange={(v) => setEmploymentType(v as EmploymentType)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => {
                    const cfg = EMPLOYMENT_TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4" />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level Posisi</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as JobLevel)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LEVEL_CONFIG[l].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="job-smin">Gaji Min (opsional)</Label>
              <Input
                id="job-smin"
                type="number"
                min="0"
                step="100000"
                placeholder="10000000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-smax">Gaji Max (opsional)</Label>
              <Input
                id="job-smax"
                type="number"
                min="0"
                step="100000"
                placeholder="15000000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-close">Batas Lamar</Label>
              <DateField
                id="job-close"
                value={closingDate}
                onChange={(v) => setClosingDate(v)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hiring Manager (opsional)</Label>
            <Select
              value={hiringManagerId}
              onValueChange={setHiringManagerId}
              disabled={submitting || employees === undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih hiring manager..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {(employees ?? []).map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? "Tanpa nama"}
                    {u.department ? ` · ${u.department}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-desc">Deskripsi Posisi</Label>
            <Textarea
              id="job-desc"
              rows={4}
              placeholder="Ringkasan peran dan dampaknya bagi tim..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-resp">Tanggung Jawab (markdown)</Label>
            <Textarea
              id="job-resp"
              rows={5}
              placeholder="- Mendesain dan mengembangkan fitur...\n- Berkolaborasi dengan tim produk..."
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              disabled={submitting}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-req">Persyaratan (markdown)</Label>
            <Textarea
              id="job-req"
              rows={5}
              placeholder="- Minimal 3 tahun pengalaman...\n- Menguasai React & TypeScript..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              disabled={submitting}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Perubahan"
                : "Posting Lowongan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
