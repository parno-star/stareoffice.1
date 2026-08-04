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
import { ImagePlus, X, Pin } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { CATEGORIES, PRIORITY_META, type NewsCategoryKey } from "../_lib/news-utils.ts";
import type { EnrichedAnnouncement } from "@/convex/announcements";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EnrichedAnnouncement | null;
};

const MAX_COVER_SIZE = 8 * 1024 * 1024; // 8MB

export default function NewsEditorDialog({ open, onOpenChange, editing }: Props) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NewsCategoryKey>("general");
  const [priority, setPriority] = useState("normal");
  const [isPinned, setIsPinned] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const createAnnouncement = useMutation(api.announcements.create);
  const updateAnnouncement = useMutation(api.announcements.update);
  const generateUploadUrl = useMutation(api.announcements.generateUploadUrl);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setSummary(editing.summary ?? "");
      setContent(editing.content);
      setCategory((editing.category as NewsCategoryKey | undefined) ?? "general");
      setPriority(editing.priority);
      setIsPinned(editing.isPinned ?? false);
      setIsDraft((editing.status ?? "published") === "draft");
      setExistingCoverUrl(editing.coverImageUrl);
      setFile(null);
      setClearCover(false);
    } else {
      setTitle("");
      setSummary("");
      setContent("");
      setCategory("general");
      setPriority("normal");
      setIsPinned(false);
      setIsDraft(false);
      setExistingCoverUrl(null);
      setFile(null);
      setClearCover(false);
    }
    setUploading(false);
    setProgress(0);
  }, [open, editing]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_COVER_SIZE) {
      toast.error("Ukuran gambar maksimal 8 MB");
      e.target.value = "";
      return;
    }
    setFile(f);
    setClearCover(false);
  };

  const uploadCover = async (): Promise<Id<"_storage"> | undefined> => {
    if (!file) return undefined;
    const uploadUrl = await generateUploadUrl({});
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
    return storageId as Id<"_storage">;
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("Judul minimal 3 karakter");
      return;
    }
    if (content.trim().length < 10) {
      toast.error("Isi berita minimal 10 karakter");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const coverId = await uploadCover();
      const status = isDraft ? "draft" : "published";

      if (isEdit && editing) {
        await updateAnnouncement({
          id: editing._id,
          title: title.trim(),
          content: content.trim(),
          summary: summary.trim() || undefined,
          priority,
          category,
          coverImageStorageId: coverId,
          clearCover: !coverId && clearCover,
          isPinned,
          status,
        });
        toast.success("Pengumuman berhasil diperbarui");
      } else {
        await createAnnouncement({
          title: title.trim(),
          content: content.trim(),
          summary: summary.trim() || undefined,
          priority,
          category,
          coverImageStorageId: coverId,
          isPinned,
          status,
        });
        toast.success(
          status === "draft"
            ? "Draf tersimpan"
            : "Berita berhasil dipublikasikan",
        );
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message?: string };
        toast.error(message ?? "Gagal menyimpan berita");
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Gagal menyimpan berita");
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
            {isEdit ? "Edit Pengumuman" : "Buat Berita & Pengumuman"}
          </DialogTitle>
          <DialogDescription>
            Bagikan informasi penting, berita, atau pengumuman kepada seluruh
            karyawan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover */}
          <div className="space-y-2">
            <Label>Gambar Sampul (opsional)</Label>
            {file ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={URL.createObjectURL(file)}
                  alt="Pratinjau"
                  className="h-48 w-full object-cover"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setFile(null)}
                  className="absolute right-2 top-2 bg-background/80 backdrop-blur hover:bg-background"
                  disabled={uploading}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : existingCoverUrl && !clearCover ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={existingCoverUrl}
                  alt="Sampul"
                  className="h-48 w-full object-cover"
                />
                <div className="absolute right-2 top-2 flex gap-1">
                  <label
                    htmlFor="news-cover-replace"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-background/80 text-xs backdrop-blur hover:bg-background"
                  >
                    <ImagePlus className="size-4" />
                    <Input
                      id="news-cover-replace"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFile}
                      disabled={uploading}
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setClearCover(true)}
                    className="bg-background/80 backdrop-blur hover:bg-background"
                    disabled={uploading}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="news-cover"
                className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <ImagePlus className="size-6" />
                <span className="text-sm">
                  Klik untuk memilih gambar sampul (maks. 8 MB)
                </span>
                <Input
                  id="news-cover"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-title">Judul</Label>
            <Input
              id="news-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kebijakan Libur Nasional 2026"
              maxLength={140}
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-summary">Ringkasan (opsional)</Label>
            <Textarea
              id="news-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ringkasan singkat yang muncul di daftar berita..."
              maxLength={240}
              disabled={uploading}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as NewsCategoryKey)}
                disabled={uploading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
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
              <Label>Prioritas</Label>
              <Select
                value={priority}
                onValueChange={setPriority}
                disabled={uploading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <meta.icon className="size-4" />
                        {meta.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-content">Isi Berita</Label>
            <Textarea
              id="news-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis isi berita atau pengumuman..."
              disabled={uploading}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Pin className="size-4 text-muted-foreground" />
              <span>Sematkan di atas daftar berita</span>
            </div>
            <Switch
              checked={isPinned}
              onCheckedChange={setIsPinned}
              disabled={uploading}
            />
          </div>

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

          {uploading ? (
            <div className="space-y-1.5">
              <Progress value={file ? progress : undefined} />
              <p className="text-xs text-muted-foreground">
                {file && progress < 100
                  ? `Mengunggah gambar... ${progress}%`
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
