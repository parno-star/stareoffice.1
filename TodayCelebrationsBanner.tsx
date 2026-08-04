import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Cake, Award, PartyPopper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getInitials } from "../_lib/celebrations-utils.ts";

export default function TodayCelebrationsBanner() {
  const data = useQuery(api.celebrations.todayCelebrations, {});
  const navigate = useNavigate();

  if (!data) return null;
  const { birthdays, anniversaries } = data;
  if (birthdays.length === 0 && anniversaries.length === 0) return null;

  const total = birthdays.length + anniversaries.length;

  return (
    <Card
      onClick={() => navigate("/celebrations")}
      className="cursor-pointer overflow-hidden border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-amber-500/5 to-purple-500/10 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-background">
          <PartyPopper className="size-6 text-pink-500" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            Ada {total} perayaan hari ini!
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {birthdays.length > 0 ? (
              <span className="flex items-center gap-1">
                <Cake className="size-3.5 text-pink-500" />
                {birthdays.length} ulang tahun
              </span>
            ) : null}
            {anniversaries.length > 0 ? (
              <span className="flex items-center gap-1">
                <Award className="size-3.5 text-amber-500" />
                {anniversaries.length} anniversary
              </span>
            ) : null}
          </div>
        </div>

        {/* Avatar stack preview */}
        <div className="flex -space-x-2">
          {[...birthdays, ...anniversaries].slice(0, 4).map((item) => (
            <Avatar
              key={item.userId}
              className="size-9 border-2 border-background"
            >
              {item.avatarUrl ? (
                <AvatarImage src={item.avatarUrl} alt={item.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs">
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {total > 4 ? (
            <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold">
              +{total - 4}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
