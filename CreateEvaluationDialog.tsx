import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { Target, X, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  positionId: Id<"ggsPositions">;
  positionTitle: string;
  triggerVariant?: "default" | "secondary";
  triggerLabel?: string;
};

export default function CreateEvaluationDialog({
  positionId,
  positionTitle,
  triggerVariant = "default",
  triggerLabel = "Mulai Evaluasi Baru",
}: Props) {
  const [open, setOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(
    `${new Date().getFullYear()} Review`,
  );
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Array<Id<"users">>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: undefined } : "skip",
  );
  const create = useMutation(api.grading.createEvaluation);

  const selectedUsers =
    employees?.filter((u) => selected.includes(u._id)) ?? [];

  const handleToggle = (id: Id<"users">) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!periodLabel.trim()) {
      toast.error("Period label wajib diisi");
      return;
    }
    if (selected.length < 1) {
      toast.error("Pilih minimal satu anggota komite");
      return;
    }
    setSaving(true);
    try {
      await create({
        positionId,
        periodLabel: periodLabel.trim(),
        reason: reason.trim() || undefined,
        evaluatorIds: selected,
      });
      toast.success("Evaluasi berhasil dibuat");
      setOpen(false);
      setReason("");
      setSelected([]);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal membuat evaluasi");
      } else {
        toast.error("Gagal membuat evaluasi");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="cursor-pointer">
          <Target className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mulai Evaluasi Jabatan</DialogTitle>
          <DialogDescription>
            Undang komite penilai untuk mengevaluasi jabatan{" "}
            <span className="font-medium">{positionTitle}</span> pada 7 faktor
            WTW GGS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Periode <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="2026 Review / Q1 2026 / dll."
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alasan / Justifikasi</Label>
            <Textarea
              rows={2}
              placeholder="Kenapa evaluasi ini dilakukan? (re-grading, peran baru, dll)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Anggota Komite <span className="text-red-500">*</span>
            </Label>
            {selectedUsers.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <Badge key={u._id} className="gap-1 pr-1">
                    <Avatar className="size-4">
                      <AvatarImage src={u.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {(u.name ?? "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    {u.name ?? "—"}
                    <button
                      type="button"
                      onClick={() => handleToggle(u._id)}
                      className="ml-1 cursor-pointer rounded-full p-0.5 hover:bg-black/10"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  className="w-full cursor-pointer justify-start"
                >
                  <Plus className="size-4" />
                  Tambah Penilai
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0">
                <Command>
                  <CommandInput placeholder="Cari karyawan..." />
                  <CommandList>
                    <CommandEmpty>Tidak ada hasil</CommandEmpty>
                    <CommandGroup>
                      {(employees ?? []).map((u) => {
                        const isSelected = selected.includes(u._id);
                        return (
                          <CommandItem
                            key={u._id}
                            value={u.name ?? u._id}
                            onSelect={() => handleToggle(u._id)}
                            className="cursor-pointer"
                          >
                            <Avatar className="size-6">
                              <AvatarImage src={u.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {(u.name ?? "?").slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm">{u.name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {u.jobTitle ?? u.department ?? ""}
                              </p>
                            </div>
                            {isSelected ? (
                              <Check className="size-4 text-primary" />
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              Semua anggota komite akan menilai jabatan, dan hasil final adalah
              rata-rata dari level yang diberikan.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Membuat..." : "Mulai Evaluasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
