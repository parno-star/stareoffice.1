/**
 * Builds a feature comparison matrix across all membership plans, used to
 * generate a marketing-friendly PDF ("Daftar Semua Fitur").
 *
 * Handles two things the raw plan data does not:
 *  1. Inheritance – a plan whose coreFeatures contains "Semua fitur <Plan>"
 *     inherits every included feature of that referenced plan.
 *  2. Categorisation – every feature label (including older variants stored on
 *     existing plans) is bucketed into a menu-aligned category so the matrix
 *     reads in the same order as the sidebar.
 */

import type { Doc } from "@/convex/_generated/dataModel.d.ts";

export type FeatureStatus = "included" | "excluded" | "na";

export type MatrixFeatureRow = {
  label: string;
  /** Status per plan, keyed by plan name. */
  statuses: Record<string, FeatureStatus>;
};

export type MatrixCategory = {
  category: string;
  features: MatrixFeatureRow[];
};

export type FeatureMatrix = {
  planNames: string[];
  categories: MatrixCategory[];
};

// Summary labels are meta-references, never shown as their own matrix row.
const SUMMARY_PREFIX = "Semua fitur ";

// Menu-aligned category order and the feature labels (incl. older variants)
// that belong to each. Any label not listed falls into "Lainnya".
const MATRIX_CATEGORIES: { category: string; labels: string[] }[] = [
  {
    category: "Dasar & Umum",
    labels: [
      "Direktori Karyawan",
      "Absensi & Cuti dasar",
      "Pengumuman (baca)",
      "Pesan & Notifikasi",
      "Perayaan otomatis",
      "Dokumen Saya",
      "Asisten AI",
      "Asisten AI (Chatbot HR)",
      "Asisten AI Premium",
    ],
  },
  {
    category: "Ruang Saya",
    labels: [
      "Reimbursement & Travel",
      "Tugas & Proyek",
      "Tugas & Proyek (10 aktif)",
      "Proyek Unlimited",
      "Jenjang Karier",
    ],
  },
  {
    category: "Komunikasi",
    labels: [
      "Kelola Surat & Kalender",
      "Forum, Saran, Penghargaan",
      "Apresiasi & Polling",
    ],
  },
  {
    category: "Tim & Kinerja",
    labels: [
      "OKR & Kinerja",
      "OKR & Goals",
      "OKR & Penilaian Kinerja",
      "Feedback 360°",
      "Pulse Survey & Helpdesk",
    ],
  },
  {
    category: "Sumber Daya",
    labels: [
      "Dokumen & Kebijakan",
      "Wiki & Knowledge Base",
      "Inventaris & Aset",
      "Pemesanan Ruangan",
    ],
  },
  {
    category: "Manajemen SDM",
    labels: [
      "Rekrutmen",
      "Rekrutmen & ATS",
      "Pelatihan",
      "Pelatihan (LMS)",
      "Onboarding karyawan",
      "Talent Management",
      "Analitik Advanced",
      "Analitik Advanced & Custom",
    ],
  },
  {
    category: "Keuangan",
    labels: ["Penggajian", "Penggajian (Payroll)"],
  },
  {
    category: "Administrasi & Enterprise",
    labels: [
      "Admin Dashboard lanjutan",
      "Audit Trail & RBAC granular",
      "API Access & Webhook",
      "Dedicated Account Manager",
    ],
  },
];

function isSummary(label: string): boolean {
  return label.startsWith(SUMMARY_PREFIX);
}

/**
 * Resolves the full set of included feature labels for each plan, expanding
 * "Semua fitur <Plan>" references recursively.
 */
function resolveIncluded(plans: Doc<"membershipPlans">[]): Map<string, Set<string>> {
  const byName = new Map<string, Doc<"membershipPlans">>();
  for (const p of plans) byName.set(p.name, p);

  const resolved = new Map<string, Set<string>>();

  const resolve = (plan: Doc<"membershipPlans">, seen: Set<string>): Set<string> => {
    const cached = resolved.get(plan.name);
    if (cached) return cached;
    if (seen.has(plan.name)) return new Set(); // guard against cycles
    seen.add(plan.name);

    const included = new Set<string>();
    for (const label of plan.coreFeatures) {
      if (isSummary(label)) {
        const refName = label.slice(SUMMARY_PREFIX.length).trim();
        const ref = byName.get(refName);
        if (ref) {
          for (const inh of resolve(ref, seen)) included.add(inh);
        }
      } else {
        included.add(label);
      }
    }
    resolved.set(plan.name, included);
    return included;
  };

  for (const p of plans) resolve(p, new Set());
  return resolved;
}

/**
 * Builds the full comparison matrix from the plans (sorted by order).
 */
export function buildFeatureMatrix(plans: Doc<"membershipPlans">[]): FeatureMatrix {
  const sorted = [...plans].sort((a, b) => a.order - b.order);
  const planNames = sorted.map((p) => p.name);
  const included = resolveIncluded(sorted);

  // Every non-summary label that appears anywhere (included or disabled).
  const allLabels = new Set<string>();
  for (const p of sorted) {
    for (const l of included.get(p.name) ?? []) allLabels.add(l);
    for (const l of p.disabledFeatures) if (!isSummary(l)) allLabels.add(l);
  }

  const statusFor = (label: string, plan: Doc<"membershipPlans">): FeatureStatus => {
    if ((included.get(plan.name) ?? new Set()).has(label)) return "included";
    if (plan.disabledFeatures.includes(label)) return "excluded";
    return "na";
  };

  const known = new Set<string>();
  const categories: MatrixCategory[] = [];

  for (const group of MATRIX_CATEGORIES) {
    const features: MatrixFeatureRow[] = [];
    for (const label of group.labels) {
      if (!allLabels.has(label)) continue;
      known.add(label);
      const statuses: Record<string, FeatureStatus> = {};
      for (const p of sorted) statuses[p.name] = statusFor(label, p);
      features.push({ label, statuses });
    }
    if (features.length > 0) categories.push({ category: group.category, features });
  }

  // Any label not captured by MATRIX_CATEGORIES goes into "Lainnya".
  const leftovers = [...allLabels].filter((l) => !known.has(l));
  if (leftovers.length > 0) {
    const features: MatrixFeatureRow[] = leftovers.map((label) => {
      const statuses: Record<string, FeatureStatus> = {};
      for (const p of sorted) statuses[p.name] = statusFor(label, p);
      return { label, statuses };
    });
    categories.push({ category: "Lainnya", features });
  }

  return { planNames, categories };
}
