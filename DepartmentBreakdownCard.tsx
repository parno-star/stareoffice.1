import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";

type Item = {
  department: string;
  count: number;
};

export default function DepartmentBreakdownCard({
  items,
}: {
  items: Array<Item>;
}) {
  const max = items.reduce((acc, i) => Math.max(acc, i.count), 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Karyawan per Departemen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada data departemen.
          </p>
        ) : (
          items.map((item) => {
            const percent = Math.round((item.count / max) * 100);
            return (
              <div key={item.department} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{item.department}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.count}
                  </span>
                </div>
                <Progress value={percent} className="h-2" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
