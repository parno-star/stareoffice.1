import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  ImageIcon,
  Sparkles,
  Type,
  Hash,
  Upload,
  Settings2,
  FileImage,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

type ValueItem = {
  icon: string;
  title: string;
  description: string;
};

type SlideItem = {
  imageUrl: string;
  storageId?: Id<"_storage">;
  caption?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

type CarouselSettings = {
  transitionType: string;
  duration: number;
  transitionSpeed: number;
  autoPlay: boolean;
};

const DEFAULT_CAROUSEL: CarouselSettings = {
  transitionType: "slide",
  duration: 5,
  transitionSpeed: 400,
  autoPlay: true,
};

/** Format bytes to human-readable string */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Max file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** Recommended dimensions */
const RECOMMENDED_WIDTH = 1920;
const RECOMMENDED_HEIGHT = 640;

export default function HomePageSettings() {
  const content = useQuery(api.welcomePage.getContent, {});
  const saveContent = useMutation(api.welcomePage.saveContent);
  const generateUploadUrl = useMutation(api.welcomePage.generateUploadUrl);

  const [slogan, setSlogan] = useState("");
  const [spotlightText, setSpotlightText] = useState("");
  const [values, setValues] = useState<ValueItem[]>([]);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [carouselSettings, setCarouselSettings] = useState<CarouselSettings>(DEFAULT_CAROUSEL);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Initialize form from loaded content
  useEffect(() => {
    if (content && !initialized) {
      setSlogan(content.slogan ?? "");
      setSpotlightText(content.spotlightText ?? "");
      setValues(content.values);
      setSlides(content.bannerSlides);
      setCarouselSettings(content.carouselSettings ?? DEFAULT_CAROUSEL);
      setInitialized(true);
    }
  }, [content, initialized]);

  if (content === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const handleSave = async () => {
    const invalidValues = values.some((v) => !v.title.trim());
    if (invalidValues) {
      toast.error("Setiap nilai perusahaan harus memiliki judul");
      return;
    }
    const invalidSlides = slides.some((s) => !s.imageUrl.trim() && !s.storageId);
    if (invalidSlides) {
      toast.error("Setiap slide banner harus memiliki gambar");
      return;
    }

    setSaving(true);
    try {
      await saveContent({
        slogan: slogan || undefined,
        spotlightText: spotlightText || undefined,
        values,
        bannerSlides: slides,
        carouselSettings,
      });
      toast.success("Pengaturan beranda berhasil disimpan");
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (index: number, field: keyof ValueItem, val: string) => {
    setValues((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
  };

  const addValue = () => {
    setValues((prev) => [...prev, { icon: "✨", title: "", description: "" }]);
  };

  const removeValue = (index: number) => {
    setValues((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlide = (index: number, field: keyof SlideItem, val: string) => {
    setSlides((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
  };

  const addSlide = () => {
    setSlides((prev) => [...prev, { imageUrl: "", caption: "" }]);
  };

  const removeSlide = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (index: number, file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Ukuran file terlalu besar. Maksimal ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG, PNG, WebP)");
      return;
    }

    setUploadingIndex(index);
    try {
      // Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Generate upload URL
      const postUrl = await generateUploadUrl();

      // Upload file
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };

      // Update slide with storage ID and metadata
      setSlides((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                storageId,
                imageUrl: URL.createObjectURL(file), // temporary preview
                fileName: file.name,
                fileSize: file.size,
                width: dimensions.width,
                height: dimensions.height,
              }
            : item
        )
      );
      toast.success(`Gambar "${file.name}" berhasil diunggah`);
    } catch {
      toast.error("Gagal mengunggah gambar");
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Slogan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Type className="size-4 text-primary" />
            Teks Banner
          </CardTitle>
          <CardDescription>
            Atur slogan yang tampil di halaman beranda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="slogan">Slogan</Label>
            <Input
              id="slogan"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Bersama Membangun Masa Depan Digital"
            />
            <p className="text-xs text-muted-foreground">
              Teks italic yang tampil di bawah judul banner
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hashtag / Tagar */}
      <HashtagEditor
        value={spotlightText}
        onChange={setSpotlightText}
      />

      {/* Company Values */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                Nilai-Nilai Perusahaan
              </CardTitle>
              <CardDescription>
                Kelola nilai-nilai inti yang ditampilkan di beranda
              </CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={addValue} className="gap-1.5 cursor-pointer">
              <Plus className="size-3.5" />
              Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {values.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada nilai perusahaan. Klik "Tambah" untuk menambahkan.
            </p>
          ) : (
            <div className="space-y-3">
              {values.map((value, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground/40" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={value.icon}
                        onChange={(e) => updateValue(i, "icon", e.target.value)}
                        className="w-14 text-center text-lg"
                        placeholder="🎯"
                      />
                      <Input
                        value={value.title}
                        onChange={(e) => updateValue(i, "title", e.target.value)}
                        className="flex-1"
                        placeholder="Nama nilai"
                      />
                    </div>
                    <Textarea
                      value={value.description}
                      onChange={(e) => updateValue(i, "description", e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                      placeholder="Deskripsi singkat..."
                      rows={2}
                    />
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="mt-2 shrink-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => removeValue(i)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carousel Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4 text-primary" />
            Pengaturan Slider
          </CardTitle>
          <CardDescription>
            Atur jenis transisi, durasi, dan perilaku carousel sorotan & kegiatan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Transition Type */}
          <div className="space-y-2">
            <Label>Jenis Transisi</Label>
            <Select
              value={carouselSettings.transitionType}
              onValueChange={(val) =>
                setCarouselSettings((prev) => ({ ...prev, transitionType: val }))
              }
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slide" className="cursor-pointer">Slide (Geser)</SelectItem>
                <SelectItem value="fade" className="cursor-pointer">Fade (Pudar)</SelectItem>
                <SelectItem value="zoom" className="cursor-pointer">Zoom (Perbesar)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Efek animasi saat berpindah antar slide
            </p>
          </div>

          {/* Auto-advance duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Durasi per Slide</Label>
              <span className="text-sm font-medium text-primary">
                {carouselSettings.duration} detik
              </span>
            </div>
            <Slider
              min={2}
              max={15}
              step={1}
              value={[carouselSettings.duration]}
              onValueChange={([val]) =>
                setCarouselSettings((prev) => ({ ...prev, duration: val }))
              }
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Waktu tampil setiap slide sebelum berpindah otomatis (2-15 detik)
            </p>
          </div>

          {/* Transition speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kecepatan Transisi</Label>
              <span className="text-sm font-medium text-primary">
                {carouselSettings.transitionSpeed} ms
              </span>
            </div>
            <Slider
              min={200}
              max={1500}
              step={100}
              value={[carouselSettings.transitionSpeed]}
              onValueChange={([val]) =>
                setCarouselSettings((prev) => ({ ...prev, transitionSpeed: val }))
              }
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Kecepatan animasi perpindahan slide (200-1500 milidetik)
            </p>
          </div>

          {/* Auto-play toggle */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Putar Otomatis</Label>
              <p className="text-xs text-muted-foreground">
                Slide berpindah secara otomatis sesuai durasi yang diatur
              </p>
            </div>
            <Switch
              checked={carouselSettings.autoPlay}
              onCheckedChange={(checked) =>
                setCarouselSettings((prev) => ({ ...prev, autoPlay: checked }))
              }
              className="cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Banner Slides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4 text-primary" />
                Slide Banner
              </CardTitle>
              <CardDescription>
                Gambar carousel di bagian sorotan & kegiatan halaman beranda
              </CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={addSlide} className="gap-1.5 cursor-pointer">
              <Plus className="size-3.5" />
              Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image guidelines info box */}
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">Panduan Gambar Slide:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Dimensi rekomendasi: <strong>{RECOMMENDED_WIDTH} x {RECOMMENDED_HEIGHT} px</strong> (rasio 3:1)</li>
                <li>Ukuran maksimal: <strong>{formatFileSize(MAX_FILE_SIZE)}</strong></li>
                <li>Format: JPG, PNG, atau WebP</li>
                <li>Gunakan gambar berkualitas tinggi untuk tampilan terbaik</li>
              </ul>
            </div>
          </div>

          {slides.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada slide banner. Klik "Tambah" untuk menambahkan.
            </p>
          ) : (
            <div className="space-y-3">
              {slides.map((slide, i) => (
                <SlideEditor
                  key={i}
                  index={i}
                  slide={slide}
                  uploading={uploadingIndex === i}
                  onUpdate={updateSlide}
                  onRemove={removeSlide}
                  onUpload={handleImageUpload}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || uploadingIndex !== null}
          className="gap-2 cursor-pointer"
        >
          <Save className="size-4" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}

/** Get image dimensions from a File */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Individual slide editor row */
function SlideEditor({
  index,
  slide,
  uploading,
  onUpdate,
  onRemove,
  onUpload,
}: {
  index: number;
  slide: SlideItem;
  uploading: boolean;
  onUpdate: (index: number, field: keyof SlideItem, val: string) => void;
  onRemove: (index: number) => void;
  onUpload: (index: number, file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(index, file);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      {/* Header: slide number + delete */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Slide {index + 1}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-destructive hover:bg-destructive/10 cursor-pointer"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Preview thumbnail */}
      <div
        className={cn(
          "w-full aspect-[21/9] rounded-md border bg-muted overflow-hidden flex items-center justify-center relative",
          uploading && "animate-pulse"
        )}
      >
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={slide.caption ?? `Slide ${index + 1}`}
            className="size-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <ImageIcon className="size-8" />
            <span className="text-xs">Belum ada gambar</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
            <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Upload + URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5 shrink-0 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-3.5" />
            {uploading ? "Mengunggah..." : "Upload Gambar"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">URL:</span>
          <Input
            value={slide.storageId ? "" : slide.imageUrl}
            onChange={(e) => onUpdate(index, "imageUrl", e.target.value)}
            placeholder="Atau masukkan URL gambar"
            className="text-sm"
            disabled={!!slide.storageId || uploading}
          />
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-1">
        <Label className="text-xs">Caption</Label>
        <Input
          value={slide.caption ?? ""}
          onChange={(e) => onUpdate(index, "caption", e.target.value)}
          placeholder="Caption (opsional)"
          className="text-sm"
        />
      </div>

      {/* File metadata info */}
      {(slide.fileName || slide.width || slide.fileSize) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          {slide.fileName && (
            <span className="flex items-center gap-1">
              <FileImage className="size-3" />
              {slide.fileName}
            </span>
          )}
          {slide.width && slide.height && (
            <span className="flex items-center gap-1">
              {slide.width} x {slide.height} px
              {(slide.width !== RECOMMENDED_WIDTH || slide.height !== RECOMMENDED_HEIGHT) && (
                <span className="text-amber-600 dark:text-amber-400 ml-0.5">(rek: {RECOMMENDED_WIDTH}x{RECOMMENDED_HEIGHT})</span>
              )}
            </span>
          )}
          {slide.fileSize && (
            <span>
              {formatFileSize(slide.fileSize)}
              {slide.fileSize > MAX_FILE_SIZE && (
                <span className="text-destructive ml-1">(terlalu besar!)</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Dedicated hashtag/tagar editor with add/remove individual tags */
function HashtagEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [newTag, setNewTag] = useState("");

  // Parse current hashtags from the combined string
  const tags = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    // Auto-prefix with # if missing
    const formatted = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    // Avoid duplicates
    if (tags.includes(formatted)) {
      toast.error("Tagar ini sudah ada");
      return;
    }
    const updated = [...tags, formatted].join(" ");
    onChange(updated);
    setNewTag("");
  };

  const removeTag = (index: number) => {
    const updated = tags.filter((_, i) => i !== index).join(" ");
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="size-4 text-primary" />
          Tagar / Hashtag
        </CardTitle>
        <CardDescription>
          Kelola tagar yang ditampilkan di halaman beranda sebagai spotlight
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-full border bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  className="flex size-4 cursor-pointer items-center justify-center rounded-full text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tags.length === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Belum ada tagar. Tambahkan tagar pertama di bawah ini.
          </p>
        )}

        {/* Add new tag input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik tagar baru, contoh: TransformasiDigital"
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addTag}
            disabled={!newTag.trim()}
            className="gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="size-3.5" />
            Tambah
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tekan Enter atau klik "Tambah" untuk menambahkan tagar. Tanda # otomatis ditambahkan.
        </p>
      </CardContent>
    </Card>
  );
}
