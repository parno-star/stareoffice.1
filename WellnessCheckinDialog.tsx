import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { Lock, Plus, X } from "lucide-react";
import {
  MOOD_ICONS,
  WELLNESS_TAG_SUGGESTIONS,
} from "@/pages/engagement/_lib/engagement-utils.ts";

export default function WellnessCheckinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = useQuery(api.engagement.getTodayWellness, open ? {} : "skip");
  const record = useMutation(api.engagement.recordWellness);
  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState<number>(3);
  const [stress, setStress] = useState<number>(3);
  const [workload, setWorkload] = useState<number>(3);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<Array<string>>([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing check-in for today
  useEffect(() => {
    if (today && open) {
      setMood(today.moodScore);
      setEnergy(today.energyScore ?? 3);
      setStress(today.stressScore ?? 3);
      setWorkload(today.workloadScore ?? 3);
      setNote(today.note ?? "");
      setTags(today.tags);
    } else if (!open) {
      // reset on close
      setMood(3);
      setEnergy(3);
      setStress(3);
      setWorkload(3);
      setNote("");
      setTags([]);
      setCustomTag("");
    }
  }, [today, open]);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const t = customTag.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await record({
        moodScore: mood,
        energyScore: energy,
        stressScore: stress,
        workloadScore: workload,
        note: note.trim() || undefined,
        tags,
      });
      toast.success("Check-in wellness tersimpan");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan check-in");
      } else {
        toast.error("Gagal menyimpan check-in");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-in Wellness Hari Ini</DialogTitle>
          <DialogDescription>
            Refleksikan perasaan dan energi Anda hari ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3">
          <Lock className="size-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <p className="font-medium text-sm text-blue-700 dark:text-blue-300">
              Pribadi
            </p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
              Check-in ini hanya bisa dilihat oleh Anda. HR dan atasan tidak
              dapat melihatnya.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label>Mood</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {MOOD_ICONS.map((m) => {
                const selected = mood === m.value;
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border py-3 cursor-pointer transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-6",
                        selected ? m.color : "text-muted-foreground",
                      )}
                    />
                    <span className="text-[10px] font-medium text-center">
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <SliderRow
            label="Energi"
            value={energy}
            onChange={setEnergy}
            minLabel="Habis"
            maxLabel="Penuh"
          />
          <SliderRow
            label="Tingkat Stres"
            value={stress}
            onChange={setStress}
            minLabel="Rileks"
            maxLabel="Tinggi"
          />
          <SliderRow
            label="Beban Kerja"
            value={workload}
            onChange={setWorkload}
            minLabel="Ringan"
            maxLabel="Berat"
          />

          <div className="space-y-2">
            <Label>Tag Perasaan</Label>
            <div className="flex flex-wrap gap-2">
              {WELLNESS_TAG_SUGGESTIONS.map((t) => {
                const selected = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={cn(
                      "text-xs rounded-full px-3 py-1 border cursor-pointer transition-colors capitalize",
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="Tag lain..."
                className="flex-1 h-9 rounded-md border bg-background px-3 text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addCustomTag}
                className="cursor-pointer"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {tags.filter((t) => !WELLNESS_TAG_SUGGESTIONS.includes(t)).length >
              0 && (
              <div className="flex flex-wrap gap-1">
                {tags
                  .filter((t) => !WELLNESS_TAG_SUGGESTIONS.includes(t))
                  .map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="pl-2 pr-1 py-0.5"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => toggleTag(t)}
                        className="ml-1 cursor-pointer rounded hover:bg-background/50"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Apa yang ada di pikiran Anda hari ini?"
              rows={3}
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
            disabled={saving}
            className="cursor-pointer"
          >
            {saving
              ? "Menyimpan..."
              : today
                ? "Perbarui Check-in"
                : "Simpan Check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant="secondary">{value} / 5</Badge>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 3)}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
