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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { UserPlus } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

const schema = z.object({
  userId: z.string().min(1, "Pilih karyawan"),
  currentLevelId: z.string().optional(),
  targetLevelId: z.string().optional(),
  mentorId: z.string().optional(),
  mentorNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Props = {
  pathId: Id<"careerPaths">;
  levels: Array<Doc<"careerPathLevels">>;
};

export default function AssignEmployeeDialog({ pathId, levels }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const employees = useQuery(api.users.listEmployees, {});
  const assignments = useQuery(api.careerPath.listPathAssignments, { pathId });
  const assign = useMutation(api.careerPath.assignEmployee);

  const assignedIds = new Set(
    (assignments ?? []).map((a) => a.userId as string),
  );
  const available = (employees ?? []).filter((e) => !assignedIds.has(e._id));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: "",
      currentLevelId: "none",
      targetLevelId: levels[0]?._id ?? "none",
      mentorId: "none",
      mentorNote: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await assign({
        pathId,
        userId: values.userId as Id<"users">,
        currentLevelId:
          values.currentLevelId && values.currentLevelId !== "none"
            ? (values.currentLevelId as Id<"careerPathLevels">)
            : undefined,
        targetLevelId:
          values.targetLevelId && values.targetLevelId !== "none"
            ? (values.targetLevelId as Id<"careerPathLevels">)
            : undefined,
        mentorId:
          values.mentorId && values.mentorId !== "none"
            ? (values.mentorId as Id<"users">)
            : undefined,
        mentorNote: values.mentorNote?.trim() || undefined,
      });
      toast.success("Karyawan ditugaskan ke jenjang karier");
      setOpen(false);
      form.reset({
        userId: "",
        currentLevelId: "none",
        targetLevelId: levels[0]?._id ?? "none",
        mentorId: "none",
        mentorNote: "",
      });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menugaskan");
      } else {
        toast.error("Gagal menugaskan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-2">
          <UserPlus className="size-4" />
          Tugaskan Karyawan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tugaskan Karyawan</DialogTitle>
          <DialogDescription>
            Pilih karyawan dan tentukan level awal serta target yang ingin
            dicapai.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="userId"
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
                      {available.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Semua karyawan sudah di path ini
                        </div>
                      ) : (
                        available.map((e) => (
                          <SelectItem key={e._id} value={e._id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                {e.avatarUrl ? (
                                  <AvatarImage src={e.avatarUrl} />
                                ) : null}
                                <AvatarFallback className="text-[10px]">
                                  {initials(e.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{e.name ?? "Tanpa nama"}</div>
                                {e.jobTitle ? (
                                  <div className="text-xs text-muted-foreground">
                                    {e.jobTitle}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="currentLevelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level Saat Ini</FormLabel>
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
                        <SelectItem value="none">Belum di level</SelectItem>
                        {levels.map((l) => (
                          <SelectItem key={l._id} value={l._id}>
                            L{l.order}. {l.title}
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
                name="targetLevelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Level</FormLabel>
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
                        <SelectItem value="none">Belum ditentukan</SelectItem>
                        {levels.map((l) => (
                          <SelectItem key={l._id} value={l._id}>
                            L{l.order}. {l.title}
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
              name="mentorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mentor (Opsional)</FormLabel>
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
                      <SelectItem value="none">Tanpa mentor</SelectItem>
                      {(employees ?? []).map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.name ?? "Tanpa nama"}
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
              name="mentorNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan Mentor</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Tujuan pengembangan, fokus, dll."
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
                {saving ? "Menugaskan..." : "Tugaskan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
