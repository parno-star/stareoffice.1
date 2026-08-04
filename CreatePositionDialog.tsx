import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";

export default function CreatePositionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [jobFamily, setJobFamily] = useState("");
  const [summary, setSummary] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createPosition = useMutation(api.grading.createPosition);

  const reset = () => {
    setTitle("");
    setDepartment("");
    setJobFamily("");
    setSummary("");
    setJobDescription("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !department.trim() || !summary.trim()) {
      toast.error("Judul, departemen, dan ringkasan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await createPosition({
        title: title.trim(),
        department: department.trim(),
        jobFamily: jobFamily.trim() || undefined,
        summary: summary.trim(),
        jobDescription: jobDescription.trim(),
      });
      toast.success("Jabatan berhasil ditambahkan");
      reset();
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan jabatan");
      } else {
        toast.error("Gagal menambahkan jabatan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="size-4" />
          Tambah Jabatan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Jabatan Baru</DialogTitle>
          <DialogDescription>
            Jabatan ini akan dievaluasi menggunakan 7 faktor WTW GGS untuk
            menentukan Global Grade-nya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Nama Jabatan <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Senior Software Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Departemen <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Job Family</Label>
            <Input
              placeholder="Technology, Finance, Sales, dll."
              value={jobFamily}
              onChange={(e) => setJobFamily(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Ringkasan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              rows={2}
              placeholder="Mission statement singkat peran ini (1-2 kalimat)."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Job Description (Markdown)</Label>
            <Textarea
              rows={6}
              placeholder="Tanggung jawab, kualifikasi, dan deskripsi lengkap peran..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Simpan Jabatan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
