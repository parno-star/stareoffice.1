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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { CATEGORY_CONFIG } from "../_lib/calendar-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const schema = z
  .object({
    title: z.string().min(1, "Judul wajib diisi").max(120),
    category: z.string().min(1),
    description: z.string().max(1000).optional(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    allDay: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().max(200).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

type EditValues = {
  id: Id<"events">;
  title: string;
  category: string;
  description?: string | undefined;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string | undefined;
  endTime?: string | undefined;
  location?: string | undefined;
};

export default function CreateEventDialog({
  defaultDate,
  trigger,
  editValues,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultDate?: string;
  trigger?: React.ReactNode;
  editValues?: EditValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [saving, setSaving] = useState(false);
  const create = useMutation(api.events.create);
  const update = useMutation(api.events.update);

  const today = defaultDate ?? new Date().toISOString().slice(0, 10);
  const isEdit = !!editValues;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editValues
      ? {
          title: editValues.title,
          category: editValues.category,
          description: editValues.description ?? "",
          startDate: editValues.startDate,
          endDate: editValues.endDate,
          allDay: editValues.allDay,
          startTime: editValues.startTime ?? "09:00",
          endTime: editValues.endTime ?? "10:00",
          location: editValues.location ?? "",
        }
      : {
          title: "",
          category: "meeting",
          description: "",
          startDate: today,
          endDate: today,
          allDay: true,
          startTime: "09:00",
          endTime: "10:00",
          location: "",
        },
  });

  const allDay = form.watch("allDay");

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isEdit && editValues) {
        await update({
          id: editValues.id,
          title: values.title,
          description: values.description,
          category: values.category,
          startDate: values.startDate,
          endDate: values.endDate,
          allDay: values.allDay,
          startTime: values.allDay ? undefined : values.startTime,
          endTime: values.allDay ? undefined : values.endTime,
          location: values.location,
        });
        toast.success("Acara diperbarui");
      } else {
        await create({
          title: values.title,
          description: values.description,
          category: values.category,
          startDate: values.startDate,
          endDate: values.endDate,
          allDay: values.allDay,
          startTime: values.allDay ? undefined : values.startTime,
          endTime: values.allDay ? undefined : values.endTime,
          location: values.location,
        });
        toast.success("Acara berhasil ditambahkan");
      }
      form.reset({
        title: "",
        category: "meeting",
        description: "",
        startDate: today,
        endDate: today,
        allDay: true,
        startTime: "09:00",
        endTime: "10:00",
        location: "",
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan acara");
      } else {
        toast.error("Gagal menyimpan acara");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined || !isEdit ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="gap-2">
              <Plus className="size-4" />
              Tambah Acara
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ubah Acara" : "Tambah Acara Baru"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail acara di kalender perusahaan."
              : "Buat acara baru di kalender perusahaan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rapat koordinasi mingguan"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${cfg.dot}`} />
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
                    <Input placeholder="Ruang Rapat Utama" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi (opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Detail tambahan tentang acara..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
