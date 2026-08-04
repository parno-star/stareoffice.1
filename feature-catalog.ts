/**
 * Central catalog of feature labels used by membership plans.
 *
 * These labels are shown as selectable options in the plan form so admins
 * pick from a consistent list instead of typing free text.
 *
 * IMPORTANT: labels under "Modul yang bisa dikunci" MUST match the keys in
 * convex/featureGate.ts (FEATURE_TO_MENUS). Only those labels actually lock a
 * menu when placed in a plan's "Fitur Tidak Tersedia" list.
 */

export type FeatureOption = {
  label: string;
  /** True when this label maps to a lockable menu in featureGate.ts */
  gates: boolean;
};

export type FeatureGroup = {
  category: string;
  options: FeatureOption[];
};

// Feature labels that map to lockable menus (must match featureGate.ts).
// Kategori diselaraskan dengan grup menu sidebar (navGroups di DashboardLayout)
// agar admin memiliki model mental yang sama saat memilih fitur.
export const GATED_FEATURE_GROUPS: FeatureGroup[] = [
  {
    category: "Umum",
    options: [
      { label: "Asisten AI (Chatbot HR)", gates: true },
      { label: "Kelola Surat & Kalender", gates: true },
    ],
  },
  {
    category: "Ruang Saya",
    options: [
      { label: "Reimbursement & Travel", gates: true },
      { label: "Tugas & Proyek", gates: true },
      { label: "Jenjang Karier", gates: true },
    ],
  },
  {
    category: "Komunikasi",
    options: [
      { label: "Forum, Saran, Penghargaan", gates: true },
      { label: "Apresiasi & Polling", gates: true },
    ],
  },
  {
    category: "Tim & Kinerja",
    options: [
      { label: "OKR & Penilaian Kinerja", gates: true },
      { label: "Feedback 360°", gates: true },
      { label: "Pulse Survey & Helpdesk", gates: true },
    ],
  },
  {
    category: "Sumber Daya",
    options: [
      { label: "Dokumen & Kebijakan", gates: true },
      { label: "Wiki & Knowledge Base", gates: true },
      { label: "Inventaris & Aset", gates: true },
      { label: "Pemesanan Ruangan", gates: true },
    ],
  },
  {
    category: "Manajemen SDM",
    options: [
      { label: "Rekrutmen & ATS", gates: true },
      { label: "Pelatihan (LMS)", gates: true },
      { label: "Onboarding karyawan", gates: true },
      { label: "Talent Management", gates: true },
      { label: "Analitik Advanced", gates: true },
    ],
  },
  {
    category: "Keuangan",
    options: [
      { label: "Penggajian (Payroll)", gates: true },
    ],
  },
];

// Descriptive labels that do NOT lock a menu – used only for display on cards.
export const DISPLAY_FEATURE_GROUPS: FeatureGroup[] = [
  {
    category: "Deskripsi Umum (hanya tampilan)",
    options: [
      { label: "Semua fitur Gratis", gates: false },
      { label: "Semua fitur Starter", gates: false },
      { label: "Semua fitur Professional", gates: false },
      { label: "Direktori Karyawan", gates: false },
      { label: "Absensi & Cuti dasar", gates: false },
      { label: "Pengumuman (baca)", gates: false },
      { label: "Pesan & Notifikasi", gates: false },
      { label: "Perayaan otomatis", gates: false },
      { label: "Dokumen Saya", gates: false },
      { label: "Admin Dashboard lanjutan", gates: false },
      { label: "Audit Trail & RBAC granular", gates: false },
      { label: "API Access & Webhook", gates: false },
      { label: "Dedicated Account Manager", gates: false },
    ],
  },
];

// All groups usable for the "Fitur Termasuk" picker (display + gated).
export const CORE_FEATURE_GROUPS: FeatureGroup[] = [
  ...DISPLAY_FEATURE_GROUPS,
  ...GATED_FEATURE_GROUPS,
];

// Flat list of every known label for quick lookup.
export const ALL_FEATURE_LABELS: string[] = [
  ...CORE_FEATURE_GROUPS.flatMap((g) => g.options.map((o) => o.label)),
];

/**
 * Canonical display order for feature labels, following the sidebar menu
 * structure (navGroups di DashboardLayout): Umum → Ruang Saya → Komunikasi →
 * Tim & Kinerja → Sumber Daya → Manajemen SDM → Keuangan → Administrasi.
 *
 * Includes older label variants stored on existing plans so their display
 * order also matches the new structure. Summary "Semua fitur X" labels come
 * first. Unknown labels fall back to the end (in their original order).
 */
export const FEATURE_DISPLAY_ORDER: string[] = [
  // Ringkasan (paling atas)
  "Semua fitur Gratis",
  "Semua fitur Starter",
  "Semua fitur Professional",

  // Umum
  "Asisten AI",
  "Asisten AI (Chatbot HR)",
  "Asisten AI Premium",
  "Pesan & Notifikasi",
  "Kelola Surat & Kalender",

  // Ruang Saya
  "Absensi & Cuti dasar",
  "Reimbursement & Travel",
  "Tugas & Proyek",
  "Tugas & Proyek (10 aktif)",
  "Proyek Unlimited",
  "Jenjang Karier",

  // Komunikasi
  "Pengumuman (baca)",
  "Forum, Saran, Penghargaan",
  "Apresiasi & Polling",
  "Perayaan otomatis",

  // Tim & Kinerja
  "OKR & Kinerja",
  "OKR & Goals",
  "OKR & Penilaian Kinerja",
  "Feedback 360°",
  "Pulse Survey & Helpdesk",

  // Sumber Daya
  "Dokumen Saya",
  "Dokumen & Kebijakan",
  "Wiki & Knowledge Base",
  "Inventaris & Aset",
  "Pemesanan Ruangan",

  // Manajemen SDM
  "Direktori Karyawan",
  "Rekrutmen",
  "Rekrutmen & ATS",
  "Pelatihan",
  "Pelatihan (LMS)",
  "Onboarding karyawan",
  "Talent Management",
  "Analitik Advanced",
  "Analitik Advanced & Custom",

  // Keuangan
  "Penggajian",
  "Penggajian (Payroll)",

  // Administrasi
  "Admin Dashboard lanjutan",
  "Audit Trail & RBAC granular",
  "API Access & Webhook",
  "Dedicated Account Manager",
];

/**
 * Returns a new array of feature labels sorted by the canonical menu order.
 * Unknown labels are appended at the end, preserving their original order.
 */
export function sortFeaturesByMenuOrder(features: string[]): string[] {
  const orderOf = (label: string): number => {
    const idx = FEATURE_DISPLAY_ORDER.indexOf(label);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...features]
    .map((label, i) => ({ label, i }))
    .sort((a, b) => orderOf(a.label) - orderOf(b.label) || a.i - b.i)
    .map((entry) => entry.label);
}
