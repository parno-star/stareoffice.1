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
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { X } from "lucide-react";
import MarkdownContent from "@/pages/wiki/_components/MarkdownContent.tsx";

type ArticleInitialValues = {
  articleId: Id<"wikiArticles">;
  spaceId: Id<"wikiSpaces">;
  title: string;
  summary: string;
  content: string;
  tags: Array<string>;
  status: string;
};

export default function ArticleFormDialog({
  trigger,
  defaultSpaceId,
  onSaved,
  initialValues,
  mode = "create",
}: {
  trigger: React.ReactNode;
  defaultSpaceId?: Id<"wikiSpaces">;
  onSaved?: (articleId: Id<"wikiArticles">) => void;
  initialValues?: ArticleInitialValues;
  mode?: "create" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const spaces = useQuery(api.wiki.listSpaces, open ? {} : "skip");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<Array<string>>(initialValues?.tags ?? []);
  const [spaceId, setSpaceId] = useState<Id<"wikiSpaces"> | null>(
    initialValues?.spaceId ?? defaultSpaceId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const createArticle = useMutation(api.wiki.createArticle);
  const updateArticle = useMutation(api.wiki.updateArticle);

  const resetOnCreate = () => {
    if (mode !== "create") return;
    setTitle("");
    setSummary("");
    setContent("");
    setTags([]);
    setTagInput("");
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t.length === 0) return;
    if (t.length > 24) {
      toast.error("Tag maksimal 24 karakter");
      return;
    }
    if (tags.includes(t)) {
      setTagInput("");
      return;
    }
    if (tags.length >= 10) {
      toast.error("Maksimal 10 tag per artikel");
      return;
    }
    setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const targetSpaceId = useMemo(() => {
    return spaceId ?? spaces?.[0]?._id ?? null;
  }, [spaceId, spaces]);

  const doSave = async (status: "draft" | "published") => {
    if (title.trim().length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    if (content.trim().length === 0) {
      toast.error("Isi artikel wajib diisi");
      return;
    }
    if (!targetSpaceId) {
      toast.error("Pilih space terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        const id = await createArticle({
          spaceId: targetSpaceId,
          title: title.trim(),
          content,
          summary: summary.trim() || undefined,
          tags,
          status,
        });
        toast.success(
          status === "published" ? "Artikel diterbitkan" : "Draft tersimpan",
        );
        setOpen(false);
        resetOnCreate();
        onSaved?.(id);
      } else if (initialValues) {
        await updateArticle({
          articleId: initialValues.articleId,
          spaceId: targetSpaceId,
          title: title.trim(),
          content,
          summary: summary.trim(),
          tags,
          status,
        });
        toast.success("Artikel diperbarui");
        setOpen(false);
        onSaved?.(initialValues.articleId);
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tulis artikel baru" : "Ubah artikel"}
          </DialogTitle>
          <DialogDescription>
            Gunakan format Markdown: **tebal**, _miring_, `kode`, `#` untuk
            heading, dan `-` untuk daftar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="space-y-1.5">
              <Label htmlFor="article-title">Judul</Label>
              <Input
                id="article-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Panduan kerja dari rumah"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Space</Label>
              <Select
                value={targetSpaceId ?? "none"}
                onValueChange={(v) =>
                  setSpaceId(v === "none" ? null : (v as Id<"wikiSpaces">))
                }
                disabled={spaces === undefined || (spaces && spaces.length === 0)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces === undefined ? (
                    <SelectItem value="loading" disabled>
                      Memuat...
                    </SelectItem>
                  ) : spaces.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Belum ada space
                    </SelectItem>
                  ) : (
                    spaces.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.icon} {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="article-summary">
              Ringkasan (opsional, tampil di daftar)
            </Label>
            <Textarea
              id="article-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Rangkum isi artikel dalam 1-2 kalimat"
              rows={2}
              maxLength={240}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tag</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => removeTag(tag)}
                >
                  #{tag}
                  <X className="size-3" />
                </Badge>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                  if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                placeholder={tags.length === 0 ? "Ketik tag lalu Enter" : ""}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Isi artikel</Label>
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">Tulis</TabsTrigger>
                <TabsTrigger value="preview">Pratinjau</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="# Judul bagian
Tulis dengan Markdown..."
                  rows={14}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="min-h-[320px] rounded-md border bg-card p-4">
                  {content.trim().length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      Belum ada konten untuk dipratinjau.
                    </p>
                  ) : (
                    <MarkdownContent content={content} />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void doSave("draft");
              }}
              disabled={submitting}
            >
              Simpan sebagai draft
            </Button>
            <Button
              type="button"
              onClick={() => {
                void doSave("published");
              }}
              disabled={submitting}
            >
              {submitting
                ? "Menyimpan..."
                : mode === "create"
                  ? "Publikasikan"
                  : "Simpan perubahan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
