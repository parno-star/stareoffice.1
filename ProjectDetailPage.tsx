import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  CheckCircle2,
  Pause,
  Play,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import TaskBoard from "./_components/TaskBoard.tsx";
import { getInitials, getProjectColor } from "./_lib/utils.ts";
import { useOpsConfig } from "./_lib/use-ops-config.ts";
import { cn } from "@/lib/utils.ts";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const projectData = useQuery(
    api.projects.getProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const tasks = useQuery(
    api.projects.listProjectTasks,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);
  const { statuses } = useOpsConfig();

  if (projectData === undefined || !projectId) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (projectData === null) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/projects")}
          className="cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
        <div className="mt-6 text-center text-muted-foreground">
          Proyek tidak ditemukan.
        </div>
      </div>
    );
  }

  const { project, owner, members } = projectData;
  const color = getProjectColor(project.color);
  const isOwner = owner?._id === currentUser?._id;
  const completedKeys = new Set(
    statuses.filter((s) => s.isCompleted).map((s) => s.key),
  );
  const completed = (tasks ?? []).filter((t) =>
    completedKeys.has(t.status),
  ).length;
  const total = (tasks ?? []).length;
  const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

  const toggleStatus = async (status: string) => {
    try {
      await updateProject({
        projectId: project._id,
        status,
      });
      toast.success("Status proyek diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal memperbarui proyek");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject({ projectId: project._id });
      toast.success("Proyek dihapus");
      navigate("/projects");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menghapus proyek");
      }
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/projects")}
        className="cursor-pointer -ml-2"
      >
        <ArrowLeft className="size-4" />
        Kembali ke proyek
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "size-12 rounded-xl flex items-center justify-center shrink-0",
              color.lightBg,
            )}
          >
            <div className={cn("size-6 rounded", color.className)} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              {project.status !== "active" && (
                <Badge variant="secondary" className="capitalize">
                  {project.status === "completed"
                    ? "Selesai"
                    : project.status === "on_hold"
                      ? "Ditunda"
                      : "Diarsipkan"}
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
        </div>
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="cursor-pointer">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {project.status === "active" ? (
                <DropdownMenuItem
                  onClick={() => toggleStatus("on_hold")}
                  className="cursor-pointer"
                >
                  <Pause className="size-4" />
                  Tunda
                </DropdownMenuItem>
              ) : project.status === "on_hold" ? (
                <DropdownMenuItem
                  onClick={() => toggleStatus("active")}
                  className="cursor-pointer"
                >
                  <Play className="size-4" />
                  Aktifkan
                </DropdownMenuItem>
              ) : null}
              {project.status !== "completed" ? (
                <DropdownMenuItem
                  onClick={() => toggleStatus("completed")}
                  className="cursor-pointer"
                >
                  <CheckCircle2 className="size-4" />
                  Tandai Selesai
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => toggleStatus("active")}
                  className="cursor-pointer"
                >
                  <Play className="size-4" />
                  Aktifkan Kembali
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Hapus Proyek
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Progres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{completion}%</div>
            <Progress value={completion} />
            <div className="text-xs text-muted-foreground">
              {completed} dari {total} selesai
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Tim ({members.length + 1})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex -space-x-2">
              {owner && (
                <Avatar className="size-9 border-2 border-background">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(owner.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              {members.slice(0, 6).map((m) => (
                <Avatar
                  key={m._id}
                  className="size-9 border-2 border-background"
                >
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {getInitials(m.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 6 && (
                <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold border-2 border-background">
                  +{members.length - 6}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Pemilik Proyek
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials(owner?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {owner?.name ?? "-"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {owner?.department ?? owner?.jobTitle ?? "-"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Papan Tugas</h2>
        <TaskBoard projectId={project._id} />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus proyek?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh tugas di proyek "{project.name}" akan dihapus permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
