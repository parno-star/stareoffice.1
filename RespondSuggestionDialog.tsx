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
import { MessageSquarePlus } from "lucide-react";
import { ConvexError } from "convex/values";
import type { SuggestionListItem } from "@/convex/suggestions.ts";
import { STATUS_CONFIG, STATUS_ORDER } from "../_lib/suggestions-utils.ts";

const schema = z.object({
  status: z.string().min(1),
  response: z.string().max(3000, "Maksimal 3000 karakter"),
});

type FormValues = z.infer<typeof schema>;

export default function RespondSuggestionDialog({
  suggestion,
}: {
  suggestion: SuggestionListItem;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const respond = useMutation(api.suggestions.respondToSuggestion);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: suggestion.status,
      response: suggestion.adminResponse ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await respond({
        suggestionId: suggestion._id,
        status: values.status,
        response: values.response,
      });
      toast.success("Tanggapan disimpan");
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan tanggapan");
      } else {
        toast.error("Gagal menyimpan tanggapan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          form.reset({
            status: suggestion.status,
            response: suggestion.adminResponse ?? "",
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <MessageSquarePlus className="size-4" />
          Tanggapi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tanggapi Saran</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {suggestion.title}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_ORDER.map((value) => {
                        const cfg = STATUS_CONFIG[value];
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
              name="response"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggapan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Bagikan tanggapan atau penjelasan kepada pengusul..."
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
                {saving ? "Menyimpan..." : "Simpan Tanggapan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
