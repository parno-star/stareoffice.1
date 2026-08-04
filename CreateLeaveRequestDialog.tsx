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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { LEAVE_TYPE_LABELS } from "../_lib/leave-utils.ts";

const schema = z
  .object({
    type: z.string().min(1, "Jenis cuti wajib dipilih"),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal akhir wajib diisi"),
    reason: z.string().min(3, "Alasan minimal 3 karakter").max(500),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

function computeDayCount(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

export default function CreateLeaveRequestDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const create = useMutation(api.leaveRequests.create);
  const stats = useQuery(api.leaveRequests.getMyStats, {});

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "annual",
      startDate: today,
      endDate: today,
      reason: "",
    },
  });

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const type = form.watch("type");
  const dayCount = computeDayCount(startDate, endDate);
  const isAnnual = type === "annual";
  const willExceedQuota =
    isAnnual &&
    stats !== undefined &&
    dayCount > 0 &&
    dayCount > stats.annualRemaining;

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await create({
        type: values.type,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason,
      });
      toast.success("Pengajuan cuti berhasil dikirim");
      form.reset({
        type: "annual",
        startDate: today,
        endDate: today,
        reason: "",
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim pengajuan");
      } else {
        toast.error("Gagal mengirim pengajuan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Ajukan Cuti
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pengajuan Cuti Baru</DialogTitle>
          <DialogDescription>
            Isi formulir di bawah ini. Pengajuan Anda akan ditinjau oleh
            administrator.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Cuti</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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

            {dayCount > 0 ? (
              <div className="space-y-2">
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  Total hari cuti:{" "}
                  <span className="font-semibold">{dayCount} hari</span>
                  {isAnnual && stats ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · sisa kuota tahunan {stats.annualRemaining} hari
                    </span>
                  ) : null}
                </div>
                {willExceedQuota ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Pengajuan ini melebihi sisa kuota cuti tahunan Anda. Anda
                    tetap bisa mengajukannya, namun persetujuan ada di tangan
                    atasan.
                  </p>
                ) : null}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alasan</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Jelaskan alasan pengajuan cuti Anda..."
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
                {saving ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
