import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.ts";

const MM_TO_PX = 96 / 25.4;
const CM_PX = MM_TO_PX * 10;

type DragTarget = "left" | "right" | "firstLine" | null;

export interface EditorRulerProps {
  /** Lebar lembar (px), termasuk margin kiri & kanan. */
  widthPx: number;
  /** Margin kiri lembar (px). */
  leftMargin: number;
  /** Margin kanan lembar (px). */
  rightMargin: number;
  /** Indent baris pertama paragraf aktif (px, relatif terhadap margin kiri). */
  firstLineIndent: number;
  /** Dipanggil saat margin kiri berubah. */
  onLeftMarginChange: (px: number) => void;
  /** Dipanggil saat margin kanan berubah. */
  onRightMarginChange: (px: number) => void;
  /** Dipanggil saat indent baris pertama berubah. */
  onFirstLineIndentChange: (px: number) => void;
  /** Dipanggil saat mulai menggeser penanda baris pertama. */
  onFirstLineDragStart?: () => void;
  /** Dipanggil saat selesai menggeser penanda baris pertama. */
  onFirstLineDragEnd?: () => void;
  /**
   * Dipanggil dengan posisi X (px, dari tepi kiri lembar) penanda baris pertama
   * selama digeser, atau null saat berhenti. Dipakai untuk menampilkan garis
   * bantu putus-putus vertikal agar sejajar dengan teks pedoman.
   */
  onFirstLineGuide?: (x: number | null) => void;
}

/**
 * Mistar horizontal seperti Microsoft Word: menampilkan penanda ukuran dalam cm
 * dan tiga penanda yang bisa digeser untuk mengatur margin kiri, margin kanan,
 * dan indent baris pertama paragraf.
 */
export default function EditorRuler({
  widthPx,
  leftMargin,
  rightMargin,
  firstLineIndent,
  onLeftMarginChange,
  onRightMarginChange,
  onFirstLineIndentChange,
  onFirstLineDragStart,
  onFirstLineDragEnd,
  onFirstLineGuide,
}: EditorRulerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragTarget>(null);
  // Indent baris pertama sementara selama digeser (agar penanda ikut bergerak
  // walau nilai sebenarnya dikelola di luar sebagai spasi pada teks).
  const [liveFirstLine, setLiveFirstLine] = useState<number | null>(null);

  // Batas minimal area teks agar tidak saling melewati (px).
  const MIN_CONTENT = CM_PX; // ~1cm

  const posFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(widthPx, x));
  }, [widthPx]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const x = posFromEvent(e.clientX);
      if (dragging === "left") {
        const maxLeft = widthPx - rightMargin - MIN_CONTENT;
        onLeftMarginChange(Math.round(Math.max(0, Math.min(maxLeft, x))));
      } else if (dragging === "right") {
        const right = widthPx - x;
        const maxRight = widthPx - leftMargin - MIN_CONTENT;
        onRightMarginChange(Math.round(Math.max(0, Math.min(maxRight, right))));
      } else if (dragging === "firstLine") {
        const indent = x - leftMargin;
        const maxIndent = widthPx - rightMargin - leftMargin - MIN_CONTENT;
        const clamped = Math.round(Math.max(0, Math.min(maxIndent, indent)));
        setLiveFirstLine(clamped);
        onFirstLineIndentChange(clamped);
        // Beri tahu posisi absolut penanda agar garis bantu digambar sejajar.
        onFirstLineGuide?.(leftMargin + clamped);
      }
    };

    const handleUp = () => {
      if (dragging === "firstLine") {
        onFirstLineDragEnd?.();
        onFirstLineGuide?.(null);
        setLiveFirstLine(null);
      }
      setDragging(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragging,
    posFromEvent,
    widthPx,
    leftMargin,
    rightMargin,
    MIN_CONTENT,
    onLeftMarginChange,
    onRightMarginChange,
    onFirstLineIndentChange,
    onFirstLineDragEnd,
    onFirstLineGuide,
  ]);

  // Penanda ukuran (cm). Angka 0 diletakkan di margin kiri agar sesuai Word.
  const totalCm = Math.floor(widthPx / CM_PX);
  const ticks = Array.from({ length: totalCm + 1 }, (_, i) => i);

  const firstLineX = leftMargin + (liveFirstLine ?? firstLineIndent);
  const rightX = widthPx - rightMargin;

  return (
    <div className="flex justify-center bg-muted/40 pt-3">
      <div
        className="relative select-none"
        style={{ width: widthPx, height: 28 }}
      >
        {/* Jalur mistar */}
        <div
          ref={trackRef}
          className="absolute inset-x-0 top-0 h-6 rounded-sm border border-border bg-background"
        >
          {/* Area margin kiri & kanan (lebih gelap) */}
          <div
            className="absolute inset-y-0 left-0 bg-muted"
            style={{ width: leftMargin }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-muted"
            style={{ width: rightMargin }}
          />

          {/* Penanda ukuran cm, angka 0 pada margin kiri */}
          {ticks.map((cm) => {
            const x = leftMargin + cm * CM_PX;
            if (x < 0 || x > widthPx) return null;
            return (
              <div
                key={`r${cm}`}
                className="pointer-events-none absolute top-1 text-[9px] leading-none text-muted-foreground"
                style={{ left: x, transform: "translateX(-50%)" }}
              >
                <div className="mx-auto h-1.5 w-px bg-muted-foreground/50" />
                <span>{cm}</span>
              </div>
            );
          })}
          {/* Penanda ukuran cm ke kiri margin (negatif tak berlabel) */}
          {Array.from({ length: Math.ceil(leftMargin / CM_PX) }, (_, i) => i + 1).map(
            (cm) => {
              const x = leftMargin - cm * CM_PX;
              if (x < 0) return null;
              return (
                <div
                  key={`l${cm}`}
                  className="pointer-events-none absolute top-1"
                  style={{ left: x, transform: "translateX(-50%)" }}
                >
                  <div className="mx-auto h-1.5 w-px bg-muted-foreground/40" />
                </div>
              );
            },
          )}
        </div>

        {/* Penanda margin kiri (segitiga bawah + batang) */}
        <RulerHandle
          x={leftMargin}
          active={dragging === "left"}
          title="Margin kiri"
          variant="bottom"
          onPointerDown={() => setDragging("left")}
        />

        {/* Penanda indent baris pertama (segitiga atas) */}
        <RulerHandle
          x={firstLineX}
          active={dragging === "firstLine"}
          title="Geser teks setelah kursor"
          variant="top"
          onPointerDown={() => {
            onFirstLineDragStart?.();
            setDragging("firstLine");
          }}
        />

        {/* Penanda margin kanan (segitiga bawah) */}
        <RulerHandle
          x={rightX}
          active={dragging === "right"}
          title="Margin kanan"
          variant="bottom"
          onPointerDown={() => setDragging("right")}
        />
      </div>
    </div>
  );
}

function RulerHandle({
  x,
  active,
  title,
  variant,
  onPointerDown,
}: {
  x: number;
  active: boolean;
  title: string;
  variant: "top" | "bottom";
  onPointerDown: () => void;
}) {
  return (
    <div
      role="slider"
      aria-label={title}
      aria-valuenow={Math.round(x)}
      tabIndex={0}
      title={title}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown();
      }}
      className="absolute z-10 cursor-ew-resize"
      style={{
        left: x,
        top: variant === "bottom" ? 12 : -2,
        transform: "translateX(-50%)",
      }}
    >
      <div
        className={cn(
          "h-0 w-0 border-x-[6px] border-x-transparent",
          variant === "bottom"
            ? "border-t-[9px]"
            : "border-b-[9px]",
          active
            ? variant === "bottom"
              ? "border-t-primary"
              : "border-b-primary"
            : variant === "bottom"
              ? "border-t-foreground/70"
              : "border-b-foreground/70",
        )}
      />
    </div>
  );
}
