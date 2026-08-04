import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Plus, Pencil, Upload, Loader2, FileText, X } from "lucide-react";
import { CANDIDATE_SOURCES } from "../_lib/recruitment-utils.ts";

type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      candidate: {
        _id: Id<"candidates">;
        firstName: string;
        lastName?: string;
        email: string;
        phone?: string;
        location?: string;
        currentTitle?: string;
        currentCompany?: string;
        linkedinUrl?: string;
        portfolioUrl?: string;
        yearsExperience?: number;
        expectedSalary?: number;
        noticeDays?: number;
        source: string;
        sourceDetail?: string;
        tags: Array<string>;
        skills: Array<string>;
        summary?: string;
        resumeStorageId?: Id<"_storage">;
        resumeFileName?: string;
        ownerId?: Id<"users">;
      };
    };

export default function CandidateFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.candidate : null;

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [currentTitle, setCurrentTitle] = useState(initial?.currentTitle ?? "");
  const [currentCompany, setCurrentCompany] = useState(
    initial?.currentCompany ?? "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedinUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initial?.portfolioUrl ?? "");
  const [yearsExperience, setYearsExperience] = useState(
    initial?.yearsExperience !== undefined ? String(initial.yearsExperience) : "",
  );
  const [expectedSalary, setExpectedSalary] = useState(
    initial?.expectedSalary ? String(initial.expectedSalary) : "",
  );
  const [noticeDays, setNoticeDays] = useState(
    initial?.noticeDays !== undefined ? String(initial.noticeDays) : "",
  );
  const [source, setSource] = useState(initial?.source ?? "linkedin");
  const [sourceDetail, setSourceDetail] = useState(initial?.sourceDetail ?? "");
  const [tagsInput, setTagsInput] = useState(
    (initial?.tags ?? []).join(", "),
  );
  const [skillsInput, setSkillsInput] = useState(
    (initial?.skills ?? []).join(", "),
  );
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [ownerId, setOwnerId] = useState<string>(initial?.ownerId ?? "none");
  const [resumeStorageId, setResumeStorageId] = useState<
    Id<"_storage"> | undefined
  >(initial?.resumeStorageId);
  const [resumeFileName, setResumeFileName] = useState<string | undefined>(
    initial?.resumeFileName,
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const employees = useQuery(api.users.listEmployees, open ? {} : "skip");
  const generateUrl = useMutation(api.recruitment.candidates.generateUploadUrl);
  const createCandidate = useMutation(api.recruitment.candidates.create);
  const updateCandidate = useMutation(api.recruitment.candidates.update);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const url = await generateUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const json = (await res.json()) as { storageId: Id<"_storage"> };
      setResumeStorageId(json.storageId);
      setResumeFileName(file.name);
      toast.success("CV berhasil diunggah");
    } catch {
      toast.error("Gagal mengunggah CV");
    } finally {
      setUploading(false);
    }
  };

  const parseCsv = (text: string): Array<string> =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const base = {
        firstName,
        lastName: lastName || undefined,
        email,
        phone: phone || undefined,
        location: location || undefined,
        currentTitle: currentTitle || undefined,
        currentCompany: currentCompany || undefined,
        linkedinUrl: linkedinUrl || undefined,
        portfolioUrl: portfolioUrl || undefined,
        yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
        expectedSalary: expectedSalary ? Number(expectedSalary) : undefined,
        noticeDays: noticeDays ? Number(noticeDays) : undefined,
        source,
        sourceDetail: sourceDetail || undefined,
        tags: parseCsv(tagsInput),
        skills: parseCsv(skillsInput),
        summary: summary || undefined,
        resumeStorageId,
        resumeFileName,
        ownerId:
          ownerId !== "none" ? (ownerId as Id<"users">) : undefined,
      };
      if (isEdit) {
        await updateCandidate({ id: props.candidate._id, ...base });
        toast.success("Kandidat diperbarui");
      } else {
        await createCandidate(base);
        toast.success("Kandidat ditambahkan");
      }
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan kandidat");
      } else {
        toast.error("Gagal menyimpan kandidat");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="ghost" className="cursor-pointer">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button className="cursor-pointer">
            <Plus className="size-4" />
            Kandidat Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ubah Kandidat" : "Tambah Kandidat"}
          </DialogTitle>
          <DialogDescription>
            Simpan profil kandidat dan unggah CV untuk proses rekrutmen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama depan</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama belakang (opsional)</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Nomor telepon</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62..."
              />
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Jakarta"
              />
            </div>
            <div className="space-y-2">
              <Label>Sumber</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Detail sumber (opsional)</Label>
              <Input
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                placeholder="Nama referrer / job board"
              />
            </div>
            <div className="space-y-2">
              <Label>Posisi saat ini</Label>
              <Input
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label>Perusahaan saat ini</Label>
              <Input
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                placeholder="Contoh: PT ABC"
              />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Portfolio URL</Label>
              <Input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Pengalaman (tahun)</Label>
              <Input
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ekspektasi gaji (IDR)</Label>
              <Input
                type="number"
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notice period (hari)</Label>
              <Input
                type="number"
                value={noticeDays}
                onChange={(e) => setNoticeDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner / Recruiter</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Saya</SelectItem>
                  {(employees ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Keahlian (pisahkan dengan koma)</Label>
            <Input
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="React, TypeScript, AWS"
            />
          </div>
          <div className="space-y-2">
            <Label>Tag (pisahkan dengan koma)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="frontend, senior"
            />
          </div>
          <div className="space-y-2">
            <Label>Ringkasan profil</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Insight singkat tentang kandidat..."
            />
          </div>

          <div className="space-y-2">
            <Label>CV / Resume</Label>
            {resumeStorageId ? (
              <div className="flex items-center gap-2 rounded-md border p-3">
                <FileText className="size-4 text-primary" />
                <span className="flex-1 truncate text-sm">
                  {resumeFileName ?? "CV tersimpan"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={() => {
                    setResumeStorageId(undefined);
                    setResumeFileName(undefined);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                <span>Pilih file PDF / DOCX</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isEdit ? "Simpan" : "Tambah Kandidat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
