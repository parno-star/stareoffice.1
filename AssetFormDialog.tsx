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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  CATEGORY_CONFIG,
  MAX_IMAGE_SIZE,
  type AssetCategory,
  type AssetStatus,
  STATUS_CONFIG,
} from "../_lib/asset-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { EnrichedAsset } from "@/convex/assets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EnrichedAsset | null;
};

export default function AssetFormDialog({ open, onOpenChange, editing }: Props) {
  const isEdit = editing !== null;
  const [name, setName] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [category, setCategory] = useState<AssetCategory>("laptop");
  const [status, setStatus] = useState<AssetStatus>("available");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const createAsset = useMutation(api.assets.create);
  const updateAsset = useMutation(api.assets.update);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setAssetTag(editing.assetTag);
        setCategory(editing.category as AssetCategory);
        setStatus(editing.status as AssetStatus);
        setBrand(editing.brand ?? "");
        setModel(editing.model ?? "");
        setSerialNumber(editing.serialNumber ?? "");
        setLocation(editing.location ?? "");
        setPurchaseDate(editing.purchaseDate ?? "");
        setPurchasePrice(
          editing.purchasePrice !== undefined
            ? String(editing.purchasePrice)
            : "",
        );
        setDescription(editing.description ?? "");
      } else {
        setName("");
        setAssetTag("");
        setCategory("laptop");
        setStatus("available");
        setBrand("");
        setModel("");
        setSerialNumber("");
        setLocation("");
        setPurchaseDate("");
        setPurchasePrice("");
        setDescription("");
      }
      setFile(null);
      setClearImage(false);
      setProgress(0);
    }
  }, [open, editing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_IMAGE_SIZE) {
      toast.error("Ukuran gambar terlalu besar. Maksimal 5 MB.");
      e.target.value = "";
      return;
    }
    setFile(selected);
    setClearImage(false);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedTag = assetTag.trim();
    if (!trimmedName) {
      toast.error("Nama aset wajib diisi");
      return;
    }
    if (!trimmedTag) {
      toast.error("Kode aset wajib diisi");
      return;
    }
    const price = purchasePrice
      ? Number(purchasePrice.replace(/[^0-9.]/g, ""))
      : undefined;
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      toast.error("Harga beli tidak valid");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (file) {
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
        imageStorageId = storageId as Id<"_storage">;
      }

      if (isEdit && editing) {
        await updateAsset({
          id: editing._id,
          name: trimmedName,
          assetTag: trimmedTag,
          category,
          status,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          location: location.trim() || undefined,
          purchaseDate: purchaseDate || undefined,
          purchasePrice: price,
          description: description.trim() || undefined,
          imageStorageId,
          clearImage: clearImage && !file,
        });
        toast.success("Aset diperbarui");
      } else {
        await createAsset({
          name: trimmedName,
          assetTag: trimmedTag,
          category,
          status,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          location: location.trim() || undefined,
          purchaseDate: purchaseDate || undefined,
          purchasePrice: price,
          description: description.trim() || undefined,
          imageStorageId,
        });
        toast.success("Aset baru ditambahkan");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan aset");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal menyimpan aset");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const existingImage = editing?.imageUrl && !clearImage && !file;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Aset" : "Tambah Aset Baru"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail aset perusahaan."
              : "Daftarkan perangkat atau aset perusahaan baru ke inventaris."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Nama Aset</Label>
              <Input
                id="asset-name"
                placeholder="MacBook Pro 14"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-tag">Kode Aset</Label>
              <Input
                id="asset-tag"
                placeholder="LP-001"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                disabled={submitting}
                maxLength={60}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as AssetCategory)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <cfg.icon className="size-4" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as AssetStatus)}
                disabled={submitting || status === "assigned"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG)
                    .filter(([value]) =>
                      // Manual status change cannot set to assigned
                      value !== "assigned" || editing?.status === "assigned",
                    )
                    .map(([value, cfg]) => (
                      <SelectItem
                        key={value}
                        value={value}
                        disabled={
                          value === "assigned" && editing?.status !== "assigned"
                        }
                      >
                        {cfg.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {status === "assigned" ? (
                <p className="text-xs text-muted-foreground">
                  Gunakan tindakan Tugaskan untuk menugaskan aset.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-brand">Merek</Label>
              <Input
                id="asset-brand"
                placeholder="Apple"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-model">Model</Label>
              <Input
                id="asset-model"
                placeholder="M3 Pro 2024"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-sn">Nomor Seri</Label>
              <Input
                id="asset-sn"
                placeholder="C02ZLXYZ12345"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-location">Lokasi</Label>
              <Input
                id="asset-location"
                placeholder="Kantor Pusat - Lt. 3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-date">Tanggal Beli</Label>
              <DateField
                id="asset-date"
                value={purchaseDate}
                onChange={(v) => setPurchaseDate(v)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-price">Harga Beli (IDR)</Label>
              <Input
                id="asset-price"
                type="number"
                min="0"
                placeholder="25000000"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-desc">Catatan</Label>
            <Textarea
              id="asset-desc"
              rows={2}
              placeholder="Keterangan tambahan (spesifikasi, kondisi awal, dll.)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Foto Aset (opsional)</Label>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ImageIcon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => setFile(null)}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : existingImage ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <img
                  src={editing.imageUrl ?? undefined}
                  alt="Aset"
                  className="size-16 rounded-lg object-cover"
                />
                <div className="flex-1 text-sm text-muted-foreground">
                  Gambar saat ini
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="asset-image-upload"
                    className="cursor-pointer rounded-md border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Ganti
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setClearImage(true)}
                    className="cursor-pointer"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Input
                  id="asset-image-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </div>
            ) : (
              <label
                htmlFor="asset-image-upload-new"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-6 text-center transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Klik untuk unggah foto aset
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maks. 5 MB (JPG, PNG)
                  </p>
                </div>
                <Input
                  id="asset-image-upload-new"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>
            )}
          </div>

          {submitting && file ? (
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
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Tambahkan Aset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
