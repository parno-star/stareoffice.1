import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function CompleteMentorshipDialog({
  trigger,
  mentorshipId,
  isMentee,
}: {
  trigger: React.ReactNode;
  mentorshipId: Id<"mentorships">;
  isMentee: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const complete = useMutation(api.training.mentorships.completeMentorship);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await complete({
        mentorshipId,
        menteeRating: isMentee && rating ? rating : undefined,
        menteeFeedback: isMentee && feedback ? feedback : undefined,
      });
      toast.success("Mentorship diselesaikan");
      setOpen(false);
      setRating(null);
      setFeedback("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selesaikan mentorship</DialogTitle>
          <DialogDescription>
            {isMentee
              ? "Beri rating & feedback untuk membantu mentor berkembang."
              : "Tandai mentorship selesai. Anda dapat memberi catatan penutup di detail sesi."}
          </DialogDescription>
        </DialogHeader>
        {isMentee ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRating(v)}
                    className="cursor-pointer p-1"
                  >
                    <Star
                      className={cn(
                        "size-6 transition-colors",
                        rating !== null && v <= rating
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Feedback (opsional)</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Apa yang paling membantu dari mentor Anda?"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Selesaikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
