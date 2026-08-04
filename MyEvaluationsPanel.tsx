import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Target, ChevronRight, Briefcase, Clock, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EVAL_STATUS_CONFIG } from "../_lib/grading-utils.ts";

export default function MyEvaluationsPanel() {
  const rows = useQuery(api.grading.myPendingEvaluations, {});
  const navigate = useNavigate();

  if (rows === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Target />
          </EmptyMedia>
          <EmptyTitle>Tidak ada penilaian</EmptyTitle>
          <EmptyDescription>
            Anda belum diundang menjadi anggota komite penilai pada evaluasi
            jabatan manapun.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ evaluator, evaluation, position }) => {
        if (!position) return null;
        const statusConfig = EVAL_STATUS_CONFIG[evaluation.status];
        const isSubmitted = evaluator.status === "submitted";
        return (
          <Card
            key={evaluator._id}
            className="cursor-pointer transition-colors hover:border-primary/40"
            onClick={() =>
              navigate(
                `/grading/${position._id}?evalId=${evaluation._id}`,
              )
            }
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Briefcase className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{position.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {position.department} · {evaluation.periodLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusConfig ? (
                        <Badge
                          variant="outline"
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      ) : null}
                      {isSubmitted ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <Check className="size-3" /> Saya sudah submit
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <Clock className="size-3" /> Menunggu penilaian saya
                        </Badge>
                      )}
                    </div>
                  </div>
                  {evaluation.reason ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {evaluation.reason}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
