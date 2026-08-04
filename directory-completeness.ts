import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { isMasaKerjaLabel, isUsiaLabel } from "./directory-columns.ts";

// A single field that counts toward an employee's data completeness.
export type CompletenessField = {
  // Human-readable label shown to users (e.g. "Email", "Tanggal Lahir").
  label: string;
  // Whether the employee currently has a value for this field.
  filled: boolean;
};

export type CompletenessResult = {
  // Total number of fields evaluated.
  total: number;
  // How many of those fields are filled in.
  filled: number;
  // 0–100 integer percentage of completeness.
  percent: number;
  // Whether every evaluated field is filled.
  isComplete: boolean;
  // Labels of the fields still missing a value.
  missing: Array<string>;
  // Full per-field breakdown (filled and missing), in display order.
  fields: Array<CompletenessField>;
};

// Core built-in fields that every employee record should have filled in.
// "Atasan" (managerId) is intentionally excluded: it is legitimately empty for
// top-level leadership. The "No." column is a display-only row number.
const CORE_FIELDS: Array<{ label: string; get: (u: Doc<"users">) => string | undefined | null }> = [
  { label: "Nama", get: (u) => u.name },
  { label: "NIP", get: (u) => u.nip },
  { label: "Email", get: (u) => u.email },
  { label: "Jabatan", get: (u) => u.jobTitle },
  { label: "Departemen", get: (u) => u.department },
  { label: "Telepon", get: (u) => u.phone },
  { label: "Lokasi", get: (u) => u.location },
  { label: "Tanggal Mulai Kerja", get: (u) => u.startDate },
  { label: "Tanggal Lahir", get: (u) => u.dateOfBirth },
];

function hasValue(raw: string | undefined | null): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * Evaluate how complete an employee's data is. Counts all core built-in fields
 * plus every custom field, EXCEPT the auto-computed fields ("Masa Kerja" and
 * "Usia") which are derived from other data and never stored.
 */
export function computeCompleteness(
  user: Doc<"users">,
  customFieldDefs: Array<Doc<"directoryFields">>,
): CompletenessResult {
  const fields: Array<CompletenessField> = [];

  for (const core of CORE_FIELDS) {
    fields.push({ label: core.label, filled: hasValue(core.get(user)) });
  }

  const customValues = (user.customFields ?? {}) as Record<string, string>;
  for (const def of customFieldDefs) {
    // Auto-computed fields are never stored, so they never count as "missing".
    if (isMasaKerjaLabel(def.label) || isUsiaLabel(def.label)) continue;
    fields.push({
      label: def.label,
      filled: hasValue(customValues[def._id]),
    });
  }

  const total = fields.length;
  const filled = fields.filter((f) => f.filled).length;
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  const missing = fields.filter((f) => !f.filled).map((f) => f.label);

  return {
    total,
    filled,
    percent,
    isComplete: missing.length === 0,
    missing,
    fields,
  };
}
