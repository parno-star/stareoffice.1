import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Inbox, Send, Clock, CheckCircle2, AlertCircle, Eye, ChevronRight,
  Flag, FileText, CalendarDays, User, ArrowRightCircle,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface DispositionTabPanelProps {
  onOpenLetter?: (letterId: Id<"letters">, type: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Menunggu",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  read:      { label: "Dibaca",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  completed: { label: "Selesai",    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  rejected:  { label: "Ditolak",    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

type DispositionItem = {
  disposition: {
    _id: string;
    letterId: string;
    fromUserId: string;
    toUserId: string;
    instructions: string;
    status: string;
    dueDate?: string;
    readAt?: string;
    completedAt?: string;
    completionNote?: string;
    _creationTime: number;
  };
  letter: {
    _id: string;
    subject: string;
    letterNumber?: string;
    type: string;
    fromName?: string;
    letterDate: string;
  } | null;
  counterpartName: string;
};

function DispositionCard({
  item,
  direction,
  onOpenLetter,
}: {
  item: DispositionItem;
  direction: "masuk" | "keluar";
  onOpenLetter?: (letterId: Id<"letters">, type: string) => void;
}) {
  const updateDisposition = useMutation(api.letters.updateDisposition);
  const [showComplete, setShowComplete] = useState(false);
  const [completeNote, setCompleteNote] = useState("");
  const [acting, setActing] = useState(false);

  const { disposition, letter, counterpartName } = item;
  const isUnread = direction === "masuk" && !disposition.readAt && disposition.status === "pending";
  const isOverdue = disposition.dueDate && isPast(parseISO(disposition.dueDate)) && disposition.status !== "completed";

  const markRead = async () => {
    if (disposition.readAt) return;
    try {
      await updateDisposition({
        dispositionId: disposition._id as Id<"letterDispositions">,
        markRead: true,
      });
    } catch { /* silent */ }
  };

  const markComplete = async () => {
    if (!completeNote.trim()) { toast.error("Isikan catatan penyelesaian"); return; }
    setActing(true);
    try {
      await updateDisposition({
        dispositionId: disposition._id as Id<"letterDispositions">,
        markRead: true,
        markCompleted: true,
        completionNote: completeNote.trim(),
      });
      toast.success("Disposisi ditandai selesai");
      setShowComplete(false);
      setCompleteNote("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message?: string }).message ?? "Gagal");
      else toast.error("Terjadi kesalahan");
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
        isUnread ? "border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/20" : "border-border bg-card"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {isUnread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-violet-500" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-1">
              {letter?.subject ?? "Surat tidak ditemukan"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {letter?.letterNumber && (
                <span className="text-[11px] text-muted-foreground">{letter.letterNumber}</span>
              )}
              <StatusBadge status={disposition.status} />
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                  <AlertCircle className="size-2.5" /> Terlambat
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {letter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                void markRead();
                onOpenLetter?.(letter._id as Id<"letters">, letter.type);
              }}
            >
              <FileText className="size-3" /> Buka Surat <ChevronRight className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3" />
          {direction === "masuk" ? `Dari: ${counterpartName}` : `Kepada: ${counterpartName}`}
        </span>
        {disposition.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
            <Clock className="size-3" /> Batas: {format(parseISO(disposition.dueDate), "d MMM yyyy", { locale: localeId })}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3" />
          {format(new Date(disposition._creationTime), "d MMM yyyy HH:mm", { locale: localeId })}
        </span>
      </div>

      {/* Instructions */}
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground border-l-2 border-violet-400">
        <p className="font-medium text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
          <ArrowRightCircle className="size-3" /> Instruksi
        </p>
        <p>{disposition.instructions}</p>
      </div>

      {/* Completion note if done */}
      {disposition.completionNote && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs">
          <p className="font-medium text-[10px] text-green-700 dark:text-green-400 mb-1">Catatan Penyelesaian</p>
          <p>{disposition.completionNote}</p>
        </div>
      )}

      {/* Actions (only for incoming + pending) */}
      {direction === "masuk" && disposition.status === "pending" && (
        <div className="flex items-center gap-2">
          {!disposition.readAt && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={markRead}>
              <Eye className="size-3" /> Tandai Dibaca
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1"
            onClick={() => setShowComplete((v) => !v)}
          >
            <CheckCircle2 className="size-3" /> Tandai Selesai
          </Button>
        </div>
      )}

      {/* Complete form */}
      {showComplete && (
        <div className="space-y-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 p-3">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">Catatan Penyelesaian *</p>
          <Textarea
            value={completeNote}
            onChange={(e) => setCompleteNote(e.target.value)}
            placeholder="Jelaskan tindakan yang telah dilakukan..."
            rows={3}
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowComplete(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={acting}
              onClick={markComplete}
            >
              <CheckCircle2 className="size-3" /> Konfirmasi Selesai
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DispositionList({
  direction,
  onOpenLetter,
}: {
  direction: "masuk" | "keluar";
  onOpenLetter?: (letterId: Id<"letters">, type: string) => void;
}) {
  const items = useQuery(api.letters.getMyDispositions, { direction });
  const [filter, setFilter] = useState<"semua" | "pending" | "completed">("semua");

  if (items === undefined) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const filtered = filter === "semua" ? items : items.filter((i) => i.disposition.status === filter);
  const pendingCount = items.filter((i) => i.disposition.status === "pending").length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b flex-wrap">
        {(["semua", "pending", "completed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {f === "semua" ? "Semua" : f === "pending" ? "Menunggu" : "Selesai"}
            {f === "pending" && pendingCount > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                filter === "pending" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
              }`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} disposisi</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {direction === "masuk" ? <Inbox /> : <Send />}
              </EmptyMedia>
              <EmptyTitle>
                {direction === "masuk" ? "Tidak ada disposisi masuk" : "Tidak ada disposisi keluar"}
              </EmptyTitle>
              <EmptyDescription>
                {direction === "masuk"
                  ? "Belum ada disposisi yang diterima untuk akun ini"
                  : "Belum ada disposisi yang dikirimkan dari akun ini"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2 p-3">
            {filtered.map((item) => (
              <DispositionCard
                key={item.disposition._id}
                item={item}
                direction={direction}
                onOpenLetter={onOpenLetter}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DispositionTabPanel({
  onOpenLetter,
}: DispositionTabPanelProps) {
  const unreadCount = useQuery(api.letters.getMyDispositionUnreadCount, {});

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Flag className="size-4 text-violet-600" />
          Disposisi Saya
          {unreadCount !== undefined && unreadCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0.5 bg-violet-600 text-white">{unreadCount} baru</Badge>
          )}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Disposisi masuk dan keluar yang berkaitan dengan akun Anda</p>
      </div>

      <Tabs defaultValue="masuk" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 mb-0 grid w-auto max-w-xs grid-cols-2">
          <TabsTrigger value="masuk" className="gap-1.5 text-xs">
            <Inbox className="size-3.5" /> Disposisi Masuk
            {unreadCount !== undefined && unreadCount > 0 && (
              <span className="ml-0.5 size-4 rounded-full bg-violet-500 text-white text-[9px] font-bold inline-flex items-center justify-center">{unreadCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="keluar" className="gap-1.5 text-xs">
            <Send className="size-3.5" /> Disposisi Keluar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="masuk" className="flex-1 overflow-hidden mt-2">
          <DispositionList direction="masuk" onOpenLetter={onOpenLetter} />
        </TabsContent>
        <TabsContent value="keluar" className="flex-1 overflow-hidden mt-2">
          <DispositionList direction="keluar" onOpenLetter={onOpenLetter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
