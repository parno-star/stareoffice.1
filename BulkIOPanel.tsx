import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  Building2,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileJson,
  ClipboardList,
  Layers,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

type ImportKind = "employees" | "departments" | "skills";

const KIND_META: Record<
  ImportKind,
  { title: string; description: string; icon: typeof Users; headers: Array<string>; sample: Array<Array<string>>; required: Array<string> }
> = {
  employees: {
    title: "Karyawan",
    description:
      "Perbarui data karyawan secara massal. Pencocokan memakai kolom email.",
    icon: Users,
    headers: [
      "email",
      "name",
      "department",
      "jobTitle",
      "phone",
      "location",
      "managerEmail",
      "startDate",
      "birthday",
    ],
    sample: [
      [
        "john@example.com",
        "John Doe",
        "Engineering",
        "Software Engineer",
        "0812xxx",
        "Jakarta",
        "manager@example.com",
        "2023-01-10",
        "06-15",
      ],
    ],
    required: ["email"],
  },
  departments: {
    title: "Departemen",
    description:
      "Tambah atau perbarui departemen resmi. Nama departemen bersifat unik.",
    icon: Building2,
    headers: ["name", "description", "color", "icon", "headEmail", "parentName"],
    sample: [
      ["Engineering", "Tim rekayasa", "blue", "⚙️", "cto@example.com", ""],
      ["Frontend", "Web & mobile", "sky", "🎨", "lead@example.com", "Engineering"],
    ],
    required: ["name"],
  },
  skills: {
    title: "Keahlian",
    description:
      "Impor matriks keahlian per karyawan. Gabungan email + skill akan diperbarui jika sudah ada.",
    icon: Sparkles,
    headers: ["email", "skill", "category", "level", "yearsExperience", "note"],
    sample: [
      ["john@example.com", "React", "technical", "4", "3", "Pengalaman produksi"],
      ["john@example.com", "Public Speaking", "soft", "3", "", ""],
    ],
    required: ["email", "skill", "level"],
  },
};

type ParsedRow = Record<string, string>;

function parseCsv(text: string): { headers: Array<string>; rows: Array<ParsedRow> } {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: , ; or \t
  const first = lines[0];
  let delimiter = ",";
  if (first.includes("\t")) delimiter = "\t";
  else if (first.split(";").length > first.split(",").length) delimiter = ";";

  const splitLine = (line: string): Array<string> => {
    const out: Array<string> = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === delimiter && !quoted) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map((v) => v.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows: Array<ParsedRow> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitLine(lines[i]);
    const row: ParsedRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set<string>()),
  );
  const escape = (val: unknown) => {
    const s = val == null ? "" : String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n");
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ImportSection({
  isAdmin,
  kind,
  onSuccess,
}: {
  isAdmin: boolean;
  kind: ImportKind;
  onSuccess: () => void;
}) {
  const meta = KIND_META[kind];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    headers: Array<string>;
    rows: Array<ParsedRow>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom directory fields (e.g. NIP) — only relevant for the employees import
  const customFieldDefs = useQuery(api.directoryFields.list, {});
  const customDefs = useMemo<Array<Doc<"directoryFields">>>(
    () => (kind === "employees" ? (customFieldDefs ?? []) : []),
    [kind, customFieldDefs],
  );

  // Effective headers shown/accepted = base headers + one column per custom field label
  const effectiveHeaders = useMemo(
    () => [...meta.headers, ...customDefs.map((d) => d.label)],
    [meta.headers, customDefs],
  );

  // Lookup from lowercased custom field label -> definition (for parsing imports)
  const customByLabel = useMemo(() => {
    const map: Record<string, Doc<"directoryFields">> = {};
    for (const d of customDefs) map[d.label.trim().toLowerCase()] = d;
    return map;
  }, [customDefs]);

  const applyEmployee = useMutation(api.orgAdvanced.bulkIO.applyEmployeeImport);
  const applyDepartment = useMutation(
    api.orgAdvanced.bulkIO.applyDepartmentImport,
  );
  const applySkills = useMutation(api.orgAdvanced.bulkIO.applySkillsImport);

  // Live preview for employees (matched vs unmatched)
  const employeeRows = useMemo(() => {
    if (kind !== "employees" || !parsed) return [];
    return parsed.rows.map((r) => {
      // Pull custom field values out of the parsed row by matching column labels
      const customValues: Record<string, string> = {};
      for (const [label, def] of Object.entries(customByLabel)) {
        const raw = r[def.label] ?? r[label];
        if (raw !== undefined && String(raw).trim() !== "") {
          customValues[def._id] = String(raw).trim();
        }
      }
      return {
        email: r.email ?? "",
        name: r.name,
        department: r.department,
        jobTitle: r.jobTitle,
        phone: r.phone,
        location: r.location,
        managerEmail: r.managerEmail,
        startDate: r.startDate,
        birthday: r.birthday,
        ...(Object.keys(customValues).length > 0
          ? { customFields: customValues }
          : {}),
      };
    });
  }, [kind, parsed, customByLabel]);

  const preview = useQuery(
    api.orgAdvanced.bulkIO.previewEmployeeImport,
    kind === "employees" && parsed && employeeRows.length > 0
      ? { rows: employeeRows }
      : "skip",
  );

  const handleSelectFile = async (file: File) => {
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = parseCsv(text);
      const missing = meta.required.filter((h) => !result.headers.includes(h));
      if (missing.length > 0) {
        toast.error(
          `Kolom wajib tidak ditemukan: ${missing.join(", ")}`,
        );
        setParsed(null);
        return;
      }
      setParsed(result);
      toast.success(`Terbaca ${result.rows.length} baris dari ${file.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Gagal membaca file");
    }
  };

  const handleApply = async () => {
    if (!parsed || parsed.rows.length === 0 || !isAdmin) return;
    setSubmitting(true);
    try {
      if (kind === "employees") {
        const rows = employeeRows;
        const result = await applyEmployee({ rows });
        toast.success(
          `${result.updated} diperbarui · ${result.skipped} dilewati · ${result.failures} gagal`,
        );
      } else if (kind === "departments") {
        const rows = parsed.rows.map((r) => ({
          name: r.name ?? "",
          description: r.description,
          color: r.color,
          icon: r.icon,
          headEmail: r.headEmail,
          parentName: r.parentName,
        }));
        const result = await applyDepartment({ rows });
        toast.success(
          `${result.created} dibuat · ${result.updated} diperbarui · ${result.skipped} dilewati`,
        );
      } else {
        const rows = parsed.rows
          .filter((r) => r.email && r.skill && r.level)
          .map((r) => ({
            email: r.email,
            skill: r.skill,
            category: r.category,
            level: Number(r.level || "1"),
            yearsExperience: r.yearsExperience
              ? Number(r.yearsExperience)
              : undefined,
            note: r.note,
          }));
        const result = await applySkills({ rows });
        toast.success(
          `${result.created} dibuat · ${result.updated} diperbarui · ${result.skipped} dilewati`,
        );
      }
      setParsed(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      onSuccess();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses impor");
      } else {
        toast.error("Gagal memproses impor");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplate = () => {
    const sampleRows = meta.sample.map((row) => {
      // Append an example value for each custom field column
      const customExamples = customDefs.map((d) => {
        if (d.type === "date") return "2024-01-01";
        if (d.type === "number") return "123456";
        if (d.type === "select") {
          const first = (d.options ?? "").split(",")[0]?.trim();
          return first ?? "";
        }
        return "Contoh";
      });
      return [...row, ...customExamples];
    });
    const escapeCell = (val: string) =>
      /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
    const content = [
      effectiveHeaders.map(escapeCell).join(","),
      ...sampleRows.map((row) => row.map(escapeCell).join(",")),
    ].join("\n");
    downloadText(`template-${kind}.csv`, content, "text/csv");
  };

  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{meta.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {meta.description}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleTemplate}
          >
            <FileSpreadsheet className="size-4" />
            Unduh Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Kolom yang diterima
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.headers.map((h) => (
                <Badge
                  key={h}
                  variant="secondary"
                  className={cn(
                    "font-mono text-[11px]",
                    meta.required.includes(h) &&
                      "bg-primary/10 text-primary border border-primary/30",
                  )}
                >
                  {h}
                  {meta.required.includes(h) ? "*" : ""}
                </Badge>
              ))}
              {customDefs.map((d) => (
                <Badge
                  key={d._id}
                  variant="secondary"
                  className="font-mono text-[11px] border border-dashed"
                >
                  {d.label}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSelectFile(file);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={!isAdmin}
              >
                <Upload className="size-4" />
                Pilih file CSV
              </Button>
              {fileName ? (
                <span className="text-xs text-muted-foreground">
                  {fileName} · {parsed?.rows.length ?? 0} baris
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Belum ada file dipilih
                </span>
              )}
            </div>
          </div>

          {kind === "employees" && preview ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-500/5 p-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Akan diperbarui
                </p>
                <p className="text-xl font-bold">{preview.matched}</p>
              </div>
              <div className="rounded-lg border bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Tidak ditemukan
                </p>
                <p className="text-xl font-bold">{preview.unmatched}</p>
              </div>
              <div className="rounded-lg border bg-rose-500/5 p-3">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  Baris bermasalah
                </p>
                <p className="text-xl font-bold">{preview.errors}</p>
              </div>
            </div>
          ) : null}

          {kind === "employees" && preview && preview.preview.length > 0 ? (
            <div className="max-h-[360px] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 100).map((p) => (
                    <tr key={p.rowIndex} className="border-t">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {p.rowIndex + 1}
                      </td>
                      <td className="px-3 py-2 font-mono">{p.email}</td>
                      <td className="px-3 py-2">
                        {p.status === "match" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            {p.changes.length > 0
                              ? `${p.changes.length} perubahan`
                              : "Tanpa perubahan"}
                          </span>
                        ) : p.status === "no_match" ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="size-3.5" />
                            Tidak ditemukan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                            <AlertCircle className="size-3.5" />
                            {p.message ?? "Error"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.changes.length === 0
                          ? "—"
                          : p.changes
                              .map(
                                (c) =>
                                  `${c.field}: ${c.from || "—"} → ${c.to || "—"}`,
                              )
                              .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.preview.length > 100 ? (
                <div className="border-t bg-muted/30 p-2 text-center text-xs text-muted-foreground">
                  Menampilkan 100 dari {preview.preview.length} baris
                </div>
              ) : null}
            </div>
          ) : null}

          {parsed && kind !== "employees" ? (
            <div className="max-h-[320px] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    {meta.headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      {meta.headers.map((h) => (
                        <td key={h} className="px-3 py-2 whitespace-nowrap">
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 100 ? (
                <div className="border-t bg-muted/30 p-2 text-center text-xs text-muted-foreground">
                  Menampilkan 100 dari {parsed.rows.length} baris
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            {parsed ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParsed(null);
                  setFileName(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                disabled={submitting}
              >
                Batal
              </Button>
            ) : null}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!parsed || parsed.rows.length === 0 || submitting || !isAdmin}
              onClick={() => void handleApply()}
            >
              <Upload className="size-4" />
              {submitting ? "Memproses..." : "Terapkan Impor"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExportSection() {
  const employees = useQuery(api.orgAdvanced.bulkIO.exportEmployees, {});
  const departments = useQuery(api.orgAdvanced.bulkIO.exportDepartments, {});
  const teams = useQuery(api.orgAdvanced.bulkIO.exportTeams, {});
  const skills = useQuery(api.orgAdvanced.bulkIO.exportSkills, {});
  const succession = useQuery(api.orgAdvanced.bulkIO.exportSuccessionPlans, {});
  const orgTree = useQuery(api.orgAdvanced.bulkIO.exportOrgTree, {});

  const today = new Date().toISOString().slice(0, 10);

  const handleDownloadCsv = (
    name: string,
    rows: Array<Record<string, unknown>> | undefined,
  ) => {
    if (!rows || rows.length === 0) {
      toast.info("Tidak ada data untuk diekspor");
      return;
    }
    downloadText(`${name}-${today}.csv`, toCsv(rows), "text/csv");
    toast.success(`${name}.csv diunduh`);
  };

  const handleDownloadJson = (
    name: string,
    data: unknown,
  ) => {
    downloadText(
      `${name}-${today}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast.success(`${name}.json diunduh`);
  };

  const cards: Array<{
    title: string;
    description: string;
    icon: typeof Users;
    count: number | undefined;
    onCsv: () => void;
    onJson: () => void;
  }> = [
    {
      title: "Karyawan",
      description: "Data profil, jabatan, dan atasan setiap karyawan.",
      icon: Users,
      count: employees?.length,
      onCsv: () => handleDownloadCsv("karyawan", employees),
      onJson: () => handleDownloadJson("karyawan", employees ?? []),
    },
    {
      title: "Departemen",
      description: "Departemen resmi beserta kepala & struktur parent.",
      icon: Building2,
      count: departments?.length,
      onCsv: () => handleDownloadCsv("departemen", departments),
      onJson: () => handleDownloadJson("departemen", departments ?? []),
    },
    {
      title: "Tim",
      description: "Tim lintas departemen dengan anggota & team lead.",
      icon: Layers,
      count: teams?.length,
      onCsv: () => handleDownloadCsv("tim", teams),
      onJson: () => handleDownloadJson("tim", teams ?? []),
    },
    {
      title: "Keahlian",
      description: "Matriks keahlian per karyawan beserta level.",
      icon: Sparkles,
      count: skills?.length,
      onCsv: () => handleDownloadCsv("keahlian", skills),
      onJson: () => handleDownloadJson("keahlian", skills ?? []),
    },
    {
      title: "Rencana Suksesi",
      description: "Daftar kandidat untuk setiap posisi kunci.",
      icon: Target,
      count: succession?.length,
      onCsv: () => handleDownloadCsv("suksesi", succession),
      onJson: () => handleDownloadJson("suksesi", succession ?? []),
    },
    {
      title: "Pohon Organisasi",
      description:
        "Struktur hierarki lengkap dalam bentuk JSON bertingkat (nested).",
      icon: FileJson,
      count: undefined,
      onCsv: () => {
        if (!orgTree) return;
        toast.info("Pohon organisasi hanya tersedia sebagai JSON");
      },
      onJson: () => {
        if (!orgTree) {
          toast.info("Data pohon organisasi belum siap");
          return;
        }
        downloadText(`pohon-organisasi-${today}.json`, orgTree, "application/json");
        toast.success("pohon-organisasi.json diunduh");
      },
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const isTree = c.title === "Pohon Organisasi";
        return (
          <Card key={c.title} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{c.title}</p>
                    {c.count !== undefined ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {c.count}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-end gap-2">
                {!isTree ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={c.onCsv}
                  >
                    <FileSpreadsheet className="size-4" />
                    CSV
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={c.onJson}
                >
                  <FileJson className="size-4" />
                  JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function BulkIOPanel({
  isAdmin,
  onRefresh,
}: {
  isAdmin: boolean;
  onRefresh?: () => void;
}) {
  const [activeKind, setActiveKind] = useState<ImportKind>("employees");

  // Combined download / quick-export dropdown at top of panel
  const employees = useQuery(
    api.orgAdvanced.bulkIO.exportEmployees,
    isAdmin ? {} : "skip",
  );
  const departments = useQuery(
    api.orgAdvanced.bulkIO.exportDepartments,
    isAdmin ? {} : "skip",
  );

  if (!isAdmin) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Akses terbatas</EmptyTitle>
          <EmptyDescription>
            Hanya admin yang dapat mengimpor atau mengekspor data organisasi
            secara massal.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Import massal &amp; export lanjutan</p>
              <p className="text-xs text-muted-foreground">
                Unggah CSV untuk memperbarui banyak baris sekaligus, atau
                ekspor data untuk laporan eksternal.
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Download className="size-4" />
                Ekspor Cepat
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Ekspor cepat ke CSV</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => {
                  if (!employees || employees.length === 0) {
                    toast.info("Data karyawan masih kosong");
                    return;
                  }
                  downloadText(
                    `karyawan-${new Date().toISOString().slice(0, 10)}.csv`,
                    toCsv(employees),
                    "text/csv",
                  );
                  toast.success("karyawan.csv diunduh");
                }}
              >
                <Users className="size-4" />
                Daftar Karyawan
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => {
                  if (!departments || departments.length === 0) {
                    toast.info("Belum ada departemen");
                    return;
                  }
                  downloadText(
                    `departemen-${new Date().toISOString().slice(0, 10)}.csv`,
                    toCsv(departments),
                    "text/csv",
                  );
                  toast.success("departemen.csv diunduh");
                }}
              >
                <Building2 className="size-4" />
                Departemen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="size-4" />
            Import CSV
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="size-4" />
            Export lanjutan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Jenis data:
            </p>
            <Select
              value={activeKind}
              onValueChange={(v) => setActiveKind(v as ImportKind)}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employees">Karyawan</SelectItem>
                <SelectItem value="departments">Departemen</SelectItem>
                <SelectItem value="skills">Keahlian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ImportSection
            isAdmin={isAdmin}
            kind={activeKind}
            onSuccess={() => onRefresh?.()}
          />
        </TabsContent>

        <TabsContent value="export">
          <ExportSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
