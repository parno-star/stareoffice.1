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
import { Label } from "@/components/ui/label.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Upload, ImagePlus, X } from "lucide-react";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PHOTO_SIZE,
  formatFileSize,
} from "../_lib/gallery-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  albumId: Id<"galleryAlbums">;
};

type FileItem = {
  file: File;
  preview: string;
};

export default function UploadPhotosDialog({ albumId }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Array<FileItem>>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const generateUploadUrl = useMutation(api.gallery.generateUploadUrl);
  const addPhoto = useMutation(api.gallery.addPhoto);

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setCaption("");
    setProgress(0);
    setCurrentIndex(0);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const accepted: Array<FileItem> = [];
    for (const file of selected) {
      if (
        !ACCEPTED_IMAGE_TYPES.includes(
          file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
        )
      ) {
        toast.error(`${file.name}: format tidak didukung`);
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        toast.error(
          `${file.name}: maksimal ${formatFileSize(MAX_PHOTO_SIZE)}`,
        );
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    setFiles((prev) => [...prev, ...accepted]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadOne = async (file: File): Promise<string> => {
    const uploadUrl = await generateUploadUrl({});
    return await new Promise<string>((resolve, reject) => {
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
            const { storageId } = JSON.parse(xhr.responseText) as {
              storageId: string;
            };
            resolve(storageId);
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
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Pilih setidaknya satu foto");
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentIndex(i);
        setProgress(0);
        const item = files[i];
        const storageId = await uploadOne(item.file);
        await addPhoto({
          albumId,
          storageId: storageId as Id<"_storage">,
          caption: caption.trim() || undefined,
        });
      }
      toast.success(
        files.length === 1
          ? "Foto berhasil diunggah"
          : `${files.length} foto berhasil diunggah`,
      );
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah foto");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal mengunggah foto");
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
          <ImagePlus className="size-4" />
          Tambah Foto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Foto</DialogTitle>
          <DialogDescription>
            Pilih satu atau beberapa foto untuk diunggah ke album ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Foto</Label>
            <label
              htmlFor="photo-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-8 text-center transition-colors hover:bg-muted/50"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Klik untuk memilih foto
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP, GIF - Maks. {formatFileSize(MAX_PHOTO_SIZE)} per foto
                </p>
              </div>
              <Input
                id="photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>

          {files.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {files.map((item, index) => (
                <div
                  key={index}
                  className="group relative aspect-square overflow-hidden rounded-lg border"
                >
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-full w-full object-cover"
                  />
                  {!uploading ? (
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="photo-caption">Keterangan (opsional)</Label>
              <Input
                id="photo-caption"
                placeholder="Keterangan untuk foto-foto ini"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={uploading}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                Keterangan yang sama akan ditambahkan ke setiap foto.
              </p>
            </div>
          ) : null}

          {uploading ? (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Mengunggah foto {currentIndex + 1} dari {files.length}... {progress}%
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
            disabled={uploading || files.length === 0}
          >
            {uploading
              ? "Mengunggah..."
              : `Unggah${files.length > 0 ? ` (${files.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
