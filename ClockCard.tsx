import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Clock, LogIn, LogOut, MapPin, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { getLocalDateString, formatClock } from "../_lib/utils.ts";

export default function ClockCard() {
  const today = getLocalDateString();
  const record = useQuery(api.attendance.getTodayRecord, { date: today });
  const clockIn = useMutation(api.attendance.clockIn);
  const clockOut = useMutation(api.attendance.clockOut);

  const [dialog, setDialog] = useState<"in" | "out" | null>(null);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    const iso = new Date().toISOString();
    try {
      if (dialog === "in") {
        await clockIn({
          nowIso: iso,
          note: note.trim() || undefined,
          location: location.trim() || undefined,
        });
        toast.success("Clock-in berhasil!");
      } else if (dialog === "out") {
        await clockOut({
          nowIso: iso,
          note: note.trim() || undefined,
        });
        toast.success("Clock-out berhasil!");
      }
      setDialog(null);
      setNote("");
      setLocation("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (record === undefined) {
    return <Skeleton className="h-48 w-full" />;
  }

  const clockedIn = !!record;
  const clockedOut = !!record?.clockOutAt;

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{dateStr}</div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="size-5 text-primary" />
                <span className="text-3xl font-bold font-mono tracking-tight">
                  {timeStr}
                </span>
              </div>
            </div>
            {record?.isLate && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="size-3" />
                Terlambat
              </Badge>
            )}
          </div>

          {clockedIn && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-3">
              <div>
                <div className="text-xs text-muted-foreground">Clock-in</div>
                <div className="text-lg font-semibold font-mono">
                  {formatClock(record.clockInAt)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Clock-out</div>
                <div className="text-lg font-semibold font-mono">
                  {formatClock(record.clockOutAt)}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!clockedIn && (
              <Button
                size="lg"
                className="flex-1 cursor-pointer"
                onClick={() => setDialog("in")}
              >
                <LogIn className="size-4" />
                Clock-in
              </Button>
            )}
            {clockedIn && !clockedOut && (
              <Button
                size="lg"
                variant="secondary"
                className="flex-1 cursor-pointer"
                onClick={() => setDialog("out")}
              >
                <LogOut className="size-4" />
                Clock-out
              </Button>
            )}
            {clockedOut && (
              <div className="flex-1 rounded-lg bg-green-500/10 px-4 py-3 text-center text-sm font-medium text-green-700 dark:text-green-400">
                Selamat, Anda telah menyelesaikan pekerjaan hari ini
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "in" ? "Clock-in" : "Clock-out"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "in"
                ? "Catat waktu mulai kerja Anda"
                : "Catat waktu selesai kerja Anda"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dialog === "in" && (
              <div className="space-y-2">
                <Label htmlFor="loc" className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Lokasi (opsional)
                </Label>
                <Input
                  id="loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Kantor pusat / Remote / Client site"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="note">Catatan (opsional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  dialog === "in"
                    ? "Mulai hari produktif"
                    : "Menyelesaikan laporan mingguan"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog(null)}
              disabled={submitting}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? "Memproses..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
