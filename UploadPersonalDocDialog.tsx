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
import { Progress } from "@/components/ui/progress.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Plus, X, FileText } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  EMPLOYEE_DOC_CATEGORIES,
  MAX_UPLOAD_SIZE,
  formatFileSize,
  type EmployeeDocCategory,
} from "../_lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function UploadPersonalDocDialog({
  userId,
}: {
  userId: Id<"users">;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EmployeeDocCategory>("other");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateUploadUrl = useMutation(api.employeeDocuments.generateUploadUrl);
  const createDoc = useMutation(api.employeeDocuments.create);

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory("other");
    setIssueDate("");
    setExpiryDate("");
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

      await createDoc({
        userId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        storageId: storageId as Id<"_storage">,
        issueDate: issueDate.trim() || undefined,
        expiryDate: expiryDate.trim() || undefined,
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
        <Button className="gap-2 cursor-pointer">
          <Plus className="size-4" />
          Tambah Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Dokumen Pribadi</DialogTitle>
          <DialogDescription>
            Unggah dokumen pribadi seperti kontrak kerja, sertifikat, atau slip
            gaji. Hanya Anda dan admin yang dapat melihat dokumen ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
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
                htmlFor="personal-doc-upload"
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
                  id="personal-doc-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdoc-title">Judul</Label>
            <Input
              id="pdoc-title"
              placeholder="Kontrak Kerja 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as EmployeeDocCategory)}
              disabled={uploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYEE_DOC_CATEGORIES).map(([value, cfg]) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pdoc-issue">Tanggal Terbit</Label>
              <DateField
                id="pdoc-issue"
                value={issueDate}
                onChange={(v) => setIssueDate(v)}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdoc-expiry">Tanggal Berakhir</Label>
              <DateField
                id="pdoc-expiry"
                value={expiryDate}
                onChange={(v) => setExpiryDate(v)}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdoc-desc">Catatan (opsional)</Label>
            <Textarea
              id="pdoc-desc"
              rows={2}
              placeholder="Keterangan tambahan..."
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
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="cursor-pointer"
          >
            {uploading ? "Mengunggah..." : "Unggah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
