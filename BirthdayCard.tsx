import { Card } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Cake } from "lucide-react";
import {
  formatCountdown,
  formatMonthDay,
  getInitials,
} from "../_lib/celebrations-utils.ts";
import type { BirthdayItem } from "@/convex/celebrations.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  item: BirthdayItem;
  onClick?: () => void;
};

export default function BirthdayCard({ item, onClick }: Props) {
  const isToday = item.daysUntil === 0;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer flex-row items-center gap-3 overflow-hidden py-3 pl-3 pr-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        isToday &&
          "bg-gradient-to-br from-pink-500/10 via-transparent to-amber-500/10 ring-1 ring-pink-500/30",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-11">
          {item.avatarUrl ? (
            <AvatarImage src={item.avatarUrl} alt={item.name} />
          ) : null}
          <AvatarFallback className="bg-pink-500/15 text-pink-700 dark:text-pink-300">
            {getInitials(item.name)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-pink-500 text-white shadow">
          <Cake className="size-3" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.jobTitle ?? item.department ?? "Ulang Tahun"}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <Badge
          variant={isToday ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isToday && "bg-pink-500 text-white hover:bg-pink-500/90",
          )}
        >
          {formatCountdown(item.daysUntil)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatMonthDay(item.birthday)}
        </span>
      </div>
    </Card>
  );
}
