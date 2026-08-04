/**
 * Engine perhitungan Kalkulator Kelas Jalan Rel
 * Mengacu pada PM 60 Tahun 2012 dan standar TQI PT KAI
 */
import type {
  GaugeType,
  RailType,
  SleeperType,
  SubgradeCondition,
  TrackClassId,
  TrackClassSpec,
  TqiCategory,
} from "./track-standards.ts";
import {
  TRACK_CLASSES_1067,
  TRACK_CLASSES_1435,
  MAX_AXLE_LOAD,
  getTqiCategory,
  getMaxSpeedFromTqi,
} from "./track-standards.ts";

// ── Input types ──────────────────────────────────────────────────────────────
export type OperationInput = {
  axleLoad: number; // ton
  designSpeed: number; // km/jam
  trainFrequency: number; // per hari
  passengerTonnageDaily: number; // Tp (ton/hari)
  freightTonnageDaily: number; // Tb (ton/hari)
  locomotiveTonnageDaily: number; // T1 (ton/hari)
};

export type InfrastructureInput = {
  gauge: GaugeType;
  railType: RailType;
  sleeperType: SleeperType;
  ballastThickness: number; // cm
  subgrade: SubgradeCondition;
};

export type GeometryInput = {
  sdAlignment: number;
  sdLevel: number;
  sdGauge: number;
  sdTwist: number;
};

export type CalculatorInput = {
  segmentName: string;
  staStart: string;
  staEnd: string;
  operation: OperationInput;
  infrastructure: InfrastructureInput;
  geometry: GeometryInput;
};

// ── Output types ─────────────────────────────────────────────────────────────
export type AxleLoadResult = {
  axleLoad: number;
  maxAllowed: number;
  isOverload: boolean;
};

export type MgtResult = {
  te: number; // Tonase ekivalen harian
  kb: number; // koefisien barang
  k1: number; // koefisien lokomotif (1.4)
  annualTonnage: number; // ton/tahun
  mgt: number; // juta ton
};

export type TqiResult = {
  tqi: number;
  category: TqiCategory;
  categoryLabel: string;
  maxSpeedAllowed: number;
  color: string;
};

export type ClassDetermination = {
  classId: TrackClassId;
  classLabel: string;
  classSpec: TrackClassSpec;
  determinedBy: string; // e.g. "daya angkut" or "kecepatan"
};

export type ValidationIssue = {
  parameter: string;
  message: string;
  severity: "warning" | "error";
};

export type CalculatorResult = {
  axleLoad: AxleLoadResult;
  mgt: MgtResult;
  tqi: TqiResult;
  speedValidation: {
    designSpeed: number;
    maxByClass: number;
    maxByTqi: number;
    effectiveMax: number;
    isExceeded: boolean;
  };
  trackClass: ClassDetermination;
  overallStatus: "aman" | "mendekati_batas" | "overload";
  statusLabel: string;
  issues: ValidationIssue[];
  recommendations: string[];
};

// ── Calculation engine ───────────────────────────────────────────────────────

/** Step 1: Validasi beban gandar */
function calculateAxleLoad(
  axleLoad: number,
  gauge: GaugeType
): AxleLoadResult {
  const maxAllowed = MAX_AXLE_LOAD[gauge];
  return {
    axleLoad,
    maxAllowed,
    isOverload: axleLoad > maxAllowed,
  };
}

/**
 * Step 2: Hitung Tonase Tahunan (MGT)
 * Rumus Indonesia: TE = Tp + (Kb × Tb) + (K1 × T1)
 * T tahunan = 360 × S × TE (S = faktor koreksi, biasanya 1)
 * Kb = 1.5 jika gandar < 18t, 1.3 jika > 18t
 * K1 = 1.4
 */
function calculateMgt(op: OperationInput): MgtResult {
  const kb = op.axleLoad <= 18 ? 1.5 : 1.3;
  const k1 = 1.4;
  const te =
    op.passengerTonnageDaily + kb * op.freightTonnageDaily + k1 * op.locomotiveTonnageDaily;
  // 360 hari operasi per tahun (standar Indonesia)
  const annualTonnage = 360 * te;
  const mgt = annualTonnage / 1_000_000;
  return { te, kb, k1, annualTonnage, mgt };
}

/**
 * Step 3: Hitung TQI
 * Metode PT KAI: penjumlahan simpangan baku 4 parameter
 * TQI = SD(alignment) + SD(level) + SD(gauge) + SD(twist)
 */
function calculateTqi(geo: GeometryInput): TqiResult {
  const tqi = geo.sdAlignment + geo.sdLevel + geo.sdGauge + geo.sdTwist;
  const cat = getTqiCategory(tqi);
  return {
    tqi: Math.round(tqi * 100) / 100,
    category: cat.category,
    categoryLabel: cat.label,
    maxSpeedAllowed: getMaxSpeedFromTqi(tqi),
    color: cat.color,
  };
}

/** Step 4: Tentukan kelas jalan rel berdasarkan PM 60/2012 */
function determineTrackClass(
  annualTonnage: number,
  gauge: GaugeType
): ClassDetermination {
  const classes = gauge === "1067" ? TRACK_CLASSES_1067 : TRACK_CLASSES_1435;

  // Kelas ditentukan oleh daya angkut lintas (tonase tahunan)
  // Cari kelas tertinggi yang sesuai
  for (const cls of classes) {
    if (annualTonnage >= cls.minAnnualTonnage) {
      return {
        classId: cls.id,
        classLabel: cls.label,
        classSpec: cls,
        determinedBy: `Daya angkut ${(annualTonnage / 1_000_000).toFixed(1)} juta ton/tahun`,
      };
    }
  }

  // Default: kelas terendah
  const lastClass = classes[classes.length - 1];
  return {
    classId: lastClass.id,
    classLabel: lastClass.label,
    classSpec: lastClass,
    determinedBy: "Daya angkut di bawah batas minimum",
  };
}

/** Validasi infrastruktur terhadap kelas yang ditentukan */
function validateInfrastructure(
  infra: InfrastructureInput,
  classSpec: TrackClassSpec
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validasi jenis rel
  if (!classSpec.allowedRails.includes(infra.railType)) {
    issues.push({
      parameter: "Jenis Rel",
      message: `Rel ${infra.railType} tidak memenuhi persyaratan ${classSpec.label}. Dibutuhkan: ${classSpec.allowedRails.join(" / ")}`,
      severity: "error",
    });
  }

  // Validasi jenis bantalan
  if (!classSpec.allowedSleepers.includes(infra.sleeperType)) {
    issues.push({
      parameter: "Jenis Bantalan",
      message: `Bantalan ${infra.sleeperType} tidak memenuhi persyaratan ${classSpec.label}. Dibutuhkan: ${classSpec.allowedSleepers.join(" / ")}`,
      severity: "error",
    });
  }

  // Validasi tebal balas
  if (infra.ballastThickness < classSpec.minBallastThickness) {
    issues.push({
      parameter: "Tebal Balas",
      message: `Tebal balas ${infra.ballastThickness} cm kurang dari minimum ${classSpec.minBallastThickness} cm untuk ${classSpec.label}`,
      severity: "error",
    });
  }

  // Peringatan subgrade
  if (infra.subgrade === "buruk") {
    issues.push({
      parameter: "Subgrade",
      message: "Kondisi subgrade buruk dapat menurunkan kemampuan dukung jalan rel",
      severity: "warning",
    });
  }

  return issues;
}

/** Generate rekomendasi berdasarkan hasil analisis */
function generateRecommendations(
  result: Omit<CalculatorResult, "recommendations">
): string[] {
  const recs: string[] = [];

  if (result.axleLoad.isOverload) {
    recs.push(
      `Beban gandar ${result.axleLoad.axleLoad} ton melebihi batas ${result.axleLoad.maxAllowed} ton. Kurangi beban atau upgrade ke lebar sepur yang mendukung beban lebih tinggi.`
    );
  }

  if (result.speedValidation.isExceeded) {
    recs.push(
      `Turunkan kecepatan rencana dari ${result.speedValidation.designSpeed} km/jam menjadi maksimal ${result.speedValidation.effectiveMax} km/jam.`
    );
  }

  const infraIssues = result.issues.filter((i) => i.severity === "error");
  for (const issue of infraIssues) {
    if (issue.parameter === "Jenis Rel") {
      recs.push(`Ganti rel ke tipe yang sesuai ${result.trackClass.classLabel}.`);
    }
    if (issue.parameter === "Jenis Bantalan") {
      recs.push(`Upgrade bantalan ke jenis yang sesuai ${result.trackClass.classLabel}.`);
    }
    if (issue.parameter === "Tebal Balas") {
      recs.push(
        `Perkuat balas (ballast) hingga minimum ${result.trackClass.classSpec.minBallastThickness} cm.`
      );
    }
  }

  if (result.tqi.category === "sedang") {
    recs.push("Lakukan tamping untuk memperbaiki geometri jalan rel.");
  }
  if (result.tqi.category === "buruk") {
    recs.push(
      "Segera lakukan perbaikan besar (tamping, angkat level, koreksi alignment) untuk meningkatkan kualitas geometri."
    );
  }

  if (recs.length === 0) {
    recs.push("Lintas dalam kondisi baik dan memenuhi persyaratan PM 60/2012.");
  }

  return recs;
}

// ── Main calculation function ────────────────────────────────────────────────
export function calculateTrackClass(input: CalculatorInput): CalculatorResult {
  const { operation, infrastructure, geometry } = input;

  // Step 1: Beban gandar
  const axleLoadResult = calculateAxleLoad(
    operation.axleLoad,
    infrastructure.gauge
  );

  // Step 2: MGT
  const mgtResult = calculateMgt(operation);

  // Step 3: TQI
  const tqiResult = calculateTqi(geometry);

  // Step 4: Kelas jalan berdasarkan daya angkut
  const trackClass = determineTrackClass(
    mgtResult.annualTonnage,
    infrastructure.gauge
  );

  // Speed validation
  const maxByClass = trackClass.classSpec.maxSpeed;
  const maxByTqi = tqiResult.maxSpeedAllowed;
  const effectiveMax = Math.min(maxByClass, maxByTqi);
  const speedValidation = {
    designSpeed: operation.designSpeed,
    maxByClass,
    maxByTqi,
    effectiveMax,
    isExceeded: operation.designSpeed > effectiveMax,
  };

  // Validate infrastructure against class
  const infraIssues = validateInfrastructure(infrastructure, trackClass.classSpec);

  // Axle load issue
  const issues: ValidationIssue[] = [];
  if (axleLoadResult.isOverload) {
    issues.push({
      parameter: "Beban Gandar",
      message: `Beban gandar ${axleLoadResult.axleLoad} ton melebihi batas ${axleLoadResult.maxAllowed} ton untuk lebar sepur ${infrastructure.gauge} mm`,
      severity: "error",
    });
  }
  if (speedValidation.isExceeded) {
    issues.push({
      parameter: "Kecepatan",
      message: `Kecepatan rencana ${operation.designSpeed} km/jam melebihi batas efektif ${effectiveMax} km/jam`,
      severity: "error",
    });
  }
  issues.push(...infraIssues);

  // Overall status
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  let overallStatus: CalculatorResult["overallStatus"];
  let statusLabel: string;

  if (errorCount > 0) {
    overallStatus = "overload";
    statusLabel = "Tidak Memenuhi Persyaratan";
  } else if (warningCount > 0 || tqiResult.category === "sedang") {
    overallStatus = "mendekati_batas";
    statusLabel = "Mendekati Batas";
  } else {
    overallStatus = "aman";
    statusLabel = "Aman";
  }

  const partialResult = {
    axleLoad: axleLoadResult,
    mgt: mgtResult,
    tqi: tqiResult,
    speedValidation,
    trackClass,
    overallStatus,
    statusLabel,
    issues,
    recommendations: [] as string[],
  };

  const recommendations = generateRecommendations(partialResult);

  return { ...partialResult, recommendations };
}
