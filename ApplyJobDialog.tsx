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
import { Progress } from "@/components/ui/progress.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, X, FileText } from "lucide-react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  MAX_RESUME_SIZE,
  formatFileSize,
} from "../_lib/job-utils.ts";

type Props = {
  jobId: Id<"jobPostings">;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ApplyJobDialog({
  jobId,
  jobTitle,
  open,
  onOpenChange,
}: Props) {
  const [coverLetter, setCoverLetter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const apply = useMutation(api.jobs.apply);

  const reset = () => {
    setCoverLetter("");
    setFile(null);
    setSubmitting(false);
    setProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_RESUME_SIZE) {
      toast.error(
        `Ukuran file terlalu besar. Maksimal ${formatFileSize(MAX_RESUME_SIZE)}.`,
      );
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    const trimmed = coverLetter.trim();
    if (trimmed.length < 20) {
      toast.error("Surat lamaran terlalu singkat (minimum 20 karakter)");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      let resumeStorageId: Id<"_storage"> | undefined;
      let resumeFileName: string | undefined;

      if (file) {
        const uploadUrl = await generateUploadUrl({});
        const storageId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const { storageId: id } = JSON.parse(xhr.responseText) as {
                  storageId: string;
                };
                resolve(id);
              } catch {
                reject(new Error("Gagal membaca respons upload"));
              }
            } else {
              reject(new Error(`Upload gagal (${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload gagal"));
          xhr.send(file);
        });
        resumeStorageId = storageId as Id<"_storage">;
        resumeFileName = file.name;
      }

      await apply({
        jobId,
        coverLetter: trimmed,
        resumeStorageId,
        resumeFileName,
      });
      toast.success("Lamaran berhasil dikirim");
      onOpenChange(false);
      reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim lamaran");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal mengirim lamaran");
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
          onOpenChange(v);
          if (!v) reset();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lamar: {jobTitle}</DialogTitle>
          <DialogDescription>
            Jelaskan mengapa Anda tertarik dan sesuai untuk posisi ini. Unggah
            CV untuk memperkuat lamaran.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cover-letter">Surat Lamaran</Label>
            <Textarea
              id="cover-letter"
              rows={7}
              placeholder="Ceritakan pengalaman, motivasi, dan bagaimana Anda bisa berkontribusi di posisi ini..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              disabled={submitting}
              maxLength={3000}
            />
            <p className="text-xs text-muted-foreground">
              Min. 20 karakter · {coverLetter.length}/3000
            </p>
          </div>

          <div className="space-y-2">
            <Label>CV / Resume (opsional)</Label>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => setFile(null)}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="resume-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-6 text-center transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Klik untuk unggah CV
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maks. {formatFileSize(MAX_RESUME_SIZE)} (PDF, DOC)
                  </p>
                </div>
                <Input
                  id="resume-upload"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>
            )}
          </div>

          {submitting && file ? (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Mengunggah... {progress}%
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Lamaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
