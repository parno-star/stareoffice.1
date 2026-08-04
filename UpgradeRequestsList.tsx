import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ArrowUpCircle,
  Users,
  HardDrive,
  Package,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Menunggu", variant: "secondary" },
  approved: { label: "Disetujui", variant: "default" },
  rejected: { label: "Ditolak", variant: "destructive" },
  completed: { label: "Selesai", variant: "default" },
};

const TYPE_ICONS: Record<string, typeof ArrowUpCircle> = {
  plan: Package,
  users: Users,
  storage: HardDrive,
};

const TYPE_LABELS: Record<string, string> = {
  plan: "Upgrade Paket",
  users: "Tambah Pengguna",
  storage: "Tambah Penyimpanan",
};

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy HH:mm", { locale: idLocale });
  } catch {
    return iso;
  }
}

type UpgradeRequestItemProps = {
  request: Doc<"upgradeRequests">;
  plans: Doc<"membershipPlans">[] | undefined;
  users: Map<string, string>;
};

function UpgradeRequestItem({ request, plans, users }: UpgradeRequestItemProps) {
  const reviewRequest = useMutation(api.promos.reviewUpgradeRequest);
  const [processing, setProcessing] = useState(false);

  const handleReview = async (status: string) => {
    setProcessing(true);
    try {
      await reviewRequest({ requestId: request._id, status });
      toast.success(status === "approved" ? "Permintaan disetujui" : "Permintaan ditolak");
    } catch {
      toast.error("Gagal memproses permintaan");
    } finally {
      setProcessing(false);
    }
  };

  const Icon = TYPE_ICONS[request.upgradeType] ?? ArrowUpCircle;
  const statusInfo = STATUS_BADGE[request.status] ?? { label: request.status, variant: "secondary" as const };
  const targetPlan = request.targetPlanId && plans
    ? plans.find((p) => p._id === request.targetPlanId)
    : null;

  const requesterId = request.requestedBy as Id<"users">;
  const requesterName = users.get(requesterId) ?? "Pengguna";

  return (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{TYPE_LABELS[request.upgradeType] ?? request.upgradeType}</p>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Dari: {requesterName} &middot; {formatDate(request.requestedAt)}
        </p>
        {targetPlan && (
          <p className="text-xs">Target paket: <span className="font-medium">{targetPlan.name}</span></p>
        )}
        {request.additionalUsers !== undefined && request.additionalUsers > 0 && (
          <p className="text-xs">Tambah pengguna: <span className="font-medium">+{request.additionalUsers}</span></p>
        )}
        {request.additionalStorageMb !== undefined && request.additionalStorageMb > 0 && (
          <p className="text-xs">
            Tambah storage: <span className="font-medium">
              +{request.additionalStorageMb >= 1024 ? `${Math.round(request.additionalStorageMb / 1024)} GB` : `${request.additionalStorageMb} MB`}
            </span>
          </p>
        )}
        {request.note && (
          <p className="text-xs text-muted-foreground">Catatan: {request.note}</p>
        )}
        {request.reviewNote && (
          <p className="text-xs text-muted-foreground">Balasan: {request.reviewNote}</p>
        )}
      </div>
      {request.status === "pending" && (
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer gap-1 text-green-600 hover:text-green-700"
            onClick={() => handleReview("approved")}
            disabled={processing}
          >
            <Check className="size-4" /> Setujui
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer gap-1 text-destructive hover:text-destructive"
            onClick={() => handleReview("rejected")}
            disabled={processing}
          >
            <X className="size-4" /> Tolak
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UpgradeRequestsList() {
  const requests = useQuery(api.promos.listUpgradeRequests, {});
  const plans = useQuery(api.membership.list, {});

  if (requests === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  // Build a name map from requests' requestedBy
  const userNames = new Map<string, string>();

  if (requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ArrowUpCircle /></EmptyMedia>
          <EmptyTitle>Belum ada permintaan upgrade</EmptyTitle>
          <EmptyDescription>
            Permintaan upgrade paket, pengguna, atau penyimpanan dari organisasi
            akan muncul di sini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <UpgradeRequestItem
          key={req._id}
          request={req}
          plans={plans}
          users={userNames}
        />
      ))}
    </div>
  );
}
