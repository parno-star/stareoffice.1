// ─── Category config ─────────────────────────────────────────────────────────
export type FundCategory =
  | "operational"
  | "procurement"
  | "travel"
  | "training"
  | "event"
  | "other";

type CategoryVisual = {
  label: string;
  color: string;
  bg: string;
  border: string;
};

export const CATEGORY_CONFIG: Record<FundCategory, CategoryVisual> = {
  operational: {
    label: "Operasional",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  procurement: {
    label: "Pengadaan",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  travel: {
    label: "Perjalanan Dinas",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
  },
  training: {
    label: "Pelatihan",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  event: {
    label: "Acara / Event",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  other: {
    label: "Lainnya",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
  },
};

// ─── Custom category color palette ───────────────────────────────────────────
// Admins pick one of these when creating a custom category. Keeps styling
// consistent with the built-in badges above.
export const CATEGORY_COLORS: ReadonlyArray<{
  key: string;
  label: string;
  visual: Omit<CategoryVisual, "label">;
}> = [
  {
    key: "slate",
    label: "Abu",
    visual: {
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
    },
  },
  {
    key: "blue",
    label: "Biru",
    visual: {
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
    },
  },
  {
    key: "sky",
    label: "Langit",
    visual: {
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
    },
  },
  {
    key: "emerald",
    label: "Hijau",
    visual: {
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
    },
  },
  {
    key: "violet",
    label: "Ungu",
    visual: {
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
    },
  },
  {
    key: "orange",
    label: "Oranye",
    visual: {
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
    },
  },
  {
    key: "rose",
    label: "Merah",
    visual: {
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
    },
  },
  {
    key: "amber",
    label: "Kuning",
    visual: {
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    },
  },
  {
    key: "teal",
    label: "Tosca",
    visual: {
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500/10",
      border: "border-teal-500/30",
    },
  },
];

function getColorVisual(color: string | undefined): Omit<CategoryVisual, "label"> {
  const found = CATEGORY_COLORS.find((c) => c.key === color);
  return found ? found.visual : CATEGORY_COLORS[0].visual;
}

// Custom category row shape used at runtime (matches Doc<"fundCategories">
// but kept local so this file stays import-free from Convex types).
type CustomCategory = {
  key: string;
  label: string;
  color: string;
  isActive?: boolean;
};

/** Resolve visuals for any category key (built-in or custom). */
export function getCategoryConfig(
  category: string,
  customs?: ReadonlyArray<CustomCategory>,
): CategoryVisual {
  const builtin = CATEGORY_CONFIG[category as FundCategory];
  if (builtin) return builtin;
  const custom = customs?.find((c) => c.key === category);
  if (custom) {
    return { label: custom.label, ...getColorVisual(custom.color) };
  }
  return { ...CATEGORY_CONFIG.other, label: category };
}

/** Combine built-in + custom categories for dropdowns. */
export function getAllCategoryOptions(
  customs?: ReadonlyArray<CustomCategory>,
): Array<{ key: string; label: string; builtin: boolean }> {
  const builtins = (Object.entries(CATEGORY_CONFIG) as Array<[FundCategory, CategoryVisual]>)
    .map(([key, cfg]) => ({ key, label: cfg.label, builtin: true }));
  const extra = (customs ?? [])
    .filter((c) => c.isActive !== false)
    .map((c) => ({ key: c.key, label: c.label, builtin: false }));
  return [...builtins, ...extra];
}

// ─── Status config ────────────────────────────────────────────────────────────
export type FundStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "disbursed"
  | "revision_needed";

export const STATUS_CONFIG: Record<
  FundStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  draft: {
    label: "Draft",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-400/30",
    dot: "bg-slate-400",
  },
  in_review: {
    label: "Dalam Review",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-400/30",
    dot: "bg-amber-400",
  },
  revision_needed: {
    label: "Perlu Revisi",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-400/30",
    dot: "bg-orange-500",
  },
  approved: {
    label: "Disetujui",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/30",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Ditolak",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-400/30",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "text-slate-500 dark:text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    dot: "bg-slate-400",
  },
  disbursed: {
    label: "Sudah Dicairkan",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-400/30",
    dot: "bg-teal-500",
  },
};

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as FundStatus] ?? STATUS_CONFIG.draft;
}

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Date ─────────────────────────────────────────────────────────────────────
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Request Type Config ─────────────────────────────────────────────────────
export type RequestTypeKey =
  | "operational"
  | "procurement"
  | "reimbursement"
  | "petty_cash"
  | "capital"
  | "travel"
  | "custom";

export type RequestTypeConfig = {
  key: RequestTypeKey;
  label: string;
  description: string;
  icon: string; // lucide icon name hint
  color: string;
  bg: string;
  border: string;
  /** Additional fields required for this type */
  fields: RequestTypeField[];
  /** Suggested attachment labels */
  suggestedAttachments: string[];
};

export type RequestTypeField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export const REQUEST_TYPE_CONFIG: Record<RequestTypeKey, RequestTypeConfig> = {
  operational: {
    key: "operational",
    label: "Operasional Rutin",
    description: "Biaya operasional harian: ATK, utilitas, pemeliharaan rutin",
    icon: "Settings",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    fields: [
      { key: "costCenter", label: "Pusat Biaya", type: "text", placeholder: "Mis. Dept. IT, Kantor Pusat" },
      { key: "budgetCode", label: "Kode Anggaran", type: "text", placeholder: "Mis. OP-2026-001" },
      { key: "frequency", label: "Frekuensi", type: "select", options: [
        { value: "one_time", label: "Sekali" },
        { value: "monthly", label: "Bulanan" },
        { value: "quarterly", label: "Per Kuartal" },
        { value: "annual", label: "Tahunan" },
      ]},
    ],
    suggestedAttachments: ["Rincian Biaya", "Nota / Kwitansi", "Form Permintaan"],
  },
  procurement: {
    key: "procurement",
    label: "Pengadaan Barang/Jasa",
    description: "Pembelian barang atau jasa baru: peralatan, software, jasa konsultan",
    icon: "ShoppingCart",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    fields: [
      { key: "vendorName", label: "Nama Vendor", type: "text", placeholder: "Mis. PT. Supplier Maju", required: true },
      { key: "itemDescription", label: "Deskripsi Barang/Jasa", type: "textarea", placeholder: "Rincian barang/jasa yang akan dibeli" },
      { key: "quantity", label: "Jumlah / Volume", type: "text", placeholder: "Mis. 10 unit, 1 paket" },
      { key: "procurementMethod", label: "Metode Pengadaan", type: "select", options: [
        { value: "direct", label: "Pembelian Langsung" },
        { value: "quotation", label: "Permintaan Penawaran" },
        { value: "tender", label: "Tender / Lelang" },
      ]},
    ],
    suggestedAttachments: ["Penawaran / Quotation", "RAB", "Spesifikasi Teknis", "TOR / KAK"],
  },
  reimbursement: {
    key: "reimbursement",
    label: "Reimbursement",
    description: "Penggantian biaya yang sudah dikeluarkan oleh karyawan",
    icon: "Receipt",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    fields: [
      { key: "expenseDate", label: "Tanggal Pengeluaran", type: "date", required: true },
      { key: "expenseCategory", label: "Kategori Pengeluaran", type: "select", required: true, options: [
        { value: "transport", label: "Transportasi" },
        { value: "meal", label: "Konsumsi" },
        { value: "supplies", label: "Perlengkapan" },
        { value: "communication", label: "Komunikasi" },
        { value: "medical", label: "Kesehatan" },
        { value: "other", label: "Lainnya" },
      ]},
      { key: "paymentMethod", label: "Dibayar Dengan", type: "select", options: [
        { value: "personal_cash", label: "Uang Pribadi" },
        { value: "personal_card", label: "Kartu Pribadi" },
        { value: "petty_cash", label: "Petty Cash" },
      ]},
    ],
    suggestedAttachments: ["Kwitansi / Struk", "Invoice", "Bukti Transfer"],
  },
  petty_cash: {
    key: "petty_cash",
    label: "Petty Cash",
    description: "Pengambilan uang kas kecil untuk kebutuhan mendesak atau kecil",
    icon: "Coins",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    fields: [
      { key: "urgencyLevel", label: "Tingkat Urgensi", type: "select", required: true, options: [
        { value: "normal", label: "Normal" },
        { value: "urgent", label: "Mendesak" },
      ]},
      { key: "expectedReturn", label: "Estimasi Kembalian", type: "text", placeholder: "Rp 0 jika habis terpakai" },
    ],
    suggestedAttachments: ["Form Petty Cash", "Nota / Struk"],
  },
  capital: {
    key: "capital",
    label: "Anggaran Besar / Investasi",
    description: "Pengeluaran modal besar: proyek, renovasi, investasi strategis",
    icon: "Building",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    fields: [
      { key: "projectName", label: "Nama Proyek", type: "text", placeholder: "Mis. Renovasi Gedung B", required: true },
      { key: "budgetYear", label: "Tahun Anggaran", type: "text", placeholder: "2026" },
      { key: "roi", label: "Estimasi ROI / Manfaat", type: "textarea", placeholder: "Jelaskan manfaat atau return yang diharapkan" },
      { key: "timeline", label: "Durasi Proyek", type: "text", placeholder: "Mis. 3 bulan, 6 bulan" },
    ],
    suggestedAttachments: ["Proposal Proyek", "RAB Detail", "Feasibility Study", "Persetujuan Prinsip"],
  },
  travel: {
    key: "travel",
    label: "Perjalanan Dinas",
    description: "Biaya perjalanan dinas: transportasi, akomodasi, uang harian",
    icon: "Plane",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    fields: [
      { key: "destination", label: "Tujuan Perjalanan", type: "text", placeholder: "Mis. Jakarta, Surabaya", required: true },
      { key: "travelStartDate", label: "Tanggal Berangkat", type: "date", required: true },
      { key: "travelEndDate", label: "Tanggal Kembali", type: "date", required: true },
      { key: "travelPurpose", label: "Tujuan Kegiatan", type: "textarea", placeholder: "Jelaskan kegiatan yang akan dilakukan" },
      { key: "participants", label: "Peserta", type: "text", placeholder: "Nama peserta yang ikut" },
    ],
    suggestedAttachments: ["Surat Tugas", "Undangan / Agenda", "Tiket / Booking"],
  },
  custom: {
    key: "custom",
    label: "Lainnya",
    description: "Pengajuan yang tidak termasuk kategori di atas",
    icon: "MoreHorizontal",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    fields: [],
    suggestedAttachments: ["Dokumen Pendukung"],
  },
};

export const REQUEST_TYPE_OPTIONS = Object.values(REQUEST_TYPE_CONFIG);

export function getRequestTypeConfig(key: string): RequestTypeConfig {
  return REQUEST_TYPE_CONFIG[key as RequestTypeKey] ?? REQUEST_TYPE_CONFIG.custom;
}
