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
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { X } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/pages/training/_lib/training-utils.ts";

type InitialValues = {
  headline: string;
  bio: string;
  expertise: Array<string>;
  categories: Array<string>;
  preferredMentee: string;
  preferredChannel?: string;
  capacity: number;
  availability?: string;
  isAcceptingRequests: boolean;
  isPublished: boolean;
};

export default function MentorProfileDialog({
  trigger,
  initialValues,
}: {
  trigger: React.ReactNode;
  initialValues?: InitialValues;
}) {
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState(initialValues?.headline ?? "");
  const [bio, setBio] = useState(initialValues?.bio ?? "");
  const [expertise, setExpertise] = useState<Array<string>>(
    initialValues?.expertise ?? [],
  );
  const [expertiseInput, setExpertiseInput] = useState("");
  const [categories, setCategories] = useState<Array<string>>(
    initialValues?.categories ?? [],
  );
  const [preferredMentee, setPreferredMentee] = useState(
    initialValues?.preferredMentee ?? "any",
  );
  const [preferredChannel, setPreferredChannel] = useState(
    initialValues?.preferredChannel ?? "",
  );
  const [capacity, setCapacity] = useState(initialValues?.capacity ?? 3);
  const [availability, setAvailability] = useState(
    initialValues?.availability ?? "",
  );
  const [isAcceptingRequests, setIsAcceptingRequests] = useState(
    initialValues?.isAcceptingRequests ?? true,
  );
  const [isPublished, setIsPublished] = useState(
    initialValues?.isPublished ?? true,
  );
  const [submitting, setSubmitting] = useState(false);

  const upsert = useMutation(api.training.mentors.upsertMyMentorProfile);

  const addExpertise = () => {
    const v = expertiseInput.trim();
    if (!v) return;
    if (expertise.includes(v)) return;
    setExpertise([...expertise, v]);
    setExpertiseInput("");
  };

  const toggleCategory = (val: string) => {
    setCategories((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
    );
  };

  const handleSubmit = async () => {
    if (!headline.trim()) {
      toast.error("Headline wajib diisi");
      return;
    }
    if (!bio.trim()) {
      toast.error("Bio wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await upsert({
        headline,
        bio,
        expertise,
        categories,
        preferredMentee,
        preferredChannel: preferredChannel || undefined,
        capacity,
        availability: availability || undefined,
        isAcceptingRequests,
        isPublished,
      });
      toast.success("Profil mentor tersimpan");
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Profil mentor</DialogTitle>
          <DialogDescription>
            Bagikan keahlian Anda agar karyawan lain dapat meminta mentorship.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Contoh: Mentor Frontend & React"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Pengalaman & pendekatan mentoring Anda..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Keahlian (tag)</Label>
            <div className="flex gap-2">
              <Input
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExpertise();
                  }
                }}
                placeholder="Ketik lalu tekan Enter..."
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={addExpertise}
              >
                Tambah
              </Button>
            </div>
            {expertise.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {expertise.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setExpertise(expertise.filter((t) => t !== tag))
                      }
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Kategori mentorship</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => {
                const active = categories.includes(c.value);
                return (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => toggleCategory(c.value)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Level mentee</Label>
              <Select value={preferredMentee} onValueChange={setPreferredMentee}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Semua level</SelectItem>
                  <SelectItem value="beginner">Pemula</SelectItem>
                  <SelectItem value="intermediate">Menengah</SelectItem>
                  <SelectItem value="advanced">Lanjutan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kapasitas mentee</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Saluran komunikasi (opsional)</Label>
            <Input
              value={preferredChannel}
              onChange={(e) => setPreferredChannel(e.target.value)}
              placeholder="Contoh: Zoom, Google Meet, WhatsApp"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ketersediaan (opsional)</Label>
            <Input
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="Contoh: Senin & Kamis, 19:00-20:00 WIB"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Terima permintaan baru</p>
              <p className="text-xs text-muted-foreground">
                Matikan ketika kapasitas Anda sudah penuh.
              </p>
            </div>
            <Switch
              checked={isAcceptingRequests}
              onCheckedChange={setIsAcceptingRequests}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Tampilkan di direktori</p>
              <p className="text-xs text-muted-foreground">
                Nonaktifkan untuk menyembunyikan profil.
              </p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
