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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
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
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Heart, Sparkles } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  CATEGORY_CONFIG,
  CATEGORY_VALUES,
  getInitials,
} from "../_lib/recognitions-utils.ts";
import { cn } from "@/lib/utils.ts";

const schema = z.object({
  toUserId: z.string().min(1, "Pilih rekan yang ingin diapresiasi"),
  category: z.enum([
    "teamwork",
    "innovation",
    "leadership",
    "excellence",
    "helpfulness",
  ]),
  message: z
    .string()
    .min(10, "Pesan minimal 10 karakter")
    .max(1000, "Pesan maksimal 1000 karakter"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  initialRecipientId?: Id<"users"> | null;
  trigger?: React.ReactNode;
};

export default function CreateRecognitionDialog({
  initialRecipientId,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const employees = useQuery(api.users.listEmployees, open ? {} : "skip");
  const currentUser = useQuery(
    api.users.getCurrentUser,
    open ? {} : "skip",
  );
  const createRecognition = useMutation(api.recognitions.createRecognition);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      toUserId: initialRecipientId ?? "",
      category: "teamwork",
      message: "",
    },
  });

  const selectedUserId = form.watch("toUserId");
  const selectedCategory = form.watch("category");

  const eligibleEmployees = (employees ?? []).filter(
    (emp) => emp._id !== currentUser?._id,
  );
  const selectedUser = eligibleEmployees.find((e) => e._id === selectedUserId);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await createRecognition({
        toUserId: values.toUserId as Id<"users">,
        category: values.category,
        message: values.message,
      });
      toast.success("Apresiasi berhasil dikirim!");
      form.reset({
        toUserId: initialRecipientId ?? "",
        category: "teamwork",
        message: "",
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim apresiasi");
      } else {
        toast.error("Gagal mengirim apresiasi");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Heart className="size-4" />
            Kirim Apresiasi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Kirim Apresiasi
          </DialogTitle>
          <DialogDescription>
            Apresiasi rekan kerja atas kontribusi positif mereka.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Recipient picker */}
            <FormField
              control={form.control}
              name="toUserId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Untuk</FormLabel>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          role="combobox"
                          className={cn(
                            "w-full justify-between border bg-background",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {selectedUser ? (
                            <span className="flex items-center gap-2">
                              <Avatar className="size-5">
                                {selectedUser.avatarUrl ? (
                                  <AvatarImage src={selectedUser.avatarUrl} />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-[10px]">
                                  {getInitials(selectedUser.name)}
                                </AvatarFallback>
                              </Avatar>
                              {selectedUser.name ?? "Tanpa nama"}
                            </span>
                          ) : (
                            "Pilih rekan kerja..."
                          )}
                          <ChevronsUpDown className="size-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Cari nama rekan..." />
                        <CommandList>
                          <CommandEmpty>
                            Tidak ada karyawan ditemukan.
                          </CommandEmpty>
                          <CommandGroup>
                            {eligibleEmployees.map((emp) => (
                              <CommandItem
                                key={emp._id}
                                value={emp.name ?? emp._id}
                                onSelect={() => {
                                  field.onChange(emp._id);
                                  setPickerOpen(false);
                                }}
                                className="gap-2"
                              >
                                <Avatar className="size-6">
                                  {emp.avatarUrl ? (
                                    <AvatarImage src={emp.avatarUrl} />
                                  ) : null}
                                  <AvatarFallback className="bg-primary/10 text-[10px]">
                                    {getInitials(emp.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate font-medium">
                                    {emp.name ?? "Tanpa nama"}
                                  </span>
                                  {emp.jobTitle ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {emp.jobTitle}
                                    </span>
                                  ) : null}
                                </div>
                                {field.value === emp._id ? (
                                  <Check className="size-4 text-primary" />
                                ) : null}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category selector */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori Apresiasi</FormLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORY_VALUES.map((cat) => {
                      const cfg = CATEGORY_CONFIG[cat];
                      const Icon = cfg.icon;
                      const isSelected = field.value === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => field.onChange(cat)}
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <Icon className={cn("size-5", cfg.iconColor)} />
                          <span className="text-xs font-medium">
                            {cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_CONFIG[selectedCategory].description}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pesan Apresiasi</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Terima kasih atas kontribusi Anda... Ceritakan secara spesifik apa yang layak diapresiasi."
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
                {saving ? "Mengirim..." : "Kirim Apresiasi"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
