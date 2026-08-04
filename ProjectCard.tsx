import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Users, CheckCircle2 } from "lucide-react";
import type { ProjectWithStats } from "@/convex/projects";
import { getProjectColor } from "../_lib/utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = { project: ProjectWithStats };

export default function ProjectCard({ project }: Props) {
  const color = getProjectColor(project.color);
  const completion =
    project.taskCount > 0
      ? Math.round((project.completedTaskCount / project.taskCount) * 100)
      : 0;

  return (
    <Link to={`/projects/${project._id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/40 cursor-pointer">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0",
                color.lightBg,
              )}
            >
              <div className={cn("size-5 rounded", color.className)} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">
                {project.name}
              </CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {project.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span>{project.memberCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              <span>
                {project.completedTaskCount}/{project.taskCount}
              </span>
            </div>
            {project.status !== "active" && (
              <Badge variant="secondary" className="ml-auto capitalize">
                {project.status === "completed"
                  ? "Selesai"
                  : project.status === "on_hold"
                    ? "Ditunda"
                    : "Diarsipkan"}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progres</span>
              <span className="font-medium">{completion}%</span>
            </div>
            <Progress value={completion} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
