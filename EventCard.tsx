import { Card, CardContent } from "@/components/ui/card.tsx";
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
import { Calendar, Clock, MapPin, Trash2, User, Users, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getCategoryConfig } from "../_lib/calendar-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import RsvpButtons from "./RsvpButtons.tsx";

type EnrichedEvent = Doc<"events"> & {
  authorName: string;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  myRsvp: "going" | "maybe" | "not_going" | null;
};

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d MMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function EventCard({
  event,
  canDelete,
  showRsvp = true,
}: {
  event: EnrichedEvent;
  canDelete: boolean;
  showRsvp?: boolean;
}) {
  const remove = useMutation(api.events.remove);
  const cfg = getCategoryConfig(event.category);

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

  return (
    <Card
      className={`border-l-4 ${cfg.border.replace("border-", "border-l-")}`}
    >
      <CardContent className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
              >
                <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <h3 className="font-semibold text-foreground">{event.title}</h3>
          </div>

          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus acara?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`Acara "${event.title}" akan dihapus permanen dari kalender.`}
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
          ) : null}
        </div>

        <div className="space-y-1.5 text-sm text-foreground/90">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <span>
              {formatDate(event.startDate)}
              {event.endDate !== event.startDate
                ? ` – ${formatDate(event.endDate)}`
                : ""}
            </span>
          </div>

          {!event.allDay && event.startTime ? (
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {event.startTime}
                {event.endTime ? ` – ${event.endTime}` : ""}
              </span>
            </div>
          ) : null}

          {event.location ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span>
              {event.goingCount} hadir · {event.maybeCount} mungkin ·{" "}
              {event.notGoingCount} tidak
            </span>
          </div>
        </div>

        {event.description ? (
          <p className="rounded-md border bg-muted/30 p-2.5 text-sm leading-relaxed text-foreground/80 line-clamp-3">
            {event.description}
          </p>
        ) : null}

        {showRsvp ? (
          <div className="pt-1">
            <RsvpButtons eventId={event._id} current={event.myRsvp} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="size-3.5" />
            <span>Dibuat oleh {event.authorName}</span>
          </div>
          <Link
            to={`/calendar/${event._id}`}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Detail
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
