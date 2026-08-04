import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { SUGGESTION_PROMPTS, SUGGESTION_CATEGORIES } from "../_lib/suggestions.ts";
import type { SuggestionCategory } from "../_lib/suggestions.ts";

type Props = {
  onPick: (prompt: string) => void;
  disabled?: boolean;
};

export default function SuggestionGrid({ onPick, disabled }: Props) {
  const [activeCategory, setActiveCategory] = useState<SuggestionCategory | "all">("all");

  const filtered =
    activeCategory === "all"
      ? SUGGESTION_PROMPTS.slice(0, 8)
      : SUGGESTION_PROMPTS.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-1.5">
        <button
          onClick={() => setActiveCategory("all")}
          disabled={disabled}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all",
            activeCategory === "all"
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          Semua
        </button>
        {SUGGESTION_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            disabled={disabled}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all",
              activeCategory === cat.key
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {filtered.map((s) => (
          <Button
            key={s.id}
            variant="ghost"
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className={cn(
              "h-auto cursor-pointer justify-start gap-3 rounded-xl border bg-gradient-to-br px-3 py-3 text-left whitespace-normal",
              s.accent,
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
              <s.icon className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {s.label}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {s.prompt}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
