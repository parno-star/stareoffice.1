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
import { Switch } from "@/components/ui/switch.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Paperclip, X, Pin } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  POLICY_CATEGORIES,
  type PolicyCategoryKey,
} from "../_lib/policy-utils.ts";
import type { PolicyListItem, PolicyWithAuthor } from "@/convex/policies.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: PolicyListItem | PolicyWithAuthor | null;
  fullPolicy?: PolicyWithAuthor | null; // supplies content + attachment when editing
};

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024; // 15MB

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export default function PolicyEditorDialog({
  open,
  onOpenChange,
  editing,
  fullPolicy,
}: Props) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PolicyCategoryKey>("code_of_conduct");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [expiresAt, setExpiresAt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [requiresAck, setRequiresAck] = useState(true);
  const [bumpAck, setBumpAck] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [keepAttachment, setKeepAttachment] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const createPolicy = useMutation(api.policies.create);
  const updatePolicy = useMutation(api.policies.update);
  const generateUploadUrl = useMutation(api.policies.generateUploadUrl);

  const isEdit = editing !== null;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setSummary(editing.summary);
      setContent(fullPolicy?.content ?? "");
      setCategory(editing.category as PolicyCategoryKey);
      setVersion(editing.version);
      setEffectiveDate(editing.effectiveDate);
      const exp = (editing as PolicyWithAuthor).expiresAt ?? "";
      setExpiresAt(exp);
      setTagsInput(editing.tags.join(", "));
      setRequiresAck(editing.requiresAcknowledgment);
      setBumpAck(true);
      setIsPinned(editing.isPinned ?? false);
      setIsDraft(editing.status === "draft");
      setFile(null);
      setKeepAttachment(true);
    } else {
      setTitle("");
      setSummary("");
      setContent("");
      setCategory("code_of_conduct");
      setVersion("1.0");
      setEffectiveDate(todayIso());
      setExpiresAt("");
      setTagsInput("");
      setRequiresAck(true);
      setBumpAck(true);
      setIsPinned(false);
      setIsDraft(false);
      setFile(null);
      setKeepAttachment(true);
    }
    setUploading(false);
    setProgress(0);
  }, [open, editing, fullPolicy]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_SIZE) {
      toast.error("Ukuran lampiran maksimal 15 MB");
      e.target.value = "";
      return;
    }
    setFile(f);
    setKeepAttachment(false);
  };

  const uploadAttachment = async (): Promise<Id<"_storage"> | undefined> => {
    if (!file) return undefined;
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
            const parsed = JSON.parse(xhr.responseText) as { storageId: string };
            resolve(parsed.storageId);
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
    return storageId as Id<"_storage">;
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("Judul minimal 3 karakter");
      return;
    }
    if (summary.trim().length < 10) {
      toast.error("Ringkasan minimal 10 karakter");
      return;
    }
    if (content.trim().length < 20) {
      toast.error("Isi kebijakan minimal 20 karakter");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
      const attachmentId = await uploadAttachment();

      if (isEdit && editing) {
        const existingFull = fullPolicy;
        // Determine storage id semantics:
        // - new file uploaded -> use new id
        // - keep attachment & no new file -> keep existing id
        // - keepAttachment = false & no new file -> remove attachment
        const attachmentStorageId = attachmentId
          ? attachmentId
          : keepAttachment
            ? (existingFull?.attachmentStorageId ?? undefined)
            : undefined;
        const attachmentFileName = attachmentId
          ? (file?.name ?? undefined)
          : keepAttachment
            ? (existingFull?.attachmentFileName ?? undefined)
            : undefined;

        await updatePolicy({
          policyId: editing._id,
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          category,
          version: version.trim() || "1.0",
          effectiveDate,
          requiresAcknowledgment: requiresAck,
          tags,
          expiresAt: expiresAt || undefined,
          attachmentStorageId,
          attachmentFileName,
          isPinned,
          bumpAcknowledgments: bumpAck,
        });
        toast.success("Kebijakan diperbarui");
      } else {
        await createPolicy({
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          category,
          version: version.trim() || "1.0",
          effectiveDate,
          requiresAcknowledgment: requiresAck,
          tags,
          expiresAt: expiresAt || undefined,
          attachmentStorageId: attachmentId,
          attachmentFileName: attachmentId ? (file?.name ?? undefined) : undefined,
          isPinned,
          publishNow: !isDraft,
        });
        toast.success(isDraft ? "Draf tersimpan" : "Kebijakan dipublikasikan");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message?: string };
        toast.error(message ?? "Gagal menyimpan kebijakan");
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Gagal menyimpan kebijakan");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!uploading) onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Kebijakan" : "Buat Kebijakan Baru"}
          </DialogTitle>
          <DialogDescription>
            Kebijakan perusahaan akan terlihat oleh seluruh karyawan setelah
            dipublikasikan. Gunakan versi baru untuk meminta konfirmasi ulang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="policy-title">Judul</Label>
            <Input
              id="policy-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kode Etik Karyawan 2026"
              maxLength={140}
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-summary">Ringkasan</Label>
            <Textarea
              id="policy-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ringkasan singkat yang muncul di daftar kebijakan..."
              maxLength={240}
              disabled={uploading}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as PolicyCategoryKey)}
                disabled={uploading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="flex items-center gap-2">
                        <c.icon className="size-4" />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-version">Versi</Label>
              <Input
                id="policy-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                maxLength={20}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="policy-effective">Tanggal Berlaku</Label>
              <DateField
                id="policy-effective"
                value={effectiveDate}
                onChange={(v) => setEffectiveDate(v)}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-expires">Tanggal Berakhir (opsional)</Label>
              <DateField
                id="policy-expires"
                value={expiresAt}
                onChange={(v) => setExpiresAt(v)}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-tags">Tag (pisahkan dengan koma)</Label>
            <Input
              id="policy-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="etika, karyawan, 2026"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-content">Isi Kebijakan (Markdown)</Label>
            <Textarea
              id="policy-content"
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`## Tujuan\nJelaskan tujuan kebijakan...\n\n## Ruang Lingkup\n- Karyawan tetap\n- Karyawan kontrak\n\n## Aturan\n1. ...\n2. ...`}
              disabled={uploading}
              className="font-mono text-sm"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>Lampiran (opsional, maks. 15 MB)</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : isEdit && fullPolicy?.attachmentFileName && keepAttachment ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {fullPolicy.attachmentFileName}
                  </span>
                </div>
                <div className="flex gap-1">
                  <label
                    htmlFor="policy-attach-replace"
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"
                  >
                    Ganti
                    <Input
                      id="policy-attach-replace"
                      type="file"
                      className="hidden"
                      onChange={handleFile}
                      disabled={uploading}
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setKeepAttachment(false)}
                    disabled={uploading}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="policy-attach"
                className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <Paperclip className="size-5" />
                Klik untuk memilih lampiran (PDF, DOCX, dll)
                <Input
                  id="policy-attach"
                  type="file"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Wajib dikonfirmasi karyawan</div>
              <div className="text-xs text-muted-foreground">
                Karyawan harus klik "Saya paham & setuju" setelah membaca.
              </div>
            </div>
            <Switch
              checked={requiresAck}
              onCheckedChange={setRequiresAck}
              disabled={uploading}
            />
          </div>

          {isEdit ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">
                  Reset konfirmasi bila versi berubah
                </div>
                <div className="text-xs text-muted-foreground">
                  Karyawan akan diminta konfirmasi ulang.
                </div>
              </div>
              <Switch
                checked={bumpAck}
                onCheckedChange={setBumpAck}
                disabled={uploading}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Pin className="size-4 text-muted-foreground" />
              <span>Sematkan di atas daftar</span>
            </div>
            <Switch
              checked={isPinned}
              onCheckedChange={setIsPinned}
              disabled={uploading}
            />
          </div>

          {!isEdit ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">Simpan sebagai draf</div>
                <div className="text-xs text-muted-foreground">
                  Draf hanya terlihat oleh admin sampai dipublikasikan.
                </div>
              </div>
              <Switch
                checked={isDraft}
                onCheckedChange={setIsDraft}
                disabled={uploading}
              />
            </div>
          ) : null}

          {uploading ? (
            <div className="space-y-1.5">
              <Progress value={file ? progress : undefined} />
              <p className="text-xs text-muted-foreground">
                {file && progress < 100
                  ? `Mengunggah lampiran... ${progress}%`
                  : "Menyimpan..."}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            {uploading
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : isDraft
                  ? "Simpan Draf"
                  : "Publikasikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
