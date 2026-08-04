import { useRef, useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Settings,
  ShoppingCart,
  Receipt,
  Coins,
  Building2,
  Plane,
  MoreHorizontal,
  Send,
  Save,
  Upload,
  FileText,
  Paperclip,
  Loader2,
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  User,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  formatCurrency,
  REQUEST_TYPE_OPTIONS,
  getRequestTypeConfig,
  type RequestTypeKey,
  type RequestTypeField,
} from "../_lib/fund-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { ChainMatchResult } from "@/convex/financeApprovalEngine.ts";

// ─── Request Type Icons ──────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  operational: Settings,
  procurement: ShoppingCart,
  reimbursement: Receipt,
  petty_cash: Coins,
  capital: Building2,
  travel: Plane,
  custom: MoreHorizontal,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function guessLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/(rab|anggaran|budget)/.test(lower)) return "RAB";
  if (/(kwitansi|kuitansi|receipt)/.test(lower)) return "Kwitansi";
  if (/(struk|nota|invoice|faktur)/.test(lower)) return "Struk / Invoice";
  if (/(quote|penawaran|quotation)/.test(lower)) return "Penawaran";
  if (/(tor|proposal)/.test(lower)) return "Proposal / TOR";
  if (/(surat|tugas|travel)/.test(lower)) return "Surat Tugas";
  return "Dokumen";
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)) : "";
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  requestType: z.string().min(1, "Pilih jenis pengajuan"),
  title: z.string().min(3, "Judul minimal 3 karakter"),
  purpose: z.string().min(10, "Jelaskan tujuan pengajuan (min. 10 karakter)"),
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

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "type", label: "Jenis" },
  { key: "detail", label: "Detail" },
  { key: "attachments", label: "Lampiran" },
  { key: "preview", label: "Preview" },
] as const;

export default function UnifiedFundRequestForm({ open, onClose }: Props) {
  const createMutation = useMutation(api.fundRequests.create);
  const submitMutation = useMutation(api.fundRequests.submit);
  const generateUploadUrl = useMutation(api.fundRequests.generateUploadUrl);

  const [step, setStep] = useState(0);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typeSpecificData, setTypeSpecificData] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requestType: "",
      title: "",
      purpose: "",
      amountRaw: "",
      neededBy: "",
    },
  });

  const watchRequestType = form.watch("requestType");
  const watchAmountRaw = form.watch("amountRaw");
  const parsedAmount = parseInt((watchAmountRaw || "").replace(/\D/g, ""), 10) || 0;
  const typeConfig = watchRequestType ? getRequestTypeConfig(watchRequestType) : null;

  // Preview approval chain
  const chainPreview = useQuery(
    api.financeApprovalEngine.previewApprovalChain,
    watchRequestType && parsedAmount > 0
      ? { requestType: watchRequestType, amount: parsedAmount }
      : "skip",
  );

  // ─── Type-specific field handlers ──────────────────────────────────────────
  const updateTypeField = (key: string, value: string) => {
    setTypeSpecificData((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Attachment handlers ───────────────────────────────────────────────────
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads: AttachmentItem[] = [];
      for (const file of Array.from(files)) {
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

  // ─── Navigation ────────────────────────────────────────────────────────────
  const canGoNext = useMemo(() => {
    if (step === 0) return !!watchRequestType;
    if (step === 1) {
      const title = form.getValues("title");
      const purpose = form.getValues("purpose");
      return title.length >= 3 && purpose.length >= 10 && parsedAmount > 0 && !!form.getValues("neededBy");
    }
    return true;
  }, [step, watchRequestType, form, parsedAmount]);

  const goNext = () => {
    if (step === 1) {
      // Validate detail fields before moving
      form.trigger(["title", "purpose", "amountRaw", "neededBy"]).then((valid) => {
        if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
      });
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Reset ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    form.reset();
    setStep(0);
    setAttachments([]);
    setAmountDisplay("");
    setTypeSpecificData({});
    onClose();
  };

  // ─── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (sendNow: boolean) => {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    const amount = parseInt(values.amountRaw.replace(/\D/g, ""), 10);
    if (!amount || amount <= 0) {
      toast.error("Jumlah dana tidak valid");
      return;
    }
    setIsSubmitting(true);
    try {
      // Map requestType to category for backward compatibility
      const categoryMap: Record<string, string> = {
        operational: "operational",
        procurement: "procurement",
        reimbursement: "other",
        petty_cash: "other",
        capital: "other",
        travel: "travel",
        custom: "other",
      };
      const category = categoryMap[values.requestType] ?? values.requestType;

      const id = await createMutation({
        title: values.title,
        purpose: values.purpose,
        category,
        requestType: values.requestType,
        amount,
        neededBy: values.neededBy,
        typeSpecificData: Object.keys(typeSpecificData).length > 0
          ? JSON.stringify(typeSpecificData)
          : undefined,
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

  // ─── Render Type-Specific Field ────────────────────────────────────────────
  const renderTypeField = (field: RequestTypeField) => {
    const value = typeSpecificData[field.key] ?? "";
    if (field.type === "select" && field.options) {
      return (
        <div key={field.key} className="space-y-1.5">
          <label className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label>
          <Select value={value} onValueChange={(v) => updateTypeField(field.key, v)}>
            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-1.5">
          <label className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label>
          <Textarea
            value={value}
            onChange={(e) => updateTypeField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        </div>
      );
    }
    if (field.type === "date") {
      return (
        <div key={field.key} className="space-y-1.5">
          <label className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label>
          <DateField
            value={value}
            onChange={(v) => updateTypeField(field.key, v)}
          />
        </div>
      );
    }
    return (
      <div key={field.key} className="space-y-1.5">
        <label className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label>
        <Input
          type="text"
          value={value}
          onChange={(e) => updateTypeField(field.key, e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-bold">Buat Pengajuan Keuangan</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                      ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="size-4 flex items-center justify-center rounded-full text-[10px] font-bold bg-background/20">
                    {i < step ? <CheckCircle2 className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="size-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" type="always">
          <Form {...form}>
            {/* Step 0: Request Type Selection */}
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pilih jenis pengajuan keuangan yang ingin Anda buat:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REQUEST_TYPE_OPTIONS.map((rt) => {
                    const Icon = TYPE_ICONS[rt.key] ?? MoreHorizontal;
                    const isSelected = watchRequestType === rt.key;
                    return (
                      <button
                        key={rt.key}
                        type="button"
                        onClick={() => form.setValue("requestType", rt.key, { shouldValidate: true })}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:border-muted-foreground/30 hover:bg-muted/30",
                        )}
                      >
                        <div className={cn("rounded-lg p-2 shrink-0", rt.bg)}>
                          <Icon className={cn("size-5", rt.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{rt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {rt.description}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Detail Form */}
            {step === 1 && typeConfig && (
              <div className="space-y-5">
                {/* Type badge */}
                <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", typeConfig.bg, typeConfig.color)}>
                  {(() => { const Icon = TYPE_ICONS[typeConfig.key] ?? MoreHorizontal; return <Icon className="size-4" />; })()}
                  {typeConfig.label}
                </div>

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

                {/* Amount + Needed By */}
                <div className="grid grid-cols-2 gap-4">
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
                        {amountDisplay && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(parseInt(amountDisplay.replace(/\D/g, ""), 10) || 0)}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>

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
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Type-specific fields */}
                {typeConfig.fields.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Detail {typeConfig.label}
                      </p>
                      {typeConfig.fields.map(renderTypeField)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Attachments */}
            {step === 2 && typeConfig && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Dokumen Pendukung</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload dokumen yang diperlukan untuk pengajuan ini
                    </p>
                  </div>
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
                    Unggah
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

                {/* Suggested attachments */}
                {typeConfig.suggestedAttachments.length > 0 && attachments.length === 0 && (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Dokumen yang disarankan untuk {typeConfig.label}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {typeConfig.suggestedAttachments.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {attachments.length === 0 ? (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Paperclip className="size-6" />
                    <span>{uploading ? "Mengunggah…" : "Klik atau seret file ke sini"}</span>
                    <span className="text-[11px]">PDF, JPG, PNG, DOC, XLS — maks. 15 MB per file</span>
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
                          <p className="truncate text-sm font-medium">{a.fileName}</p>
                          <div className="flex items-center gap-2">
                            <Input
                              value={a.label}
                              onChange={(e) => updateAttachmentLabel(a.storageId, e.target.value)}
                              placeholder="Label"
                              className="h-7 text-xs"
                            />
                            {a.size && (
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatBytes(a.size)}
                              </span>
                            )}
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
                      {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      Tambah dokumen lain
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Preview & Submit */}
            {step === 3 && typeConfig && (
              <div className="space-y-5">
                {/* Summary card */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-lg p-2", typeConfig.bg)}>
                      {(() => { const Icon = TYPE_ICONS[typeConfig.key] ?? MoreHorizontal; return <Icon className={cn("size-5", typeConfig.color)} />; })()}
                    </div>
                    <div>
                      <p className="font-semibold">{form.getValues("title")}</p>
                      <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-primary/5 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Jumlah Dana</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(parsedAmount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dibutuhkan: {form.getValues("neededBy")}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Tujuan</p>
                    <p className="whitespace-pre-wrap">{form.getValues("purpose")}</p>
                  </div>

                  {/* Type-specific data summary */}
                  {Object.keys(typeSpecificData).length > 0 && typeConfig.fields.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Detail {typeConfig.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {typeConfig.fields.map((f) => {
                          const val = typeSpecificData[f.key];
                          if (!val) return null;
                          let displayVal = val;
                          if (f.options) {
                            const opt = f.options.find((o) => o.value === val);
                            displayVal = opt?.label ?? val;
                          }
                          return (
                            <div key={f.key}>
                              <p className="text-xs text-muted-foreground">{f.label}</p>
                              <p className="font-medium">{displayVal}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attachments summary */}
                  {attachments.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <Paperclip className="size-3" />
                        {attachments.length} Dokumen Pendukung
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {attachments.map((a) => (
                          <Badge key={a.storageId} variant="secondary" className="text-xs gap-1">
                            <FileText className="size-3" />
                            {a.label || a.fileName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Approval Chain Preview */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="size-3.5" />
                    Jalur Persetujuan
                  </p>
                  <ApprovalChainPreview preview={chainPreview} />
                </div>
              </div>
            )}
          </Form>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t px-6 py-4 shrink-0">
          <div>
            {step > 0 ? (
              <Button variant="ghost" onClick={goBack} disabled={isSubmitting}>
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Batal
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={!canGoNext}>
                Lanjut
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => onSubmit(false)}
                >
                  <Save className="size-4" />
                  Simpan Draft
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => onSubmit(true)}
                >
                  {isSubmitting ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Ajukan Sekarang
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval Chain Preview Sub-component ────────────────────────────────────
function ApprovalChainPreview({ preview }: { preview: ChainMatchResult | null | undefined }) {
  if (preview === undefined) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-center">
        <Loader2 className="size-5 mx-auto animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-2">Memuat jalur persetujuan...</p>
      </div>
    );
  }
  if (preview === null) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="size-4" />
          <p className="text-sm font-medium">Tidak ada rantai persetujuan yang cocok</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Hubungi admin untuk mengkonfigurasi rantai persetujuan untuk jenis dan nilai ini.
          Pengajuan masih bisa disimpan sebagai draft.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Link2 className="size-3" />
          {preview.chainName}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {preview.approvers.length} level persetujuan
        </span>
      </div>
      <div className="space-y-1.5">
        {preview.approvers.map((a, idx) => (
          <div
            key={`${a.level}-${a.userId}`}
            className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
          >
            <div className="flex size-6 items-center justify-center rounded-full border bg-background text-xs font-bold shrink-0">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium truncate">{a.userName}</p>
              </div>
              <p className="text-xs text-muted-foreground">{a.label}</p>
              {a.delegatedFromName && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <ArrowRight className="size-3" />
                  Delegasi dari {a.delegatedFromName}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-3" />
                SLA: {a.slaHours}j
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
