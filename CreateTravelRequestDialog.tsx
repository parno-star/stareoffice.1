import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, PlusCircle, CalendarDays } from "lucide-react";
import { ConvexError } from "convex/values";
import {
  TRANSPORT_CONFIG,
  type TransportMode,
  enumerateDates,
  formatDateLong,
  todayIso,
} from "../_lib/travel-utils.ts";

type ItineraryItem = {
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  activity: string;
  notes: string;
};

function makeEmptyItem(date: string): ItineraryItem {
  return {
    date,
    timeStart: "",
    timeEnd: "",
    location: "",
    activity: "",
    notes: "",
  };
}

export default function CreateTravelRequestDialog({
  triggerLabel = "Ajukan Perjalanan",
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerVariant?: "default" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [transportMode, setTransportMode] = useState<TransportMode>("flight");
  const [accommodation, setAccommodation] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [items, setItems] = useState<Array<ItineraryItem>>([
    makeEmptyItem(todayIso()),
  ]);
  const [submitting, setSubmitting] = useState(false);

  const createRequest = useMutation(api.travel.create);

  const dates = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return [];
    return enumerateDates(startDate, endDate);
  }, [startDate, endDate]);

  const reset = () => {
    setTitle("");
    setDestination("");
    setPurpose("");
    setStartDate(todayIso());
    setEndDate(todayIso());
    setTransportMode("flight");
    setAccommodation("");
    setEstimatedCost("");
    setItems([makeEmptyItem(todayIso())]);
    setSubmitting(false);
  };

  const updateItem = (index: number, patch: Partial<ItineraryItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    const firstDate = dates[0] ?? startDate;
    setItems((prev) => [...prev, makeEmptyItem(firstDate)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (asDraft: boolean) => {
    if (title.trim().length === 0) {
      toast.error("Judul perjalanan wajib diisi");
      return;
    }
    if (destination.trim().length === 0) {
      toast.error("Tujuan perjalanan wajib diisi");
      return;
    }
    if (purpose.trim().length === 0) {
      toast.error("Tujuan/alasan perjalanan wajib diisi");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Tanggal perjalanan wajib diisi");
      return;
    }
    if (startDate > endDate) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }
    const numCost = Number(estimatedCost.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numCost) || numCost < 0) {
      toast.error("Estimasi biaya tidak valid");
      return;
    }

    // Filter out incomplete itinerary items
    const itinerary = items
      .filter(
        (it) =>
          it.location.trim().length > 0 && it.activity.trim().length > 0,
      )
      .map((it) => ({
        date: it.date,
        timeStart: it.timeStart || undefined,
        timeEnd: it.timeEnd || undefined,
        location: it.location.trim(),
        activity: it.activity.trim(),
        notes: it.notes.trim() || undefined,
      }));

    setSubmitting(true);
    try {
      await createRequest({
        title: title.trim(),
        destination: destination.trim(),
        purpose: purpose.trim(),
        startDate,
        endDate,
        transportMode,
        accommodation: accommodation.trim() || undefined,
        estimatedCost: numCost,
        submit: !asDraft,
        itinerary: itinerary.length > 0 ? itinerary : undefined,
      });
      toast.success(
        asDraft
          ? "Perjalanan disimpan sebagai draft"
          : "Pengajuan perjalanan berhasil dikirim",
      );
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim pengajuan");
      } else {
        toast.error("Gagal mengirim pengajuan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          setOpen(v);
          if (!v) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="gap-2 cursor-pointer">
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pengajuan Perjalanan Dinas Baru</DialogTitle>
          <DialogDescription>
            Isi detail perjalanan, rencana harian, dan estimasi biaya agar
            persetujuan berjalan cepat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="trip-title">Judul Perjalanan</Label>
            <Input
              id="trip-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kunjungan klien di Surabaya"
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trip-destination">Tujuan (Kota / Kantor)</Label>
              <Input
                id="trip-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Surabaya, Jawa Timur"
                disabled={submitting}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label>Moda Transportasi</Label>
              <Select
                value={transportMode}
                onValueChange={(v) => setTransportMode(v as TransportMode)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRANSPORT_CONFIG).map(([value, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4" />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trip-start">Tanggal Mulai</Label>
              <DateField
                id="trip-start"
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  if (endDate < v) setEndDate(v);
                }}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-end">Tanggal Selesai</Label>
              <DateField
                id="trip-end"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                min={startDate}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-purpose">Tujuan / Alasan Perjalanan</Label>
            <Textarea
              id="trip-purpose"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Presentasi proposal proyek, rapat koordinasi, audit cabang..."
              disabled={submitting}
              maxLength={500}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trip-accommodation">Akomodasi (opsional)</Label>
              <Input
                id="trip-accommodation"
                value={accommodation}
                onChange={(e) => setAccommodation(e.target.value)}
                placeholder="Hotel Midtown, Surabaya"
                disabled={submitting}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-cost">Estimasi Biaya (IDR)</Label>
              <Input
                id="trip-cost"
                type="number"
                min="0"
                step="50000"
                placeholder="2500000"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays className="size-4" />
                  Rencana Itinerary (Opsional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tambahkan aktivitas harian untuk memperjelas rencana.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addItem}
                disabled={submitting || dates.length === 0}
                className="gap-1 cursor-pointer"
              >
                <PlusCircle className="size-4" />
                Tambah
              </Button>
            </div>

            {dates.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Tentukan tanggal mulai dan selesai terlebih dahulu.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-md border bg-background p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Select
                        value={item.date}
                        onValueChange={(v) => updateItem(index, { date: v })}
                        disabled={submitting}
                      >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dates.map((d) => (
                            <SelectItem key={d} value={d}>
                              {formatDateLong(d)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeItem(index)}
                        disabled={submitting || items.length <= 1}
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Mulai</Label>
                        <Input
                          type="time"
                          value={item.timeStart}
                          onChange={(e) =>
                            updateItem(index, { timeStart: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Selesai</Label>
                        <Input
                          type="time"
                          value={item.timeEnd}
                          onChange={(e) =>
                            updateItem(index, { timeEnd: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Lokasi</Label>
                      <Input
                        value={item.location}
                        onChange={(e) =>
                          updateItem(index, { location: e.target.value })
                        }
                        placeholder="Kantor klien, Hotel Midtown..."
                        disabled={submitting}
                        maxLength={160}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Aktivitas</Label>
                      <Input
                        value={item.activity}
                        onChange={(e) =>
                          updateItem(index, { activity: e.target.value })
                        }
                        placeholder="Meeting, site visit, presentasi..."
                        disabled={submitting}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Catatan</Label>
                      <Textarea
                        rows={2}
                        value={item.notes}
                        onChange={(e) =>
                          updateItem(index, { notes: e.target.value })
                        }
                        placeholder="Catatan tambahan (opsional)"
                        disabled={submitting}
                        maxLength={300}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => submit(true)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Simpan Draft
          </Button>
          <Button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
