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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { todayIso } from "../_lib/onboarding-utils.ts";
import { Search, UserPlus } from "lucide-react";

type Props = {
  trigger?: ReactNode;
  excludeUserIds?: Array<Id<"users">>;
};

export default function StartOnboardingDialog({
  trigger,
  excludeUserIds = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<Id<"users"> | "">("");
  const [startDate, setStartDate] = useState(todayIso());
  const [buddyId, setBuddyId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: search.trim() || undefined } : "skip",
  );
  const start = useMutation(api.onboarding.startOnboarding);

  const excludedSet = useMemo(
    () => new Set(excludeUserIds.map((id) => id as string)),
    [excludeUserIds],
  );
  const eligible = useMemo(
    () =>
      (employees ?? []).filter(
        (u) => !excludedSet.has(u._id as string),
      ),
    [employees, excludedSet],
  );
  const allEmployees = employees ?? [];

  const reset = () => {
    setUserId("");
    setStartDate(todayIso());
    setBuddyId("none");
    setManagerId("none");
    setNotes("");
    setSearch("");
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      toast.error("Tanggal tidak valid");
      return;
    }
    setSubmitting(true);
    try {
      await start({
        userId: userId as Id<"users">,
        startDate,
        buddyId:
          buddyId !== "none" ? (buddyId as Id<"users">) : undefined,
        managerId:
          managerId !== "none" ? (managerId as Id<"users">) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Onboarding dimulai");
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memulai onboarding");
      } else {
        toast.error("Gagal memulai onboarding");
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
        {trigger ?? (
          <Button className="gap-2 cursor-pointer">
            <UserPlus className="size-4" />
            Mulai Onboarding
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mulai Onboarding Karyawan Baru</DialogTitle>
          <DialogDescription>
            Checklist akan dibuat otomatis dari template aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cari Karyawan</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik nama..."
                className="pl-9"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Karyawan</Label>
            <Select
              value={userId || "none"}
              onValueChange={(v) =>
                setUserId(v === "none" ? "" : (v as Id<"users">))
              }
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih karyawan..." />
              </SelectTrigger>
              <SelectContent>
                {eligible.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Tidak ada karyawan tersedia
                  </SelectItem>
                ) : (
                  eligible.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                      {u.department ? ` · ${u.department}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Tanggal Mulai Kerja</Label>
            <DateField
              id="start-date"
              value={startDate}
              onChange={(v) => setStartDate(v)}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Manajer</Label>
              <Select
                value={managerId}
                onValueChange={setManagerId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {allEmployees.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Buddy / Mentor</Label>
              <Select
                value={buddyId}
                onValueChange={setBuddyId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {allEmployees.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onb-notes">Catatan (opsional)</Label>
            <Textarea
              id="onb-notes"
              rows={3}
              placeholder="Catatan khusus untuk tim HR atau manajer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !userId}
            className="cursor-pointer"
          >
            {submitting ? "Memulai..." : "Mulai Onboarding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
