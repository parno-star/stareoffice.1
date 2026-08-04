import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Lock, ArrowUpCircle } from "lucide-react";

type FeatureGateProps = {
  /** The sidebar menu key to check (e.g. "training", "recruitment") */
  menuKey: string;
  children: React.ReactNode;
};

/**
 * Wraps page content and blocks access if the organisation's membership plan
 * does not include the specified feature.
 *
 * Usage:
 * ```tsx
 * <FeatureGate menuKey="training">
 *   <TrainingPageContent />
 * </FeatureGate>
 * ```
 */
export default function FeatureGate({ menuKey, children }: FeatureGateProps) {
  const result = useQuery(api.planAccess.isFeatureBlocked, { menuKey });
  const navigate = useNavigate();

  if (result === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (result.blocked) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>Fitur Tidak Tersedia</EmptyTitle>
            <EmptyDescription>
              {result.upgradeMessage ?? "Fitur ini tidak termasuk dalam paket keanggotaan Anda."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowUpCircle className="size-4" />
              Kembali ke Dashboard
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return <>{children}</>;
}
