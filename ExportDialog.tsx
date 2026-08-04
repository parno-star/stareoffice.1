import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { FileText, ImageIcon, Download } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExportFormat = "png" | "pdf";
export type PaperSize = "a4" | "a3" | "a2" | "letter" | "legal" | "fit";
export type Orientation = "landscape" | "portrait";
export type ScaleMode = "fit" | "actual" | "custom";

export type ExportSettings = {
  format: ExportFormat;
  paperSize: PaperSize;
  orientation: Orientation;
  scaleMode: ScaleMode;
  customScalePct: number;
  pixelRatio: number;
  bgColor: string;
  includeTitle: boolean;
  titleText: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
  isExporting: boolean;
  defaultTitle?: string;
};

// ─── Paper size dimensions in mm ─────────────────────────────────────────────
export const PAPER_SIZES: Record<
  PaperSize,
  { label: string; w: number; h: number } | null
> = {
  a2:     { label: "A2 (420 × 594 mm)", w: 420, h: 594 },
  a3:     { label: "A3 (297 × 420 mm)", w: 297, h: 420 },
  a4:     { label: "A4 (210 × 297 mm)", w: 210, h: 297 },
  letter: { label: "Letter (216 × 279 mm)", w: 216, h: 279 },
  legal:  { label: "Legal (216 × 356 mm)", w: 216, h: 356 },
  fit:    null, // use content size
};

export default function ExportDialog({ open, onClose, onExport, isExporting, defaultTitle }: Props) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("fit");
  const [customScalePct, setCustomScalePct] = useState(100);
  const [pixelRatio, setPixelRatio] = useState(2);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [includeTitle, setIncludeTitle] = useState(true);
  const [titleText, setTitleText] = useState(defaultTitle ?? "Struktur Organisasi");
  const [titleEdited, setTitleEdited] = useState(false);

  // Sync the default title (e.g. once the organization name loads) unless the
  // user has manually edited it.
  useEffect(() => {
    if (!titleEdited && defaultTitle) {
      setTitleText(defaultTitle);
    }
  }, [defaultTitle, titleEdited]);

  const handleExport = async () => {
    await onExport({
      format,
      paperSize,
      orientation,
      scaleMode,
      customScalePct,
      pixelRatio,
      bgColor,
      includeTitle,
      titleText,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Pengaturan Ekspor Bagan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Format File</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="flex gap-4"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">PDF</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                <RadioGroupItem value="png" id="fmt-png" />
                <ImageIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">PNG</span>
              </label>
            </RadioGroup>
          </div>

          <Separator />

          {/* Paper size – only for PDF */}
          {format === "pdf" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paper-size" className="text-sm font-semibold">Ukuran Kertas</Label>
                <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
                  <SelectTrigger id="paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit">Sesuai Konten</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a3">A3</SelectItem>
                    <SelectItem value="a2">A2</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paperSize !== "fit" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Orientasi</Label>
                  <RadioGroup
                    value={orientation}
                    onValueChange={(v) => setOrientation(v as Orientation)}
                    className="flex gap-3 pt-1"
                  >
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <RadioGroupItem value="landscape" id="ori-land" />
                      Landscape
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <RadioGroupItem value="portrait" id="ori-port" />
                      Portrait
                    </label>
                  </RadioGroup>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Scale */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Skala Bagan</Label>
            <RadioGroup
              value={scaleMode}
              onValueChange={(v) => setScaleMode(v as ScaleMode)}
              className="space-y-1.5"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="fit" id="scale-fit" />
                <span>Sesuaikan ke halaman <span className="text-muted-foreground">(fit to page)</span></span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="actual" id="scale-actual" />
                <span>Ukuran asli <span className="text-muted-foreground">(100%)</span></span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="custom" id="scale-custom" />
                <span>Kustom</span>
              </label>
            </RadioGroup>
            {scaleMode === "custom" ? (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="range"
                  min={25}
                  max={200}
                  step={5}
                  value={customScalePct}
                  onChange={(e) => setCustomScalePct(Number(e.target.value))}
                  className="w-40 accent-primary"
                />
                <span className="w-12 text-sm font-mono tabular-nums text-muted-foreground">
                  {customScalePct}%
                </span>
              </div>
            ) : null}
          </div>

          <Separator />

          {/* PNG-specific: resolution */}
          {format === "png" ? (
            <div className="space-y-2">
              <Label htmlFor="pixel-ratio" className="text-sm font-semibold">Resolusi</Label>
              <Select
                value={String(pixelRatio)}
                onValueChange={(v) => setPixelRatio(Number(v))}
              >
                <SelectTrigger id="pixel-ratio" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1× — Standar (72 dpi)</SelectItem>
                  <SelectItem value="2">2× — Tinggi (144 dpi)</SelectItem>
                  <SelectItem value="3">3× — Ultra (216 dpi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Background color */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Warna Latar</Label>
            <div className="flex items-center gap-3">
              {["#ffffff", "#f8fafc", "#1e293b", "#0f172a"].map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setBgColor(c)}
                  className="size-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: bgColor === c ? "hsl(var(--primary))" : "transparent",
                    boxShadow: bgColor === c ? "0 0 0 2px hsl(var(--primary)/0.3)" : undefined,
                  }}
                />
              ))}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="size-7 cursor-pointer rounded border"
                />
                Kustom
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-title"
                checked={includeTitle}
                onChange={(e) => setIncludeTitle(e.target.checked)}
                className="accent-primary"
              />
              <Label htmlFor="include-title" className="cursor-pointer text-sm font-semibold">
                Tambahkan Judul
              </Label>
            </div>
            {includeTitle ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={titleText}
                  onChange={(e) => { setTitleText(e.target.value); setTitleEdited(true); }}
                  placeholder="Nama Organisasi"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-xs text-muted-foreground">
                  Nama organisasi ditampilkan di baris atas, dan label "Struktur Organisasi" otomatis ditambahkan di bawahnya.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Batal
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Download className="size-4" />
            )}
            {isExporting ? "Mengekspor…" : `Ekspor ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
