import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  ChevronDown,
  Train,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

const STATUS_CONFIG = {
  aman: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    label: "Aman",
  },
  mendekati_batas: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    label: "Mendekati Batas",
  },
  overload: {
    icon: XCircle,
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    label: "Tidak Memenuhi",
  },
} as const;

type OverallStatus = keyof typeof STATUS_CONFIG;

export default function HistoryList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.trackCalculations.listMy,
    {},
    { initialNumItems: 20 }
  );
  const removeCalc = useMutation(api.trackCalculations.remove);
  const navigate = useNavigate();

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Calculator />
          </EmptyMedia>
          <EmptyTitle>Belum ada riwayat perhitungan</EmptyTitle>
          <EmptyDescription>
            Gunakan kalkulator untuk menghitung kelas jalan rel, lalu simpan hasilnya
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" className="cursor-pointer" onClick={() => navigate("/track-calculator")}>
            Buka Kalkulator
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((calc) => (
        <HistoryCard key={calc._id} calc={calc} onDelete={async () => {
          try {
            await removeCalc({ id: calc._id });
            toast.success("Data berhasil dihapus");
          } catch {
            toast.error("Gagal menghapus data");
          }
        }} />
      ))}
      {status === "CanLoadMore" && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            size="sm"
            className="cursor-pointer gap-1.5"
            onClick={() => loadMore(20)}
          >
            <ChevronDown className="size-4" />
            Muat Lebih Banyak
          </Button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  calc,
  onDelete,
}: {
  calc: Doc<"trackCalculations">;
  onDelete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const sc = STATUS_CONFIG[calc.overallStatus as OverallStatus] ?? STATUS_CONFIG.aman;
  const StatusIcon = sc.icon;

  const date = new Date(calc.calculatedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => setExpanded((e) => !e)}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", sc.bg)}>
            <StatusIcon className={cn("size-5", sc.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{calc.segmentName}</p>
                <p className="text-xs text-muted-foreground">
                  STA {calc.staStart} - {calc.staEnd} | Sepur {calc.input.infrastructure.gauge} mm
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", sc.bg, sc.text)}>
                {sc.label}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{calc.trackClassLabel}</span>
              <span>TQI: {calc.tqi}</span>
              <span>MGT: {calc.mgt.toFixed(1)}</span>
              <span>V maks: {calc.effectiveMaxSpeed} km/jam</span>
              {calc.issueCount > 0 && (
                <span className="text-red-600">{calc.issueCount} temuan</span>
              )}
            </div>

            <p className="mt-1 text-[11px] text-muted-foreground">{date}</p>

            {calc.note && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Catatan: {calc.note}
              </p>
            )}

            {expanded && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailBlock label="Data Operasi">
                    <p>Beban gandar: {calc.input.operation.axleLoad} ton</p>
                    <p>Kecepatan rencana: {calc.input.operation.designSpeed} km/jam</p>
                    <p>Frekuensi KA: {calc.input.operation.trainFrequency}/hari</p>
                    <p>Tp: {calc.input.operation.passengerTonnageDaily} ton/hari</p>
                    <p>Tb: {calc.input.operation.freightTonnageDaily} ton/hari</p>
                    <p>T1: {calc.input.operation.locomotiveTonnageDaily} ton/hari</p>
                  </DetailBlock>
                  <DetailBlock label="Infrastruktur">
                    <p>Rel: {calc.input.infrastructure.railType}</p>
                    <p>Bantalan: {calc.input.infrastructure.sleeperType}</p>
                    <p>Balas: {calc.input.infrastructure.ballastThickness} cm</p>
                    <p>Subgrade: {calc.input.infrastructure.subgrade}</p>
                  </DetailBlock>
                  <DetailBlock label="Geometri (SD)">
                    <p>Alignment: {calc.input.geometry.sdAlignment} mm</p>
                    <p>Level: {calc.input.geometry.sdLevel} mm</p>
                    <p>Gauge: {calc.input.geometry.sdGauge} mm</p>
                    <p>Twist: {calc.input.geometry.sdTwist} mm</p>
                  </DetailBlock>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer gap-1.5 text-destructive hover:text-destructive"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setDeleting(true);
                      await onDelete();
                      setDeleting(false);
                    }}
                    disabled={deleting}
                  >
                    <Trash2 className="size-3.5" />
                    {deleting ? "Menghapus..." : "Hapus"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      <div className="space-y-0.5 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}
