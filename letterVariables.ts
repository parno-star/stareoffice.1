// Shared helpers for letter content templates and mail-merge variables.

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

/** Human-readable labels for content template categories. */
export const CONTENT_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  umum: "Umum",
  keluar: "Surat Keluar",
  masuk: "Surat Masuk",
  internal: "Surat Internal",
  memo: "Nota",
};

/**
 * Definisi variabel (placeholder) mail-merge yang didukung.
 * Ditulis di isi surat/template sebagai `{kunci}` dan otomatis diganti
 * dengan data form saat template diterapkan atau surat disimpan.
 */
export type LetterVariableKey =
  | "nomor_surat"
  | "tanggal"
  | "perihal"
  | "nama_penerima"
  | "jabatan_penerima"
  | "instansi_penerima"
  | "nama_pengirim"
  | "jabatan_pengirim"
  | "tempat";

export type LetterVariableDef = {
  key: LetterVariableKey;
  /** Teks yang disisipkan ke editor, mis. "{nomor_surat}". */
  token: string;
  label: string;
  description: string;
};

export const LETTER_VARIABLES: LetterVariableDef[] = [
  { key: "nomor_surat", token: "{nomor_surat}", label: "Nomor Surat", description: "Nomor surat (otomatis/manual)" },
  { key: "tanggal", token: "{tanggal}", label: "Tanggal", description: "Tanggal surat" },
  { key: "perihal", token: "{perihal}", label: "Perihal", description: "Perihal/subjek surat" },
  { key: "nama_penerima", token: "{nama_penerima}", label: "Nama Penerima", description: "Nama tujuan surat" },
  { key: "jabatan_penerima", token: "{jabatan_penerima}", label: "Jabatan Penerima", description: "Jabatan penerima" },
  { key: "instansi_penerima", token: "{instansi_penerima}", label: "Instansi Penerima", description: "Instansi/organisasi penerima" },
  { key: "nama_pengirim", token: "{nama_pengirim}", label: "Nama Pengirim", description: "Nama pengirim surat" },
  { key: "jabatan_pengirim", token: "{jabatan_pengirim}", label: "Jabatan Pengirim", description: "Jabatan pengirim" },
  { key: "tempat", token: "{tempat}", label: "Tempat", description: "Tempat penulisan surat" },
];

/** Nilai variabel yang diisi dari data form. */
export type LetterVariableValues = Partial<Record<LetterVariableKey, string>>;

/** Format tanggal ISO (yyyy-mm-dd) menjadi "d MMMM yyyy" berbahasa Indonesia. */
export function formatVariableDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "d MMMM yyyy", { locale: localeId });
}

/** Escape karakter khusus regex agar token `{...}` bisa dicari secara harfiah. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ganti semua placeholder `{kunci}` pada HTML isi surat dengan nilai dari form.
 * Placeholder yang nilainya kosong/tak tersedia dibiarkan apa adanya agar
 * pengguna tetap melihat variabel yang belum terisi.
 */
export function substituteLetterVariables(
  html: string,
  values: LetterVariableValues,
): string {
  let result = html;
  for (const def of LETTER_VARIABLES) {
    const value = values[def.key];
    if (value === undefined || value === null || value.trim() === "") continue;
    const pattern = new RegExp(escapeRegExp(def.token), "g");
    result = result.replace(pattern, value);
  }
  return result;
}

/** Apakah HTML masih mengandung placeholder variabel yang belum terisi? */
export function hasUnfilledVariables(html: string): boolean {
  return LETTER_VARIABLES.some((def) => html.includes(def.token));
}
