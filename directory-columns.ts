import type { Doc } from "@/convex/_generated/dataModel.d.ts";

/**
 * Detects the special "Masa Kerja" (length of service) custom field by its
 * label, ignoring case and extra spacing. This field is NEVER stored: it is
 * always computed live from the employee's start date and shown as years +
 * months. During import its column is ignored.
 */
export function isMasaKerjaLabel(label: string): boolean {
  return label.trim().toLowerCase().replace(/\s+/g, " ") === "masa kerja";
}

/**
 * Detects the special "Usia" (age) custom field by its label, ignoring case and
 * extra spacing. Like "Masa Kerja", this field is NEVER stored: it is always
 * computed live from the employee's date of birth and shown as years + months.
 * During import its column is ignored.
 */
export function isUsiaLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "usia" || normalized === "umur";
}

/**
 * Detects the "No. SK/Kontrak Pegawai" custom field by its label. This is the
 * column whose value becomes a clickable link to the employee's attached SK /
 * Kontrak PDF documents. We require the label to start with "no" so the related
 * "Masa SK/Kontrak" and "Cek Fisik SK/Kontrak" fields are NOT matched.
 */
export function isSkNumberLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    normalized.startsWith("no") &&
    normalized.includes("sk") &&
    normalized.includes("kontrak")
  );
}

/**
 * Compute age as "X tahun Y bulan" from an ISO date of birth (YYYY-MM-DD) up to
 * today. Returns null when the date is missing or invalid.
 */
export function computeAge(dateOfBirth?: string | null): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  if (dob.getTime() > now.getTime()) return null;

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (parts.length === 0) return "Kurang dari 1 bulan";
  return parts.join(" ");
}

/**
 * Compute length of service as "X tahun Y bulan" from an ISO start date
 * (YYYY-MM-DD) up to today. Returns a friendly message when the date is
 * missing or in the future.
 */
export function computeTenure(startDate?: string | null): string | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  if (start.getTime() > now.getTime()) return "Belum mulai bekerja";

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (parts.length === 0) return "Kurang dari 1 bulan";
  return parts.join(" ");
}


export type ColumnFieldType = "text" | "number" | "date" | "select";

export type BuiltInColumn = {
  // Stable token used in the saved order array
  key: string;
  label: string;
  type: ColumnFieldType;
  required: boolean;
};

// Built-in directory columns that always exist and cannot be deleted.
// The `key` is also the token stored in organizations.directoryColumnOrder.
export const BUILT_IN_COLUMNS: Array<BuiltInColumn> = [
  { key: "no", label: "NO.", type: "number", required: false },
  { key: "nama", label: "NAMA", type: "text", required: true },
  { key: "nip", label: "NIP", type: "text", required: false },
  { key: "email", label: "EMAIL", type: "text", required: false },
  { key: "jobTitle", label: "JABATAN", type: "text", required: false },
  { key: "department", label: "DEPARTEMEN", type: "text", required: false },
  { key: "phone", label: "TELEPON", type: "text", required: false },
  { key: "location", label: "LOKASI", type: "text", required: false },
  { key: "startDate", label: "TANGGAL MULAI KERJA", type: "date", required: false },
  { key: "dateOfBirth", label: "TANGGAL LAHIR", type: "date", required: false },
  { key: "managerId", label: "ATASAN", type: "text", required: false },
];

// A unified column can be either a built-in field or an admin-defined custom field.
export type OrderedColumn =
  | { kind: "builtin"; token: string; builtin: BuiltInColumn }
  | { kind: "custom"; token: string; custom: Doc<"directoryFields"> };

/**
 * Built-in columns considered sensitive: only administrators may see them.
 * Regular employees see general columns only (name, job title, department,
 * location, work email/phone, manager). Kept in sync with the server-side
 * redactDirectoryUser() in convex/directory.ts.
 */
export const SENSITIVE_BUILTIN_KEYS: ReadonlyArray<string> = [
  "nip",
  "startDate",
  "dateOfBirth",
];

/**
 * Filter a set of ordered columns down to what a viewer may see. Admins see
 * everything; regular employees see only general built-in columns (all custom
 * fields are hidden because they may hold private data such as salary).
 */
export function filterColumnsForViewer(
  columns: Array<OrderedColumn>,
  canSeeSensitive: boolean,
): Array<OrderedColumn> {
  if (canSeeSensitive) return columns;
  return columns.filter(
    (col) =>
      col.kind === "builtin" && !SENSITIVE_BUILTIN_KEYS.includes(col.builtin.key),
  );
}

/**
 * Merge built-in columns and custom fields into a single ordered list based on
 * the saved token order. Tokens not present in the saved order are appended in
 * their natural order (built-ins first, then custom fields by their own order),
 * so newly added fields always show up even before an explicit reorder.
 */
export function buildOrderedColumns(
  customFields: Array<Doc<"directoryFields">>,
  savedOrder: Array<string>,
): Array<OrderedColumn> {
  // Token -> column lookup for everything that currently exists.
  const byToken = new Map<string, OrderedColumn>();
  for (const b of BUILT_IN_COLUMNS) {
    byToken.set(b.key, { kind: "builtin", token: b.key, builtin: b });
  }
  for (const c of customFields) {
    byToken.set(c._id, { kind: "custom", token: c._id, custom: c });
  }

  const result: Array<OrderedColumn> = [];
  const used = new Set<string>();

  // 1) Emit columns in the saved order (skipping any that no longer exist).
  for (const token of savedOrder) {
    const col = byToken.get(token);
    if (col && !used.has(token)) {
      result.push(col);
      used.add(token);
    }
  }

  // 2) Append any remaining columns not covered by the saved order.
  for (const b of BUILT_IN_COLUMNS) {
    if (!used.has(b.key)) {
      result.push({ kind: "builtin", token: b.key, builtin: b });
      used.add(b.key);
    }
  }
  const sortedCustom = [...customFields].sort((a, b) => a.order - b.order);
  for (const c of sortedCustom) {
    if (!used.has(c._id)) {
      result.push({ kind: "custom", token: c._id, custom: c });
      used.add(c._id);
    }
  }

  return result;
}

/**
 * Format a stored numeric field value with thousand separators using dots, the
 * Indonesian locale convention (e.g. "5000000" -> "5.000.000"). Any non-numeric
 * portion is returned unchanged so free-text entries are never mangled.
 */
export function formatNumberValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return raw;
  // Normalize: allow an optional leading sign and a decimal part.
  const match = trimmed.match(/^(-?)(\d+)(?:[.,](\d+))?$/);
  if (!match) return raw;
  const [, sign, intPart, decPart] = match;
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

// Resolve the displayed value for a built-in column from a user document.
export function builtInValue(
  user: Doc<"users">,
  key: string,
  managerName: string | null,
): string | undefined {
  switch (key) {
    case "nama":
      return user.name ?? undefined;
    case "nip":
      return user.nip ?? undefined;
    case "email":
      return user.email ?? undefined;
    case "jobTitle":
      return user.jobTitle ?? undefined;
    case "department":
      return user.department ?? undefined;
    case "phone":
      return user.phone ?? undefined;
    case "location":
      return user.location ?? undefined;
    case "startDate":
      return user.startDate ?? undefined;
    case "dateOfBirth":
      return user.dateOfBirth ?? undefined;
    case "managerId":
      return managerName ?? undefined;
    default:
      return undefined;
  }
}
