import { useEffect, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
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
import { ChevronLeft, ChevronRight, X, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { PhotoWithUrl } from "@/convex/gallery.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  photos: Array<PhotoWithUrl>;
  canDeletePhoto: (photo: PhotoWithUrl) => boolean;
};

export default function PhotoGrid({ photos, canDeletePhoto }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const removePhoto = useMutation(api.gallery.removePhoto);

  const close = useCallback(() => setActiveIndex(null), []);
  const prev = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null) return null;
      return i === 0 ? photos.length - 1 : i - 1;
    });
  }, [photos.length]);
  const next = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null) return null;
      return i === photos.length - 1 ? 0 : i + 1;
    });
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (activeIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, close, prev, next]);

  const handleDelete = async (photo: PhotoWithUrl) => {
    try {
      await removePhoto({ photoId: photo._id });
      toast.success("Foto berhasil dihapus");
      // If we're deleting the active photo, close the lightbox
      if (activeIndex !== null && photos[activeIndex]?._id === photo._id) {
        close();
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus foto");
      } else {
        toast.error("Gagal menghapus foto");
      }
    }
  };

  const active = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo._id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.caption ?? "Foto galeri"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="size-6 text-muted-foreground" />
              </div>
            )}
            {photo.caption ? (
              <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent p-2 text-left transition-transform duration-300 group-hover:translate-y-0">
                <p className="line-clamp-2 text-xs font-medium text-white">
                  {photo.caption}
                </p>
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
          onClick={close}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm">
              {activeIndex !== null ? activeIndex + 1 : 0} / {photos.length}
              {active.uploaderName ? (
                <span className="ml-2 text-white/70">
                  · oleh {active.uploaderName}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {canDeletePhoto(active) ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus foto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Foto ini akan dihapus permanen dari album. Aksi ini tidak dapat dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(active)}>
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={close}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          {/* Image area */}
          <div
            className="relative flex flex-1 items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={prev}
                className={cn(
                  "absolute left-4 z-10 size-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white",
                )}
              >
                <ChevronLeft className="size-6" />
              </Button>
            ) : null}

            {active.url ? (
              <img
                src={active.url}
                alt={active.caption ?? "Foto"}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center text-white/70">
                <ImageOff className="size-10" />
              </div>
            )}

            {photos.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={next}
                className="absolute right-4 z-10 size-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              >
                <ChevronRight className="size-6" />
              </Button>
            ) : null}
          </div>

          {/* Caption */}
          {active.caption ? (
            <div
              className="px-6 py-4 text-center text-sm text-white/90"
              onClick={(e) => e.stopPropagation()}
            >
              {active.caption}
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      ) : null}
    </>
  );
}
