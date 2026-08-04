import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Scale, Check } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils.ts";

export default function BenchmarkPanel({
  allUsers,
}: {
  allUsers: Array<Doc<"users">>;
}) {
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of allUsers) {
      if (u.department && u.department.trim()) set.add(u.department);
    }
    return Array.from(set).sort();
  }, [allUsers]);

  const [selected, setSelected] = useState<Array<string>>(() =>
    departments.slice(0, Math.min(3, departments.length)),
  );

  const data = useQuery(api.orgAdvanced.benchmark.compareDepartments, {
    departments: selected,
  });

  const toggle = (dept: string) => {
    setSelected((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  };

  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4" />
            Perbandingan Departemen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {departments.map((d) => {
              const isSelected = selected.includes(d);
              return (
                <Button
                  key={d}
                  type="button"
                  variant={isSelected ? "default" : "secondary"}
                  size="sm"
                  className={cn("gap-1.5", !isSelected && "text-muted-foreground")}
                  onClick={() => toggle(d)}
                >
                  {isSelected ? <Check className="size-3.5" /> : null}
                  {d}
                </Button>
              );
            })}
          </div>

          {selected.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pilih minimal satu departemen untuk membandingkan
            </p>
          ) : !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Departemen</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Manager</th>
                      <th className="px-3 py-2 text-right font-medium">IC</th>
                      <th className="px-3 py-2 text-right font-medium">Rentang</th>
                      <th className="px-3 py-2 text-right font-medium">Tenure</th>
                      <th className="px-3 py-2 text-right font-medium">Posisi Kosong</th>
                      <th className="px-3 py-2 text-right font-medium">Keahlian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr
                        key={row.department}
                        className={cn(i > 0 && "border-t")}
                      >
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: chartColors[i % chartColors.length],
                              color: chartColors[i % chartColors.length],
                            }}
                          >
                            {row.department}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {row.headcount}
                        </td>
                        <td className="px-3 py-2 text-right">{row.managers}</td>
                        <td className="px-3 py-2 text-right">{row.ics}</td>
                        <td className="px-3 py-2 text-right">{row.avgSpan}</td>
                        <td className="px-3 py-2 text-right">
                          {row.avgTenureYears} th
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.openPositions}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.skillsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="department"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <RTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="headcount" name="Total" radius={[4, 4, 0, 0]}>
                      {data.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="openPositions"
                      name="Posisi Kosong"
                      radius={[4, 4, 0, 0]}
                      fill="var(--chart-4)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
