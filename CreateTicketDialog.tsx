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
import { Send, Search, Wrench, CheckCircle2 } from "lucide-react";
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
} from "../_lib/support-utils.ts";

// Steps shown to the user so they understand what happens after submitting a ticket.
const PROCESS_STEPS = [
  {
    icon: Send,
    title: "1. Kirim tiket",
    desc: "Isi form ini lalu klik Kirim. Tiket langsung tercatat dengan status Terbuka.",
  },
  {
    icon: Search,
    title: "2. Ditinjau Admin IT organisasi",
    desc: "Admin IT di organisasi Anda menerima notifikasi dan meninjau laporan sesuai prioritas.",
  },
  {
    icon: Wrench,
    title: "3. Dikerjakan",
    desc: "Status berubah jadi Dikerjakan. Anda bisa berdiskusi lewat komentar di detail tiket.",
  },
  {
    icon: CheckCircle2,
    title: "4. Selesai",
    desc: "Setelah beres, tiket ditandai Selesai. Anda dapat menutup atau membukanya kembali.",
  },
] as const;

const schema = z.object({
  title: z
    .string()
    .min(5, "Judul minimal 5 karakter")
    .max(150, "Judul maksimal 150 karakter"),
  category: z.string().min(1),
  priority: z.string().min(1),
  description: z
    .string()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(5000, "Deskripsi maksimal 5000 karakter"),
});

type FormValues = z.infer<typeof schema>;

export default function CreateTicketDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const createTicket = useMutation(api.tickets.createTicket);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "hardware",
      priority: "medium",
      description: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const ticketId = await createTicket({
        title: values.title,
        description: values.description,
        category: values.category,
        priority: values.priority,
      });
      toast.success("Tiket bantuan berhasil dibuat");
      form.reset();
      setOpen(false);
      navigate(`/support/${ticketId}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat tiket");
      } else {
        toast.error("Gagal membuat tiket");
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
          Buat Tiket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Tiket Bantuan IT</DialogTitle>
          <DialogDescription>
            Jelaskan kendala yang Anda alami agar Admin IT organisasi Anda
            dapat segera membantu.
          </DialogDescription>
        </DialogHeader>

        {/* Explains the ticket lifecycle so users know what to expect */}
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold text-foreground">
            Bagaimana prosesnya?
          </p>
          <ol className="space-y-2">
            {PROCESS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul Masalah</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Laptop tidak bisa terkoneksi ke WiFi"
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
                        {Object.entries(CATEGORY_CONFIG).map(
                          ([value, cfg]) => {
                            const Icon = cfg.icon;
                            return (
                              <SelectItem key={value} value={value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="size-4" />
                                  {cfg.label}
                                </span>
                              </SelectItem>
                            );
                          },
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioritas</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_ORDER.map((value) => {
                          const cfg = PRIORITY_CONFIG[value];
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi Masalah</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder="Jelaskan masalah, langkah yang sudah dicoba, dan pesan error jika ada..."
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
                {saving ? "Mengirim..." : "Kirim Tiket"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
