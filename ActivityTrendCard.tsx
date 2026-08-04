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
  leaveRequests: number;
  tickets: number;
  suggestions: number;
  forumThreads: number;
};

const chartConfig = {
  leaveRequests: {
    label: "Cuti",
    color: "var(--chart-1)",
  },
  tickets: {
    label: "Tiket IT",
    color: "var(--chart-2)",
  },
  suggestions: {
    label: "Saran",
    color: "var(--chart-3)",
  },
  forumThreads: {
    label: "Forum",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

function formatShortDate(iso: string): string {
  // iso is YYYY-MM-DD
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function ActivityTrendCard({
  data,
}: {
  data: Array<Point>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aktivitas 14 Hari Terakhir</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-leave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-tickets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-suggestions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-forum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
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
              dataKey="leaveRequests"
              stroke="var(--chart-1)"
              fill="url(#grad-leave)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="tickets"
              stroke="var(--chart-2)"
              fill="url(#grad-tickets)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="suggestions"
              stroke="var(--chart-3)"
              fill="url(#grad-suggestions)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="forumThreads"
              stroke="var(--chart-4)"
              fill="url(#grad-forum)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
