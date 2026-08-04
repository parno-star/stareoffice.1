import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Hash, Settings, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

const LETTER_TYPES = [
  { value: "keluar", label: "Surat Keluar" },
  { value: "masuk", label: "Surat Masuk" },
  { value: "memo", label: "Nota" },
];

const FORMAT_EXAMPLES = [
  { format: "{PREFIX}/{SEQ3}/{MM}/{YYYY}", desc: "Contoh: SEKR/001/04/2025" },
  { format: "{PREFIX}/{SEQ3}/{BULAN}/{YYYY}", desc: "Contoh: SEKR/001/IV/2025" },
  { format: "{SEQ4}/{YYYY}", desc: "Contoh: 0001/2025" },
  { format: "{PREFIX}-{SEQ3}-{YY}", desc: "Contoh: SKL-001-25" },
];

export default function LetterNumberConfigPanel() {
  const configs = useQuery(api.letters.listLetterNumberConfigs);
  const generatePreview = useMutation(api.letters.generateLetterNumber);
  const upsertConfig = useMutation(api.letters.upsertLetterNumberConfig);

  const [open, setOpen] = useState(false);
  const [editType, setEditType] = useState("keluar");
  const [format, setFormat] = useState("{PREFIX}/{SEQ3}/{BULAN}/{YYYY}");
  const [prefix, setPrefix] = useState("");
  const [resetPeriod, setResetPeriod] = useState("yearly");
  const [lastSequence, setLastSequence] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const openEdit = (letterType: string) => {
    const existing = configs?.find((c) => c.letterType === letterType);
    setEditType(letterType);
    setFormat(existing?.format ?? "{PREFIX}/{SEQ3}/{BULAN}/{YYYY}");
    setPrefix(existing?.prefix ?? "");
    setResetPeriod(existing?.resetPeriod ?? "yearly");
    setLastSequence(existing?.lastSequence ?? 0);
    setPreview(null);
    setOpen(true);
  };

  const handlePreview = async () => {
    try {
      const result = await generatePreview({ letterType: editType, preview: true });
      setPreview(result);
    } catch {
      toast.error("Gagal generate preview");
    }
  };

  const handleSave = async () => {
    try {
      await upsertConfig({ letterType: editType, format, prefix: prefix || undefined, resetPeriod, lastSequence });
      toast.success("Konfigurasi penomoran disimpan");
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan konfigurasi");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Penomoran Surat Otomatis</h3>
      </div>

      <div className="grid gap-3">
        {LETTER_TYPES.map((lt) => {
          const cfg = configs?.find((c) => c.letterType === lt.value);
          return (
            <div
              key={lt.value}
              className="flex items-center justify-between border rounded-lg p-4 bg-muted/30"
            >
              <div>
                <p className="font-medium text-sm">{lt.label}</p>
                {cfg ? (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Format: <code className="bg-muted px-1 rounded">{cfg.format}</code></p>
                    <p>Urutan terakhir: <strong>{cfg.lastSequence}</strong> &middot; Reset: <Badge variant="outline" className="text-xs">{cfg.resetPeriod}</Badge></p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 italic">Belum dikonfigurasi (pakai default)</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(lt.value)} className="gap-1">
                <Settings className="h-3.5 w-3.5" />
                Atur
              </Button>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Konfigurasi Penomoran — {LETTER_TYPES.find((t) => t.value === editType)?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Format Nomor Surat</Label>
              <Input
                value={format}
                onChange={(e) => { setFormat(e.target.value); setPreview(null); }}
                placeholder="{PREFIX}/{SEQ3}/{BULAN}/{YYYY}"
              />
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Variabel yang tersedia:
                </p>
                <div className="flex flex-wrap gap-1">
                  {["{PREFIX}", "{SEQ3}", "{SEQ4}", "{MM}", "{BULAN}", "{YYYY}", "{YY}"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setFormat((f) => f + v); setPreview(null); }}
                      className="text-xs bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded font-mono cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Contoh format:</p>
                {FORMAT_EXAMPLES.map((ex) => (
                  <button
                    key={ex.format}
                    type="button"
                    onClick={() => { setFormat(ex.format); setPreview(null); }}
                    className="block text-xs text-left w-full hover:bg-muted px-2 py-1 rounded"
                  >
                    <code className="font-mono">{ex.format}</code>
                    <span className="text-muted-foreground ml-1">→ {ex.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Prefix / Kode Unit</Label>
              <Input
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setPreview(null); }}
                placeholder="SEKR, HRD, dll."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Reset Urutan</Label>
                <Select value={resetPeriod} onValueChange={(v) => { setResetPeriod(v); setPreview(null); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Setiap Bulan</SelectItem>
                    <SelectItem value="yearly">Setiap Tahun</SelectItem>
                    <SelectItem value="never">Tidak Pernah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Urutan Saat Ini</Label>
                <Input
                  type="number"
                  min={0}
                  value={lastSequence}
                  onChange={(e) => setLastSequence(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handlePreview} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" />
                Preview Nomor
              </Button>
              {preview && (
                <code className="text-sm font-mono bg-primary/10 text-primary px-3 py-1 rounded">
                  {preview}
                </code>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
