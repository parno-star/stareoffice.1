import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Building2,
  Users as UsersIcon,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  bandColorForGrade,
  bandLabelForGrade,
  POSITION_STATUS_CONFIG,
  formatIDR,
} from "../_lib/grading-utils.ts";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  position: Doc<"ggsPositions"> & {
    employeeCount: number;
    salaryBand: Doc<"ggsSalaryBands"> | null;
  };
};

export default function PositionCard({ position }: Props) {
  const navigate = useNavigate();
  const status = POSITION_STATUS_CONFIG[position.status];
  const band = position.salaryBand;

  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm"
      onClick={() => navigate(`/grading/${position._id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Briefcase className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{position.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3" /> {position.department}
                  </span>
                  {position.jobFamily ? (
                    <span className="text-muted-foreground">
                      · {position.jobFamily}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {status ? (
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {position.summary}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              {position.currentGrade !== undefined ? (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg font-bold",
                      bandColorForGrade(position.currentGrade),
                    )}
                  >
                    {position.currentGrade}
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Global Grade
                    </p>
                    <p className="text-xs font-semibold">
                      {bandLabelForGrade(position.currentGrade)}
                    </p>
                  </div>
                </div>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  Belum dievaluasi
                </Badge>
              )}
              {band ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Salary Band (Mid)
                  </p>
                  <p className="font-semibold">{formatIDR(band.midSalary)}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Karyawan
                </p>
                <p className="inline-flex items-center gap-1 font-semibold">
                  <UsersIcon className="size-3.5" />
                  {position.employeeCount}
                </p>
              </div>
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// Helper type export for list consumers
export type PositionListItem = Props["position"];
export type PositionId = Id<"ggsPositions">;
