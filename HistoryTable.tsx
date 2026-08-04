import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { CalendarX } from "lucide-react";
import {
  getMonthRange,
  formatClock,
  formatDateId,
  formatMinutes,
} from "../_lib/utils.ts";

export default function HistoryTable() {
  const range = getMonthRange();
  const records = useQuery(api.attendance.listMyHistory, {
    startDate: range.start,
    endDate: range.end,
  });

  if (records === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (records.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX />
          </EmptyMedia>
          <EmptyTitle>Belum ada riwayat</EmptyTitle>
          <EmptyDescription>
            Riwayat absensi Anda untuk bulan ini akan muncul di sini setelah
            Anda clock-in.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Clock-in</TableHead>
            <TableHead>Clock-out</TableHead>
            <TableHead>Durasi</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r._id}>
              <TableCell className="font-medium">
                {formatDateId(r.date)}
              </TableCell>
              <TableCell className="font-mono">
                {formatClock(r.clockInAt)}
              </TableCell>
              <TableCell className="font-mono">
                {formatClock(r.clockOutAt)}
              </TableCell>
              <TableCell>{formatMinutes(r.workMinutes)}</TableCell>
              <TableCell>
                {r.isLate ? (
                  <Badge variant="destructive">Terlambat</Badge>
                ) : r.clockOutAt ? (
                  <Badge variant="secondary">Selesai</Badge>
                ) : (
                  <Badge>Aktif</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
