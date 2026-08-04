import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { RotateCcw } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: Id<"assets">;
  assetName: string;
};

type Condition = "good" | "damaged" | "lost";

export default function ReturnAssetDialog({
  open,
  onOpenChange,
  assetId,
  assetName,
}: Props) {
  const [condition, setCondition] = useState<Condition>("good");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnAsset = useMutation(api.assets.returnAsset);

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      await returnAsset({
        assetId,
        returnCondition: condition,
        returnNote: note.trim() || undefined,
      });
      toast.success("Aset berhasil dikembalikan");
      onOpenChange(false);
      setCondition("good");
      setNote("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengembalikan aset");
      } else {
        toast.error("Gagal mengembalikan aset");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kembalikan Aset</DialogTitle>
          <DialogDescription>
            Tandai <span className="font-medium">{assetName}</span> sebagai
            telah dikembalikan dan catat kondisinya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kondisi saat kembali</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as Condition)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Baik - siap dipakai kembali</SelectItem>
                <SelectItem value="damaged">
                  Rusak - butuh perbaikan
                </SelectItem>
                <SelectItem value="lost">Hilang - aset tidak kembali</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {condition === "good"
                ? "Aset akan kembali berstatus Tersedia."
                : condition === "damaged"
                  ? "Aset akan ditandai untuk Perbaikan."
                  : "Aset akan ditandai sebagai Pensiun."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-note">Catatan (opsional)</Label>
            <Textarea
              id="return-note"
              rows={3}
              placeholder="Detail kondisi, aksesoris yang hilang, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
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
            onClick={handleReturn}
            disabled={submitting}
            className="cursor-pointer gap-2"
          >
            <RotateCcw className="size-4" />
            {submitting ? "Memproses..." : "Kembalikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
