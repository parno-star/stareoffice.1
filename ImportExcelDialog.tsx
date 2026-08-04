import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  buildOrderedColumns,
  computeAge,
  computeTenure,
  isMasaKerjaLabel,
  isUsiaLabel,
  type OrderedColumn,
} from "../_lib/directory-columns.ts";

type EmployeeRow = {
  name: string;
  nip?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  location?: string;
  startDate?: string;
  birthday?: string;
  dateOfBirth?: string;
  bio?: string;
  customFields?: Record<string, string>;
};

type ImportResult = {
  created: number;
  updated: number;
  errors: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries?: Array<{ user: Doc<"users"> }>;
};

type StandardField = Exclude<keyof EmployeeRow, "customFields">;

// Known column header mappings (Indonesian & English)
const COLUMN_MAP: Record<string, StandardField> = {
  nama: "name",
  name: "name",
  "nama lengkap": "name",
  "full name": "name",
  nip: "nip",
  "no. induk pegawai": "nip",
  "nomor induk pegawai": "nip",
  "employee id": "nip",
  "id karyawan": "nip",
  email: "email",
  "e-mail": "email",
  "alamat email": "email",
  jabatan: "jobTitle",
  "job title": "jobTitle",
  posisi: "jobTitle",
  position: "jobTitle",
  departemen: "department",
  department: "department",
  divisi: "department",
  division: "department",
  telepon: "phone",
  phone: "phone",
  "no. telepon": "phone",
  "no telepon": "phone",
  "nomor telepon": "phone",
  "phone number": "phone",
  hp: "phone",
  "no. hp": "phone",
  lokasi: "location",
  location: "location",
  kota: "location",
  city: "location",
  kantor: "location",
  office: "location",
  "tanggal bergabung": "startDate",
  "tanggal mulai kerja": "startDate",
  "tanggal mulai": "startDate",
  "start date": "startDate",
  "join date": "startDate",
  "tanggal masuk": "startDate",
  "mulai bekerja": "startDate",
  "tanggal lahir": "dateOfBirth",
  "date of birth": "dateOfBirth",
  "tgl lahir": "dateOfBirth",
  "ulang tahun": "birthday",
  birthday: "birthday",
  ultah: "birthday",
  bio: "bio",
  tentang: "bio",
  about: "bio",
  deskripsi: "bio",
};

// Known columns that are exported but cannot be imported directly.
// They are recognized so they don't trigger an "unrecognized column" warning,
// but their values are ignored during import.
// - "No." is just a display row number.
// - "Atasan" (manager) is a reference by name and is set separately in the app.
const IGNORED_COLUMNS = new Set<string>([
  "no",
  "no.",
  "nomor",
  "number",
  "#",
  "atasan",
  "manager",
  "supervisor",
  "kepala",
]);

function parseDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  // A real Date object (produced when the workbook is read with cellDates).
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // A raw Excel serial number (date cell read without cellDates).
  if (typeof value === "number" && isFinite(value)) {
    return excelSerialToIso(value);
  }

  const str = String(value).trim();
  if (!str) return undefined;

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (day-first, Indonesian standard)
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d);
    const month = Number(m);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
    }
  }

  // A numeric string that is actually an Excel serial number.
  if (/^\d+(\.\d+)?$/.test(str)) {
    const iso = excelSerialToIso(Number(str));
    if (iso) return iso;
  }

  return undefined;
}

// Convert an Excel serial date number into ISO YYYY-MM-DD.
// Excel day 1 = 1900-01-01. Accepts any serial that maps to a year 1900–9999,
// so birthdays before 1982 (previously rejected) now work.
function excelSerialToIso(serial: number): string | undefined {
  if (!isFinite(serial) || serial < 1 || serial > 2958465) return undefined;
  // 25569 = days between 1899-12-30 (Excel epoch) and 1970-01-01 (Unix epoch).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return undefined;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse a birthday into MM-DD (year-agnostic) format.
function parseBirthday(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;

  // Already MM-DD
  if (/^\d{2}-\d{2}$/.test(str)) return str;

  // Reuse the full date parser then strip the year
  const full = parseDate(value);
  if (full) {
    const parts = full.split("-");
    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  }

  // DD/MM (no year)
  const dm = str.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (dm) {
    const [, d, m] = dm;
    return `${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  return undefined;
}

// Resolve the preview cell value for an ordered column from a parsed import row.
// `index` is the zero-based row position, used for the "No." column.
function previewValue(
  col: OrderedColumn,
  row: EmployeeRow,
  index: number,
): string {
  if (col.kind === "custom") {
    // "Masa Kerja" is computed live from the start date, not imported.
    if (isMasaKerjaLabel(col.custom.label)) {
      return computeTenure(row.startDate) ?? "-";
    }
    // "Usia" is computed live from the date of birth, not imported.
    if (isUsiaLabel(col.custom.label)) {
      return computeAge(row.dateOfBirth) ?? "-";
    }
    return row.customFields?.[col.custom._id] ?? "-";
  }
  switch (col.builtin.key) {
    case "no":
      return String(index + 1);
    case "nama":
      return row.name || "-";
    case "nip":
      return row.nip ?? "-";
    case "email":
      return row.email ?? "-";
    case "jobTitle":
      return row.jobTitle ?? "-";
    case "department":
      return row.department ?? "-";
    case "phone":
      return row.phone ?? "-";
    case "location":
      return row.location ?? "-";
    case "startDate":
      return row.startDate ?? "-";
    case "dateOfBirth":
      return row.dateOfBirth ?? "-";
    case "managerId":
      // Manager is set inside the app, not via import.
      return "-";
    default:
      return "-";
  }
}

export default function ImportExcelDialog({ open, onOpenChange }: Props) {
  const bulkCreate = useMutation(api.users.bulkCreateEmployees);
  const customFieldDefs = useQuery(api.directoryFields.list, {});
  const columnOrder = useQuery(api.directoryFields.getColumnOrder, {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<EmployeeRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // The template and preview must use the SAME field definitions and saved
  // column order as the "Kelola Field Direktori" dialog. Both are loaded via
  // separate queries, so we only consider the data ready once BOTH have
  // resolved. Generating the template before this would silently fall back to
  // an empty custom-field list and produce fewer columns in a different order.
  const fieldDataReady =
    customFieldDefs !== undefined && columnOrder !== undefined;

  // Mirror the exact column order of the directory table for the preview.
  const orderedColumns = buildOrderedColumns(
    customFieldDefs ?? [],
    columnOrder ?? [],
  );

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setUnmappedColumns([]);
    setResult(null);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setParsedRows([]);
    setParseErrors([]);
    setUnmappedColumns([]);
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await f.arrayBuffer();
      // cellDates: true turns real Excel date cells into JS Date objects so we
      // parse them reliably regardless of the locale display format.
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        setParseErrors(["File tidak memiliki sheet yang valid"]);
        return;
      }
      const sheet = workbook.Sheets[firstSheet];
      if (!sheet) {
        setParseErrors(["Sheet kosong"]);
        return;
      }

      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (rawData.length === 0) {
        setParseErrors(["File tidak memiliki data (hanya header atau kosong)"]);
        return;
      }

      // Map headers
      const firstRow = rawData[0];
      if (!firstRow) {
        setParseErrors(["File tidak memiliki data"]);
        return;
      }
      const headers = Object.keys(firstRow);
      const mapping: Record<string, StandardField> = {};
      // header -> custom field definition
      const customMapping: Record<string, Doc<"directoryFields">> = {};
      const unmapped: string[] = [];

      // Build a lookup of custom field labels (lowercased) -> definition.
      // The auto-computed "Masa Kerja" field is intentionally excluded so its
      // column is treated as ignored during import (value is derived, not read).
      const customByLabel: Record<string, Doc<"directoryFields">> = {};
      for (const def of customFieldDefs ?? []) {
        if (isMasaKerjaLabel(def.label)) continue;
        if (isUsiaLabel(def.label)) continue;
        customByLabel[def.label.trim().toLowerCase()] = def;
      }

      for (const h of headers) {
        const cleaned = h.trim().toLowerCase();
        // Skip columns that are exported for display but not importable.
        if (IGNORED_COLUMNS.has(cleaned)) {
          continue;
        }
        // "Masa Kerja" is computed automatically; ignore its column on import.
        if (isMasaKerjaLabel(h)) {
          continue;
        }
        // "Usia" is computed automatically; ignore its column on import.
        if (isUsiaLabel(h)) {
          continue;
        }
        const std = COLUMN_MAP[cleaned];
        if (std) {
          mapping[h] = std;
          continue;
        }
        const custom = customByLabel[cleaned];
        if (custom) {
          customMapping[h] = custom;
          continue;
        }
        unmapped.push(h);
      }

      if (!Object.values(mapping).includes("name")) {
        setParseErrors([
          'Kolom "Nama" tidak ditemukan. Pastikan ada kolom bernama "Nama", "Name", atau "Nama Lengkap".',
        ]);
        return;
      }

      const rows: EmployeeRow[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rawData.length; i++) {
        const raw = rawData[i];
        if (!raw) continue;
        const row: Partial<EmployeeRow> = {};

        for (const [header, field] of Object.entries(mapping)) {
          const val = raw[header];
          if (field === "startDate") {
            row.startDate = parseDate(val);
          } else if (field === "dateOfBirth") {
            row.dateOfBirth = parseDate(val);
          } else if (field === "birthday") {
            row.birthday = parseBirthday(val);
          } else if (field === "phone") {
            // Preserve phone as string
            row.phone = val ? String(val).trim() : undefined;
          } else {
            const strVal = val ? String(val).trim() : undefined;
            if (strVal) {
              row[field] = strVal;
            }
          }
        }

        // Custom field values keyed by definition id
        const customValues: Record<string, string> = {};
        for (const [header, def] of Object.entries(customMapping)) {
          const val = raw[header];
          let strVal: string | undefined;
          if (def.type === "date") {
            strVal = parseDate(val);
          } else {
            strVal = val !== undefined && val !== null ? String(val).trim() : undefined;
          }
          if (strVal) customValues[def._id] = strVal;
        }
        if (Object.keys(customValues).length > 0) {
          row.customFields = customValues;
        }

        // Auto-derive the year-agnostic birthday (MM-DD) from the full date of
        // birth when the dedicated "Ulang Tahun" column is not provided. This
        // lets admins fill only the "Tanggal Lahir" column and still get
        // birthday reminders.
        if (!row.birthday && row.dateOfBirth) {
          const parts = row.dateOfBirth.split("-");
          if (parts.length === 3) {
            row.birthday = `${parts[1]}-${parts[2]}`;
          }
        }

        if (!row.name || row.name.trim().length < 2) {
          errors.push(`Baris ${i + 2}: Nama kosong atau terlalu pendek`);
          continue;
        }

        rows.push(row as EmployeeRow);
      }

      if (unmapped.length > 0) {
        setUnmappedColumns(unmapped);
        toast.warning(
          `Kolom tidak dikenali: ${unmapped.join(", ")}`,
        );
      }

      setParsedRows(rows);
      setParseErrors(errors);
    } catch (error) {
      console.error(error);
      setParseErrors(["Gagal membaca file. Pastikan format .xlsx atau .xls yang valid."]);
    }
  }, [customFieldDefs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) void processFile(f);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await bulkCreate({ employees: parsedRows });
      setResult(res);
      if (res.created > 0) {
        toast.success(`${res.created} karyawan baru berhasil ditambahkan`);
      }
      if (res.updated > 0) {
        toast.success(`${res.updated} karyawan berhasil diperbarui`);
      }
      if (res.errors.length > 0) {
        toast.error(`${res.errors.length} baris gagal diimpor`);
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengimpor data");
      } else {
        toast.error("Gagal mengimpor data");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (downloadingTemplate) return;
    if (!fieldDataReady) {
      toast.info("Sedang memuat daftar field. Coba lagi sebentar.");
      return;
    }
    setDownloadingTemplate(true);
    try {
      const XLSX = await import("xlsx");

      // Build the template columns directly from the same ordered-column
      // definition used by the directory table and the preview, so the
      // template's column order and count always match the table exactly.
      // Exception: the "No." (nomor urut) column is always forced to the first
      // position in the template, regardless of where it sits in the saved
      // directory column order, so the sequence number is always column A.
      const templateColumns = [
        ...orderedColumns.filter(
          (col) => col.kind === "builtin" && col.builtin.key === "no",
        ),
        ...orderedColumns.filter(
          (col) => !(col.kind === "builtin" && col.builtin.key === "no"),
        ),
      ];

      // Example dummy values (3 variants) for each built-in column key.
      const dummyByKey: Record<string, [string, string, string]> = {
        no: ["1", "2", "3"],
        nama: ["Budi Santoso", "Siti Aminah", "Andi Wijaya"],
        nip: ["199001012020011001", "199203152021012002", "198807202019011003"],
        email: ["budi@perusahaan.com", "siti@perusahaan.com", "andi@perusahaan.com"],
        jobTitle: ["Software Engineer", "HR Manager", "Finance Staff"],
        department: ["Engineering", "Human Resources", "Finance"],
        phone: ["08123456789", "08987654321", "08111222333"],
        location: ["Jakarta", "Bandung", "Surabaya"],
        startDate: ["15-01-2024", "01-03-2021", "20-07-2019"],
        dateOfBirth: ["17-08-1990", "15-03-1992", "20-07-1988"],
        managerId: ["Dewi Lestari", "Budi Santoso", "Siti Aminah"],
      };

      const exampleCustomValue = (
        def: Doc<"directoryFields">,
        variant: number,
      ): string => {
        // Masa Kerja is auto-computed; show a hint instead of an editable value.
        if (isMasaKerjaLabel(def.label)) return "(otomatis)";
        // Usia is auto-computed from date of birth; show a hint instead.
        if (isUsiaLabel(def.label)) return "(otomatis)";
        if (def.type === "date") return ["01-01-2024", "15-06-2023", "30-09-2022"][variant] ?? "";
        if (def.type === "number") return ["123456", "234567", "345678"][variant] ?? "";
        if (def.type === "select") {
          const opts = (def.options ?? "").split(",").map((o) => o.trim()).filter(Boolean);
          return opts[variant % Math.max(opts.length, 1)] ?? opts[0] ?? "";
        }
        return ["Contoh", "Contoh 2", "Contoh 3"][variant] ?? "Contoh";
      };

      const widthByKey: Record<string, number> = {
        no: 6,
        nama: 20,
        nip: 20,
        email: 28,
        jobTitle: 22,
        department: 18,
        phone: 16,
        location: 14,
        startDate: 18,
        dateOfBirth: 16,
        managerId: 18,
      };

      // Header labels mirror the table (built-in labels are already uppercase;
      // uppercase custom labels too for a uniform look).
      const headers = templateColumns.map((col) =>
        col.kind === "builtin" ? col.builtin.label : col.custom.label.toUpperCase(),
      );

      // Three illustrative dummy rows. The template intentionally contains NO
      // real employee data so admins start from a clean sheet.
      const dummyRows: string[][] = [0, 1, 2].map((variant) =>
        templateColumns.map((col) => {
          if (col.kind === "custom") return exampleCustomValue(col.custom, variant);
          return dummyByKey[col.builtin.key]?.[variant] ?? "";
        }),
      );

      const data = [headers, ...dummyRows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      // Set column widths for better readability (matches header order)
      ws["!cols"] = templateColumns.map((col) =>
        col.kind === "builtin"
          ? { wch: widthByKey[col.builtin.key] ?? 18 }
          : { wch: 18 },
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Karyawan");

      // Instruction sheet explaining each column and expected formats, in the
      // same order as the columns above.
      const guideForColumn = (col: OrderedColumn): string[] => {
        if (col.kind === "custom") {
          const d = col.custom;
          if (isMasaKerjaLabel(d.label)) {
            return [d.label, "Tidak", "Otomatis", "Dihitung otomatis dari Tanggal Mulai Kerja. Diabaikan saat impor."];
          }
          if (isUsiaLabel(d.label)) {
            return [d.label, "Tidak", "Otomatis", "Dihitung otomatis dari Tanggal Lahir. Diabaikan saat impor."];
          }
          const typeLabel =
            d.type === "date"
              ? "Tanggal (DD-MM-YYYY)"
              : d.type === "number"
                ? "Angka"
                : d.type === "select"
                  ? `Pilihan: ${(d.options ?? "").split(",").map((o) => o.trim()).filter(Boolean).join(", ")}`
                  : "Teks";
          return [d.label, d.required ? "Ya" : "Tidak", typeLabel, "Field tambahan yang Anda buat sendiri."];
        }
        const info: Record<string, [string, string, string, string]> = {
          no: ["No.", "Tidak", "Angka", "Nomor urut untuk tampilan saja. Diabaikan saat impor."],
          nama: ["Nama", "Ya", "Teks", "Nama lengkap karyawan. Minimal 2 karakter."],
          nip: ["NIP", "Tidak", "Teks/Angka", "Nomor Induk Pegawai. Dipakai untuk mencocokkan data saat impor ulang (data diperbarui, bukan digandakan)."],
          email: ["Email", "Tidak", "Teks", "Alamat email valid. Juga dipakai untuk mencocokkan data bila NIP kosong."],
          jobTitle: ["Jabatan", "Tidak", "Teks", "Contoh: Software Engineer, HR Manager."],
          department: ["Departemen", "Tidak", "Teks", "Contoh: Engineering, Finance."],
          phone: ["Telepon", "Tidak", "Teks", "Nomor telepon. Awali dengan tanda ' bila nol di depan hilang."],
          location: ["Lokasi", "Tidak", "Teks", "Kota atau kantor. Contoh: Jakarta."],
          startDate: ["Tanggal Mulai Kerja", "Tidak", "Tanggal (DD-MM-YYYY)", "Contoh: 15-01-2024."],
          dateOfBirth: ["Tanggal Lahir", "Tidak", "Tanggal (DD-MM-YYYY)", "Tanggal lahir lengkap dengan tahun. Contoh: 17-08-1990. Sistem otomatis mengambil tanggal & bulan untuk pengingat ulang tahun."],
          managerId: ["Atasan", "Tidak", "Teks", "Diatur di dalam aplikasi, bukan lewat impor. Kolom ini diabaikan saat impor."],
        };
        return info[col.builtin.key] ?? [col.builtin.label, "Tidak", "Teks", ""];
      };

      const guideData: string[][] = [
        ["PETUNJUK PENGISIAN TEMPLATE IMPOR KARYAWAN"],
        [""],
        ['Isi data karyawan pada sheet "Data Karyawan". Baris contoh yang sudah ada boleh dihapus dan diganti dengan data asli Anda.'],
        [""],
        ["Kolom", "Wajib", "Format / Tipe", "Keterangan"],
        ...templateColumns.map(guideForColumn),
        [""],
        ["CATATAN PENTING"],
        ["- Urutan dan jumlah kolom pada template ini sama dengan tabel Direktori Karyawan."],
        ["- Sel yang dikosongkan TIDAK akan menghapus data lama saat impor ulang."],
        ["- Format tanggal yang dianjurkan adalah DD-MM-YYYY (contoh: 17-08-1990)."],
        ["- Pengingat ulang tahun diambil otomatis dari tanggal & bulan pada kolom Tanggal Lahir."],
        ["- Jangan mengubah judul kolom pada sheet \"Data Karyawan\" agar tetap dikenali."],
        ["- Kolom dengan judul yang tidak dikenali akan diabaikan saat impor."],
      ];
      const guideWs = XLSX.utils.aoa_to_sheet(guideData);
      guideWs["!cols"] = [
        { wch: 24 },
        { wch: 10 },
        { wch: 26 },
        { wch: 60 },
      ];
      XLSX.utils.book_append_sheet(wb, guideWs, "Petunjuk");

      // Generate a blob and trigger download via an anchor element.
      // XLSX.writeFile can fail silently inside sandboxed iframes.
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-impor-karyawan.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal membuat template. Coba lagi.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Impor Data Karyawan dari Excel
          </DialogTitle>
          <DialogDescription>
            Upload file Excel (.xlsx, .xls) atau CSV untuk mengimpor data karyawan secara menyeluruh, termasuk field tambahan. Karyawan dicocokkan berdasarkan NIP: jika NIP sudah ada, datanya diperbarui; jika belum, dibuat baru. Sel yang dikosongkan tidak akan menghapus data lama.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {/* Step 1: File upload */}
          {!result && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
                file && "border-primary/40 bg-primary/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="size-10 text-primary" />
                  <div className="text-center">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={resetState}
                  >
                    <X className="size-4" />
                    Ganti file
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="size-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">
                      Seret file ke sini atau klik untuk memilih
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Format: .xlsx, .xls, .csv
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer"
                  >
                    Pilih File
                  </Button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Template download */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                Belum punya template? Unduh contoh file.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 cursor-pointer"
                disabled={downloadingTemplate || !fieldDataReady}
                onClick={() => { void handleDownloadTemplate(); }}
              >
                {downloadingTemplate || !fieldDataReady ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {downloadingTemplate
                  ? "Menyiapkan..."
                  : !fieldDataReady
                    ? "Memuat..."
                    : "Unduh Template"}
              </Button>
            </div>

            {/* Unrecognized columns notice */}
            {unmappedColumns.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
                  <AlertCircle className="size-4" />
                  {unmappedColumns.length} kolom tidak dikenali dan akan diabaikan
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unmappedColumns.map((col, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 dark:text-amber-500"
                    >
                      {col}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Kolom di atas tidak cocok dengan field bawaan maupun field tambahan.
                  Periksa kembali penulisan judul kolom, atau buat field tambahan lewat "Kelola Field" bila ingin kolom ini ikut diimpor.
                </p>
              </div>
            )}

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircle className="size-4" />
                  Peringatan
                </p>
                <ul className="space-y-0.5 text-sm text-destructive/80">
                  {parseErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Pratinjau Data ({parsedRows.length} baris siap diimpor)
                  </p>
                  <Badge variant="secondary">{parsedRows.length} karyawan</Badge>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {orderedColumns.map((col) => (
                          <TableHead
                            key={col.token}
                            className={cn(
                              col.kind === "builtin" &&
                                col.builtin.key === "no" &&
                                "w-12 text-center",
                            )}
                          >
                            {col.kind === "builtin"
                              ? col.builtin.label
                              : col.custom.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          {orderedColumns.map((col) => {
                            const isNo =
                              col.kind === "builtin" &&
                              col.builtin.key === "no";
                            const isNama =
                              col.kind === "builtin" &&
                              col.builtin.key === "nama";
                            return (
                              <TableCell
                                key={col.token}
                                className={cn(
                                  isNo && "text-center text-muted-foreground",
                                  isNama && "font-medium",
                                )}
                              >
                                {previewValue(col, row, i)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedRows.length > 50 && (
                    <p className="p-2 text-center text-xs text-muted-foreground">
                      ...dan {parsedRows.length - 50} baris lainnya
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-6 text-center">
              {result.created > 0 || result.updated > 0 ? (
                <CheckCircle2 className="size-12 text-green-600" />
              ) : (
                <AlertCircle className="size-12 text-destructive" />
              )}
              <div>
                <p className="text-lg font-semibold">
                  {result.created > 0 || result.updated > 0
                    ? "Impor selesai"
                    : "Tidak ada data yang berhasil diimpor"}
                </p>
                {(result.created > 0 || result.updated > 0) && (
                  <p className="text-sm text-muted-foreground">
                    {result.created > 0 && `${result.created} karyawan baru ditambahkan`}
                    {result.created > 0 && result.updated > 0 && " · "}
                    {result.updated > 0 && `${result.updated} karyawan diperbarui`}
                  </p>
                )}
                {result.errors.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {result.errors.length} baris mengalami error
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-1 text-sm font-medium text-destructive">
                  Detail Error:
                </p>
                <ul className="space-y-0.5 text-sm text-destructive/80">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!result ? (
            <>
              <Button
                variant="secondary"
                onClick={() => handleClose(false)}
                disabled={importing}
              >
                Batal
              </Button>
              <Button
                onClick={() => void handleImport()}
                disabled={parsedRows.length === 0 || importing}
                className="gap-1.5"
              >
                {importing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Impor {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
