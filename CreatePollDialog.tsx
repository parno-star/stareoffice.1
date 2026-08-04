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
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Form,
  FormControl,
  FormDescription,
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
import { BarChart3, Plus, X } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  datetimeLocalToIso,
  getMinCloseDateTimeLocal,
} from "../_lib/polls-utils.ts";

const schema = z.object({
  question: z
    .string()
    .min(5, "Pertanyaan minimal 5 karakter")
    .max(200, "Pertanyaan maksimal 200 karakter"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter").optional(),
  options: z
    .array(
      z.object({
        text: z
          .string()
          .min(1, "Pilihan tidak boleh kosong")
          .max(100, "Pilihan maksimal 100 karakter"),
      }),
    )
    .min(2, "Minimal 2 pilihan")
    .max(10, "Maksimal 10 pilihan"),
  allowMultiple: z.boolean(),
  isAnonymous: z.boolean(),
  hasDeadline: z.boolean(),
  closesAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreatePollDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const createPoll = useMutation(api.polls.createPoll);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      question: "",
      description: "",
      options: [{ text: "" }, { text: "" }],
      allowMultiple: false,
      isAnonymous: false,
      hasDeadline: false,
      closesAt: "",
    },
  });

  const options = form.watch("options");
  const hasDeadline = form.watch("hasDeadline");

  const addOption = () => {
    if (options.length >= 10) return;
    form.setValue("options", [...options, { text: "" }]);
  };
  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    form.setValue(
      "options",
      options.filter((_, i) => i !== index),
    );
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      let closesAtIso: string | undefined;
      if (values.hasDeadline && values.closesAt) {
        closesAtIso = datetimeLocalToIso(values.closesAt);
        if (!closesAtIso) {
          toast.error("Tanggal penutupan tidak valid");
          setSaving(false);
          return;
        }
      }

      await createPoll({
        question: values.question,
        description: values.description || undefined,
        options: values.options.map((o) => o.text),
        allowMultiple: values.allowMultiple,
        isAnonymous: values.isAnonymous,
        closesAt: closesAtIso,
      });
      toast.success("Polling berhasil dibuat!");
      form.reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat polling");
      } else {
        toast.error("Gagal membuat polling");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <BarChart3 className="size-4" />
          Buat Polling
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Polling Baru</DialogTitle>
          <DialogDescription>
            Kumpulkan suara dari rekan kerja untuk pertanyaan atau keputusan
            bersama.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pertanyaan</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Apa topik yang ingin dibahas minggu ini?"
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
                  <FormLabel>Deskripsi (opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Tambahkan konteks singkat untuk polling ini..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Options */}
            <div className="space-y-2">
              <Label>Pilihan Jawaban</Label>
              <div className="space-y-2">
                {options.map((_, i) => (
                  <FormField
                    key={i}
                    control={form.control}
                    name={`options.${i}.text`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {i + 1}
                          </span>
                          <FormControl>
                            <Input
                              placeholder={`Pilihan ${i + 1}`}
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeOption(i)}
                            disabled={options.length <= 2}
                            className="shrink-0"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addOption}
                disabled={options.length >= 10}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                Tambah Pilihan
              </Button>
            </div>

            {/* Settings */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <FormField
                control={form.control}
                name="allowMultiple"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel>Pilihan Ganda</FormLabel>
                      <FormDescription>
                        Izinkan memilih lebih dari satu jawaban
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
              <FormField
                control={form.control}
                name="isAnonymous"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel>Polling Anonim</FormLabel>
                      <FormDescription>
                        Sembunyikan identitas pemilih
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
              <FormField
                control={form.control}
                name="hasDeadline"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel>Batas Waktu</FormLabel>
                      <FormDescription>
                        Tutup otomatis pada waktu tertentu
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
              {hasDeadline ? (
                <FormField
                  control={form.control}
                  name="closesAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tutup Pada</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          min={getMinCloseDateTimeLocal()}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

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
                {saving ? "Membuat..." : "Buat Polling"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
