/**
 * Standar Kelas Jalan Rel berdasarkan PM 60 Tahun 2012
 * Peraturan Menteri Perhubungan tentang Persyaratan Teknis Jalur Kereta Api
 */

// ── Tipe Rel yang diakui PM 60/2012 ──────────────────────────────────────────
export const RAIL_TYPES = ["R42", "R50", "R54", "R60"] as const;
export type RailType = (typeof RAIL_TYPES)[number];

// Berat per meter (kg/m) untuk referensi
export const RAIL_WEIGHT: Record<RailType, number> = {
  R42: 42,
  R50: 50,
  R54: 54,
  R60: 60,
};

// ── Jenis Bantalan ───────────────────────────────────────────────────────────
export const SLEEPER_TYPES = ["beton", "kayu", "baja"] as const;
export type SleeperType = (typeof SLEEPER_TYPES)[number];

export const SLEEPER_LABELS: Record<SleeperType, string> = {
  beton: "Beton",
  kayu: "Kayu",
  baja: "Baja",
};

// ── Lebar Sepur ──────────────────────────────────────────────────────────────
export const GAUGE_TYPES = ["1067", "1435"] as const;
export type GaugeType = (typeof GAUGE_TYPES)[number];

export const MAX_AXLE_LOAD: Record<GaugeType, number> = {
  "1067": 18, // ton
  "1435": 22.5, // ton
};

// ── Kondisi Subgrade ─────────────────────────────────────────────────────────
export const SUBGRADE_CONDITIONS = ["baik", "sedang", "buruk"] as const;
export type SubgradeCondition = (typeof SUBGRADE_CONDITIONS)[number];

// ── Klasifikasi Kelas Jalan Rel PM 60/2012 (1067mm) ─────────────────────────
export type TrackClassId = "I" | "II" | "III" | "IV" | "V";

export type TrackClassSpec = {
  id: TrackClassId;
  label: string;
  // Daya angkut lintas (ton/tahun) - batas bawah
  minAnnualTonnage: number;
  // Kecepatan maksimum (km/jam)
  maxSpeed: number;
  // Beban gandar maks (ton)
  maxAxleLoad: number;
  // Rel yang diperbolehkan
  allowedRails: RailType[];
  // Bantalan yang diperbolehkan
  allowedSleepers: SleeperType[];
  // Tebal balas atas minimum (cm)
  minBallastThickness: number;
  // Lebar bahu balas minimum (cm)
  minShoulderWidth: number;
  // Landai penentu maks (permil)
  maxGradient: number;
};

export const TRACK_CLASSES_1067: TrackClassSpec[] = [
  {
    id: "I",
    label: "Kelas I",
    minAnnualTonnage: 20_000_000,
    maxSpeed: 120,
    maxAxleLoad: 18,
    allowedRails: ["R60", "R54"],
    allowedSleepers: ["beton"],
    minBallastThickness: 30,
    minShoulderWidth: 60,
    maxGradient: 10,
  },
  {
    id: "II",
    label: "Kelas II",
    minAnnualTonnage: 10_000_000,
    maxSpeed: 110,
    maxAxleLoad: 18,
    allowedRails: ["R54", "R50"],
    allowedSleepers: ["beton", "kayu"],
    minBallastThickness: 30,
    minShoulderWidth: 50,
    maxGradient: 10,
  },
  {
    id: "III",
    label: "Kelas III",
    minAnnualTonnage: 5_000_000,
    maxSpeed: 100,
    maxAxleLoad: 18,
    allowedRails: ["R54", "R50", "R42"],
    allowedSleepers: ["beton", "kayu", "baja"],
    minBallastThickness: 30,
    minShoulderWidth: 40,
    maxGradient: 20,
  },
  {
    id: "IV",
    label: "Kelas IV",
    minAnnualTonnage: 2_500_000,
    maxSpeed: 90,
    maxAxleLoad: 18,
    allowedRails: ["R54", "R50", "R42"],
    allowedSleepers: ["beton", "kayu", "baja"],
    minBallastThickness: 25,
    minShoulderWidth: 40,
    maxGradient: 25,
  },
  {
    id: "V",
    label: "Kelas V",
    minAnnualTonnage: 0,
    maxSpeed: 80,
    maxAxleLoad: 18,
    allowedRails: ["R42"],
    allowedSleepers: ["kayu", "baja"],
    minBallastThickness: 25,
    minShoulderWidth: 35,
    maxGradient: 25,
  },
];

// ── Klasifikasi 1435mm ───────────────────────────────────────────────────────
export const TRACK_CLASSES_1435: TrackClassSpec[] = [
  {
    id: "I",
    label: "Kelas I",
    minAnnualTonnage: 20_000_000,
    maxSpeed: 160,
    maxAxleLoad: 22.5,
    allowedRails: ["R60"],
    allowedSleepers: ["beton"],
    minBallastThickness: 30,
    minShoulderWidth: 60,
    maxGradient: 10,
  },
  {
    id: "II",
    label: "Kelas II",
    minAnnualTonnage: 10_000_000,
    maxSpeed: 140,
    maxAxleLoad: 22.5,
    allowedRails: ["R60"],
    allowedSleepers: ["beton"],
    minBallastThickness: 30,
    minShoulderWidth: 50,
    maxGradient: 10,
  },
  {
    id: "III",
    label: "Kelas III",
    minAnnualTonnage: 5_000_000,
    maxSpeed: 120,
    maxAxleLoad: 22.5,
    allowedRails: ["R60", "R54"],
    allowedSleepers: ["beton"],
    minBallastThickness: 30,
    minShoulderWidth: 40,
    maxGradient: 20,
  },
  {
    id: "IV",
    label: "Kelas IV",
    minAnnualTonnage: 0,
    maxSpeed: 100,
    maxAxleLoad: 22.5,
    allowedRails: ["R60", "R54"],
    allowedSleepers: ["beton"],
    minBallastThickness: 25,
    minShoulderWidth: 40,
    maxGradient: 25,
  },
];

// ── Standar TQI PT KAI ──────────────────────────────────────────────────────
export type TqiCategory = "sangat_baik" | "baik" | "sedang" | "buruk";

export type TqiThreshold = {
  category: TqiCategory;
  label: string;
  maxTqi: number; // upper bound (inclusive), Infinity for last
  speedRange: string;
  color: string; // for visual display
};

export const TQI_THRESHOLDS: TqiThreshold[] = [
  {
    category: "sangat_baik",
    label: "Sangat Baik",
    maxTqi: 20,
    speedRange: "100 - 120 km/jam",
    color: "emerald",
  },
  {
    category: "baik",
    label: "Baik",
    maxTqi: 35,
    speedRange: "80 - 100 km/jam",
    color: "blue",
  },
  {
    category: "sedang",
    label: "Sedang",
    maxTqi: 50,
    speedRange: "60 - 80 km/jam",
    color: "amber",
  },
  {
    category: "buruk",
    label: "Buruk",
    maxTqi: Infinity,
    speedRange: "< 60 km/jam",
    color: "red",
  },
];

export function getTqiCategory(tqi: number): TqiThreshold {
  for (const t of TQI_THRESHOLDS) {
    if (tqi <= t.maxTqi) return t;
  }
  return TQI_THRESHOLDS[TQI_THRESHOLDS.length - 1];
}

// Max speed allowed by TQI condition
export function getMaxSpeedFromTqi(tqi: number): number {
  if (tqi <= 20) return 120;
  if (tqi <= 35) return 100;
  if (tqi <= 50) return 80;
  return 60;
}
