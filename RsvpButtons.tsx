import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { Check, HelpCircle, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type RsvpStatus = "going" | "maybe" | "not_going";

const OPTIONS: Array<{
  value: RsvpStatus;
  label: string;
  icon: typeof Check;
  activeClass: string;
}> = [
  {
    value: "going",
    label: "Hadir",
    icon: Check,
    activeClass: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
  },
  {
    value: "maybe",
    label: "Mungkin",
    icon: HelpCircle,
    activeClass: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
  },
  {
    value: "not_going",
    label: "Tidak",
    icon: X,
    activeClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
  },
];

export default function RsvpButtons({
  eventId,
  current,
  size = "sm",
}: {
  eventId: Id<"events">;
  current: RsvpStatus | null;
  size?: "sm" | "default";
}) {
  const [saving, setSaving] = useState<RsvpStatus | null>(null);
  const setRsvp = useMutation(api.events.setRsvp);

  const handle = async (status: RsvpStatus) => {
    if (saving) return;
    setSaving(status);
    try {
      await setRsvp({ eventId, status });
      toast.success(
        status === "going"
          ? "Kehadiran dikonfirmasi"
          : status === "maybe"
            ? "Ditandai mungkin hadir"
            : "Ditandai tidak hadir",
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        const Icon = opt.icon;
        return (
          <Button
            key={opt.value}
            type="button"
            size={size}
            variant="secondary"
            disabled={saving !== null}
            onClick={() => handle(opt.value)}
            className={cn(
              "cursor-pointer border",
              active ? opt.activeClass : "bg-background",
            )}
          >
            <Icon className="size-4" />
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
