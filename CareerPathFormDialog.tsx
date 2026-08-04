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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  COVER_COLORS,
  TRACK_OPTIONS,
  coverGradient,
} from "../_lib/career-utils.ts";
import { cn } from "@/lib/utils.ts";

const schema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  track: z.string().min(1, "Pilih track"),
  department: z.string(),
  coverColor: z.string().min(1, "Pilih warna"),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  path?: Doc<"careerPaths">;
  trigger?: React.ReactNode;
  onCreated?: (id: string) => void;
};

export default function CareerPathFormDialog({
  path,
  trigger,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const departments = useQuery(api.users.listDepartments, {});
  const createPath = useMutation(api.careerPath.createPath);
  const updatePath = useMutation(api.careerPath.updatePath);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: path?.title ?? "",
      description: path?.description ?? "",
      track: path?.track ?? "technical",
      department: path?.department ?? "",
      coverColor: path?.coverColor ?? "sky",
      icon: path?.icon ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (path) {
        await updatePath({
          pathId: path._id,
          title: values.title,
          description: values.description,
          track: values.track,
          department: values.department,
          coverColor: values.coverColor,
          icon: values.icon?.trim() || undefined,
        });
        toast.success("Jenjang karier diperbarui");
      } else {
        const id = await createPath({
          title: values.title,
          description: values.description,
          track: values.track,
          department: values.department,
          coverColor: values.coverColor,
          icon: values.icon?.trim() || undefined,
        });
        toast.success("Jenjang karier dibuat");
        onCreated?.(id);
      }
      setOpen(false);
      form.reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan jenjang karier");
      } else {
        toast.error("Gagal menyimpan jenjang karier");
      }
    } finally {
      setSaving(false);
    }
  };

  const currentColor = form.watch("coverColor");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="size-4" />
            Jenjang Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {path ? "Edit Jenjang Karier" : "Buat Jenjang Karier"}
          </DialogTitle>
          <DialogDescription>
            Tentukan informasi dasar jenjang karier. Level dan persyaratan dapat
            dikelola setelah jenjang dibuat.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "h-20 rounded-xl bg-gradient-to-br text-white",
            coverGradient(currentColor),
          )}
        />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul Jenjang</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Engineering Career Ladder"
                      {...field}
                    />
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
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Jelaskan fokus jenjang ini dan kepada siapa ditujukan..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="track"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track</FormLabel>
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
                        {TRACK_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
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
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departemen</FormLabel>
                    <Select
                      value={field.value === "" ? "all" : field.value}
                      onValueChange={(v) =>
                        field.onChange(v === "all" ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Semua departemen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Semua departemen</SelectItem>
                        {(departments ?? []).map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="coverColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warna</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {COVER_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => field.onChange(c.value)}
                        className={cn(
                          "size-8 cursor-pointer rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                          c.swatch,
                          field.value === c.value
                            ? "ring-foreground"
                            : "ring-transparent",
                        )}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ikon (Emoji) — Opsional</FormLabel>
                  <FormControl>
                    <Input placeholder="🚀" maxLength={4} {...field} />
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
                {saving ? "Menyimpan..." : path ? "Simpan" : "Buat"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
