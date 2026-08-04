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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { CATEGORY_CONFIG } from "../_lib/suggestions-utils.ts";

const schema = z.object({
  title: z
    .string()
    .min(3, "Judul minimal 3 karakter")
    .max(150, "Judul maksimal 150 karakter"),
  category: z.string().min(1),
  content: z
    .string()
    .min(10, "Isi minimal 10 karakter")
    .max(5000, "Isi maksimal 5000 karakter"),
  isAnonymous: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateSuggestionDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const createSuggestion = useMutation(api.suggestions.createSuggestion);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "workplace",
      content: "",
      isAnonymous: false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await createSuggestion({
        title: values.title,
        content: values.content,
        category: values.category,
        isAnonymous: values.isAnonymous,
      });
      toast.success("Saran berhasil dikirim. Terima kasih atas masukan Anda!");
      form.reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim saran");
      } else {
        toast.error("Gagal mengirim saran");
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
          Kirim Saran
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kirim Saran Baru</DialogTitle>
          <DialogDescription>
            Bagikan ide atau masukan Anda untuk meningkatkan perusahaan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul Saran</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Tambahkan ruang meditasi di kantor"
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
                      {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi Saran</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder="Jelaskan saran Anda secara detail, manfaatnya, dan bagaimana cara menerapkannya..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isAnonymous"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Kirim secara anonim</FormLabel>
                    <FormDescription className="text-xs">
                      Nama Anda tidak akan ditampilkan kepada rekan tim lain.
                    </FormDescription>
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
                {saving ? "Mengirim..." : "Kirim Saran"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
