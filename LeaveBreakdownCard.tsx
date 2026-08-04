import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

type Item = {
  type: string;
  approved: number;
  pending: number;
  rejected: number;
  totalDays: number;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Tahunan",
  sick: "Sakit",
  personal: "Pribadi",
  maternity: "Melahirkan",
  other: "Lainnya",
};

const chartConfig = {
  approved: { label: "Disetujui", color: "var(--chart-1)" },
  pending: { label: "Menunggu", color: "var(--chart-4)" },
  rejected: { label: "Ditolak", color: "var(--chart-5)" },
} satisfies ChartConfig;

export default function LeaveBreakdownCard({
  items,
}: {
  items: Array<Item>;
}) {
  const data = items.map((i) => ({
    ...i,
    label: LEAVE_TYPE_LABELS[i.type] ?? i.type,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cuti per Kategori</CardTitle>
        <p className="text-xs text-muted-foreground">
          Jumlah pengajuan cuti berdasarkan status dan jenis.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data cuti.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="approved"
                fill="var(--chart-1)"
                radius={[6, 6, 0, 0]}
                stackId="a"
              />
              <Bar
                dataKey="pending"
                fill="var(--chart-4)"
                stackId="a"
              />
              <Bar
                dataKey="rejected"
                fill="var(--chart-5)"
                radius={[0, 0, 6, 6]}
                stackId="a"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
