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
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, X } from "lucide-react";
import { ConvexError } from "convex/values";
import { CATEGORY_CONFIG } from "@/pages/calendar/_lib/calendar-utils.ts";
import { EVENT_TYPES } from "../_lib/events-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const MAX_BANNER_SIZE = 8 * 1024 * 1024; // 8 MB

const schema = z
  .object({
    title: z.string().min(1, "Judul wajib diisi").max(120),
    category: z.string().min(1),
    eventType: z.string().min(1),
    description: z.string().max(2000).optional(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    allDay: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().max(200).optional(),
    capacity: z
      .string()
      .optional()
      .refine(
        (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0),
        "Kapasitas harus berupa angka positif",
      ),
    rsvpDeadline: z.string().optional(),
    isFeatured: z.boolean(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  })
  .refine((v) => !v.rsvpDeadline || v.rsvpDeadline <= v.startDate, {
    message: "Batas RSVP tidak boleh melewati tanggal mulai",
    path: ["rsvpDeadline"],
  });

type FormValues = z.infer<typeof schema>;

export type EventEditValues = {
  id: Id<"events">;
  title: string;
  category: string;
  eventType: string | undefined;
  description?: string | undefined;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string | undefined;
  endTime?: string | undefined;
  location?: string | undefined;
  capacity?: number | undefined;
  rsvpDeadline?: string | undefined;
  isFeatured: boolean;
  bannerUrl: string | null;
};

export default function EventFormDialog({
  defaultDate,
  trigger,
  editValues,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultDate?: string;
  trigger?: React.ReactNode;
  editValues?: EventEditValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [clearBanner, setClearBanner] = useState(false);
  const [existingBannerUrl, setExistingBannerUrl] = useState<string | null>(
    editValues?.bannerUrl ?? null,
  );

  const create = useMutation(api.events.create);
  const update = useMutation(api.events.update);
  const generateUploadUrl = useMutation(api.events.generateBannerUploadUrl);

  const today = defaultDate ?? new Date().toISOString().slice(0, 10);
  const isEdit = !!editValues;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editValues
      ? {
          title: editValues.title,
          category: editValues.category,
          eventType: editValues.eventType ?? "gathering",
          description: editValues.description ?? "",
          startDate: editValues.startDate,
          endDate: editValues.endDate,
          allDay: editValues.allDay,
          startTime: editValues.startTime ?? "09:00",
          endTime: editValues.endTime ?? "10:00",
          location: editValues.location ?? "",
          capacity:
            typeof editValues.capacity === "number"
              ? String(editValues.capacity)
              : "",
          rsvpDeadline: editValues.rsvpDeadline ?? "",
          isFeatured: editValues.isFeatured,
        }
      : {
          title: "",
          category: "event",
          eventType: "gathering",
          description: "",
          startDate: today,
          endDate: today,
          allDay: true,
          startTime: "09:00",
          endTime: "10:00",
          location: "",
          capacity: "",
          rsvpDeadline: "",
          isFeatured: false,
        },
  });

  // Sync existing banner when editValues or open changes
  useEffect(() => {
    if (open) {
      setExistingBannerUrl(editValues?.bannerUrl ?? null);
      setBannerFile(null);
      setClearBanner(false);
      setProgress(0);
    }
  }, [open, editValues]);

  const allDay = form.watch("allDay");

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_BANNER_SIZE) {
      toast.error("Ukuran gambar maksimal 8 MB");
      e.target.value = "";
      return;
    }
    setBannerFile(f);
    setClearBanner(false);
  };

  const uploadBanner = async (): Promise<Id<"_storage"> | undefined> => {
    if (!bannerFile) return undefined;
    const uploadUrl = await generateUploadUrl({});
    const storageId = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      xhr.setRequestHeader(
        "Content-Type",
        bannerFile.type || "application/octet-stream",
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
      xhr.send(bannerFile);
    });
    return storageId as Id<"_storage">;
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    setProgress(0);
    try {
      const bannerId = await uploadBanner();
      const capacityNum =
        values.capacity && values.capacity.trim() !== ""
          ? Number(values.capacity)
          : undefined;

      if (isEdit && editValues) {
        await update({
          id: editValues.id,
          title: values.title,
          description: values.description,
          category: values.category,
          eventType: values.eventType,
          startDate: values.startDate,
          endDate: values.endDate,
          allDay: values.allDay,
          startTime: values.allDay ? undefined : values.startTime,
          endTime: values.allDay ? undefined : values.endTime,
          location: values.location,
          capacity: capacityNum,
          rsvpDeadline: values.rsvpDeadline || undefined,
          isFeatured: values.isFeatured,
          bannerStorageId: bannerId,
          clearBanner: !bannerId && clearBanner,
        });
        toast.success("Acara diperbarui");
      } else {
        await create({
          title: values.title,
          description: values.description,
          category: values.category,
          eventType: values.eventType,
          startDate: values.startDate,
          endDate: values.endDate,
          allDay: values.allDay,
          startTime: values.allDay ? undefined : values.startTime,
          endTime: values.allDay ? undefined : values.endTime,
          location: values.location,
          capacity: capacityNum,
          rsvpDeadline: values.rsvpDeadline || undefined,
          isFeatured: values.isFeatured,
          bannerStorageId: bannerId,
        });
        toast.success("Acara berhasil ditambahkan");
      }
      form.reset({
        title: "",
        category: "event",
        eventType: "gathering",
        description: "",
        startDate: today,
        endDate: today,
        allDay: true,
        startTime: "09:00",
        endTime: "10:00",
        location: "",
        capacity: "",
        rsvpDeadline: "",
        isFeatured: false,
      });
      setBannerFile(null);
      setClearBanner(false);
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan acara");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Gagal menyimpan acara");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) setOpen(v);
      }}
    >
      {trigger !== undefined || !isEdit ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="gap-2">
              <Plus className="size-4" />
              Buat Acara
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ubah Acara Perusahaan" : "Buat Acara Perusahaan"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail acara dan undangan untuk karyawan."
              : "Buat acara baru untuk diumumkan kepada seluruh karyawan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Banner */}
            <div className="space-y-2">
              <Label>Banner Acara (opsional)</Label>
              {bannerFile ? (
                <div className="relative overflow-hidden rounded-lg border">
                  <img
                    src={URL.createObjectURL(bannerFile)}
                    alt="Pratinjau banner"
                    className="h-48 w-full object-cover"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setBannerFile(null)}
                    className="absolute right-2 top-2 bg-background/80 backdrop-blur hover:bg-background"
                    disabled={saving}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : existingBannerUrl && !clearBanner ? (
                <div className="relative overflow-hidden rounded-lg border">
                  <img
                    src={existingBannerUrl}
                    alt="Banner saat ini"
                    className="h-48 w-full object-cover"
                  />
                  <div className="absolute right-2 top-2 flex gap-1">
                    <label
                      htmlFor="event-banner-replace"
                      className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-background/80 backdrop-blur hover:bg-background"
                    >
                      <ImagePlus className="size-4" />
                      <Input
                        id="event-banner-replace"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBannerFile}
                        disabled={saving}
                      />
                    </label>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setClearBanner(true)}
                      className="bg-background/80 backdrop-blur hover:bg-background"
                      disabled={saving}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="event-banner"
                  className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  <ImagePlus className="size-6" />
                  <span className="text-sm">
                    Klik untuk pilih banner (maks. 8 MB)
                  </span>
                  <Input
                    id="event-banner"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerFile}
                    disabled={saving}
                  />
                </label>
              )}
              {saving && bannerFile ? (
                <Progress value={progress} className="h-1.5" />
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Company Gathering Tahunan 2026"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CATEGORY_CONFIG)
                          .filter(([k]) => k !== "deadline")
                          .map(([value, cfg]) => (
                            <SelectItem key={value} value={value}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={`size-2 rounded-full ${cfg.dot}`}
                                />
                                {cfg.label}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Acara</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(EVENT_TYPES).map(([value, cfg]) => (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-2">
                              <span>{cfg.emoji}</span>
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Mulai</FormLabel>
                    <FormControl>
                      <DateField value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Akhir</FormLabel>
                    <FormControl>
                      <DateField value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border px-3 py-2.5">
                  <div>
                    <Label>Sepanjang Hari</Label>
                    <p className="text-xs text-muted-foreground">
                      Matikan untuk menentukan jam mulai dan selesai
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {!allDay ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jam Mulai</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jam Selesai</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ballroom Lt. 5 / Zoom link"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kapasitas (opsional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="150"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rsvpDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batas RSVP (opsional)</FormLabel>
                    <FormControl>
                      <DateField value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi (opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Detail agenda, dress code, transportasi, dsb."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border px-3 py-2.5">
                  <div>
                    <Label>Unggulan</Label>
                    <p className="text-xs text-muted-foreground">
                      Tampilkan sebagai acara unggulan di halaman events
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Menyimpan..."
                  : isEdit
                    ? "Simpan Perubahan"
                    : "Simpan Acara"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
