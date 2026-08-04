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
import { Slider } from "@/components/ui/slider.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { formatMetricValue } from "../_lib/okr-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: Doc<"keyResults"> | null;
};

export default function CheckInDialog({
  open,
  onOpenChange,
  keyResult,
}: Props) {
  const checkIn = useMutation(api.okr.keyResults.checkInKeyResult);
  const [newValue, setNewValue] = useState("");
  const [confidence, setConfidence] = useState(70);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !keyResult) return;
    setNewValue(String(keyResult.currentValue));
    setConfidence(keyResult.confidence);
    setNote("");
  }, [open, keyResult]);

  if (!keyResult) return null;

  const isBoolean = keyResult.metricType === "boolean";

  const handleSubmit = async () => {
    const n = Number(newValue);
    if (Number.isNaN(n)) {
      toast.error("Masukkan angka yang valid");
      return;
    }
    setSubmitting(true);
    try {
      await checkIn({
        keyResultId: keyResult._id,
        newValue: n,
        confidence,
        note: note.trim() || undefined,
      });
      toast.success("Check-in tersimpan");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal check-in");
      } else {
        toast.error("Gagal check-in");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in Progress</DialogTitle>
          <DialogDescription>{keyResult.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dari</span>
              <span className="font-medium">
                {formatMetricValue(
                  keyResult.startValue,
                  keyResult.metricType,
                  keyResult.unit,
                )}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Sekarang</span>
              <span className="font-medium">
                {formatMetricValue(
                  keyResult.currentValue,
                  keyResult.metricType,
                  keyResult.unit,
                )}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Target</span>
              <span className="font-medium">
                {formatMetricValue(
                  keyResult.targetValue,
                  keyResult.metricType,
                  keyResult.unit,
                )}
              </span>
            </div>
          </div>

          {isBoolean ? (
            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newValue === "0" ? "default" : "secondary"}
                  className="flex-1 cursor-pointer"
                  onClick={() => setNewValue("0")}
                >
                  Belum
                </Button>
                <Button
                  type="button"
                  variant={newValue === "1" ? "default" : "secondary"}
                  className="flex-1 cursor-pointer"
                  onClick={() => setNewValue("1")}
                >
                  Selesai
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="newval">Nilai baru</Label>
              <Input
                id="newval"
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Keyakinan</Label>
              <span className="text-sm font-medium">{confidence}%</span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={(v) => setConfidence(v[0] ?? 0)}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Apa yang kamu lakukan? Kendala?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Simpan check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
