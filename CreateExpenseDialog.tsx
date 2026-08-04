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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, X, FileText } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  MAX_RECEIPT_SIZE,
  formatCurrency,
  formatFileSize,
  getCategoryIcon,
} from "../_lib/expense-utils.ts";
import { Progress } from "@/components/ui/progress.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CreateExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [cashAdvanceId, setCashAdvanceId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const policies = useQuery(api.expensePolicies.list, open ? {} : "skip");
  const categories = useQuery(
    api.expenseCategories.list,
    open ? {} : "skip",
  );
  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.isActive),
    [categories],
  );
  const myAdvances = useQuery(
    api.cashAdvances.listApprovedForMe,
    open ? {} : "skip",
  );

  // Default the category to the first active one once the list loads.
  useEffect(() => {
    if (activeCategories.length > 0 && !category) {
      setCategory(activeCategories[0]!.key);
    }
  }, [activeCategories, category]);

  const activePolicy = policies?.find(
    (p) => p.category === category && p.isActive,
  );

  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);
  const createExpense = useMutation(api.expenses.create);

  const reset = () => {
    setTitle("");
    setAmount("");
    setCategory("");
    setExpenseDate(todayIso());
    setDescription("");
    setFile(null);
    setCashAdvanceId("none");
    setSubmitting(false);
    setProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_RECEIPT_SIZE) {
      toast.error(
        `Ukuran file terlalu besar. Maksimal ${formatFileSize(MAX_RECEIPT_SIZE)}.`,
      );
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      toast.error("Judul pengeluaran wajib diisi");
      return;
    }
    const numAmount = Number(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    if (description.trim().length === 0) {
      toast.error("Deskripsi pengeluaran wajib diisi");
      return;
    }
    if (!category) {
      toast.error("Pilih kategori pengeluaran");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      let receiptStorageId: Id<"_storage"> | undefined;
      let receiptFileName: string | undefined;

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
        receiptStorageId = storageId as Id<"_storage">;
        receiptFileName = file.name;
      }

      await createExpense({
        title: trimmedTitle,
        category,
        amount: numAmount,
        expenseDate,
        description: description.trim(),
        receiptStorageId,
        receiptFileName,
        cashAdvanceId:
          cashAdvanceId !== "none"
            ? (cashAdvanceId as Id<"cashAdvances">)
            : undefined,
      });

      toast.success("Pengajuan reimbursement berhasil dikirim");
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim pengajuan");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal mengirim pengajuan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          setOpen(v);
          if (!v) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 cursor-pointer">
          <Plus className="size-4" />
          Ajukan Reimbursement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pengajuan Reimbursement Baru</DialogTitle>
          <DialogDescription>
            Isi detail pengeluaran dan unggah bukti (opsional) untuk
            mempermudah proses persetujuan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exp-title">Judul</Label>
            <Input
              id="exp-title"
              placeholder="Perjalanan dinas ke Jakarta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Nominal (IDR)</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="1000"
                placeholder="250000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Tanggal</Label>
              <DateField
                id="exp-date"
                value={expenseDate}
                onChange={(v) => setExpenseDate(v)}
                disabled={submitting}
                max={todayIso()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  return (
                    <SelectItem key={cat.key} value={cat.key}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {activePolicy ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Kebijakan kategori
                </p>
                <ul className="mt-1 space-y-0.5">
                  {activePolicy.maxAmountPerRequest ? (
                    <li>
                      Maks. {formatCurrency(activePolicy.maxAmountPerRequest)}{" "}
                      per pengajuan
                    </li>
                  ) : null}
                  {activePolicy.monthlyLimitPerUser ? (
                    <li>
                      Batas bulanan:{" "}
                      {formatCurrency(activePolicy.monthlyLimitPerUser)}
                    </li>
                  ) : null}
                  {activePolicy.receiptRequiredAbove ? (
                    <li>
                      Kuitansi wajib di atas{" "}
                      {formatCurrency(activePolicy.receiptRequiredAbove)}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          {myAdvances && myAdvances.length > 0 ? (
            <div className="space-y-2">
              <Label>Settle uang muka (opsional)</Label>
              <Select
                value={cashAdvanceId}
                onValueChange={setCashAdvanceId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih uang muka terkait" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Tidak terkait uang muka
                  </SelectItem>
                  {myAdvances.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.title} - {formatCurrency(a.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Jika pengeluaran ini memakai uang muka yang sudah dicairkan,
                kaitkan agar penyelesaian lebih mudah.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="exp-desc">Deskripsi</Label>
            <Textarea
              id="exp-desc"
              rows={3}
              placeholder="Jelaskan keperluan pengeluaran ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Bukti / Kuitansi (opsional)</Label>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
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
            ) : (
              <label
                htmlFor="receipt-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-6 text-center transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Klik untuk unggah kuitansi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maks. {formatFileSize(MAX_RECEIPT_SIZE)} (JPG, PNG, PDF)
                  </p>
                </div>
                <Input
                  id="receipt-upload"
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
            onClick={() => {
              setOpen(false);
              reset();
            }}
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
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
