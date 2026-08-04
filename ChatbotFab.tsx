import { useLocation, useNavigate } from "react-router-dom";
import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence, useMotionValue } from "motion/react";

// Persist the dragged position so it stays put across pages and reloads.
const STORAGE_KEY = "starfi-fab-offset";

function loadOffset(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { x: number; y: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    }
  } catch {
    // ignore malformed storage
  }
  return { x: 0, y: 0 };
}

export default function ChatbotFab() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide when already on the chatbot page or inside a messages conversation
  const isVisible =
    !location.pathname.startsWith("/chatbot") &&
    !location.pathname.match(/^\/messages\/.+/);

  // Invisible full-screen area that keeps the button within the viewport.
  const constraintsRef = useRef<HTMLDivElement>(null);
  const initial = loadOffset();
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);
  // Distinguish a real drag from a plain click so dragging never navigates.
  const draggedRef = useRef(false);

  return (
    <div
      ref={constraintsRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <AnimatePresence>
        {isVisible && (
          <motion.button
            type="button"
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0}
            style={{ x, y }}
            onDragStart={() => {
              draggedRef.current = true;
            }}
            onDragEnd={() => {
              try {
                localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify({ x: x.get(), y: y.get() }),
                );
              } catch {
                // ignore storage write failures
              }
              // Reset after the click event has had a chance to fire.
              window.setTimeout(() => {
                draggedRef.current = false;
              }, 0);
            }}
            onClick={() => {
              if (draggedRef.current) return;
              navigate("/chatbot");
            }}
            aria-label="Buka Starfa AI Assistant"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" as const }}
            whileDrag={{ scale: 1.05 }}
            className={cn(
              "group pointer-events-auto fixed bottom-20 right-4 z-40 flex cursor-grab items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-shadow active:cursor-grabbing lg:bottom-4",
              "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white",
              "hover:shadow-2xl",
            )}
          >
            <span className="relative flex size-7 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="size-4" />
              <span className="absolute -inset-1 rounded-full bg-white/20 opacity-0 transition-opacity group-hover:animate-ping group-hover:opacity-100" />
            </span>
            <span className="hidden text-sm font-semibold sm:inline">
              Tanya Starfa
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
