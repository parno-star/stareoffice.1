import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  RotateCcw,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";
import type { ChecklistItem } from "./tour-data.ts";

type OnboardingChecklistProps = {
  items: ChecklistItem[];
  completedIds: string[];
  onToggle: (id: string) => void;
  onDismiss: () => void;
  onRestartTour: () => void;
};

export default function OnboardingChecklist({
  items,
  completedIds,
  onToggle,
  onDismiss,
  onRestartTour,
}: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const doneCount = completedIds.length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = doneCount === totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Panduan Memulai</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allDone ? "Semua selesai!" : `${doneCount}/${totalCount} selesai`}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Checklist items */}
          <div className="space-y-1">
            <AnimatePresence>
              {items.map((item) => {
                const done = completedIds.includes(item.id);
                const ItemIcon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    layout
                    onClick={() => {
                      if (!done) {
                        onToggle(item.id);
                        navigate(item.path);
                      }
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      done
                        ? "opacity-60 hover:bg-muted/50"
                        : "hover:bg-muted"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-5 shrink-0 text-green-500" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done && "line-through text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                    {!done && (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onRestartTour}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              Ulangi Tour
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
