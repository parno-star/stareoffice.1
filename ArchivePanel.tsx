import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Archive, Search, Download, Send, ArrowLeftRight, FileText, Inbox, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { LetterTypeBadge, LetterStatusBadge } from "./LetterStatusBadge.tsx";

type ArchivedLetter = Doc<"letters"> & { archiveUrl: string | null };

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Semua Jenis" },
  { value: "keluar", label: "Surat Keluar" },
  { value: "memo", label: "Nota" },
  { value: "masuk", label: "Surat Masuk" },
];

function typeIcon(type: string) {
  if (type === "masuk") return <Inbox className="size-4 text-teal-600" />;
  if (type === "keluar") return <Send className="size-4 text-blue-600" />;
  if (type === "memo") return <FileText className="size-4 text-violet-600" />;
  return <ArrowLeftRight className="size-4 text-orange-600" />;
}

function downloadArchive(letter: ArchivedLetter) {
  if (!letter.archiveUrl) {
    toast.error("Arsip PDF belum tersedia untuk surat ini.");
    return;
  }
  const a = document.createElement("a");
  a.href = letter.archiveUrl;
  a.download = letter.archivePdfName ?? `${letter.subject}.pdf`;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}

export default function ArchivePanel({
  onOpenLetter,
}: {
  onOpenLetter: (letterId: Id<"letters">, type: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { results, status, loadMore } = usePaginatedQuery(
    api.letters.listArchivedLetters,
    {
      type: typeFilter === "all" ? undefined : typeFilter,
      search: search.trim() || undefined,
    },
    { initialNumItems: 30 },
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
          <Archive className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Arsip Surat</h2>
          <p className="text-xs text-muted-foreground">
            Semua surat yang sudah dikirim/difinalkan beserta salinan PDF permanennya.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari perihal surat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {results === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Archive />
              </EmptyMedia>
              <EmptyTitle>Belum ada surat di arsip</EmptyTitle>
              <EmptyDescription>
                Surat yang sudah dikirim atau difinalkan akan muncul di sini beserta salinan PDF-nya.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {results.map((letter: ArchivedLetter) => (
              <div
                key={letter._id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
              >
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {typeIcon(letter.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{letter.subject}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {format(new Date(letter.letterDate), "d MMM yyyy", { locale: localeId })}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {letter.type === "masuk" ? `Dari: ${letter.fromName}` : `Kepada: ${letter.toName}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <LetterTypeBadge type={letter.type} />
                    <LetterStatusBadge status={letter.status} />
                    {letter.letterNumber && (
                      <Badge variant="outline" className="text-[10px]">{letter.letterNumber}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => onOpenLetter(letter._id, letter.type)}
                    title="Lihat detail surat"
                  >
                    <Eye className="size-4" />
                    <span className="hidden sm:inline">Detail</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    disabled={!letter.archiveUrl}
                    onClick={() => downloadArchive(letter)}
                    title="Unduh Arsip PDF"
                  >
                    <Download className="size-4" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
              </div>
            ))}
            {status === "CanLoadMore" && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  className="w-full"
                  size="sm"
                  onClick={() => loadMore(30)}
                >
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
