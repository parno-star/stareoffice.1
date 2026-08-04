import { Badge } from "@/components/ui/badge.tsx";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

export type LeaveStatus = "pending" | "approved" | "rejected";

const CONFIG: Record<
  LeaveStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Menunggu",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

export default function LeaveStatusBadge({ status }: { status: string }) {
  const key =
    (status as LeaveStatus) in CONFIG ? (status as LeaveStatus) : "pending";
  const { label, className, icon: Icon } = CONFIG[key];
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
