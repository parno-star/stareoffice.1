import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { FileText, Download, ExternalLink } from "lucide-react";
import { formatFileSize } from "@/pages/my-documents/_lib/utils.ts";

const SK_CATEGORY = "contract";

/**
 * Dialog that lists an employee's SK/Kontrak PDF documents. Each document opens
 * in a new browser tab, letting the device's own built-in PDF viewer render it
 * (this avoids browsers blocking an embedded/iframe PDF preview). A download
 * option is also provided. Access is enforced by the backend query (admins see
 * all, employees see only their own).
 */
export default function SkDocumentsViewer({
  userId,
  open,
  onOpenChange,
}: {
  userId: Id<"users">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const documents = useQuery(
    api.employeeDocuments.listForUser,
    open ? { userId, category: SK_CATEGORY } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Dokumen SK / Kontrak
          </DialogTitle>
          <DialogDescription>
            Ketuk dokumen untuk membukanya di penampil PDF perangkat Anda, atau
            gunakan tombol unduh untuk menyimpannya.
          </DialogDescription>
        </DialogHeader>

        {documents === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Belum ada dokumen SK/Kontrak yang dilampirkan.
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc._id}>
                {doc.url ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {doc.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.fileName} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </a>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer gap-1.5"
                        asChild
                      >
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          Buka
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        asChild
                        aria-label="Unduh dokumen"
                      >
                        <a href={doc.url} download={doc.fileName}>
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {doc.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.fileName} · {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Tidak tersedia
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
