// Shared definitions for data-access SCOPES (categories of company data a
// vendor/super_admin can request consent to view). Used by both backend
// (convex/dataAccess.ts, requireTenant enforcement) and frontend
// (AccessRequestDialog, data-privacy page).
//
// A scope groups related app modules (MenuKeys) into a customer-facing category
// so a company can grant least-privilege access ("only Letters & Documents")
// instead of all-or-nothing.

import type { MenuKey } from "./roles";

export const DATA_SCOPE_VALUES = [
  "letters_documents",
  "hr_people",
  "finance_payroll",
  "communication",
  "org_settings",
] as const;

export type DataScope = (typeof DATA_SCOPE_VALUES)[number];

export function isDataScope(value: string): value is DataScope {
  return (DATA_SCOPE_VALUES as ReadonlyArray<string>).includes(value);
}

export type DataScopeDef = {
  id: DataScope;
  label: string;
  description: string;
};

export const DATA_SCOPES: ReadonlyArray<DataScopeDef> = [
  {
    id: "letters_documents",
    label: "Surat & Dokumen",
    description:
      "Surat masuk/keluar, disposisi, arsip dokumen, dan berkas resmi organisasi.",
  },
  {
    id: "hr_people",
    label: "Data Kepegawaian (HR)",
    description:
      "Direktori karyawan, cuti, absensi, kinerja, rekrutmen, pelatihan, dan data SDM.",
  },
  {
    id: "finance_payroll",
    label: "Keuangan & Penggajian",
    description:
      "Reimbursement, pengajuan dana, perjalanan dinas, penggajian, dan laporan keuangan.",
  },
  {
    id: "communication",
    label: "Komunikasi & Kolaborasi",
    description:
      "Pesan, forum, berita, kalender, proyek, dan kolaborasi antar karyawan.",
  },
  {
    id: "org_settings",
    label: "Organisasi & Pengaturan",
    description:
      "Struktur organisasi, pengguna & peran, aset, dan pengaturan sistem.",
  },
];

const SCOPE_LABEL_MAP: Record<DataScope, string> = DATA_SCOPES.reduce(
  (acc, s) => {
    acc[s.id] = s.label;
    return acc;
  },
  {} as Record<DataScope, string>,
);

/** Human-readable label for a scope id (falls back to the raw id). */
export function scopeLabel(id: string): string {
  return isDataScope(id) ? SCOPE_LABEL_MAP[id] : id;
}

/** Comma-separated labels for a list of scope ids. */
export function scopeLabels(ids: ReadonlyArray<string>): string {
  return ids.map(scopeLabel).join(", ");
}

/**
 * Maps each app menu to the data scope it belongs to. Menus not listed are
 * considered "general" (always accessible, no confidential data), e.g. the
 * dashboard shell, notifications, chatbot, and the privacy control center
 * itself. Used by scope enforcement (milestone 2) to decide which modules a
 * scoped grant unlocks.
 */
export const MENU_SCOPE_MAP: Partial<Record<MenuKey, DataScope>> = {
  // Letters & documents
  letters: "letters_documents",
  document_archive: "letters_documents",
  documents: "letters_documents",
  my_documents: "letters_documents",
  wiki: "letters_documents",
  policies: "letters_documents",

  // HR & people
  directory: "hr_people",
  leave: "hr_people",
  attendance: "hr_people",
  onboarding: "hr_people",
  training: "hr_people",
  mentorship: "hr_people",
  performance: "hr_people",
  grading: "hr_people",
  talent: "hr_people",
  recruitment: "hr_people",
  jobs: "hr_people",
  okr: "hr_people",
  engagement: "hr_people",
  feedback360: "hr_people",
  pulse: "hr_people",
  offboarding: "hr_people",
  career_path: "hr_people",
  career_planning: "hr_people",
  profile_verification: "hr_people",
  reports: "hr_people",
  analytics: "hr_people",

  // Finance & payroll
  expenses: "finance_payroll",
  fund_requests: "finance_payroll",
  finance_dashboard: "finance_payroll",
  finance_audit: "finance_payroll",
  finance_settings: "finance_payroll",
  travel: "finance_payroll",
  payroll: "finance_payroll",
  billing: "finance_payroll",

  // Communication & collaboration
  messages: "communication",
  forum: "communication",
  news: "communication",
  calendar: "communication",
  projects: "communication",
  suggestions: "communication",
  support: "communication",
  gallery: "communication",
  celebrations: "communication",
  recognitions: "communication",
  awards: "communication",
  polls: "communication",
  rooms: "communication",
  events: "communication",
  teams: "communication",

  // Organization & settings
  organization: "org_settings",
  assets: "org_settings",
  user_management: "org_settings",
  admin: "org_settings",
  membership_settings: "org_settings",
  promo_settings: "org_settings",
  membership_dashboard: "org_settings",
};

/** The scope a menu belongs to, or null if it is general (always allowed). */
export function scopeForMenu(menu: MenuKey): DataScope | null {
  return MENU_SCOPE_MAP[menu] ?? null;
}
