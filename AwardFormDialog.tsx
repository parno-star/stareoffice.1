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
import { Switch } from "@/components/ui/switch.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { AwardListItem } from "@/convex/awards";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Check,
  ChevronsUpDown,
  Trophy,
  Upload,
  X,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  CATEGORY_CONFIG,
  CATEGORY_VALUES,
  MAX_CERTIFICATE_SIZE,
  getInitials,
  type AwardCategory,
} from "../_lib/awards-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AwardListItem | null;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AwardFormDialog({
  open,
  onOpenChange,
  editing,
}: Props) {
  const isEdit = editing !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AwardCategory>("employee_of_month");
  const [recipientId, setRecipientId] = useState<string>("");
  const [period, setPeriod] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [awardedOn, setAwardedOn] = useState(todayIso());
  const [bonusAmount, setBonusAmount] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const employees = useQuery(api.users.listEmployees, open ? {} : "skip");
  const generateUploadUrl = useMutation(
    api.awards.generateCertificateUploadUrl,
  );
  const createAward = useMutation(api.awards.createAward);
  const updateAward = useMutation(api.awards.updateAward);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setCategory(editing.category as AwardCategory);
      setRecipientId(editing.recipientId);
      setPeriod(editing.period ?? "");
      setPeriodLabel(editing.periodLabel ?? "");
      setAwardedOn(editing.awardedOn);
      setBonusAmount(
        editing.bonusAmount !== undefined ? String(editing.bonusAmount) : "",
      );
      setIsFeatured(editing.isFeatured ?? false);
    } else {
      setTitle("");
      setDescription("");
      setCategory("employee_of_month");
      setRecipientId("");
      setPeriod("");
      setPeriodLabel("");
      setAwardedOn(todayIso());
      setBonusAmount("");
      setIsFeatured(false);
    }
    setFile(null);
    setProgress(0);
  }, [open, editing]);

  // Auto-fill title based on category + period for convenience
  useEffect(() => {
    if (isEdit) return;
    const cfg = CATEGORY_CONFIG[category];
    if (!title && periodLabel) {
      setTitle(`${cfg.label} - ${periodLabel}`);
    } else if (!title) {
      setTitle(cfg.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const selectedUser = (employees ?? []).find((e) => e._id === recipientId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_CERTIFICATE_SIZE) {
      toast.error("Ukuran file terlalu besar. Maksimal 5 MB.");
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Judul penghargaan wajib diisi");
      return;
    }
    if (!recipientId) {
      toast.error("Pilih penerima penghargaan");
      return;
    }
    if (!awardedOn) {
      toast.error("Tanggal penghargaan wajib diisi");
      return;
    }
    const bonus = bonusAmount
      ? Number(bonusAmount.replace(/[^0-9.]/g, ""))
      : undefined;
    if (bonus !== undefined && (!Number.isFinite(bonus) || bonus < 0)) {
      toast.error("Jumlah bonus tidak valid");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      let certificateStorageId: Id<"_storage"> | undefined;
      if (file) {
        const uploadUrl = await generateUploadUrl({});
        const storageId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const { storageId: id } = JSON.parse(xhr.responseText) as {
                  storageId: string;
                };
                resolve(id);
              } catch {
                reject(new Error("Gagal membaca respons upload"));
              }
            } else {
              reject(new Error(`Upload gagal (${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload gagal"));
          xhr.send(file);
        });
        certificateStorageId = storageId as Id<"_storage">;
      }

      if (isEdit && editing) {
        await updateAward({
          awardId: editing._id,
          title: trimmedTitle,
          description: description.trim() || undefined,
          category,
          period: period.trim() || undefined,
          periodLabel: periodLabel.trim() || undefined,
          awardedOn,
          bonusAmount: bonus,
          certificateStorageId,
          isFeatured,
        });
        toast.success("Penghargaan diperbarui");
      } else {
        await createAward({
          title: trimmedTitle,
          description: description.trim() || undefined,
          category,
          recipientId: recipientId as Id<"users">,
          period: period.trim() || undefined,
          periodLabel: periodLabel.trim() || undefined,
          awardedOn,
          bonusAmount: bonus,
          certificateStorageId,
          isFeatured,
        });
        toast.success("Penghargaan berhasil dibuat!");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan penghargaan");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal menyimpan penghargaan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            {isEdit ? "Edit Penghargaan" : "Berikan Penghargaan"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail penghargaan."
              : "Pilih karyawan dan kategori untuk memberikan penghargaan resmi."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category picker */}
          <div className="space-y-2">
            <Label>Kategori Penghargaan</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORY_VALUES.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const Icon = cfg.icon;
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    disabled={submitting}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("size-5", cfg.iconColor)} />
                    <span className="text-xs font-medium leading-tight">
                      {cfg.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_CONFIG[category].description}
            </p>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>Penerima Penghargaan</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  role="combobox"
                  disabled={submitting || isEdit}
                  className={cn(
                    "w-full justify-between border bg-background",
                    !recipientId && "text-muted-foreground",
                  )}
                >
                  {selectedUser ? (
                    <span className="flex items-center gap-2">
                      <Avatar className="size-5">
                        {selectedUser.avatarUrl ? (
                          <AvatarImage src={selectedUser.avatarUrl} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-[10px]">
                          {getInitials(selectedUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      {selectedUser.name ?? "Tanpa nama"}
                    </span>
                  ) : (
                    "Pilih karyawan..."
                  )}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Cari nama karyawan..." />
                  <CommandList>
                    <CommandEmpty>Tidak ada karyawan ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {(employees ?? []).map((emp) => (
                        <CommandItem
                          key={emp._id}
                          value={emp.name ?? emp._id}
                          onSelect={() => {
                            setRecipientId(emp._id);
                            setPickerOpen(false);
                          }}
                          className="gap-2"
                        >
                          <Avatar className="size-6">
                            {emp.avatarUrl ? (
                              <AvatarImage src={emp.avatarUrl} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-[10px]">
                              {getInitials(emp.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                              {emp.name ?? "Tanpa nama"}
                            </span>
                            {emp.jobTitle ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {emp.jobTitle}
                              </span>
                            ) : null}
                          </div>
                          {recipientId === emp._id ? (
                            <Check className="size-4 text-primary" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                Penerima tidak dapat diubah setelah dibuat.
              </p>
            ) : null}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="award-title">Judul Penghargaan</Label>
            <Input
              id="award-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Employee of the Month - April 2026"
              disabled={submitting}
              maxLength={150}
            />
          </div>

          {/* Period */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="award-period-label">
                Label Periode (opsional)
              </Label>
              <Input
                id="award-period-label"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="April 2026, Q1 2026, 2026"
                disabled={submitting}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="award-date">Tanggal Diberikan</Label>
              <DateField
                id="award-date"
                value={awardedOn}
                onChange={(v) => setAwardedOn(v)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="award-desc">Deskripsi & Alasan</Label>
            <Textarea
              id="award-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan alasan penghargaan ini diberikan..."
              disabled={submitting}
              maxLength={2000}
            />
          </div>

          {/* Bonus */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="award-bonus">Bonus (opsional, IDR)</Label>
              <Input
                id="award-bonus"
                type="number"
                min="0"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="1000000"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Featured</Label>
              <div className="flex h-9 items-center gap-3 rounded-md border bg-background px-3">
                <Switch
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                  disabled={submitting}
                />
                <span className="text-sm text-muted-foreground">
                  Tampilkan di hero
                </span>
              </div>
            </div>
          </div>

          {/* Certificate upload */}
          <div className="space-y-2">
            <Label>Sertifikat / Foto (opsional)</Label>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => setFile(null)}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : editing?.certificateUrl ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="size-8 text-muted-foreground" />
                <div className="flex-1 text-sm text-muted-foreground">
                  Sertifikat saat ini terlampir
                </div>
                <label
                  htmlFor="award-cert-upload"
                  className="cursor-pointer rounded-md border px-3 py-1 text-xs hover:bg-muted"
                >
                  Ganti
                </label>
                <Input
                  id="award-cert-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </div>
            ) : (
              <label
                htmlFor="award-cert-upload-new"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-6 text-center transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Klik untuk unggah sertifikat
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maks. 5 MB (JPG, PNG, PDF)
                  </p>
                </div>
                <Input
                  id="award-cert-upload-new"
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>
            )}
          </div>

          {submitting && file ? (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Mengunggah... {progress}%
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
              : isEdit
                ? "Simpan Perubahan"
                : "Berikan Penghargaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
