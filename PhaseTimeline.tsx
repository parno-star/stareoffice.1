import { Card, CardContent } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import OnboardingTaskRow from "./OnboardingTaskRow.tsx";
import {
  PHASE_ORDER,
  PHASE_CONFIG,
  phaseFromOffset,
  type OnboardingPhase,
} from "../_lib/onboarding-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  tasks: Array<Doc<"onboardingTasks">>;
  startDate: string;
  canToggle: boolean;
  canDelete: boolean;
};

function getPhaseOfTask(
  task: Doc<"onboardingTasks">,
  startDate: string,
): OnboardingPhase {
  if (task.phase && (PHASE_ORDER as Array<string>).includes(task.phase)) {
    return task.phase as OnboardingPhase;
  }
  if (!task.dueDate) return "first_week";
  const [sy, sm, sd] = startDate.split("-").map((n) => Number(n));
  const [dy, dm, dd] = task.dueDate.split("-").map((n) => Number(n));
  const diff = Math.round(
    (new Date(dy, dm - 1, dd).getTime() -
      new Date(sy, sm - 1, sd).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return phaseFromOffset(diff);
}

export default function PhaseTimeline({
  tasks,
  startDate,
  canToggle,
  canDelete,
}: Props) {
  const grouped: Record<OnboardingPhase, Array<Doc<"onboardingTasks">>> = {
    preboarding: [],
    day_one: [],
    first_week: [],
    first_month: [],
    first_quarter: [],
  };
  for (const t of tasks) {
    const p = getPhaseOfTask(t, startDate);
    grouped[p].push(t);
  }
  for (const p of PHASE_ORDER) {
    grouped[p].sort((a, b) => a.order - b.order);
  }

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phase, idx) => {
        const cfg = PHASE_CONFIG[phase];
        const Icon = cfg.icon;
        const phaseTasks = grouped[phase];
        const total = phaseTasks.length;
        const done = phaseTasks.filter((t) => t.status === "done").length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        const isComplete = total > 0 && done === total;
        const isEmpty = total === 0;

        return (
          <div key={phase} className="relative">
            {/* Connector line */}
            {idx !== PHASE_ORDER.length - 1 ? (
              <div
                className="absolute left-[21px] top-10 bottom-0 w-px bg-border"
                aria-hidden
              />
            ) : null}

            <div className="flex gap-4">
              <div
                className={cn(
                  "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2",
                  cfg.accent,
                  isComplete ? "ring-2 ring-emerald-500/40" : "",
                )}
              >
                <Icon className={cn("size-5", cfg.color)} />
              </div>

              <div className="min-w-0 flex-1 pb-2">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={cn("text-sm font-semibold", cfg.color)}>
                            {cfg.label}
                          </h3>
                          <Badge variant="outline" className="text-[10px]">
                            {cfg.short}
                          </Badge>
                          {isComplete ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            >
                              Selesai
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cfg.description}
                        </p>
                      </div>
                      {!isEmpty ? (
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">
                            {done}/{total}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {percent}%
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {!isEmpty ? (
                      <>
                        <Progress value={percent} className="mt-3 h-1.5" />
                        <div className="mt-3 space-y-2">
                          {phaseTasks.map((task) => (
                            <OnboardingTaskRow
                              key={task._id}
                              task={task}
                              canToggle={canToggle}
                              canDelete={canDelete}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Belum ada tugas di fase ini.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
