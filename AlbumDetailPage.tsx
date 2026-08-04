import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { isAdminRole } from "@/convex/roles.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
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
import {
  ArrowLeft,
  Calendar,
  Camera,
  ImageIcon,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import UploadPhotosDialog from "./_components/UploadPhotosDialog.tsx";
import PhotoGrid from "./_components/PhotoGrid.tsx";
import { formatEventDate } from "./_lib/gallery-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { PhotoWithUrl } from "@/convex/gallery.ts";

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();

  const albumData = useQuery(
    api.gallery.getAlbum,
    albumId ? { albumId: albumId as Id<"galleryAlbums"> } : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const removeAlbum = useMutation(api.gallery.removeAlbum);

  if (albumData === undefined || currentUser === undefined) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!albumData) {
    return (
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyTitle>Album tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Album mungkin telah dihapus atau tidak tersedia.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/gallery")}>
              Kembali ke Galeri
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const { album, photos } = albumData;
  const isAdmin = isAdminRole(currentUser?.role);
  const isAuthor =
    currentUser !== null &&
    currentUser !== undefined &&
    album.authorId === currentUser._id;
  const canDeleteAlbum = isAdmin || isAuthor;

  const canDeletePhoto = (photo: PhotoWithUrl): boolean => {
    if (!currentUser) return false;
    return (
      isAdmin ||
      isAuthor ||
      photo.uploaderId === currentUser._id
    );
  };

  const handleDeleteAlbum = async () => {
    try {
      await removeAlbum({ albumId: album._id });
      toast.success("Album berhasil dihapus");
      navigate("/gallery");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus album");
      } else {
        toast.error("Gagal menghapus album");
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      {/* Back button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => navigate("/gallery")}
        className="gap-2"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Galeri
      </Button>

      {/* Album header */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {album.coverUrl ? (
          <div className="relative h-40 w-full overflow-hidden sm:h-56">
            <img
              src={album.coverUrl}
              alt={album.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {album.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                {formatEventDate(album.eventDate)}
              </span>
              {album.authorName ? (
                <span className="flex items-center gap-1.5">
                  <UserIcon className="size-4" />
                  {album.authorName}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Camera className="size-4" />
                {album.photoCount} foto
              </span>
            </div>
            {album.description ? (
              <p className="text-sm text-muted-foreground">
                {album.description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <UploadPhotosDialog albumId={album._id} />
            {canDeleteAlbum ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus album?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Album ini beserta semua foto di dalamnya akan dihapus permanen. Aksi ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAlbum}>
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      </div>

      {/* Photos */}
      {photos.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Camera />
            </EmptyMedia>
            <EmptyTitle>Belum ada foto</EmptyTitle>
            <EmptyDescription>
              Tambahkan foto pertama untuk mulai mengisi album ini.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <UploadPhotosDialog albumId={album._id} />
          </EmptyContent>
        </Empty>
      ) : (
        <PhotoGrid photos={photos} canDeletePhoto={canDeletePhoto} />
      )}
    </div>
  );
}
