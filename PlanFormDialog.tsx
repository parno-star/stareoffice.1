import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
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
import FeaturePicker from "./FeaturePicker.tsx";
import {
  CORE_FEATURE_GROUPS,
  GATED_FEATURE_GROUPS,
} from "../_lib/feature-catalog.ts";

const planFormSchema = z.object({
  slug: z.string().min(1, "Slug wajib diisi").regex(/^[a-z0-9_-]+$/, "Hanya huruf kecil, angka, - dan _"),
  name: z.string().min(1, "Nama paket wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  price: z.string().min(1, "Harga wajib diisi"),
  priceUnit: z.string().min(1, "Satuan harga wajib diisi"),
  pricePerUserMonth: z.coerce.number(),
  maxEmployees: z.coerce.number().min(0, "Minimum 0 (unlimited)"),
  maxStorageMb: z.coerce.number().min(0, "Minimum 0 (unlimited)"),
  supportLevel: z.string().min(1, "Level dukungan wajib dipilih"),
  coreFeatures: z.array(z.string()).min(1, "Pilih minimal satu fitur"),
  disabledFeatures: z.array(z.string()),
  order: z.coerce.number().min(1, "Minimum 1"),
  isPopular: z.boolean(),
  isActive: z.boolean(),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

type PlanFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Doc<"membershipPlans"> | null;
  existingCount: number;
};

export default function PlanFormDialog({ open, onOpenChange, plan, existingCount }: PlanFormDialogProps) {
  const createPlan = useMutation(api.membership.create);
  const updatePlan = useMutation(api.membership.update);

  const isEditing = plan !== null;

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      slug: "",
      name: "",
      description: "",
      price: "",
      priceUnit: "",
      pricePerUserMonth: 0,
      maxEmployees: 0,
      maxStorageMb: 0,
      supportLevel: "community",
      coreFeatures: [],
      disabledFeatures: [],
      order: existingCount + 1,
      isPopular: false,
      isActive: true,
    },
  });

  useEffect(() => {
    if (plan) {
      form.reset({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        priceUnit: plan.priceUnit,
        pricePerUserMonth: plan.pricePerUserMonth,
        maxEmployees: plan.maxEmployees,
        maxStorageMb: plan.maxStorageMb,
        supportLevel: plan.supportLevel,
        coreFeatures: plan.coreFeatures,
        disabledFeatures: plan.disabledFeatures,
        order: plan.order,
        isPopular: plan.isPopular,
        isActive: plan.isActive,
      });
    } else {
      form.reset({
        slug: "",
        name: "",
        description: "",
        price: "",
        priceUnit: "",
        pricePerUserMonth: 0,
        maxEmployees: 0,
        maxStorageMb: 0,
        supportLevel: "community",
        coreFeatures: [],
        disabledFeatures: [],
        order: existingCount + 1,
        isPopular: false,
        isActive: true,
      });
    }
  }, [plan, form, existingCount]);

  const onSubmit = async (values: PlanFormValues) => {
    try {
      const coreFeatures = values.coreFeatures.filter(Boolean);
      const disabledFeatures = values.disabledFeatures.filter(Boolean);

      if (isEditing && plan) {
        await updatePlan({
          planId: plan._id,
          name: values.name,
          description: values.description,
          price: values.price,
          priceUnit: values.priceUnit,
          pricePerUserMonth: values.pricePerUserMonth,
          maxEmployees: values.maxEmployees,
          maxStorageMb: values.maxStorageMb,
          supportLevel: values.supportLevel,
          coreFeatures,
          disabledFeatures,
          order: values.order,
          isPopular: values.isPopular,
          isActive: values.isActive,
        });
        toast.success("Paket berhasil diperbarui!");
      } else {
        await createPlan({
          slug: values.slug,
          name: values.name,
          description: values.description,
          price: values.price,
          priceUnit: values.priceUnit,
          pricePerUserMonth: values.pricePerUserMonth,
          maxEmployees: values.maxEmployees,
          maxStorageMb: values.maxStorageMb,
          supportLevel: values.supportLevel,
          coreFeatures,
          disabledFeatures,
          order: values.order,
          isPopular: values.isPopular,
          isActive: values.isActive,
        });
        toast.success("Paket baru berhasil dibuat!");
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
          <DialogTitle>{isEditing ? `Edit Paket: ${plan.name}` : "Buat Paket Baru"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Perbarui detail dan fitur paket keanggotaan."
              : "Isi informasi untuk membuat paket keanggotaan baru."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic info row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Paket</FormLabel>
                    <FormControl>
                      <Input placeholder="Professional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (ID unik)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="professional"
                        {...field}
                        disabled={isEditing}
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
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Deskripsi singkat paket..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pricing */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga (tampilan)</FormLabel>
                    <FormControl>
                      <Input placeholder="Rp 65rb" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Satuan</FormLabel>
                    <FormControl>
                      <Input placeholder="/user/bulan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pricePerUserMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga/user/bulan (IDR)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="65.000"
                        value={
                          field.value
                            ? new Intl.NumberFormat("id-ID").format(
                                Number(field.value),
                              )
                            : ""
                        }
                        onChange={(e) => {
                          // Keep only digits, store as a plain number.
                          const digits = e.target.value.replace(/\D/g, "");
                          field.onChange(digits ? Number(digits) : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Limits */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="maxEmployees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maks Karyawan</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="200 (0 = unlimited)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxStorageMb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maks Storage (MB)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="51.200 (0 = unlimited)"
                        value={
                          field.value
                            ? new Intl.NumberFormat("id-ID").format(
                                Number(field.value),
                              )
                            : ""
                        }
                        onChange={(e) => {
                          // Keep only digits, store as a plain number.
                          const digits = e.target.value.replace(/\D/g, "");
                          field.onChange(digits ? Number(digits) : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supportLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level Dukungan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="community" className="cursor-pointer">Komunitas</SelectItem>
                        <SelectItem value="email" className="cursor-pointer">Email</SelectItem>
                        <SelectItem value="priority" className="cursor-pointer">Prioritas</SelectItem>
                        <SelectItem value="dedicated" className="cursor-pointer">Dedicated AM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Core features */}
            <FormField
              control={form.control}
              name="coreFeatures"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fitur Termasuk</FormLabel>
                  <FormControl>
                    <FeaturePicker
                      groups={CORE_FEATURE_GROUPS}
                      selected={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Disabled features */}
            <FormField
              control={form.control}
              name="disabledFeatures"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fitur Tidak Tersedia</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Centang modul yang dikunci untuk paket ini. Item bertanda
                    "kunci menu" akan menyembunyikan menu terkait dari pengguna.
                  </p>
                  <FormControl>
                    <FeaturePicker
                      groups={GATED_FEATURE_GROUPS}
                      selected={field.value}
                      onChange={field.onChange}
                      showGateBadge
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Order and toggles */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urutan Tampil</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPopular"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="cursor-pointer"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Paling Populer</FormLabel>
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
                    : "Buat Paket"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
