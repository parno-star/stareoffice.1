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

type Point = {
  month: string;
  label: string;
  approved: number;
  pending: number;
  rejected: number;
};

const chartConfig = {
  approved: { label: "Disetujui / Dibayar", color: "var(--chart-1)" },
  pending: { label: "Menunggu", color: "var(--chart-4)" },
  rejected: { label: "Ditolak", color: "var(--chart-5)" },
} satisfies ChartConfig;

function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1)}jt`;
  }
  if (value >= 1_000) {
    return `Rp${(value / 1_000).toFixed(0)}rb`;
  }
  return `Rp${value}`;
}

export default function ExpensesMonthlyCard({
  data,
}: {
  data: Array<Point>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Reimbursement 6 Bulan Terakhir
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Total pengajuan reimbursement per bulan berdasarkan status.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={formatRupiahShort}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    formatRupiahShort(Number(value))
                  }
                />
              }
            />
            <Bar dataKey="approved" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="pending" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="rejected" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
