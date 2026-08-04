import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { FileText, LayoutTemplate, Check } from "lucide-react";
import { CONTENT_TEMPLATE_CATEGORY_LABELS } from "../_lib/letterVariables.ts";

interface LetterTemplatePickerProps {
  /** Letter type/category to prioritise (e.g. "keluar", "memo"). Optional. */
  category?: string;
  /** Called with the chosen template's raw HTML content. */
  onSelect: (content: string) => void;
  /** Whether the editor currently has meaningful content (to warn on replace). */
  hasExistingContent?: boolean;
}

/**
 * Button + dialog that lets the user pick a saved letter body template and
 * insert it into the editor. Templates are managed by admins in Pengaturan Surat.
 */
export default function LetterTemplatePicker({
  category,
  onSelect,
  hasExistingContent,
}: LetterTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const templates = useQuery(
    api.letterContentTemplates.listActive,
    open ? { category } : "skip",
  );

  const handlePick = (tpl: Doc<"letterContentTemplates">) => {
    if (
      hasExistingContent &&
      !window.confirm(
        "Isi surat saat ini akan diganti dengan template terpilih. Lanjutkan?",
      )
    ) {
      return;
    }
    onSelect(tpl.content);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <LayoutTemplate className="size-3.5" />
        Pilih Template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Template Isi Surat</DialogTitle>
            <DialogDescription>
              Pilih template untuk mengisi badan surat secara otomatis. Anda tetap
              bisa mengeditnya setelah dipilih.
            </DialogDescription>
          </DialogHeader>

          {templates === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Belum ada template</EmptyTitle>
                <EmptyDescription>
                  Admin dapat membuat template isi surat di Pengaturan Surat → tab
                  Template Isi.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <button
                  key={tpl._id}
                  type="button"
                  onClick={() => handlePick(tpl)}
                  className="group flex w-full flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="font-semibold text-sm">{tpl.name}</span>
                    {tpl.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {CONTENT_TEMPLATE_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                      </Badge>
                    )}
                    <Check className="ml-auto size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground">{tpl.description}</p>
                  )}
                  <div
                    className="prose prose-xs mt-1 max-h-20 max-w-none overflow-hidden text-xs text-muted-foreground [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
                    dangerouslySetInnerHTML={{ __html: tpl.content }}
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
