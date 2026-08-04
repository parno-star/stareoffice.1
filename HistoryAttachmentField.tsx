import { useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Paperclip, FileText, X, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/pages/my-documents/_lib/utils.ts";

// Max attachment size for history documents (10 MB).
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf";

// Local, staged attachment metadata (already uploaded to Convex storage but not
// yet persisted with the history entry). storageId is passed to the mutation.
export type StagedAttachment = {
  storageId: Id<"_storage">;
  name: string;
  size: number;
  type: string;
};

type Props = {
  // Existing saved attachment (edit mode): shows name + download link.
  existing?: {
    name: string | null;
    size: number | null;
    url: string | null;
  } | null;
  // Newly staged upload (chosen this session, not yet saved).
  staged: StagedAttachment | null;
  onStagedChange: (a: StagedAttachment | null) => void;
  // Whether the existing attachment is marked for removal.
  removeExisting: boolean;
  onRemoveExistingChange: (remove: boolean) => void;
  // Uploads a File to Convex storage and returns its storage id.
  uploadFile: (file: File) => Promise<Id<"_storage">>;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

// Reusable "attach a supporting document" field for history form dialogs.
// Handles picking a file, uploading it to Convex storage, showing the staged or
// existing attachment, and letting the user replace or remove it.
export default function HistoryAttachmentField({
  existing,
  staged,
  onStagedChange,
  removeExisting,
  onRemoveExistingChange,
  uploadFile,
  disabled,
  label = "Dokumen Pendukung",
  hint = "PDF atau gambar, maksimal 10 MB. Contoh: ijazah, sertifikat, piagam.",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const hasExisting = !!existing?.name && !removeExisting;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("Ukuran file melebihi 10 MB");
      return;
    }
    setUploading(true);
    try {
      const storageId = await uploadFile(file);
      onStagedChange({
        storageId,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      // A freshly uploaded file replaces any existing attachment.
      onRemoveExistingChange(false);
    } catch {
      toast.error("Gagal mengunggah dokumen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {staged ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{staged.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(staged.size)} · Siap disimpan
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Hapus lampiran"
            disabled={disabled || uploading}
            onClick={() => onStagedChange(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : hasExisting ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{existing?.name}</p>
            <p className="text-xs text-muted-foreground">
              {existing?.size ? formatFileSize(existing.size) : "Tersimpan"}
            </p>
          </div>
          {existing?.url ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Unduh dokumen"
              asChild
            >
              <a href={existing.url} download={existing.name ?? undefined}>
                <Download className="size-4" />
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Hapus lampiran"
            disabled={disabled || uploading}
            onClick={() => onRemoveExistingChange(true)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="w-full cursor-pointer gap-2"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Mengunggah...
            </>
          ) : (
            <>
              <Paperclip className="size-4" />
              {existing?.name && removeExisting
                ? "Unggah dokumen pengganti"
                : "Unggah dokumen"}
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">{hint}</p>
      {existing?.name && removeExisting && !staged ? (
        <button
          type="button"
          className="cursor-pointer text-xs text-primary hover:underline"
          onClick={() => onRemoveExistingChange(false)}
        >
          Batalkan penghapusan dokumen lama
        </button>
      ) : null}
    </div>
  );
}
