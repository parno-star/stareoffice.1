import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Download, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { DocumentWithUploader } from "@/convex/documents.ts";
import {
  CATEGORY_CONFIG,
  formatFileSize,
  getCategoryLabel,
  getFileIcon,
  type DocumentCategory,
} from "../_lib/document-utils.ts";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

function getBadgeClass(category: string): string {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as DocumentCategory].badge;
  }
  return CATEGORY_CONFIG.other.badge;
}

export default function DocumentCard({
  document,
  canDelete,
}: {
  document: DocumentWithUploader;
  canDelete: boolean;
}) {
  const remove = useMutation(api.documents.remove);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = getFileIcon(document.fileType, document.fileName);
  const uploadedAgo = formatDistanceToNow(new Date(document._creationTime), {
    addSuffix: true,
    locale: idLocale,
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove({ documentId: document._id });
      toast.success("Dokumen berhasil dihapus");
      setConfirmOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus dokumen");
      } else {
        toast.error("Gagal menghapus dokumen");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="group transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-6 text-primary" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold leading-tight">
                  {document.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {document.fileName}
                </p>
              </div>
              {canDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setConfirmOpen(true)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {document.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {document.description}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs", getBadgeClass(document.category))}
              >
                {getCategoryLabel(document.category)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(document.fileSize)}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="truncate text-xs text-muted-foreground">
                {document.uploaderName ?? "Tidak diketahui"} · {uploadedAgo}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-1.5"
                asChild
                disabled={!document.url}
              >
                <a
                  href={document.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-3.5" />
                  Buka
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer gap-1.5"
                asChild
                disabled={!document.url}
              >
                <a
                  href={document.url ?? "#"}
                  download={document.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-3.5" />
                  Unduh
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Dokumen "{document.title}"
              akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
