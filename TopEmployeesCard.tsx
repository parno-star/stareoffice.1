import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { HeartHandshake } from "lucide-react";

type Item = {
  userId: string;
  name: string;
  department: string | undefined;
  avatarUrl: string | undefined;
  count: number;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TopEmployeesCard({ items }: { items: Array<Item> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Karyawan Paling Diapresiasi (90 hari)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Berdasarkan jumlah apresiasi yang diterima.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada apresiasi dalam 90 hari terakhir.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((it, idx) => (
              <li key={it.userId} className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <Avatar className="size-9">
                  <AvatarImage src={it.avatarUrl} alt={it.name} />
                  <AvatarFallback>{initials(it.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  {it.department ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {it.department}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <HeartHandshake className="size-4 text-rose-500" />
                  {it.count}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
