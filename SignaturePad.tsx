import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eraser, PenLine, Type, Upload, X } from "lucide-react";

type SignatureType = "drawn" | "typed" | "upload";

type Props = {
  onSave: (data: string, type: SignatureType, role: string) => void;
  onCancel: () => void;
  initialRole?: string;
  // Hide the "Peran Penandatangan" selector. Used when saving a personal
  // default signature (profile) where a signing role is not relevant.
  showRole?: boolean;
};

const SIGNATURE_ROLES = [
  { value: "penandatangan", label: "Penandatangan" },
  { value: "mengetahui", label: "Mengetahui" },
  { value: "menyetujui", label: "Menyetujui" },
  { value: "saksi", label: "Saksi" },
  { value: "penerima", label: "Penerima" },
];

const TYPED_FONTS = [
  { label: "Kursif Elegan", font: "'Dancing Script', cursive" },
  { label: "Tulisan Tangan", font: "'Pacifico', cursive" },
  { label: "Formal", font: "'Great Vibes', cursive" },
];

export default function SignaturePad({ onSave, onCancel, initialRole = "penandatangan", showRole = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [selectedFont, setSelectedFont] = useState(TYPED_FONTS[0].font);
  const [role, setRole] = useState(initialRole);
  const [activeTab, setActiveTab] = useState<SignatureType>("drawn");

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load cursive fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Pacifico&family=Great+Vibes&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    setIsDrawing(true);
    setLastPos(pos);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing || !lastPos) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setLastPos(pos);
      setHasDrawing(true);
    },
    [isDrawing, lastPos],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setLastPos(null);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const renderTypedToCanvas = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `52px ${selectedFont}`;
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Hanya file gambar yang diperbolehkan (PNG, JPG, SVG)");
      return;
    }
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setUploadError(null);
  };

  const isSaveDisabled = () => {
    if (activeTab === "drawn") return !hasDrawing;
    if (activeTab === "typed") return !typedName.trim();
    if (activeTab === "upload") return !uploadedImage;
    return true;
  };

  const handleSave = () => {
    if (activeTab === "drawn") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawing) return;
      onSave(canvas.toDataURL("image/png"), "drawn", role);
    } else if (activeTab === "typed") {
      if (!typedName.trim()) return;
      onSave(renderTypedToCanvas(), "typed", role);
    } else if (activeTab === "upload") {
      if (!uploadedImage) return;
      onSave(uploadedImage, "upload", role);
    }
  };

  return (
    <div className="space-y-4">
      {showRole && (
        <div className="flex items-center gap-3">
          <Label>Peran Penandatangan</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIGNATURE_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SignatureType)}>
        <TabsList className="w-full">
          <TabsTrigger value="drawn" className="flex-1 gap-1.5 text-xs">
            <PenLine className="h-3.5 w-3.5" />
            Gambar Tangan
          </TabsTrigger>
          <TabsTrigger value="typed" className="flex-1 gap-1.5 text-xs">
            <Type className="h-3.5 w-3.5" />
            Ketik Nama
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Upload Gambar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drawn" className="space-y-2">
          <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full touch-none cursor-crosshair"
              style={{ height: "200px" }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground text-sm">Tanda tangani di sini...</p>
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="gap-1">
            <Eraser className="h-4 w-4" />
            Hapus
          </Button>
        </TabsContent>

        <TabsContent value="typed" className="space-y-3">
          <div>
            <Label className="mb-1 block">Nama</Label>
            <Input
              placeholder="Ketik nama Anda..."
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block">Gaya Font</Label>
            <div className="flex gap-2 flex-wrap">
              {TYPED_FONTS.map((f) => (
                <button
                  key={f.font}
                  type="button"
                  onClick={() => setSelectedFont(f.font)}
                  className={`px-3 py-2 rounded border text-lg transition-colors ${
                    selectedFont === f.font
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  }`}
                  style={{ fontFamily: f.font }}
                >
                  {typedName || f.label}
                </button>
              ))}
            </div>
          </div>
          {typedName && (
            <div
              className="border rounded-lg bg-white p-6 flex items-center justify-center"
              style={{ height: "120px" }}
            >
              <span
                className="text-4xl text-slate-800"
                style={{ fontFamily: selectedFont }}
              >
                {typedName}
              </span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-3">
          {uploadedImage ? (
            <div className="space-y-2">
              <div className="relative border-2 rounded-lg bg-white overflow-hidden flex items-center justify-center" style={{ height: "200px" }}>
                <img
                  src={uploadedImage}
                  alt="Tanda tangan"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <button
                  type="button"
                  onClick={clearUpload}
                  className="absolute top-2 right-2 rounded-full bg-destructive text-white p-1 hover:bg-destructive/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1"
              >
                <Upload className="h-4 w-4" />
                Ganti Gambar
              </Button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              style={{ height: "200px" }}
            >
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">Klik untuk upload gambar tanda tangan</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG — Maks. 2MB</p>
                <p className="text-xs text-muted-foreground">Disarankan menggunakan gambar dengan latar transparan (PNG)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaveDisabled()}
        >
          Simpan Tanda Tangan
        </Button>
      </div>
    </div>
  );
}
