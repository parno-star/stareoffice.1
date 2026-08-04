import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";

const promoFormSchema = z.object({
  code: z.string().min(1, "Kode promo wajib diisi").regex(/^[A-Z0-9_-]+$/i, "Hanya huruf, angka, - dan _"),
  name: z.string().min(1, "Nama promo wajib diisi"),
  description: z.string().optional(),
  type: z.enum(["plan_upgrade", "extra_users", "extra_storage", "discount"]),
  discountPercent: z.coerce.number().min(0).max(100),
  discountFlat: z.coerce.number().min(0),
  extraUsers: z.coerce.number().min(0),
  extraStorageMb: z.coerce.number().min(0),
  applicablePlanSlugs: z.string(), // comma-separated, parsed later
  validFrom: z.string().min(1, "Tanggal mulai wajib diisi"),
  validUntil: z.string().min(1, "Tanggal berakhir wajib diisi"),
  maxRedemptions: z.coerce.number().min(0),
  isActive: z.boolean(),
});

type PromoFormValues = z.infer<typeof promoFormSchema>;

type PromoFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: Doc<"promos"> | null;
};

function toLocalDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export default function PromoFormDialog({ open, onOpenChange, promo }: PromoFormDialogProps) {
  const createPromo = useMutation(api.promos.create);
  const updatePromo = useMutation(api.promos.update);
  const plans = useQuery(api.membership.list, {});

  const isEditing = promo !== null;

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "discount",
      discountPercent: 0,
      discountFlat: 0,
      extraUsers: 0,
      extraStorageMb: 0,
      applicablePlanSlugs: "",
      validFrom: "",
      validUntil: "",
      maxRedemptions: 0,
      isActive: true,
    },
  });

  const watchType = form.watch("type");

  useEffect(() => {
    if (promo) {
      form.reset({
        code: promo.code,
        name: promo.name,
        description: promo.description ?? "",
        type: promo.type as PromoFormValues["type"],
        discountPercent: promo.discountPercent,
        discountFlat: promo.discountFlat,
        extraUsers: promo.extraUsers,
        extraStorageMb: promo.extraStorageMb,
        applicablePlanSlugs: promo.applicablePlanSlugs.join(", "),
        validFrom: toLocalDatetime(promo.validFrom),
        validUntil: toLocalDatetime(promo.validUntil),
        maxRedemptions: promo.maxRedemptions,
        isActive: promo.isActive,
      });
    } else {
      form.reset({
        code: "",
        name: "",
        description: "",
        type: "discount",
        discountPercent: 0,
        discountFlat: 0,
        extraUsers: 0,
        extraStorageMb: 0,
        applicablePlanSlugs: "",
        validFrom: "",
        validUntil: "",
        maxRedemptions: 0,
        isActive: true,
      });
    }
  }, [promo, form]);

  const onSubmit = async (values: PromoFormValues) => {
    try {
      const slugs = values.applicablePlanSlugs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const validFrom = new Date(values.validFrom).toISOString();
      const validUntil = new Date(values.validUntil).toISOString();

      if (isEditing && promo) {
        await updatePromo({
          promoId: promo._id,
          name: values.name,
          description: values.description || undefined,
          type: values.type,
          discountPercent: values.discountPercent,
          discountFlat: values.discountFlat,
          extraUsers: values.extraUsers,
          extraStorageMb: values.extraStorageMb,
          applicablePlanSlugs: slugs,
          validFrom,
          validUntil,
          maxRedemptions: values.maxRedemptions,
          isActive: values.isActive,
        });
        toast.success("Promo berhasil diperbarui!");
      } else {
        await createPromo({
          code: values.code.toUpperCase(),
          name: values.name,
          description: values.description || undefined,
          type: values.type,
          discountPercent: values.discountPercent,
          discountFlat: values.discountFlat,
          extraUsers: values.extraUsers,
          extraStorageMb: values.extraStorageMb,
          applicablePlanSlugs: slugs,
          validFrom,
          validUntil,
          maxRedemptions: values.maxRedemptions,
          isActive: values.isActive,
        });
        toast.success("Promo baru berhasil dibuat!");
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit Promo: ${promo.name}` : "Buat Promo Baru"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Perbarui detail promo."
              : "Isi informasi untuk membuat promo baru."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Promo</FormLabel>
                    <FormControl>
                      <Input placeholder="Diskon Akhir Tahun" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Promo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="HEMAT2026"
                        className="font-mono uppercase"
                        {...field}
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormDescription>Akan diubah ke huruf besar otomatis</FormDescription>
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
                    <Textarea rows={2} placeholder="Deskripsi promo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Promo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="discount" className="cursor-pointer">Diskon Harga</SelectItem>
                      <SelectItem value="plan_upgrade" className="cursor-pointer">Upgrade Paket</SelectItem>
                      <SelectItem value="extra_users" className="cursor-pointer">Tambah Pengguna</SelectItem>
                      <SelectItem value="extra_storage" className="cursor-pointer">Tambah Penyimpanan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional fields based on type */}
            {(watchType === "discount" || watchType === "plan_upgrade") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="discountPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diskon Persen (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountFlat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Potongan Flat (IDR)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {watchType === "extra_users" && (
              <FormField
                control={form.control}
                name="extraUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah Pengguna Tambahan</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchType === "extra_storage" && (
              <FormField
                control={form.control}
                name="extraStorageMb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Penyimpanan Tambahan (MB)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5120" {...field} />
                    </FormControl>
                    <FormDescription>5120 MB = 5 GB</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Applicable plans */}
            <FormField
              control={form.control}
              name="applicablePlanSlugs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Berlaku untuk Paket (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="free, starter, professional"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Slug paket dipisah koma. Kosongkan untuk semua paket.
                    {plans && plans.length > 0 && (
                      <> Tersedia: {plans.map((p) => p.slug).join(", ")}</>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validity */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="validFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mulai Berlaku</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="cursor-pointer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berakhir</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="cursor-pointer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Limits and toggles */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="maxRedemptions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maks Penggunaan</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0 = unlimited" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="cursor-pointer"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Aktif</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Menyimpan..."
                  : isEditing
                    ? "Simpan Perubahan"
                    : "Buat Promo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
