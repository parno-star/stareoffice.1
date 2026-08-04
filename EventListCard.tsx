import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Trash2,
  Users,
  Sparkles,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import { getCategoryConfig } from "@/pages/calendar/_lib/calendar-utils.ts";
import { getEventTypeLabel, formatTimeRange } from "../_lib/events-utils.ts";
import type { EnrichedEvent } from "./types.ts";
import RsvpButtons from "@/pages/calendar/_components/RsvpButtons.tsx";

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function EventListCard({
  event,
  canManage,
  onEdit,
}: {
  event: EnrichedEvent;
  canManage: boolean;
  onEdit?: () => void;
}) {
  const remove = useMutation(api.events.remove);
  const cfg = getCategoryConfig(event.category);
  const typeInfo = getEventTypeLabel(event.eventType);

  const handleDelete = async () => {
    try {
      await remove({ id: event._id });
      toast.success("Acara dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  const capacityLabel =
    typeof event.capacity === "number" && event.capacity > 0
      ? `${event.goingCount}/${event.capacity} hadir`
      : `${event.goingCount} hadir`;
  const capacityFull =
    typeof event.capacityRemaining === "number" &&
    event.capacityRemaining === 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0">
      {/* Banner or colored header */}
      {event.bannerUrl ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          {event.isFeatured ? (
            <Badge className="absolute left-3 top-3 gap-1 bg-amber-500/95 text-white hover:bg-amber-500">
              <Sparkles className="size-3" />
              Unggulan
            </Badge>
          ) : null}
        </div>
      ) : (
        <div
          className={`relative flex h-28 items-center justify-center ${cfg.bg}`}
        >
          <span className="text-5xl">{typeInfo.emoji}</span>
          {event.isFeatured ? (
            <Badge className="absolute left-3 top-3 gap-1 bg-amber-500/95 text-white hover:bg-amber-500">
              <Sparkles className="size-3" />
              Unggulan
            </Badge>
          ) : null}
        </div>
      )}

      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
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
          {event.rsvpClosed ? (
            <Badge variant="outline" className="border-muted-foreground/40">
              RSVP ditutup
            </Badge>
          ) : capacityFull ? (
            <Badge variant="destructive">Penuh</Badge>
          ) : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            {event.title}
          </h3>
          {event.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5 text-sm text-foreground/90">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>
              {formatDate(event.startDate)}
              {event.endDate !== event.startDate
                ? ` – ${formatDate(event.endDate)}`
                : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
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
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{event.location}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span>
              {capacityLabel} · {event.maybeCount} mungkin ·{" "}
              {event.notGoingCount} tidak
            </span>
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-1">
          {!event.rsvpClosed ? (
            <RsvpButtons eventId={event._id} current={event.myRsvp} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <span className="text-xs text-muted-foreground">
              Dibuat oleh {event.authorName}
            </span>
            <div className="flex items-center gap-1">
              {canManage ? (
                <>
                  {onEdit ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={onEdit}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus acara?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {`Acara "${event.title}" akan dihapus permanen beserta semua RSVP-nya.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="cursor-pointer text-primary"
              >
                <Link to={`/calendar/${event._id}`}>
                  Detail
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
