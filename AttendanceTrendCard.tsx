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
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  present: number;
  late: number;
};

const chartConfig = {
  present: { label: "Hadir", color: "var(--chart-1)" },
  late: { label: "Terlambat", color: "var(--chart-5)" },
} satisfies ChartConfig;

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function AttendanceTrendCard({
  data,
}: {
  data: Array<Point>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kehadiran 30 Hari Terakhir</CardTitle>
        <p className="text-xs text-muted-foreground">
          Jumlah karyawan yang clock-in per hari dan jumlah keterlambatan.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-present" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-late" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={28}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="present"
              stroke="var(--chart-1)"
              fill="url(#grad-present)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="late"
              stroke="var(--chart-5)"
              fill="url(#grad-late)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
