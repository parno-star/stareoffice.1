import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type Slide = {
  imageUrl: string;
  caption?: string;
};

type CarouselSettings = {
  transitionType: string;   // "slide" | "fade" | "zoom"
  duration: number;          // seconds
  transitionSpeed: number;   // ms
  autoPlay: boolean;
};

type BannerCarouselProps = {
  slides: Slide[];
  settings?: CarouselSettings;
};

const DEFAULT_SETTINGS: CarouselSettings = {
  transitionType: "slide",
  duration: 5,
  transitionSpeed: 400,
  autoPlay: true,
};

/** Build motion variants based on transition type */
function getVariants(type: string, direction: number, speed: number) {
  const durationSec = speed / 1000;

  if (type === "fade") {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: durationSec, ease: "easeOut" as const },
    };
  }

  if (type === "zoom") {
    return {
      initial: { opacity: 0, scale: 1.15 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 },
      transition: { duration: durationSec, ease: "easeOut" as const },
    };
  }

  // Default: slide
  return {
    initial: { opacity: 0, x: direction * 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -60 },
    transition: { duration: durationSec, ease: "easeOut" as const },
  };
}

export default function BannerCarousel({ slides, settings }: BannerCarouselProps) {
  const cfg = settings ?? DEFAULT_SETTINGS;
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current]
  );

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-advance based on settings
  useEffect(() => {
    if (slides.length <= 1 || !cfg.autoPlay) return;
    const timer = setInterval(next, cfg.duration * 1000);
    return () => clearInterval(timer);
  }, [next, slides.length, cfg.autoPlay, cfg.duration]);

  if (slides.length === 0) return null;

  const slide = slides[current];
  const variants = getVariants(cfg.transitionType, direction, cfg.transitionSpeed);

  return (
    <div className="relative overflow-hidden rounded-2xl aspect-[21/9] bg-muted group">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current}
          custom={direction}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={variants.transition}
          className="absolute inset-0"
        >
          <img
            src={slide.imageUrl}
            alt={slide.caption ?? `Slide ${current + 1}`}
            className="size-full object-cover"
          />
          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Caption */}
          {slide.caption && (
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white text-sm font-medium drop-shadow-lg sm:text-base">
                {slide.caption}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/50"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "cursor-pointer rounded-full transition-all",
                i === current
                  ? "h-2 w-5 bg-white"
                  : "size-2 bg-white/50 hover:bg-white/80"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
