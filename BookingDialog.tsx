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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { ConvexError } from "convex/values";
import { buildIsoTimestamp } from "../_lib/rooms-utils.ts";

const schema = z
  .object({
    roomId: z.string().min(1, "Pilih ruangan"),
    title: z.string().min(2, "Judul minimal 2 karakter").max(200),
    purpose: z.string().max(500).optional(),
    attendeeCount: z.coerce.number().min(1).max(1000).optional(),
    date: z.string().min(1, "Pilih tanggal"),
    startTime: z.string().min(1, "Pilih waktu mulai"),
    endTime: z.string().min(1, "Pilih waktu selesai"),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Waktu selesai harus setelah waktu mulai",
    path: ["endTime"],
  });

type FormValues = z.infer<typeof schema>;

type Props = {
  initialRoomId?: Id<"rooms"> | null;
  initialDate?: string;
  trigger?: React.ReactNode;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function roundedNowTime(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const minutes = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(minutes, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BookingDialog({
  initialRoomId,
  initialDate,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const rooms = useQuery(api.rooms.listRooms, open ? {} : "skip");
  const createBooking = useMutation(api.rooms.createBooking);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roomId: initialRoomId ?? "",
      title: "",
      purpose: "",
      attendeeCount: undefined,
      date: initialDate ?? todayIso(),
      startTime: roundedNowTime(15),
      endTime: roundedNowTime(75),
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const startIso = buildIsoTimestamp(values.date, values.startTime);
      const endIso = buildIsoTimestamp(values.date, values.endTime);
      await createBooking({
        roomId: values.roomId as Id<"rooms">,
        title: values.title,
        purpose: values.purpose || undefined,
        attendeeCount: values.attendeeCount,
        startTime: startIso,
        endTime: endIso,
        date: values.date,
      });
      toast.success("Ruangan berhasil dipesan");
      form.reset({
        roomId: values.roomId,
        title: "",
        purpose: "",
        attendeeCount: undefined,
        date: values.date,
        startTime: values.endTime,
        endTime: values.endTime,
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat pemesanan");
      } else {
        toast.error("Gagal membuat pemesanan");
      }
    } finally {
      setSaving(false);
    }
  };

  const availableRooms = (rooms ?? []).filter((r) => r.isActive);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <CalendarPlus className="size-4" />
            Pesan Ruangan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pesan Ruangan</DialogTitle>
          <DialogDescription>
            Isi detail pemesanan untuk meminjam ruang rapat.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruangan</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={rooms === undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih ruangan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRooms.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Belum ada ruangan tersedia
                        </div>
                      ) : (
                        availableRooms.map((r) => (
                          <SelectItem key={r._id} value={r._id}>
                            {r.name}
                            {r.location ? ` · ${r.location}` : ""} · {r.capacity}{" "}
                            org
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul Agenda</FormLabel>
                  <FormControl>
                    <Input placeholder="Rapat tim marketing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl>
                    <DateField value={field.value} onChange={field.onChange} min={todayIso()} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mulai</FormLabel>
                    <FormControl>
                      <Input type="time" step={900} {...field} />
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
                    <FormLabel>Selesai</FormLabel>
                    <FormControl>
                      <Input type="time" step={900} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="attendeeCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah Peserta (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Misal: 8"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Tujuan atau catatan tambahan..."
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
                {saving ? "Memesan..." : "Pesan Ruangan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
