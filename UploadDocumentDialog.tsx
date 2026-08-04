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
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Plus, X, FileText } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  CATEGORY_CONFIG,
  MAX_UPLOAD_SIZE,
  formatFileSize,
  type DocumentCategory,
} from "../_lib/document-utils.ts";
import { Progress } from "@/components/ui/progress.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function UploadDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDoc = useMutation(api.documents.create);

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory("other");
    setUploading(false);
    setProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_UPLOAD_SIZE) {
      toast.error(
        `Ukuran file terlalu besar. Maksimal ${formatFileSize(MAX_UPLOAD_SIZE)}.`,
      );
      e.target.value = "";
      return;
    }
    setFile(selected);
    // Auto-fill title with filename (without extension) if empty
    if (title.length === 0) {
      const name = selected.name.replace(/\.[^/.]+$/, "");
      setTitle(name);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Silakan pilih file terlebih dahulu");
      return;
    }
    if (title.trim().length === 0) {
      toast.error("Judul dokumen wajib diisi");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const uploadUrl = await generateUploadUrl({});

      // Use XHR to report upload progress
      const storageId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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

      await createDoc({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        storageId: storageId as Id<"_storage">,
      });

      toast.success("Dokumen berhasil diunggah");
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah dokumen");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal mengunggah dokumen");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!uploading) {
          setOpen(v);
          if (!v) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Unggah Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Unggah Dokumen Baru</DialogTitle>
          <DialogDescription>
            Bagikan dokumen, kebijakan, atau template dengan tim Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div className="space-y-2">
            <Label>File</Label>
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
                  disabled={uploading}
                  onClick={() => setFile(null)}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="file-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-8 text-center transition-colors hover:bg-muted/50"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Klik untuk memilih file</p>
                  <p className="text-xs text-muted-foreground">
                    Maks. {formatFileSize(MAX_UPLOAD_SIZE)}
                  </p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Judul</Label>
            <Input
              id="doc-title"
              placeholder="Kebijakan Kerja dari Rumah 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              maxLength={120}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
              disabled={uploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="doc-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="doc-desc"
              rows={3}
              placeholder="Ringkasan singkat tentang dokumen ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              maxLength={500}
            />
          </div>

          {uploading ? (
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
            disabled={uploading}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
          >
            {uploading ? "Mengunggah..." : "Unggah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
