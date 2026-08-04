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
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { suggestPeriods } from "../_lib/performance-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const schema = z.object({
  revieweeId: z.string().min(1, "Pilih karyawan"),
  period: z.string().min(1, "Pilih periode"),
});

type FormValues = z.infer<typeof schema>;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function CreateReviewDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const employees = useQuery(api.performance.listReviewableEmployees, {});
  const createReview = useMutation(api.performance.create);
  const year = new Date().getFullYear();
  const periods = suggestPeriods(year);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      revieweeId: "",
      period: `${year}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const id = await createReview({
        revieweeId: values.revieweeId as Id<"users">,
        period: values.period,
      });
      toast.success("Draf penilaian dibuat");
      setOpen(false);
      form.reset({
        revieweeId: "",
        period: `${year}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      });
      navigate(`/performance/${id}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat penilaian");
      } else {
        toast.error("Gagal membuat penilaian");
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
          Penilaian Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Penilaian Kinerja</DialogTitle>
          <DialogDescription>
            Pilih karyawan dan periode penilaian. Draf dibuat agar Anda dapat
            menyelesaikannya kapan saja sebelum dikirim.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="revieweeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Karyawan</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih karyawan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees?.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Tidak ada karyawan yang dapat Anda nilai
                        </div>
                      ) : (
                        employees?.map((emp) => (
                          <SelectItem key={emp._id} value={emp._id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                {emp.avatarUrl ? (
                                  <AvatarImage src={emp.avatarUrl} />
                                ) : null}
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(emp.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{emp.name}</div>
                                {emp.jobTitle ? (
                                  <div className="text-xs text-muted-foreground">
                                    {emp.jobTitle}
                                  </div>
                                ) : null}
                              </div>
                            </div>
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
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periode Penilaian</FormLabel>
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
                      {periods.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {saving ? "Membuat..." : "Buat Draf"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
