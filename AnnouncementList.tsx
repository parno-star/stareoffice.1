import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Megaphone,
  AlertTriangle,
  Info,
  Bell,
  ArrowRight,
  Heart,
  MessageSquare,
  Pin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { EnrichedAnnouncement } from "@/convex/announcements";

const priorityConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Bell }
> = {
  urgent: { label: "Mendesak", variant: "destructive", icon: AlertTriangle },
  important: { label: "Penting", variant: "default", icon: Bell },
  normal: { label: "Informasi", variant: "secondary", icon: Info },
};

export default function AnnouncementList({
  announcements,
}: {
  announcements: EnrichedAnnouncement[];
}) {
  const navigate = useNavigate();

  if (announcements.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Megaphone />
          </EmptyMedia>
          <EmptyTitle>Belum ada pengumuman</EmptyTitle>
          <EmptyDescription>
            Pengumuman perusahaan akan muncul di sini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Show only first 5 on dashboard
  const display = announcements.slice(0, 5);

  return (
    <div className="space-y-3">
      {display.map((a) => {
        const config = priorityConfig[a.priority] ?? priorityConfig.normal;
        const PriorityIcon = config.icon;
        const timeAgo = formatDistanceToNow(new Date(a.publishedAt), {
          addSuffix: true,
          locale: idLocale,
        });
        const preview = a.summary?.trim() || a.content;

        return (
          <Card
            key={a._id}
            onClick={() => navigate(`/news/${a._id}`)}
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {a.isPinned ? (
                    <Pin className="size-4 shrink-0 text-primary" />
                  ) : (
                    <PriorityIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base leading-snug">
                    {a.title}
                  </CardTitle>
                </div>
                <Badge variant={config.variant} className="shrink-0 text-xs">
                  {config.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {preview}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {a.authorName}
                </span>
                {a.authorDepartment && (
                  <>
                    <span>&middot;</span>
                    <span>{a.authorDepartment}</span>
                  </>
                )}
                <span>&middot;</span>
                <span>{timeAgo}</span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {a.likeCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" />
                    {a.commentCount ?? 0}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button
        variant="ghost"
        className="w-full gap-2"
        onClick={() => navigate("/news")}
      >
        Lihat semua berita & pengumuman
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
