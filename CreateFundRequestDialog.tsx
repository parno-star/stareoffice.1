import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { X, ArrowUp, ArrowDown, Send, Save, UserPlus, Upload, FileText, Paperclip, Loader2 } from "lucide-react";
import { formatCurrency, getAllCategoryOptions } from "../_lib/fund-utils.ts";
import ApproverPickerDialog from "./ApproverPickerDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const schema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  purpose: z.string().min(10, "Jelaskan tujuan pengajuan (min. 10 karakter)"),
  category: z.string().min(1, "Pilih kategori"),
  amountRaw: z.string().min(1, "Masukkan jumlah"),
  neededBy: z.string().min(1, "Pilih tanggal dibutuhkan"),
});

type FormValues = z.infer<typeof schema>;

type AttachmentItem = {
  storageId: Id<"_storage">;
  fileName: string;
  label: string;
  mimeType?: string;
  size?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function guessLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/(rab|anggaran|budget)/.test(lower)) return "RAB";
  if (/(kwitansi|kuitansi|receipt)/.test(lower)) return "Kwitansi";
  if (/(struk|nota|invoice|faktur)/.test(lower)) return "Struk / Invoice";
  if (/(quote|penawaran|quotation)/.test(lower)) return "Penawaran";
  if (/(tor|proposal)/.test(lower)) return "Proposal / TOR";
  return "Dokumen";
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LABEL_SUGGESTIONS = [
  "RAB",
  "Kwitansi",
  "Struk / Invoice",
  "Penawaran",
  "Proposal / TOR",
  "Surat Tugas",
  "Dokumen",
];

export default function CreateFundRequestDialog({ open, onClose }: Props) {
  const createMutation = useMutation(api.fundRequests.create);
  const submitMutation = useMutation(api.fundRequests.submit);
  const generateUploadUrl = useMutation(api.fundRequests.generateUploadUrl);
  const users = useQuery(api.users.listEmployees, {});
  const customCategories = useQuery(api.fundRequests.listCategories, {});
  const categoryOptions = getAllCategoryOptions(customCategories ?? []);

  const [approverIds, setApproverIds] = useState<Id<"users">[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      purpose: "",
      category: "",
      amountRaw: "",
      neededBy: "",
    },
  });

  const addApprover = (id: Id<"users">) => {
    setApproverIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeApprover = (id: Id<"users">) => {
    setApproverIds((prev) => prev.filter((x) => x !== id));
  };

  const approverUsers = (users ?? []).filter((u) => approverIds.includes(u._id));
  approverUsers.sort((a, b) => approverIds.indexOf(a._id) - approverIds.indexOf(b._id));

  const moveApprover = (id: Id<"users">, direction: "up" | "down") => {
    setApproverIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const formatAmountInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits ? new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)) : "";
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads: AttachmentItem[] = [];
      for (const file of Array.from(files)) {
        // Max 15 MB per file
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`"${file.name}" terlalu besar (maks. 15 MB)`);
          continue;
        }
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) {
          toast.error(`Gagal mengunggah ${file.name}`);
          continue;
        }
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        uploads.push({
          storageId,
          fileName: file.name,
          label: guessLabel(file.name),
          mimeType: file.type || undefined,
          size: file.size,
        });
      }
      if (uploads.length > 0) {
        setAttachments((prev) => [...prev, ...uploads]);
        toast.success(`${uploads.length} dokumen berhasil diunggah`);
      }
    } catch {
      toast.error("Gagal mengunggah dokumen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (storageId: Id<"_storage">) => {
    setAttachments((prev) => prev.filter((a) => a.storageId !== storageId));
  };

  const updateAttachmentLabel = (storageId: Id<"_storage">, label: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.storageId === storageId ? { ...a, label } : a)),
    );
  };

  const handleClose = () => {
    form.reset();
    setApproverIds([]);
    setAttachments([]);
    setAmountDisplay("");
    onClose();
  };

  const onSubmit = async (values: FormValues, sendNow: boolean) => {
    if (approverIds.length === 0) {
      toast.error("Tambahkan minimal 1 penyetuju");
      return;
    }
    const parsedAmount = parseInt(values.amountRaw.replace(/\D/g, ""), 10);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Jumlah dana tidak valid");
      return;
    }
    setIsSubmitting(true);
    try {
      const id = await createMutation({
        title: values.title,
        purpose: values.purpose,
        category: values.category,
        amount: parsedAmount,
        neededBy: values.neededBy,
        approverIds,
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({
                storageId: a.storageId,
                fileName: a.fileName,
                label: a.label || undefined,
                mimeType: a.mimeType,
                size: a.size,
              }))
            : undefined,
      });
      if (sendNow) {
        await submitMutation({ id });
        toast.success("Pengajuan dana berhasil dikirim untuk disetujui");
      } else {
        toast.success("Draft pengajuan dana tersimpan");
      }
      handleClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan pengajuan");
      } else {
        toast.error("Gagal menyimpan pengajuan");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-bold">Buat Pengajuan Dana</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" type="always">
          <Form {...form}>
            <div className="space-y-5">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Judul Pengajuan</FormLabel>
                    <FormControl>
                      <Input placeholder="Mis. Pengadaan ATK Kantor Q2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category + Amount row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih kategori" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((opt) => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountRaw"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jumlah Dana (IDR)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0"
                          value={amountDisplay}
                          onChange={(e) => {
                            const formatted = formatAmountInput(e.target.value);
                            setAmountDisplay(formatted);
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      {amountDisplay ? (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(parseInt(amountDisplay.replace(/\D/g, ""), 10) || 0)}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Needed By */}
              <FormField
                control={form.control}
                name="neededBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Dibutuhkan</FormLabel>
                    <FormControl>
                      <DateField value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Purpose */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tujuan / Justifikasi</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Jelaskan tujuan penggunaan dana secara rinci…"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attachments section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-semibold">
                    Dokumen Pendukung
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (RAB, kwitansi, struk, dll.)
                    </span>
                  </FormLabel>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Unggah Dokumen
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />

                {attachments.length === 0 ? (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Paperclip className="size-5" />
                    <span>
                      {uploading ? "Mengunggah…" : "Klik atau seret file ke sini"}
                    </span>
                    <span className="text-[11px]">
                      PDF, JPG, PNG, DOC, XLS — maks. 15 MB per file
                    </span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {attachments.map((a) => (
                      <div
                        key={a.storageId}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium">
                            {a.fileName}
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              value={a.label}
                              onChange={(e) =>
                                updateAttachmentLabel(a.storageId, e.target.value)
                              }
                              placeholder="Label (mis. RAB)"
                              list={`label-suggestions-${a.storageId}`}
                              className="h-7 text-xs"
                            />
                            <datalist id={`label-suggestions-${a.storageId}`}>
                              {LABEL_SUGGESTIONS.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                            {a.size ? (
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatBytes(a.size)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.storageId)}
                          aria-label="Hapus dokumen"
                          className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      Tambah dokumen lain
                    </button>
                  </div>
                )}
              </div>

              {/* Approvers section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-semibold">
                    Rantai Persetujuan
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (urutan dari level 1)
                    </span>
                  </FormLabel>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                  >
                    <UserPlus className="size-4" />
                    Tambah Penyetuju
                  </Button>
                </div>

                {approverUsers.length > 0 ? (
                  <div className="space-y-1.5">
                    {approverUsers.map((u, idx) => (
                      <div
                        key={u._id}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <Badge variant="secondary" className="min-w-[28px] justify-center text-xs">
                          {idx + 1}
                        </Badge>
                        <Avatar className="size-8 shrink-0">
                          {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} /> : null}
                          <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u.name ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.jobTitle ?? "Tanpa jabatan"}
                            {u.department ? ` · ${u.department}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveApprover(u._id, "up")}
                            disabled={idx === 0}
                            aria-label="Naikkan level"
                            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveApprover(u._id, "down")}
                            disabled={idx === approverUsers.length - 1}
                            aria-label="Turunkan level"
                            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeApprover(u._id)}
                            aria-label="Hapus penyetuju"
                            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <UserPlus className="size-4" />
                    Belum ada penyetuju — klik untuk menambahkan
                  </button>
                )}
              </div>
            </div>
          </Form>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-4 shrink-0">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={form.handleSubmit((v) => onSubmit(v, false))}
            >
              <Save className="size-4" />
              Simpan Draft
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={form.handleSubmit((v) => onSubmit(v, true))}
            >
              {isSubmitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="size-4" />
              )}
              Ajukan Sekarang
            </Button>
          </div>
        </div>
      </DialogContent>

      <ApproverPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addApprover}
        selectedIds={approverIds}
      />
    </Dialog>
  );
}
