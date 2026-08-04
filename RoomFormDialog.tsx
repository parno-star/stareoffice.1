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
import { Switch } from "@/components/ui/switch.tsx";
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
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { ConvexError } from "convex/values";
import { AMENITIES } from "../_lib/rooms-utils.ts";
import { cn } from "@/lib/utils.ts";

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100),
  location: z.string().max(100).optional(),
  capacity: z.coerce.number().min(1, "Minimal 1").max(1000, "Maksimal 1000"),
  description: z.string().max(500).optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  room?: Doc<"rooms">;
  trigger?: React.ReactNode;
};

export default function RoomFormDialog({ room, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amenities, setAmenities] = useState<Array<string>>(
    room?.amenities ?? [],
  );
  const createRoom = useMutation(api.rooms.createRoom);
  const updateRoom = useMutation(api.rooms.updateRoom);

  const isEdit = room !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: room?.name ?? "",
      location: room?.location ?? "",
      capacity: room?.capacity ?? 8,
      description: room?.description ?? "",
      isActive: room?.isActive ?? true,
    },
  });

  // Reset state when opening for existing room
  useEffect(() => {
    if (open && room) {
      form.reset({
        name: room.name,
        location: room.location ?? "",
        capacity: room.capacity,
        description: room.description ?? "",
        isActive: room.isActive,
      });
      setAmenities(room.amenities);
    } else if (open && !room) {
      form.reset({
        name: "",
        location: "",
        capacity: 8,
        description: "",
        isActive: true,
      });
      setAmenities([]);
    }
  }, [open, room, form]);

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isEdit && room) {
        await updateRoom({
          roomId: room._id,
          name: values.name,
          location: values.location || undefined,
          capacity: values.capacity,
          description: values.description || undefined,
          amenities,
          isActive: values.isActive,
        });
        toast.success("Ruangan diperbarui");
      } else {
        await createRoom({
          name: values.name,
          location: values.location || undefined,
          capacity: values.capacity,
          description: values.description || undefined,
          amenities,
        });
        toast.success("Ruangan ditambahkan");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan ruangan");
      } else {
        toast.error("Gagal menyimpan ruangan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            {isEdit ? (
              <Pencil className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {isEdit ? "Edit Ruangan" : "Tambah Ruangan"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Ruangan" : "Tambah Ruangan"}</DialogTitle>
          <DialogDescription>
            Kelola ruang rapat yang dapat dipesan oleh karyawan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Ruangan</FormLabel>
                  <FormControl>
                    <Input placeholder="Ruang Garuda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Input placeholder="Lantai 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kapasitas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        {...field}
                      />
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
                      rows={2}
                      placeholder="Cocok untuk rapat kecil hingga sedang..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Fasilitas</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AMENITIES.map((a) => {
                  const Icon = a.icon;
                  const isOn = amenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-all",
                        isOn
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          isOn ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isEdit ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                    <div>
                      <FormLabel>Ruangan Aktif</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Nonaktifkan untuk menyembunyikan dari daftar pemesanan.
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
            ) : null}

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
                    : "Tambah Ruangan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
