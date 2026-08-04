// WTW Global Grading System (GGS) factor definitions and anchor guide.
// Mirrors the factor keys used in convex/grading.ts.

export const FACTOR_KEYS = [
  "functional_knowledge",
  "business_expertise",
  "leadership",
  "problem_solving",
  "nature_of_impact",
  "area_of_impact",
  "interpersonal_skills",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

export type FactorDef = {
  key: FactorKey;
  label: string;
  description: string;
  weight: number; // 0..1, display only (backend uses same)
  levels: Array<{
    level: number;
    title: string;
    description: string;
  }>;
};

export const FACTORS: ReadonlyArray<FactorDef> = [
  {
    key: "functional_knowledge",
    label: "Functional Knowledge",
    description:
      "Kedalaman pengetahuan teknis, prosedur, dan keahlian fungsional yang dibutuhkan untuk peran.",
    weight: 0.18,
    levels: [
      {
        level: 1,
        title: "Dasar",
        description:
          "Menerapkan pengetahuan prosedural dasar untuk tugas yang terstruktur dan berulang.",
      },
      {
        level: 2,
        title: "Operasional",
        description:
          "Memiliki pengetahuan kerja yang solid terhadap prosedur dan alat operasional.",
      },
      {
        level: 3,
        title: "Terampil",
        description:
          "Pemahaman menyeluruh tentang bidang fungsional dan praktik terbaiknya.",
      },
      {
        level: 4,
        title: "Advanced",
        description:
          "Menguasai konsep lanjutan; mampu menangani situasi kompleks dan berlevel menengah.",
      },
      {
        level: 5,
        title: "Ahli",
        description:
          "Subject matter expert yang dirujuk; memahami integrasi lintas fungsi.",
      },
      {
        level: 6,
        title: "Strategis",
        description:
          "Menetapkan standar profesional, mengarahkan best practice pada tingkat organisasi.",
      },
      {
        level: 7,
        title: "Thought Leader",
        description:
          "Keahlian kelas industri; menentukan arah fungsi secara nasional/internasional.",
      },
    ],
  },
  {
    key: "business_expertise",
    label: "Business Expertise",
    description:
      "Pemahaman terhadap model bisnis, pasar, pelanggan, dan lanskap kompetitif perusahaan.",
    weight: 0.12,
    levels: [
      {
        level: 1,
        title: "Dasar",
        description: "Memahami tugas dalam konteks tim atau unit terdekat.",
      },
      {
        level: 2,
        title: "Operasional",
        description:
          "Memahami prioritas departemen dan hubungannya dengan tujuan perusahaan.",
      },
      {
        level: 3,
        title: "Kompeten",
        description:
          "Memahami bagaimana unit bisnis berkontribusi terhadap perusahaan secara keseluruhan.",
      },
      {
        level: 4,
        title: "Berpengalaman",
        description:
          "Memahami strategi, kompetitor, dan dinamika pasar untuk unit bisnis.",
      },
      {
        level: 5,
        title: "Strategis",
        description:
          "Membentuk strategi unit bisnis berdasarkan pemahaman pasar yang mendalam.",
      },
      {
        level: 6,
        title: "Eksekutif",
        description:
          "Mendorong strategi perusahaan; memahami isu ekonomi & industri makro.",
      },
      {
        level: 7,
        title: "Pemimpin Industri",
        description:
          "Mengarahkan visi bisnis; diakui sebagai pemikir strategis tingkat industri.",
      },
    ],
  },
  {
    key: "leadership",
    label: "Leadership",
    description:
      "Cakupan kepemimpinan terhadap orang, tim, dan organisasi — formal maupun informal.",
    weight: 0.15,
    levels: [
      {
        level: 1,
        title: "Individu",
        description: "Kontributor individu tanpa tanggung jawab kepemimpinan.",
      },
      {
        level: 2,
        title: "Peer Leader",
        description:
          "Memberikan arahan informal/teknis kepada rekan kerja atau junior.",
      },
      {
        level: 3,
        title: "Team Lead",
        description:
          "Mengelola tim kecil atau sekelompok kontributor individu dalam satu bidang.",
      },
      {
        level: 4,
        title: "Manager",
        description:
          "Mengelola tim / departemen, membangun kapabilitas, dan mengeksekusi prioritas.",
      },
      {
        level: 5,
        title: "Senior Manager",
        description:
          "Memimpin beberapa tim/sub-fungsi; menetapkan arah operasional yang kompleks.",
      },
      {
        level: 6,
        title: "Direktur",
        description:
          "Memimpin fungsi atau unit bisnis besar; menentukan kebijakan dan prioritas strategis.",
      },
      {
        level: 7,
        title: "Eksekutif",
        description:
          "Memimpin segmen bisnis atau lini perusahaan; membentuk budaya & visi organisasi.",
      },
    ],
  },
  {
    key: "problem_solving",
    label: "Problem Solving",
    description:
      "Kompleksitas masalah yang ditangani dan kreativitas solusi yang dihasilkan.",
    weight: 0.15,
    levels: [
      {
        level: 1,
        title: "Terstruktur",
        description:
          "Menyelesaikan masalah rutin mengikuti prosedur yang telah ditetapkan.",
      },
      {
        level: 2,
        title: "Adaptif",
        description:
          "Mengidentifikasi variasi masalah sederhana dan menyesuaikan pendekatan.",
      },
      {
        level: 3,
        title: "Analitis",
        description:
          "Menangani masalah yang belum jelas strukturnya; melakukan analisis data.",
      },
      {
        level: 4,
        title: "Kompleks",
        description:
          "Menyelesaikan masalah multifaset yang membutuhkan judgment & trade-off.",
      },
      {
        level: 5,
        title: "Inovatif",
        description:
          "Menghasilkan pendekatan baru / solusi lintas-fungsi pada isu strategis.",
      },
      {
        level: 6,
        title: "Strategis",
        description:
          "Memecahkan isu enterprise yang ambigu dan berjangka panjang.",
      },
      {
        level: 7,
        title: "Transformatif",
        description:
          "Menyelesaikan masalah level industri; membentuk paradigma baru di bidangnya.",
      },
    ],
  },
  {
    key: "nature_of_impact",
    label: "Nature of Impact",
    description:
      "Jenis dan kedalaman dampak peran terhadap proses, produk, dan hasil bisnis.",
    weight: 0.15,
    levels: [
      {
        level: 1,
        title: "Tugas",
        description: "Dampak terbatas pada penyelesaian tugas individu.",
      },
      {
        level: 2,
        title: "Proses",
        description: "Dampak pada efisiensi dan kualitas proses tim.",
      },
      {
        level: 3,
        title: "Operasional",
        description:
          "Mempengaruhi output operasional departemen atau kelompok kerja.",
      },
      {
        level: 4,
        title: "Taktis",
        description:
          "Mempengaruhi hasil jangka pendek unit bisnis atau fungsi.",
      },
      {
        level: 5,
        title: "Strategis",
        description:
          "Mempengaruhi keberhasilan jangka menengah unit bisnis/fungsi.",
      },
      {
        level: 6,
        title: "Enterprise",
        description:
          "Dampak signifikan pada kinerja perusahaan & posisi kompetitif.",
      },
      {
        level: 7,
        title: "Transformasional",
        description:
          "Menggerakkan arah strategis perusahaan dan posisi industri.",
      },
    ],
  },
  {
    key: "area_of_impact",
    label: "Area of Impact",
    description:
      "Cakupan geografis / organisasi dari pengaruh peran (tim, fungsi, perusahaan, global).",
    weight: 0.1,
    levels: [
      {
        level: 1,
        title: "Individual",
        description: "Pengaruh terbatas pada pekerjaan pribadi.",
      },
      {
        level: 2,
        title: "Tim",
        description: "Pengaruh pada tim atau kelompok kerja terdekat.",
      },
      {
        level: 3,
        title: "Departemen",
        description: "Pengaruh pada departemen atau sub-fungsi.",
      },
      {
        level: 4,
        title: "Fungsi",
        description: "Pengaruh pada satu fungsi utama perusahaan.",
      },
      {
        level: 5,
        title: "Unit Bisnis",
        description: "Pengaruh pada unit bisnis atau lini produk.",
      },
      {
        level: 6,
        title: "Perusahaan",
        description: "Pengaruh pada seluruh perusahaan (nasional).",
      },
      {
        level: 7,
        title: "Global",
        description: "Pengaruh regional/global lintas entitas perusahaan.",
      },
    ],
  },
  {
    key: "interpersonal_skills",
    label: "Interpersonal Skills",
    description:
      "Kompleksitas interaksi, negosiasi, dan kemampuan memengaruhi stakeholder.",
    weight: 0.15,
    levels: [
      {
        level: 1,
        title: "Kolaborasi Dasar",
        description:
          "Berkomunikasi untuk menyelesaikan tugas rutin dengan rekan kerja.",
      },
      {
        level: 2,
        title: "Koordinasi",
        description: "Berkoordinasi lintas tim untuk menyelaraskan aktivitas.",
      },
      {
        level: 3,
        title: "Mempengaruhi Taktis",
        description:
          "Mempersuasi rekan kerja & stakeholder internal untuk mengadopsi ide.",
      },
      {
        level: 4,
        title: "Negosiasi",
        description:
          "Menegosiasikan isu yang melibatkan kepentingan beragam & sensitif.",
      },
      {
        level: 5,
        title: "Mempengaruhi Strategis",
        description:
          "Membangun konsensus pada isu kompleks lintas fungsi/organisasi.",
      },
      {
        level: 6,
        title: "Eksternal",
        description:
          "Merepresentasikan perusahaan ke stakeholder eksternal strategis.",
      },
      {
        level: 7,
        title: "Negosiasi Enterprise",
        description:
          "Memimpin negosiasi tingkat industri; membentuk reputasi & kemitraan global.",
      },
    ],
  },
];

export function getFactor(key: FactorKey | string): FactorDef | undefined {
  return FACTORS.find((f) => f.key === key);
}

// ---- Status configs ----------------------------------------------------
export const EVAL_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
  in_review: {
    label: "Sedang Dinilai",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  approved: {
    label: "Disetujui",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  },
  archived: {
    label: "Diarsipkan",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export const POSITION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Aktif",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  archived: {
    label: "Arsip",
    className: "bg-muted text-muted-foreground border-border",
  },
};

// ---- Size band config --------------------------------------------------
export const SIZE_BAND_CONFIG: Record<
  string,
  { label: string; description: string; shift: number }
> = {
  A: {
    label: "A — Small",
    description: "Perusahaan kecil (<$200M revenue / <500 karyawan).",
    shift: -2,
  },
  B: {
    label: "B — Medium",
    description: "Menengah ($200M-$1B / 500-2,000 karyawan).",
    shift: -1,
  },
  C: {
    label: "C — Large",
    description: "Besar ($1B-$5B / 2,000-10,000 karyawan).",
    shift: 0,
  },
  D: {
    label: "D — Very Large",
    description: "Sangat besar ($5B-$25B / multi-negara).",
    shift: 1,
  },
  E: {
    label: "E — Global Enterprise",
    description: "Enterprise global (>$25B / lintas benua).",
    shift: 2,
  },
};

// ---- Grade helpers -----------------------------------------------------
export function bandLabelForGrade(grade: number): string {
  if (grade <= 5) return "Support";
  if (grade <= 10) return "Professional";
  if (grade <= 15) return "Senior Professional";
  if (grade <= 19) return "Manager";
  if (grade <= 22) return "Senior Manager / Director";
  return "Executive";
}

export function bandColorForGrade(grade: number): string {
  if (grade <= 5) return "bg-slate-500/10 text-slate-700 dark:text-slate-300";
  if (grade <= 10) return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (grade <= 15)
    return "bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (grade <= 19) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (grade <= 22)
    return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

// ---- Currency & formatting ---------------------------------------------
export function formatIDR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompaRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${ratio.toFixed(1)}%`;
}

export function compaRatioColor(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "text-muted-foreground";
  if (ratio < 80) return "text-red-600 dark:text-red-400";
  if (ratio < 90) return "text-amber-600 dark:text-amber-400";
  if (ratio <= 110) return "text-emerald-600 dark:text-emerald-400";
  if (ratio <= 120) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ---- Scoring preview (frontend preview only; backend is source of truth)
export function predictGradeFromLevels(
  levels: Record<FactorKey, number | undefined>,
  sizeBand: string,
): { score: number; grade: number; bandLabel: string } | null {
  let sum = 0;
  let total = 0;
  for (const f of FACTORS) {
    const lvl = levels[f.key];
    if (!lvl) return null;
    sum += lvl * f.weight;
    total += f.weight;
  }
  if (total === 0) return null;
  const avg = sum / total; // 1..7
  const score = Math.round((avg / 7) * 10000) / 100; // 0..100
  const avg100 = (avg / 7) * 100;
  const baseGrade = Math.round(
    1 + ((Math.max(14, Math.min(100, avg100)) - 14) / (100 - 14)) * 24,
  );
  const shift = SIZE_BAND_CONFIG[sizeBand]?.shift ?? 0;
  const grade = Math.max(1, Math.min(25, baseGrade + shift));
  return { score, grade, bandLabel: bandLabelForGrade(grade) };
}
