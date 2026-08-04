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
  department: string;
  count: number;
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

const chartConfig = {
  count: { label: "Karyawan" },
} satisfies ChartConfig;

export default function HeadcountCard({ items }: { items: Array<Item> }) {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Distribusi Karyawan per Departemen
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Total {total} karyawan tersebar di {items.length} departemen.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data departemen.
          </p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <ChartContainer
              config={chartConfig}
              className="mx-auto h-60 w-full max-w-[260px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={items}
                  dataKey="count"
                  nameKey="department"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {items.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={PALETTE[idx % PALETTE.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex-1 space-y-2">
              {items.map((it, idx) => {
                const pct = total === 0 ? 0 : Math.round((it.count / total) * 100);
                return (
                  <li
                    key={it.department}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="block size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                      />
                      <span className="truncate">{it.department}</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {it.count} ({pct}%)
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
