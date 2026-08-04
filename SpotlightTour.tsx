import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { TourStep } from "./tour-data.ts";

type SpotlightTourProps = {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TooltipPos = {
  top: number;
  left: number;
};

function getTooltipPosition(
  rect: TargetRect,
  position: TourStep["position"],
  tooltipW: number,
  tooltipH: number
): TooltipPos {
  const GAP = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;

  switch (position) {
    case "bottom":
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "top":
      top = rect.top - tooltipH - GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left + rect.width + GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - GAP;
      break;
  }

  // Keep within viewport
  if (left < 8) left = 8;
  if (left + tooltipW > vw - 8) left = vw - tooltipW - 8;
  if (top < 8) top = 8;
  if (top + tooltipH > vh - 8) top = vh - tooltipH - 8;

  return { top, left };
}

export default function SpotlightTour({
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}: SpotlightTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      // Scroll into view if needed
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    updateRect();
    // Re-measure on scroll/resize
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  // Re-measure after a brief delay for DOM settlement
  useEffect(() => {
    const t = setTimeout(updateRect, 150);
    return () => clearTimeout(t);
  }, [currentStep, updateRect]);

  if (!step) return null;

  const PAD = 6;
  const spotRect = targetRect
    ? {
        top: targetRect.top - PAD,
        left: targetRect.left - PAD,
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  // Calculate tooltip width based on viewport
  const tooltipW = Math.min(340, window.innerWidth - 32);
  const tooltipH = 220; // estimate
  const tooltipPos =
    spotRect && targetRect
      ? getTooltipPosition(targetRect, step.position, tooltipW, tooltipH)
      : { top: window.innerHeight / 2 - tooltipH / 2, left: window.innerWidth / 2 - tooltipW / 2 };

  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <svg className="absolute inset-0 size-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotRect && (
              <rect
                x={spotRect.left}
                y={spotRect.top}
                width={spotRect.width}
                height={spotRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={onSkip}
        />
      </svg>

      {/* Highlight border */}
      {spotRect && (
        <motion.div
          className="absolute rounded-lg border-2 border-primary"
          style={{
            top: spotRect.top,
            left: spotRect.left,
            width: spotRect.width,
            height: spotRect.height,
            pointerEvents: "none",
          }}
          layoutId="spotlight-ring"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "absolute z-10 rounded-xl border bg-card shadow-2xl p-4",
          )}
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: tooltipW,
          }}
        >
          {/* Close button */}
          <button
            onClick={onSkip}
            className="absolute right-2 top-2 cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-3 pr-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <StepIcon className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>

          {/* Progress + navigation */}
          <div className="mt-4 flex items-center justify-between">
            {/* Step indicators */}
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === currentStep ? "bg-primary w-4" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onPrev}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="size-3.5" />
                  Kembali
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={onFinish} className="gap-1 text-xs">
                  Selesai
                </Button>
              ) : (
                <Button size="sm" onClick={onNext} className="gap-1 text-xs">
                  Lanjut
                  <ChevronRight className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Langkah {currentStep + 1} dari {steps.length}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
