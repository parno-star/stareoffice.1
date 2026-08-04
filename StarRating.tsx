import { Star } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type Props = {
  value: number | undefined;
  onChange?: (value: number | undefined) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function StarRating({
  value,
  onChange,
  readOnly,
  size = "md",
}: Props) {
  const sizeClass =
    size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";

  const handleClick = (n: number) => {
    if (readOnly || !onChange) return;
    // Clicking the same star clears the rating
    onChange(value === n ? undefined : n);
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== undefined && n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => handleClick(n)}
            disabled={readOnly}
            aria-label={`Beri nilai ${n}`}
            className={cn(
              "transition-colors",
              readOnly ? "cursor-default" : "cursor-pointer hover:scale-110",
            )}
          >
            <Star
              className={cn(
                sizeClass,
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
      {value !== undefined ? (
        <span className="ml-1 text-sm font-medium tabular-nums">
          {value.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
