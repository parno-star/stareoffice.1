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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { useNavigate } from "react-router-dom";
import { CATEGORY_CONFIG } from "../_lib/forum-utils.ts";

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
});

type FormValues = z.infer<typeof schema>;

export default function CreateThreadDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const createThread = useMutation(api.forum.createThread);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "general",
      content: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const threadId = await createThread({
        title: values.title,
        content: values.content,
        category: values.category,
      });
      toast.success("Diskusi berhasil dibuat");
      form.reset();
      setOpen(false);
      navigate(`/forum/${threadId}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat diskusi");
      } else {
        toast.error("Gagal membuat diskusi");
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
          Buat Diskusi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mulai Diskusi Baru</DialogTitle>
          <DialogDescription>
            Bagikan pertanyaan, ide, atau topik dengan rekan tim.
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
                      placeholder="Bagaimana cara mengakses VPN dari luar kantor?"
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
                  <FormLabel>Isi</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder="Jelaskan pertanyaan atau ide Anda dengan detail..."
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
                {saving ? "Memposting..." : "Posting Diskusi"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
