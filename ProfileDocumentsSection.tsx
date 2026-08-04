import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Download,
  ExternalLink,
  FileText,
  FolderLock,
  Info,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import type { EmployeeDocumentWithMeta } from "@/convex/employeeDocuments.ts";
import {
  formatFileSize,
  formatIsoDate,
  getCategoryConfig,
  getExpiryStatus,
} from "@/pages/my-documents/_lib/utils.ts";

type Props = {
  userId: Id<"users">;
};

// Read-only documents view for the employee's own profile. Employees can open
// and download documents HR has attached (SK/Kontrak and other categories) but
// cannot upload or delete here — uploads are managed by HR via "Dokumen Saya".
export default function ProfileDocumentsSection({ userId }: Props) {
  const documents = useQuery(api.employeeDocuments.listForUser, { userId });

  if (documents === undefined) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Group documents by category for a tidy, sectioned layout.
  const byCategory = new Map<string, Array<EmployeeDocumentWithMeta>>();
  for (const doc of documents) {
    const list = byCategory.get(doc.category) ?? [];
    list.push(doc);
    byCategory.set(doc.category, list);
  }
  // Order categories: contract (SK/Kontrak) first, then the rest as they appear.
  const orderedCategories = Array.from(byCategory.keys()).sort((a, b) => {
    if (a === "contract") return -1;
    if (b === "contract") return 1;
    return 0;
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderLock className="mr-1 inline size-3" />
            Dokumen Saya
          </h2>
          <p className="text-xs text-muted-foreground">
            SK, kontrak, sertifikat, dan dokumen resmi lain yang dilampirkan HR.
          </p>
        </div>

        {documents.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Belum ada dokumen</EmptyTitle>
              <EmptyDescription>
                HR belum melampirkan dokumen apa pun untuk Anda.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-5">
            {orderedCategories.map((category) => {
              const config = getCategoryConfig(category);
              const CatIcon = config.icon;
              const docs = byCategory.get(category) ?? [];
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-md ${config.tint}`}
                    >
                      <CatIcon className="size-3.5" />
                    </span>
                    <h3 className="text-xs font-semibold">{config.label}</h3>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {docs.length}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {docs.map((doc) => (
                      <DocumentRow key={doc._id} doc={doc} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Dokumen di sini dikelola oleh HR. Jika ada dokumen yang perlu
          diperbarui atau ditambahkan, silakan hubungi HR.
        </p>
      </CardContent>
    </Card>
  );
}

function DocumentRow({ doc }: { doc: EmployeeDocumentWithMeta }) {
  const expiryStatus = getExpiryStatus(doc.expiryDate);
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
        <FileText className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">
            {doc.fileName} &middot; {formatFileSize(doc.fileSize)}
          </span>
          {doc.issueDate ? (
            <span>Terbit: {formatIsoDate(doc.issueDate)}</span>
          ) : null}
          {doc.expiryDate ? (
            <span
              className={
                expiryStatus === "expired"
                  ? "text-red-600 dark:text-red-400"
                  : expiryStatus === "soon"
                    ? "text-amber-600 dark:text-amber-400"
                    : undefined
              }
            >
              Berakhir: {formatIsoDate(doc.expiryDate)}
            </span>
          ) : null}
          {expiryStatus === "expired" ? (
            <Badge
              variant="secondary"
              className="h-4 gap-0.5 bg-red-500/10 px-1.5 text-[10px] text-red-700 dark:text-red-300"
            >
              <AlertTriangle className="size-2.5" />
              Kadaluarsa
            </Badge>
          ) : null}
          {expiryStatus === "soon" ? (
            <Badge
              variant="secondary"
              className="h-4 gap-0.5 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
            >
              <CalendarClock className="size-2.5" />
              Segera berakhir
            </Badge>
          ) : null}
        </div>
      </div>
      {doc.url ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button type="button" size="sm" className="cursor-pointer gap-1.5" asChild>
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              <span className="hidden sm:inline">Buka</span>
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            asChild
            aria-label="Unduh dokumen"
          >
            <a href={doc.url} download={doc.fileName}>
              <Download className="size-4" />
            </a>
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          Tidak tersedia
        </span>
      )}
    </li>
  );
}
