import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Upload, FileCheck } from "lucide-react";
import { CATEGORY_OPTIONS } from "../_lib/training-utils.ts";

type Props = {
  trigger: ReactNode;
};

export default function ExternalTrainingDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [durationHours, setDurationHours] = useState("");
  const [completedDate, setCompletedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [expiryDate, setExpiryDate] = useState("");
  const [cost, setCost] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const generateUrl = useMutation(api.training.external.generateUploadUrl);
  const submit = useMutation(api.training.external.submitExternalTraining);

  const reset = () => {
    setTitle("");
    setProvider("");
    setDescription("");
    setCategory("other");
    setDurationHours("");
    setCompletedDate(new Date().toISOString().slice(0, 10));
    setExpiryDate("");
    setCost("");
    setCertificateUrl("");
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !provider.trim() || !completedDate) {
      toast.error("Judul, penyelenggara & tanggal wajib diisi");
      return;
    }
    setBusy(true);
    try {
      let storageId: string | undefined;
      let fileName: string | undefined;
      if (file) {
        const url = await generateUrl({});
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!resp.ok) throw new Error("Upload gagal");
        const json = (await resp.json()) as { storageId: string };
        storageId = json.storageId;
        fileName = file.name;
      }
      await submit({
        title: title.trim(),
        provider: provider.trim(),
        description: description.trim() || undefined,
        category,
        durationHours: durationHours ? Number(durationHours) : undefined,
        completedDate,
        expiryDate: expiryDate || undefined,
        certificateStorageId: storageId
          ? (storageId as Id<"_storage">)
          : undefined,
        certificateFileName: fileName,
        certificateUrl: certificateUrl.trim() || undefined,
        cost: cost ? Number(cost) : undefined,
      });
      toast.success("Sertifikat dikirim untuk direview");
      reset();
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : err instanceof Error
            ? err.message
            : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah sertifikat eksternal</DialogTitle>
            <DialogDescription>
              Unggah sertifikat pelatihan dari luar perusahaan. Admin akan
              memverifikasi sebelum dihitung.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="t">Judul pelatihan</Label>
              <Input
                id="t"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p">Penyelenggara</Label>
              <Input
                id="p"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Coursera, Dicoding, kantor klien, dsb"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d">Deskripsi</Label>
              <Textarea
                id="d"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dh">Durasi (jam)</Label>
                <Input
                  id="dh"
                  type="number"
                  min={0}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cd">Tanggal selesai</Label>
                <DateField
                  id="cd"
                  value={completedDate}
                  onChange={(v) => setCompletedDate(v)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed">Tanggal kedaluwarsa</Label>
                <DateField
                  id="ed"
                  value={expiryDate}
                  onChange={(v) => setExpiryDate(v)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cost">Biaya (IDR)</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="url">URL sertifikat</Label>
              <Input
                id="url"
                value={certificateUrl}
                onChange={(e) => setCertificateUrl(e.target.value)}
                placeholder="Link ke sertifikat online (opsional)"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="file">File sertifikat (PDF/gambar)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileCheck className="size-3.5" /> {file.name}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="cursor-pointer gap-1"
            >
              <Upload className="size-4" />
              {busy ? "Mengirim..." : "Kirim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
