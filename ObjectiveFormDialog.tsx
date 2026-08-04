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
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  OKR_SCOPE_OPTIONS,
  CATEGORY_OPTIONS,
  generateCurrentPeriodOptions,
} from "../_lib/okr-utils.ts";

type Objective = Doc<"objectives"> & {
  owner?: { _id: Id<"users">; name?: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective?: Objective | null;
  currentUser: Doc<"users">;
  defaultScope?: "company" | "department" | "team" | "individual";
  isAdmin: boolean;
};

export default function ObjectiveFormDialog({
  open,
  onOpenChange,
  objective,
  currentUser,
  defaultScope = "individual",
  isAdmin,
}: Props) {
  const isEdit = Boolean(objective);
  const createObjective = useMutation(api.okr.objectives.createObjective);
  const updateObjective = useMutation(api.okr.objectives.updateObjective);
  const users = useQuery(api.users.listEmployees, {});
  const departments = useQuery(api.organization.listDepartments, {});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("");
  const [scope, setScope] = useState<string>(defaultScope);
  const [category, setCategory] = useState<string>("strategic");
  const [ownerId, setOwnerId] = useState<string>(currentUser._id);
  const [department, setDepartment] = useState<string>("");
  const [parentId, setParentId] = useState<string>("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const periodOptions = useMemo(() => generateCurrentPeriodOptions(), []);
  const parentOptions = useQuery(
    api.okr.objectives.listParentOptions,
    period ? { period } : "skip",
  );

  useEffect(() => {
    if (!open) return;
    if (objective) {
      setTitle(objective.title);
      setDescription(objective.description ?? "");
      setPeriod(objective.period);
      setScope(objective.scope);
      setCategory(objective.category);
      setOwnerId(objective.ownerId as string);
      setDepartment(objective.department ?? "");
      setParentId(
        objective.parentObjectiveId
          ? (objective.parentObjectiveId as string)
          : "none",
      );
      setStartDate(objective.startDate ?? "");
      setEndDate(objective.endDate ?? "");
    } else {
      setTitle("");
      setDescription("");
      setPeriod(periodOptions[0]?.value ?? "");
      setScope(defaultScope);
      setCategory("strategic");
      setOwnerId(currentUser._id as string);
      setDepartment(currentUser.department ?? "");
      setParentId("none");
      setStartDate("");
      setEndDate("");
    }
  }, [open, objective, currentUser, periodOptions, defaultScope]);

  const canPickOwner = isAdmin;
  const needsDepartment = scope === "department";

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul objective wajib diisi");
      return;
    }
    if (!period) {
      toast.error("Pilih periode");
      return;
    }
    if (needsDepartment && !department.trim()) {
      toast.error("Pilih departemen");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && objective) {
        await updateObjective({
          objectiveId: objective._id,
          title: title.trim(),
          description: description.trim() || undefined,
          period,
          scope,
          ownerId: ownerId as Id<"users">,
          department: needsDepartment ? department.trim() : undefined,
          category,
          parentObjectiveId:
            parentId && parentId !== "none"
              ? (parentId as Id<"objectives">)
              : null,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        toast.success("OKR diperbarui");
      } else {
        await createObjective({
          title: title.trim(),
          description: description.trim() || undefined,
          period,
          scope,
          ownerId: ownerId as Id<"users">,
          department: needsDepartment ? department.trim() : undefined,
          category,
          parentObjectiveId:
            parentId && parentId !== "none"
              ? (parentId as Id<"objectives">)
              : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        toast.success("OKR dibuat");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Filter scopes - non-admins can only create individual objectives
  const availableScopes = isAdmin
    ? OKR_SCOPE_OPTIONS
    : OKR_SCOPE_OPTIONS.filter((s) => s.value === "individual");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Objective" : "Buat Objective Baru"}
          </DialogTitle>
          <DialogDescription>
            Tulis tujuan kualitatif yang inspiratif. Anda akan menambahkan Key
            Results setelah membuat objective.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="okr-title">Judul Objective</Label>
            <Input
              id="okr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Menjadi perusahaan pilihan karyawan di industri"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="okr-description">Deskripsi (opsional)</Label>
            <Textarea
              id="okr-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kenapa objective ini penting? Seperti apa hasilnya?"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Periode</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Owner</Label>
              <Select
                value={ownerId}
                onValueChange={setOwnerId}
                disabled={!canPickOwner}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsDepartment ? (
              <div className="grid gap-2">
                <Label>Departemen</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Pilih departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d.department._id} value={d.department.name}>
                        {d.department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Parent OKR (opsional)</Label>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={!parentOptions || parentOptions.length === 0}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Tidak ada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {(parentOptions ?? [])
                    .filter((o) => !objective || o._id !== objective._id)
                    .map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="okr-start">Mulai (opsional)</Label>
              <DateField
                id="okr-start"
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="okr-end">Selesai (opsional)</Label>
              <DateField
                id="okr-end"
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat OKR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
