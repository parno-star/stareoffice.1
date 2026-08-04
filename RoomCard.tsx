import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  CalendarPlus,
  DoorOpen,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { getAmenityConfig } from "../_lib/rooms-utils.ts";
import BookingDialog from "./BookingDialog.tsx";
import RoomFormDialog from "./RoomFormDialog.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  room: Doc<"rooms">;
  isAdmin: boolean;
  onSelect?: (roomId: string) => void;
  isSelected?: boolean;
};

export default function RoomCard({
  room,
  isAdmin,
  onSelect,
  isSelected,
}: Props) {
  const removeRoom = useMutation(api.rooms.removeRoom);

  const handleDelete = async () => {
    try {
      await removeRoom({ roomId: room._id });
      toast.success("Ruangan dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus ruangan");
      } else {
        toast.error("Gagal menghapus ruangan");
      }
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        isSelected && "border-primary ring-2 ring-primary/20",
        !room.isActive && "opacity-60",
      )}
    >
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect?.(room._id)}
            className="group flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15">
              <DoorOpen className="size-5 text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold group-hover:text-primary">
                {room.name}
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {room.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {room.location}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  {room.capacity} orang
                </span>
                {!room.isActive ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Nonaktif
                  </Badge>
                ) : null}
              </div>
            </div>
          </button>
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <RoomFormDialog
                  room={room}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Hapus
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus ruangan ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ruangan dan seluruh pemesanannya akan dihapus permanen.
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
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {room.description ? (
          <p className="text-sm text-muted-foreground">{room.description}</p>
        ) : null}

        {room.amenities.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {room.amenities.map((a) => {
              const cfg = getAmenityConfig(a);
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <span
                  key={a}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                >
                  <Icon className="size-3" />
                  {cfg.label}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Belum ada fasilitas
          </p>
        )}

        {room.isActive ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect?.(room._id)}
              className="gap-1"
            >
              Lihat Jadwal
            </Button>
            <BookingDialog
              initialRoomId={room._id}
              trigger={
                <Button size="sm" className="gap-1.5">
                  <CalendarPlus className="size-3.5" />
                  Pesan
                </Button>
              }
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
