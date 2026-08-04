import { Card, CardContent } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";

type Tone = "primary" | "emerald" | "amber" | "sky" | "rose" | "violet" | "slate";

const toneMap: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "primary",
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick &&
          "cursor-pointer transition-colors hover:border-primary/40 hover:shadow-md",
      )}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            toneMap[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sublabel ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {sublabel}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
