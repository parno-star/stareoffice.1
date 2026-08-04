import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Download,
  ExternalLink,
  MoreVertical,
  Trash2,
  Clock,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import {
  formatFileSize,
  formatIsoDate,
  getCategoryConfig,
  getExpiryStatus,
} from "../_lib/utils.ts";
import type { EmployeeDocumentWithMeta } from "@/convex/employeeDocuments.ts";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function PersonalDocCard({
  document,
  showOwner,
}: {
  document: EmployeeDocumentWithMeta;
  showOwner?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useMutation(api.employeeDocuments.remove);

  const config = getCategoryConfig(document.category);
  const Icon = config.icon;
  const expiryStatus = getExpiryStatus(document.expiryDate);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove({ documentId: document._id });
      toast.success("Dokumen dihapus");
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
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${config.tint}`}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold leading-tight">
                {document.title}
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {document.url ? (
                    <>
                      <DropdownMenuItem asChild>
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer"
                        >
                          <ExternalLink className="size-4" />
                          Buka
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a
                          href={document.url}
                          download={document.fileName}
                          className="cursor-pointer"
                        >
                          <Download className="size-4" />
                          Unduh
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmOpen(true)}
                    className="cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className={config.badge}>
                {config.label}
              </Badge>
              {expiryStatus === "expired" ? (
                <Badge
                  variant="secondary"
                  className="bg-red-500/10 text-red-700 dark:text-red-300"
                >
                  <AlertTriangle className="size-3" />
                  Kadaluarsa
                </Badge>
              ) : null}
              {expiryStatus === "soon" ? (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  <CalendarClock className="size-3" />
                  Segera kadaluarsa
                </Badge>
              ) : null}
            </div>
            {showOwner && document.ownerName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Pemilik:{" "}
                <span className="font-medium">{document.ownerName}</span>
              </p>
            ) : null}
            {document.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {document.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatDistanceToNow(new Date(document._creationTime), {
              addSuffix: true,
              locale: idLocale,
            })}
          </span>
          <span className="truncate">
            {document.fileName} &middot; {formatFileSize(document.fileSize)}
          </span>
          {document.issueDate ? (
            <span>Terbit: {formatIsoDate(document.issueDate)}</span>
          ) : null}
          {document.expiryDate ? (
            <span
              className={
                expiryStatus === "expired"
                  ? "text-red-600 dark:text-red-400"
                  : expiryStatus === "soon"
                    ? "text-amber-600 dark:text-amber-400"
                    : undefined
              }
            >
              Berakhir: {formatIsoDate(document.expiryDate)}
            </span>
          ) : null}
        </div>

        {document.url ? (
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="flex-1 cursor-pointer"
            >
              <a href={document.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Buka
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="flex-1 cursor-pointer"
            >
              <a href={document.url} download={document.fileName}>
                <Download className="size-4" />
                Unduh
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen &quot;{document.title}&quot; akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
