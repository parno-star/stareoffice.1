// Shared utilities for 9-box grid rendering.

export const BOX_LABELS: Record<string, string> = {
  "1-1": "Risiko",
  "2-1": "Kontributor Efektif",
  "3-1": "Performer Solid",
  "1-2": "Teka-teki",
  "2-2": "Inti Tim",
  "3-2": "Performer Tinggi",
  "1-3": "Berlian Kasar",
  "2-3": "Bintang Berkembang",
  "3-3": "Bintang",
};

export const BOX_DESCRIPTIONS: Record<string, string> = {
  "1-1": "Performa dan potensi rendah. Rencana perbaikan atau rotasi.",
  "2-1": "Performa cukup dengan potensi pertumbuhan terbatas.",
  "3-1": "Performa tinggi, potensi tumbuh terbatas - jaga retensi.",
  "1-2": "Potensi menengah tapi performa belum muncul - cari hambatan.",
  "2-2": "Tulang punggung - performa & potensi stabil.",
  "3-2": "Performer andalan - siapkan development path.",
  "1-3": "Potensi tinggi tapi butuh dorongan performa.",
  "2-3": "Bintang berkembang - jalur mentor.",
  "3-3": "Talenta kunci - siapkan promosi atau retensi khusus.",
};

// Tailwind classes for cell background & text.
export const BOX_TONES: Record<string, string> = {
  "1-1": "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "2-1": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "3-1":
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "1-2": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "2-2": "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "3-2":
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "1-3":
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "2-3":
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "3-3":
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
};

// Grid layout position: row 0 = top (Potensi 3), col 0 = left (Performance 1).
// Returns { row, col } for CSS placement given (performance 1..3, potential 1..3)
export function cellPosition(performance: number, potential: number): {
  row: number;
  col: number;
} {
  // Potential 3 (top) => row 0, Potential 1 (bottom) => row 2
  return {
    row: 3 - potential,
    col: performance - 1,
  };
}
