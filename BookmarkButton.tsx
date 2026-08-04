import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

export default function BookmarkButton({
  courseId,
  variant = "ghost",
  size = "sm",
  className,
  showLabel = true,
}: {
  courseId: Id<"courses">;
  variant?:
    | "default"
    | "ghost"
    | "secondary"
    | "destructive"
    | "link";
  size?: "sm" | "default" | "lg" | "icon" | "icon-sm";
  className?: string;
  showLabel?: boolean;
}) {
  const isBookmarked = useQuery(api.training.budget.isBookmarked, {
    courseId,
  });
  const toggle = useMutation(api.training.budget.toggleBookmark);

  const handleClick = async () => {
    try {
      const res = await toggle({ courseId });
      toast.success(
        res.bookmarked ? "Ditambahkan ke wishlist" : "Dihapus dari wishlist",
      );
    } catch {
      toast.error("Gagal");
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      className={cn("cursor-pointer gap-1", className)}
    >
      {isBookmarked ? (
        <BookmarkCheck className="size-4 fill-primary text-primary" />
      ) : (
        <Bookmark className="size-4" />
      )}
      {showLabel ? (isBookmarked ? "Tersimpan" : "Simpan") : null}
    </Button>
  );
}
