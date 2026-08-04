import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ImageIcon, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatEventDate } from "../_lib/gallery-utils.ts";
import type { AlbumSummary } from "@/convex/gallery.ts";

export default function AlbumCard({ album }: { album: AlbumSummary }) {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/gallery/${album._id}`)}
      className="group cursor-pointer gap-0 overflow-hidden pt-0 pb-0 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Cover */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <ImageIcon className="size-12 text-muted-foreground/50" />
          </div>
        )}
        <Badge className="absolute right-3 top-3 bg-background/90 text-foreground shadow-sm backdrop-blur">
          {album.photoCount} foto
        </Badge>
      </div>

      {/* Meta */}
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-semibold leading-tight">
          {album.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>{formatEventDate(album.eventDate)}</span>
          {album.authorName ? (
            <>
              <span className="mx-0.5">·</span>
              <span className="truncate">oleh {album.authorName}</span>
            </>
          ) : null}
        </div>
        {album.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {album.description}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
