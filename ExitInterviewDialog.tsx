import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
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
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { PRIMARY_REASON_OPTIONS } from "../_lib/offboarding-utils.ts";
import { cn } from "@/lib/utils.ts";
import { Star } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interviewId: Id<"exitInterviews"> | null;
};

function RatingInput({
  label,
  value,
  onChange,
  max = 5,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max }).map((_, i) => {
          const n = i + 1;
          const selected = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors cursor-pointer",
                selected
                  ? "border-amber-400 bg-amber-400/20 text-amber-600 dark:text-amber-300"
                  : "hover:bg-muted",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {max === 5 ? (
                <Star
                  className={cn(
                    "size-3.5",
                    selected ? "fill-current" : "",
                  )}
                />
              ) : (
                n
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ExitInterviewDialog({
  open,
  onOpenChange,
  interviewId,
}: Props) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [overall, setOverall] = useState<number | null>(null);
  const [recommend, setRecommend] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<number | null>(null);
  const [compensation, setCompensation] = useState<number | null>(null);
  const [management, setManagement] = useState<number | null>(null);
  const [wlb, setWlb] = useState<number | null>(null);
  const [growth, setGrowth] = useState<number | null>(null);
  const [culture, setCulture] = useState<number | null>(null);
  const [primary, setPrimary] = useState<string>("none");
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [whyLeaving, setWhyLeaving] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useMutation(api.offboarding.submitExitInterview);

  const reset = () => {
    setIsAnonymous(false);
    setOverall(null);
    setRecommend(null);
    setWouldReturn(null);
    setCompensation(null);
    setManagement(null);
    setWlb(null);
    setGrowth(null);
    setCulture(null);
    setPrimary("none");
    setLiked("");
    setImprove("");
    setWhyLeaving("");
    setSuggestions("");
  };

  const handleSubmit = async () => {
    if (!interviewId) return;
    if (overall === null) {
      toast.error("Berikan skor kepuasan keseluruhan");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        id: interviewId,
        isAnonymous,
        overallSatisfaction: overall ?? undefined,
        recommendScore: recommend ?? undefined,
        wouldReturnScore: wouldReturn ?? undefined,
        compensationRating: compensation ?? undefined,
        managementRating: management ?? undefined,
        workLifeBalanceRating: wlb ?? undefined,
        growthRating: growth ?? undefined,
        cultureRating: culture ?? undefined,
        primaryReason: primary !== "none" ? primary : undefined,
        likedMost: liked.trim() || undefined,
        areasForImprovement: improve.trim() || undefined,
        whyLeaving: whyLeaving.trim() || undefined,
        suggestions: suggestions.trim() || undefined,
      });
      toast.success("Terima kasih! Jawaban Anda telah dikirim.");
      reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim");
      } else {
        toast.error("Gagal mengirim");
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
          if (!v) reset();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exit Interview</DialogTitle>
          <DialogDescription>
            Feedback Anda sangat berharga untuk membuat perusahaan menjadi
            tempat kerja yang lebih baik.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Kirim Secara Anonim</p>
              <p className="text-xs text-muted-foreground">
                Jika aktif, nama Anda tidak akan ditampilkan ke HR untuk
                jawaban naratif.
              </p>
            </div>
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RatingInput
              label="Kepuasan Keseluruhan"
              value={overall}
              onChange={setOverall}
              disabled={submitting}
            />
            <RatingInput
              label="Kemungkinan Merekomendasikan (0-10)"
              value={recommend}
              onChange={setRecommend}
              max={10}
              disabled={submitting}
            />
            <RatingInput
              label="Mau Kembali di Masa Depan"
              value={wouldReturn}
              onChange={setWouldReturn}
              disabled={submitting}
            />
            <RatingInput
              label="Kompensasi"
              value={compensation}
              onChange={setCompensation}
              disabled={submitting}
            />
            <RatingInput
              label="Manajemen"
              value={management}
              onChange={setManagement}
              disabled={submitting}
            />
            <RatingInput
              label="Work-Life Balance"
              value={wlb}
              onChange={setWlb}
              disabled={submitting}
            />
            <RatingInput
              label="Pertumbuhan Karir"
              value={growth}
              onChange={setGrowth}
              disabled={submitting}
            />
            <RatingInput
              label="Budaya Kerja"
              value={culture}
              onChange={setCulture}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Alasan Utama</Label>
            <Select
              value={primary}
              onValueChange={setPrimary}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih alasan utama..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak dipilih</SelectItem>
                {PRIMARY_REASON_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="liked">Apa yang paling Anda sukai?</Label>
            <Textarea
              id="liked"
              rows={3}
              value={liked}
              onChange={(e) => setLiked(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="improve">Area yang perlu diperbaiki</Label>
            <Textarea
              id="improve"
              rows={3}
              value={improve}
              onChange={(e) => setImprove(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="why">Alasan mengapa Anda pergi</Label>
            <Textarea
              id="why"
              rows={3}
              value={whyLeaving}
              onChange={(e) => setWhyLeaving(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggestions">Saran untuk perusahaan</Label>
            <Textarea
              id="suggestions"
              rows={3}
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || overall === null}
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Exit Interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
