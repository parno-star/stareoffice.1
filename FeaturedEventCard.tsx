import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Sparkles,
  Users,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Link } from "react-router-dom";
import { getCategoryConfig } from "@/pages/calendar/_lib/calendar-utils.ts";
import { getEventTypeLabel, formatTimeRange } from "../_lib/events-utils.ts";
import RsvpButtons from "@/pages/calendar/_components/RsvpButtons.tsx";
import type { EnrichedEvent } from "./types.ts";

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d MMMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function FeaturedEventCard({ event }: { event: EnrichedEvent }) {
  const cfg = getCategoryConfig(event.category);
  const typeInfo = getEventTypeLabel(event.eventType);

  return (
    <Card className="overflow-hidden pt-0">
      <div className="grid gap-0 md:grid-cols-2">
        {/* Visual */}
        {event.bannerUrl ? (
          <div className="relative h-56 md:h-full">
            <img
              src={event.bannerUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />
            <Badge className="absolute left-4 top-4 gap-1 bg-amber-500/95 text-white hover:bg-amber-500">
              <Sparkles className="size-3.5" />
              Unggulan
            </Badge>
          </div>
        ) : (
          <div
            className={`relative flex h-56 items-center justify-center md:h-full ${cfg.bg}`}
          >
            <span className="text-8xl">{typeInfo.emoji}</span>
            <Badge className="absolute left-4 top-4 gap-1 bg-amber-500/95 text-white hover:bg-amber-500">
              <Sparkles className="size-3.5" />
              Unggulan
            </Badge>
          </div>
        )}

        {/* Content */}
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`gap-1.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}
              variant="outline"
            >
              <span className={`size-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <span>{typeInfo.emoji}</span>
              {typeInfo.label}
            </Badge>
          </div>

          <div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
              {event.title}
            </h2>
            {event.description ? (
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {event.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <span className="capitalize">
                {formatDate(event.startDate)}
                {event.endDate !== event.startDate
                  ? ` – ${formatDate(event.endDate)}`
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>
                {formatTimeRange(
                  event.startTime ?? undefined,
                  event.endTime ?? undefined,
                  event.allDay,
                )}
              </span>
            </div>
            {event.location ? (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" />
              <span>
                {event.goingCount} hadir
                {typeof event.capacity === "number" && event.capacity > 0
                  ? ` dari ${event.capacity}`
                  : ""}{" "}
                · {event.maybeCount} mungkin
              </span>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-2">
            {!event.rsvpClosed ? (
              <RsvpButtons
                eventId={event._id}
                current={event.myRsvp}
                size="default"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Periode RSVP telah ditutup.
              </p>
            )}
            <Button asChild variant="secondary" className="w-full">
              <Link to={`/calendar/${event._id}`}>
                Lihat detail & peserta
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
