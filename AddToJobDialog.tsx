import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Loader2 } from "lucide-react";
import { RECRUITMENT_STAGES, STAGE_CONFIG } from "../_lib/recruitment-utils.ts";

export default function AddToJobDialog({
  candidateId,
  onClose,
}: {
  candidateId: Id<"candidates"> | null;
  onClose: () => void;
}) {
  const [jobId, setJobId] = useState<string>("none");
  const [stage, setStage] = useState<string>("applied");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = candidateId !== null;
  const jobs = useQuery(
    api.recruitment.jobs.list,
    open ? { status: "open" } : "skip",
  );
  const addToJob = useMutation(api.recruitment.applications.add);

  useEffect(() => {
    if (!open) {
      setJobId("none");
      setStage("applied");
      setCoverLetter("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!candidateId || jobId === "none") {
      toast.error("Pilih lowongan");
      return;
    }
    try {
      setSubmitting(true);
      await addToJob({
        candidateId,
        jobId: jobId as Id<"recruitmentJobs">,
        stage,
        coverLetter: coverLetter.trim() || undefined,
      });
      toast.success("Kandidat ditambahkan ke lowongan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      } else {
        toast.error("Gagal menambahkan ke lowongan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambahkan ke Lowongan</DialogTitle>
          <DialogDescription>
            Pilih lowongan dan stage awal untuk kandidat ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lowongan terbuka</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih lowongan..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih lowongan...</SelectItem>
                {(jobs ?? []).map((j) => (
                  <SelectItem key={j._id} value={j._id}>
                    {j.title} · {j.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Stage awal</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECRUITMENT_STAGES.filter(
                  (s) =>
                    s !== "hired" && s !== "rejected" && s !== "withdrawn",
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cover letter / catatan (opsional)</Label>
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={3}
              placeholder="Ringkas mengapa kandidat cocok..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
