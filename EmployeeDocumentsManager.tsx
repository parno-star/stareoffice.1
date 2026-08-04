import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  FileText,
  Loader2,
  Trash2,
  Upload,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  MAX_UPLOAD_SIZE,
  formatFileSize,
  formatIsoDate,
} from "@/pages/my-documents/_lib/utils.ts";

// SK / Kontrak documents live under the shared "contract" document category so
// they appear consistently in both the directory and the "Dokumen Saya" page.
const SK_CATEGORY = "contract";

/**
 * Admin-facing manager for an employee's SK/Kontrak PDF documents. Lets admins
 * upload new PDF files (each with a title), see the list, view, download, and
 * delete them. Backed by the shared employeeDocuments store.
 */
export default function EmployeeDocumentsManager({
  userId,
}: {
  userId: Id<"users">;
}) {
  const documents = useQuery(api.employeeDocuments.listForUser, {
    userId,
    category: SK_CATEGORY,
  });
  const generateUploadUrl = useMutation(
    api.employeeDocuments.generateUploadUrl,
  );
  const createDoc = useMutation(api.employeeDocuments.create);
  const removeDoc = useMutation(api.employeeDocuments.remove);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"employeeDocuments"> | null>(
    null,
  );

  const handleFilePick = (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("File harus berupa PDF");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`Ukuran file maksimal ${formatFileSize(MAX_UPLOAD_SIZE)}`);
      return;
    }
    // Default the title to the filename (without extension) when empty, then
    // upload immediately so the admin does not need a separate confirm step.
    const effectiveTitle = title.trim() || file.name.replace(/\.pdf$/i, "");
    setTitle(effectiveTitle);
    void handleUpload(file, effectiveTitle);
  };

  const handleUpload = async (file: File, docTitle: string) => {
    if (!docTitle.trim()) {
      toast.error("Judul dokumen wajib diisi");
      return;
    }
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl({});
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload gagal");
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      await createDoc({
        userId,
        title: docTitle.trim(),
        category: SK_CATEGORY,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storageId,
      });
      toast.success("Dokumen SK berhasil diunggah");
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah dokumen");
      } else {
        toast.error("Gagal mengunggah dokumen");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: Id<"employeeDocuments">) => {
    setDeletingId(documentId);
    try {
      await removeDoc({ documentId });
      toast.success("Dokumen dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus dokumen");
      } else {
        toast.error("Gagal menghapus dokumen");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">Dokumen SK / Kontrak Pegawai</p>
        <p className="text-xs text-muted-foreground">
          Unggah file PDF SK atau kontrak. Bisa lebih dari satu dokumen.
        </p>
      </div>

      {/* Upload form: pick a file to upload it immediately */}
      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Judul Dokumen (opsional)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Prevent submitting the surrounding employee edit form on Enter.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Contoh: SK Pengangkatan 2024"
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">
            Jika dikosongkan, judul diambil dari nama file.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFilePick(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          className="cursor-pointer gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Mengunggah..." : "Pilih & Unggah File PDF"}
        </Button>
      </div>

      {/* Existing documents */}
      {documents === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          Belum ada dokumen yang diunggah.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc._id}
              className="flex items-center gap-3 rounded-md border bg-background p-2.5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.fileName}
                  {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""} ·{" "}
                  {formatIsoDate(doc._creationTime
                    ? new Date(doc._creationTime).toISOString().slice(0, 10)
                    : undefined)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {doc.url ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      aria-label="Lihat dokumen"
                    >
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Eye className="size-4" />
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      aria-label="Unduh dokumen"
                    >
                      <a href={doc.url} download={doc.fileName}>
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(doc._id)}
                  disabled={deletingId === doc._id}
                  aria-label="Hapus dokumen"
                >
                  {deletingId === doc._id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
