import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Library,
  Plus,
  Pin,
  PinOff,
  Trash2,
  ExternalLink,
  Download,
  Mail,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  getResourceKindConfig,
  getResourceCategoryConfig,
  getInitials,
} from "../_lib/onboarding-utils.ts";
import ResourceFormDialog from "./ResourceFormDialog.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import type { ResourceWithExtras } from "@/convex/onboarding/resources.ts";

function ResourceCard({
  resource,
  canManage,
}: {
  resource: ResourceWithExtras;
  canManage: boolean;
}) {
  const kind = getResourceKindConfig(resource.kind);
  const cat = getResourceCategoryConfig(resource.category);
  const KindIcon = kind.icon;
  const updateResource = useMutation(api.onboarding.resources.update);
  const removeResource = useMutation(api.onboarding.resources.remove);

  const handleTogglePin = async () => {
    try {
      await updateResource({
        id: resource._id,
        isPinned: !resource.isPinned,
      });
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal memperbarui");
      } else {
        toast.error("Gagal memperbarui");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await removeResource({ id: resource._id });
      toast.success("Resource dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const openUrl = resource.kind === "document"
    ? resource.fileUrl ?? undefined
    : resource.url ?? undefined;

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg ${kind.iconBg}`}
          >
            {resource.icon ? (
              <span className="text-xl" aria-hidden>
                {resource.icon}
              </span>
            ) : (
              <KindIcon className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {resource.title}
                  </p>
                  {resource.isPinned ? (
                    <Pin className="size-3.5 text-primary" />
                  ) : null}
                </div>
                {resource.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {resource.description}
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={handleTogglePin}
                    title={resource.isPinned ? "Lepas pin" : "Pin"}
                  >
                    {resource.isPinned ? (
                      <PinOff className="size-4" />
                    ) : (
                      <Pin className="size-4" />
                    )}
                  </Button>
                  <ResourceFormDialog
                    resource={resource}
                    trigger={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="cursor-pointer"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus resource?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={cat.badge}>
                {cat.label}
              </Badge>
              <Badge variant="outline">{kind.label}</Badge>
            </div>

            {resource.kind === "contact" && resource.contactUserId ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <Avatar className="size-8">
                  {resource.contactAvatar ? (
                    <AvatarImage src={resource.contactAvatar} />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(resource.contactName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resource.contactName ?? "Karyawan"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {resource.contactJobTitle ?? ""}
                  </p>
                </div>
                {resource.contactEmail ? (
                  <a
                    href={`mailto:${resource.contactEmail}`}
                    className="shrink-0"
                  >
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer"
                    >
                      <Mail className="size-4" />
                    </Button>
                  </a>
                ) : null}
              </div>
            ) : null}

            {openUrl ? (
              <div className="mt-3">
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 cursor-pointer"
                  >
                    {resource.kind === "document" ? (
                      <>
                        <Download className="size-4" />
                        Unduh {resource.fileName ? "· " + resource.fileName : ""}
                      </>
                    ) : (
                      <>
                        <ExternalLink className="size-4" />
                        Buka {resource.kind === "video" ? "video" : "tautan"}
                      </>
                    )}
                  </Button>
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type Props = {
  canManage: boolean;
};

export default function ResourcesTab({ canManage }: Props) {
  const resources = useQuery(api.onboarding.resources.list, {});

  if (resources === undefined) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tautan, dokumen, video, dan kontak yang wajib diketahui karyawan
            baru.
          </p>
          <ResourceFormDialog
            trigger={
              <Button size="sm" className="gap-1 cursor-pointer">
                <Plus className="size-4" />
                Resource Baru
              </Button>
            }
          />
        </div>
      ) : null}

      {resources.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Library />
            </EmptyMedia>
            <EmptyTitle>Belum ada resource</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Bangun pustaka sambutan untuk karyawan baru agar mereka bisa cepat beradaptasi."
                : "HR akan segera melengkapi pustaka sambutan di sini."}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <ResourceFormDialog
                trigger={
                  <Button size="sm" className="gap-1 cursor-pointer">
                    <Plus className="size-4" />
                    Resource Baru
                  </Button>
                }
              />
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {resources.map((r) => (
            <ResourceCard key={r._id} resource={r} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
