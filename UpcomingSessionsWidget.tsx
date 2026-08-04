import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Calendar, ExternalLink, MapPin, Video } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatIdDateTime,
  SESSION_FORMAT_LABEL,
} from "../_lib/advanced-utils.ts";

export default function UpcomingSessionsWidget() {
  const sessions = useQuery(api.training.sessions.listUpcomingForUser, {});
  if (sessions === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (sessions.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-blue-600" />
          <h3 className="font-semibold">Sesi Live Mendatang</h3>
          <Badge variant="secondary" className="ml-auto">
            {sessions.length}
          </Badge>
        </div>
        <ul className="divide-y">
          {sessions.slice(0, 3).map((s) => (
            <li
              key={s._id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                to={`/training/${s.courseId}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.courseTitle}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{formatIdDateTime(s.startAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    {s.format === "offline" ? (
                      <MapPin className="size-3" />
                    ) : (
                      <Video className="size-3" />
                    )}
                    {SESSION_FORMAT_LABEL[s.format] ?? s.format}
                  </span>
                </div>
              </Link>
              {s.meetingUrl ? (
                <a
                  href={s.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Gabung
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
