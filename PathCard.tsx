import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowRight, Layers, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CareerPathWithMeta } from "@/convex/careerPath";
import {
  coverBadge,
  coverGradient,
  trackLabel,
} from "../_lib/career-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  path: CareerPathWithMeta;
};

export default function PathCard({ path }: Props) {
  const navigate = useNavigate();
  return (
    <Card className="cursor-pointer overflow-hidden pt-0 transition-all hover:shadow-md">
      <div
        className={cn(
          "flex h-24 items-end justify-between bg-gradient-to-br p-4 text-white",
          coverGradient(path.coverColor),
        )}
        onClick={() => navigate(`/career-path/${path._id}`)}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{path.icon ?? "🚀"}</span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {trackLabel(path.track)}
          </span>
        </div>
        {!path.isPublished ? (
          <Badge variant="secondary" className="text-[10px]">
            Draf
          </Badge>
        ) : null}
      </div>
      <CardContent className="space-y-3 p-4">
        <div onClick={() => navigate(`/career-path/${path._id}`)}>
          <h3 className="line-clamp-1 text-base font-semibold">
            {path.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {path.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {path.department ? (
            <Badge
              variant="secondary"
              className={cn("text-[10px]", coverBadge(path.coverColor))}
            >
              {path.department}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Layers className="size-3" /> {path.levelCount} level
          </Badge>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Users className="size-3" /> {path.assigneeCount}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            oleh {path.authorName ?? "-"}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => navigate(`/career-path/${path._id}`)}
          >
            Lihat
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
