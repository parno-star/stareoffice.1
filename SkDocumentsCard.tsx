import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { FileText, Download, ExternalLink } from "lucide-react";
import { formatFileSize } from "@/pages/my-documents/_lib/utils.ts";

const SK_CATEGORY = "contract";

/**
 * Read-only list of an employee's SK/Kontrak PDF documents shown on the detail
 * page. Each row opens the PDF in a new browser tab (rendered by the device's
 * own PDF viewer) and offers a download button. The backend query enforces
 * access: admins see all, an employee sees only their own documents. Renders
 * nothing when there are none.
 */
export default function SkDocumentsCard({
  userId,
  canView,
}: {
  userId: Id<"users">;
  canView: boolean;
}) {
  const documents = useQuery(
    api.employeeDocuments.listForUser,
    canView ? { userId, category: SK_CATEGORY } : "skip",
  );

  // Hide entirely while loading or when the employee has no SK documents, so
  // the detail page stays clean for profiles without attachments.
  if (!canView) return null;
  if (documents === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (documents.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="size-3.5" />
          Dokumen SK / Kontrak ({documents.length})
        </h2>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.fileName} · {formatFileSize(doc.fileSize)}
                </p>
              </div>
              {doc.url ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer gap-1.5"
                    asChild
                  >
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                      Lihat
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
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
