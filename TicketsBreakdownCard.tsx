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
import { Pie, PieChart, Cell } from "recharts";

type Item = {
  status: string;
  count: number;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Baru",
  in_progress: "Diproses",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_COLOR: Record<string, string> = {
  open: "var(--chart-4)",
  in_progress: "var(--chart-2)",
  resolved: "var(--chart-1)",
  closed: "var(--chart-3)",
};

const chartConfig = {
  count: { label: "Tiket" },
} satisfies ChartConfig;

export default function TicketsBreakdownCard({
  items,
}: {
  items: Array<Item>;
}) {
  const data = items
    .filter((it) => it.count > 0)
    .map((it) => ({
      ...it,
      label: STATUS_LABEL[it.status] ?? it.status,
    }));
  const total = data.reduce((acc, i) => acc + i.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribusi Tiket IT</CardTitle>
        <p className="text-xs text-muted-foreground">
          {total} tiket total di seluruh status.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada tiket IT.
          </p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <ChartContainer
              config={chartConfig}
              className="mx-auto h-52 w-full max-w-[220px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.status}
                      fill={STATUS_COLOR[d.status] ?? "var(--chart-1)"}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex-1 space-y-2">
              {data.map((d) => {
                const pct =
                  total === 0 ? 0 : Math.round((d.count / total) * 100);
                return (
                  <li
                    key={d.status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="block size-3 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLOR[d.status] ?? "var(--chart-1)",
                        }}
                      />
                      <span>{d.label}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {d.count} ({pct}%)
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
