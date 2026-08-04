import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  colorForDepartment,
  COLOR_CLASSES,
  getInitials,
} from "../_lib/directory-utils.ts";
import { formatIsoFullDate } from "@/pages/celebrations/_lib/celebrations-utils.ts";
import EmployeeActionsMenu from "./EmployeeActionsMenu.tsx";
import { computeCompleteness } from "../_lib/directory-completeness.ts";
import { IncompleteBadge } from "./CompletenessIndicators.tsx";
import {
  buildOrderedColumns,
  builtInValue,
  computeAge,
  computeTenure,
  filterColumnsForViewer,
  formatNumberValue,
  isMasaKerjaLabel,
  isSkNumberLabel,
  isUsiaLabel,
  type OrderedColumn,
} from "../_lib/directory-columns.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { FileText } from "lucide-react";
import SkDocumentsViewer from "./SkDocumentsViewer.tsx";

// Render a single cell's value for a column, given a directory entry.
function cellContent(
  col: OrderedColumn,
  entry: DirectoryEntry,
  skOwners: Set<Id<"users">>,
  onOpenSk: (id: Id<"users">) => void,
): React.ReactNode {
  const tone = COLOR_CLASSES[colorForDepartment(entry.user.department)];

  if (col.kind === "builtin") {
    const key = col.builtin.key;
    // "Nama" is rendered specially (avatar + link) by the caller.
    if (key === "department") {
      return entry.user.department ? (
        <Badge variant="secondary" className={`${tone.chip} border-transparent`}>
          {entry.user.department}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    const raw = builtInValue(entry.user, key, entry.managerName);
    if (!raw) return <span className="text-muted-foreground">—</span>;
    if (col.builtin.type === "date") return formatIsoFullDate(raw);
    return raw;
  }

  // Custom field
  // "Masa Kerja" is always computed live from the start date, never stored.
  if (isMasaKerjaLabel(col.custom.label)) {
    const tenure = computeTenure(entry.user.startDate);
    return tenure ? tenure : <span className="text-muted-foreground">—</span>;
  }
  // "Usia" is always computed live from the date of birth, never stored.
  if (isUsiaLabel(col.custom.label)) {
    const age = computeAge(entry.user.dateOfBirth);
    return age ? age : <span className="text-muted-foreground">—</span>;
  }
  const raw = (entry.user.customFields ?? {})[col.custom._id];

  // "No. SK/Kontrak" column: when the employee has SK PDFs attached, render the
  // number (or a fallback label) as a link that opens the document viewer.
  if (isSkNumberLabel(col.custom.label)) {
    const hasDocs = skOwners.has(entry.user._id);
    if (!hasDocs) {
      return raw ? (
        <span>{raw}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpenSk(entry.user._id)}
        className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-primary hover:underline"
      >
        <FileText className="size-3.5 shrink-0" />
        {raw ? raw : "Lihat dokumen"}
      </button>
    );
  }

  if (!raw) return <span className="text-muted-foreground">—</span>;
  if (col.custom.type === "date") return formatIsoFullDate(raw);
  if (col.custom.type === "number") return formatNumberValue(raw);
  return raw;
}

export default function DirectoryTableView({
  entries,
  onSelect,
  currentUserId,
  canManage,
  customFieldDefs,
  columnOrder,
}: {
  entries: Array<DirectoryEntry>;
  onSelect: (id: Id<"users">) => void;
  currentUserId?: Id<"users"> | null;
  canManage?: boolean;
  customFieldDefs?: Array<Doc<"directoryFields">>;
  columnOrder?: Array<string>;
}) {
  const orderedColumns = filterColumnsForViewer(
    buildOrderedColumns(customFieldDefs ?? [], columnOrder ?? []),
    Boolean(canManage),
  );

  // Employees (visible to the caller) that have SK/Kontrak PDFs attached.
  const skOwnerList = useQuery(api.employeeDocuments.skOwnerIds, {});
  const skOwners = useMemo(
    () => new Set<Id<"users">>(skOwnerList ?? []),
    [skOwnerList],
  );
  const [skViewerUserId, setSkViewerUserId] = useState<Id<"users"> | null>(
    null,
  );

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // Clamp the current page whenever the list shrinks (e.g. after filtering).
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = useMemo(
    () => entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [entries, safePage],
  );
  const firstRow = entries.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const lastRow = Math.min(entries.length, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card className="overflow-hidden p-0">
      <Table containerClassName="always-scrollbar">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {orderedColumns.map((col) => (
              <TableHead
                key={col.token}
                className={
                  col.kind === "builtin" && col.builtin.key === "no"
                    ? "w-12 text-center whitespace-nowrap"
                    : "whitespace-nowrap"
                }
              >
                {col.kind === "builtin" ? col.builtin.label : col.custom.label}
              </TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageEntries.map((entry, index) => {
            const tone = COLOR_CLASSES[colorForDepartment(entry.user.department)];
            const isSelf = currentUserId === entry.user._id;
            const rowNumber = safePage * PAGE_SIZE + index + 1;
            return (
              <TableRow key={entry.user._id}>
                {orderedColumns.map((col) => {
                  // "No." column
                  if (col.kind === "builtin" && col.builtin.key === "no") {
                    return (
                      <TableCell
                        key={col.token}
                        className="text-center text-muted-foreground"
                      >
                        {rowNumber}
                      </TableCell>
                    );
                  }
                  // "Nama" column (avatar + clickable name)
                  if (col.kind === "builtin" && col.builtin.key === "nama") {
                    const showCompleteness = canManage || isSelf;
                    const completeness = computeCompleteness(
                      entry.user,
                      customFieldDefs ?? [],
                    );
                    return (
                      <TableCell key={col.token} className="whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 shrink-0">
                            {entry.user.avatarUrl ? (
                              <AvatarImage
                                src={entry.user.avatarUrl}
                                alt={entry.user.name ?? ""}
                              />
                            ) : null}
                            <AvatarFallback className={`${tone.chip} text-xs font-semibold`}>
                              {getInitials(entry.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <button
                            onClick={() => onSelect(entry.user._id)}
                            className="cursor-pointer text-left font-medium hover:text-primary hover:underline"
                          >
                            {entry.user.name ?? "Tanpa Nama"}
                          </button>
                          {showCompleteness ? (
                            <IncompleteBadge result={completeness} />
                          ) : null}
                        </div>
                      </TableCell>
                    );
                  }
                  // All other columns
                  return (
                    <TableCell
                      key={col.token}
                      className="text-muted-foreground whitespace-nowrap"
                    >
                      {cellContent(col, entry, skOwners, setSkViewerUserId)}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onSelect(entry.user._id)}
                      aria-label="Buka profil"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                    {canManage ? (
                      <EmployeeActionsMenu
                        employee={entry.user}
                        canDelete={!isSelf}
                      />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {entries.length > PAGE_SIZE ? (
        <div className="flex flex-col items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Menampilkan{" "}
            <span className="font-medium text-foreground">{firstRow}</span>–
            <span className="font-medium text-foreground">{lastRow}</span> dari{" "}
            <span className="font-medium text-foreground">{entries.length}</span>{" "}
            karyawan
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <span className="px-1 text-sm text-muted-foreground">
              Hal. {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Berikutnya
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
      {skViewerUserId ? (
        <SkDocumentsViewer
          userId={skViewerUserId}
          open={skViewerUserId !== null}
          onOpenChange={(next) => {
            if (!next) setSkViewerUserId(null);
          }}
        />
      ) : null}
    </Card>
  );
}
