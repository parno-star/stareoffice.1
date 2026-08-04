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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  RESOURCE_KIND_CONFIG,
  RESOURCE_CATEGORY_CONFIG,
  type ResourceKind,
  type ResourceCategory,
} from "../_lib/onboarding-utils.ts";
import { Upload, X } from "lucide-react";

type Props = {
  resource?: Doc<"onboardingResources">;
  trigger: ReactNode;
};

export default function ResourceFormDialog({ resource, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [kind, setKind] = useState<ResourceKind>(
    (resource?.kind as ResourceKind) ?? "link",
  );
  const [category, setCategory] = useState<ResourceCategory>(
    (resource?.category as ResourceCategory) ?? "welcome",
  );
  const [url, setUrl] = useState(resource?.url ?? "");
  const [icon, setIcon] = useState(resource?.icon ?? "");
  const [isPinned, setIsPinned] = useState(resource?.isPinned ?? false);
  const [contactUserId, setContactUserId] = useState<string>(
    (resource?.contactUserId as string) ?? "none",
  );
  const [fileName, setFileName] = useState<string | null>(
    resource?.fileName ?? null,
  );
  const [uploadedStorageId, setUploadedStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(
    api.onboarding.resources.generateUploadUrl,
  );
  const createResource = useMutation(api.onboarding.resources.create);
  const updateResource = useMutation(api.onboarding.resources.update);

  const employees = useQuery(
    api.users.listEmployees,
    open && kind === "contact" ? {} : "skip",
  );

  const isEdit = resource != null;

  const reset = () => {
    setTitle(resource?.title ?? "");
    setDescription(resource?.description ?? "");
    setKind((resource?.kind as ResourceKind) ?? "link");
    setCategory((resource?.category as ResourceCategory) ?? "welcome");
    setUrl(resource?.url ?? "");
    setIcon(resource?.icon ?? "");
    setIsPinned(resource?.isPinned ?? false);
    setContactUserId((resource?.contactUserId as string) ?? "none");
    setFileName(resource?.fileName ?? null);
    setUploadedStorageId(null);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Ukuran maksimum 20MB");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload gagal");
      const body = (await res.json()) as { storageId: Id<"_storage"> };
      setUploadedStorageId(body.storageId);
      setFileName(file.name);
      toast.success("File berhasil diunggah");
    } catch {
      toast.error("Gagal mengunggah file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && resource) {
        await updateResource({
          id: resource._id,
          title: trimmed,
          description: description.trim(),
          category,
          url: kind === "link" || kind === "video" ? url.trim() : undefined,
          icon: icon.trim(),
          isPinned,
        });
        toast.success("Resource diperbarui");
      } else {
        if ((kind === "link" || kind === "video") && !url.trim()) {
          toast.error("URL wajib diisi");
          setSubmitting(false);
          return;
        }
        if (kind === "document" && !uploadedStorageId) {
          toast.error("Unggah file terlebih dahulu");
          setSubmitting(false);
          return;
        }
        if (kind === "contact" && contactUserId === "none") {
          toast.error("Pilih kontak karyawan");
          setSubmitting(false);
          return;
        }
        await createResource({
          title: trimmed,
          description: description.trim() || undefined,
          kind,
          category,
          url: kind === "link" || kind === "video" ? url.trim() : undefined,
          storageId:
            kind === "document" ? uploadedStorageId ?? undefined : undefined,
          fileName:
            kind === "document" ? fileName ?? undefined : undefined,
          contactUserId:
            kind === "contact" ? (contactUserId as Id<"users">) : undefined,
          icon: icon.trim() || undefined,
          isPinned,
        });
        toast.success("Resource ditambahkan");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Resource" : "Resource Baru"}
          </DialogTitle>
          <DialogDescription>
            Tambahkan tautan, dokumen, video, atau kontak penting untuk
            karyawan baru.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="res-title">Judul</Label>
            <Input
              id="res-title"
              placeholder="Panduan Budaya Perusahaan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="res-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="res-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={300}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isEdit ? (
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as ResourceKind)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESOURCE_KIND_CONFIG).map(
                      ([value, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      },
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ResourceCategory)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_CATEGORY_CONFIG).map(
                    ([value, cfg]) => (
                      <SelectItem key={value} value={value}>
                        {cfg.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind === "link" || kind === "video" ? (
            <div className="space-y-2">
              <Label htmlFor="res-url">URL</Label>
              <Input
                id="res-url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
              />
            </div>
          ) : null}

          {kind === "document" && !isEdit ? (
            <div className="space-y-2">
              <Label>File</Label>
              {fileName ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <p className="truncate text-sm">{fileName}</p>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setFileName(null);
                      setUploadedStorageId(null);
                    }}
                    disabled={submitting || uploading}
                    className="cursor-pointer"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full gap-2 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || uploading}
                >
                  <Upload className="size-4" />
                  {uploading ? "Mengunggah..." : "Unggah File"}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
              />
              <p className="text-xs text-muted-foreground">
                Maksimum 20MB. PDF, Word, Excel, atau gambar.
              </p>
            </div>
          ) : null}

          {kind === "contact" && !isEdit ? (
            <div className="space-y-2">
              <Label>Kontak</Label>
              <Select
                value={contactUserId}
                onValueChange={setContactUserId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {(employees ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa nama"}
                      {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="res-icon">Ikon emoji (opsional)</Label>
              <Input
                id="res-icon"
                placeholder="🚀"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                disabled={submitting}
                maxLength={4}
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  disabled={submitting}
                  className="size-4 rounded accent-primary"
                />
                Pinkan resource ini
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
