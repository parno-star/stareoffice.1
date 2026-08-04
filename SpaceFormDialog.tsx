import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import {
  WIKI_COLORS,
  WIKI_SPACE_ICONS,
  type WikiColorToken,
} from "@/pages/wiki/_lib/wiki-utils.ts";

export default function SpaceFormDialog({
  trigger,
  onCreated,
  initialValues,
  mode = "create",
}: {
  trigger: React.ReactNode;
  onCreated?: (spaceId: Id<"wikiSpaces">) => void;
  initialValues?: {
    spaceId: Id<"wikiSpaces">;
    name: string;
    description: string;
    icon: string;
    color: string;
  };
  mode?: "create" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [icon, setIcon] = useState(initialValues?.icon ?? "📘");
  const [color, setColor] = useState<WikiColorToken>(
    (initialValues?.color as WikiColorToken) ?? "blue",
  );
  const [submitting, setSubmitting] = useState(false);
  const create = useMutation(api.wiki.createSpace);
  const update = useMutation(api.wiki.updateSpace);

  const reset = () => {
    if (mode === "create") {
      setName("");
      setDescription("");
      setIcon("📘");
      setColor("blue");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      toast.error("Nama space wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        const id = await create({
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
        });
        toast.success("Space dibuat");
        setOpen(false);
        reset();
        onCreated?.(id);
      } else if (initialValues) {
        await update({
          spaceId: initialValues.spaceId,
          name: name.trim(),
          description: description.trim(),
          icon,
          color,
        });
        toast.success("Space diperbarui");
        setOpen(false);
      }
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat space baru" : "Ubah space"}
          </DialogTitle>
          <DialogDescription>
            Space mengelompokkan artikel terkait, misalnya HR, Produk, atau
            Engineering.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="space-name">Nama space</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kebijakan HR"
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="space-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan tujuan space ini..."
              maxLength={240}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ikon</Label>
            <div className="flex flex-wrap gap-1.5">
              {WIKI_SPACE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    "flex size-9 cursor-pointer items-center justify-center rounded-md border text-lg transition-all",
                    icon === emoji
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-transparent bg-muted hover:bg-muted/80",
                  )}
                >
                  {emoji}
                </button>
              ))}
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-16"
                placeholder="Atau"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Warna</Label>
            <div className="flex flex-wrap gap-2">
              {WIKI_COLORS.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => setColor(c.token)}
                  title={c.label}
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-full transition-all",
                    c.className,
                    color === c.token
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "",
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Menyimpan..."
                : mode === "create"
                  ? "Buat space"
                  : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
