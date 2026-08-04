import { useNavigate, useParams, Link } from "react-router-dom";
import {
  useQuery,
  useMutation,
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import LearningPathFormDialog from "./_components/LearningPathFormDialog.tsx";
import { isAdminRole } from "@/convex/roles.ts";
import { cn } from "@/lib/utils.ts";

function LearningPathDetailInner({ pathId }: { pathId: Id<"learningPaths"> }) {
  const navigate = useNavigate();
  const path = useQuery(api.training.paths.getPath, { id: pathId });
  const me = useQuery(api.users.getCurrentUser, {});
  const isAdmin = isAdminRole(me?.role);
  const allCourses = useQuery(
    api.courses.listCourses,
    isAdmin ? { filter: "all" } : "skip",
  );
  const setPublished = useMutation(api.training.paths.setPathPublished);
  const removePath = useMutation(api.training.paths.removePath);
  const addCourse = useMutation(api.training.paths.addCourseToPath);
  const removeCourseFromPath = useMutation(
    api.training.paths.removeCourseFromPath,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  if (path === undefined) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (path === null) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Jalur tidak ditemukan.</p>
        <Button
          variant="ghost"
          onClick={() => navigate("/training")}
          className="mt-3 cursor-pointer"
        >
          Kembali
        </Button>
      </div>
    );
  }

  const handleTogglePublish = async () => {
    try {
      await setPublished({ id: pathId, isPublished: !path.isPublished });
      toast.success(
        path.isPublished ? "Jalur dijadikan draft" : "Jalur dipublikasikan",
      );
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    try {
      await removePath({ id: pathId });
      toast.success("Jalur dihapus");
      navigate("/training");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleAddCourse = async () => {
    if (!selectedCourseId) return;
    try {
      await addCourse({
        pathId,
        courseId: selectedCourseId as Id<"courses">,
      });
      toast.success("Kelas ditambahkan ke jalur");
      setAddOpen(false);
      setSelectedCourseId("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const availableCourses = (allCourses ?? []).filter(
    (c) => !path.courses.some((pc) => pc._id === c._id),
  );

  const gradient = cn("bg-gradient-to-br", {
    "from-blue-500 via-blue-600 to-indigo-700": path.coverColor === "blue",
    "from-emerald-500 via-emerald-600 to-teal-700":
      path.coverColor === "green",
    "from-orange-500 via-orange-600 to-rose-600":
      path.coverColor === "orange",
    "from-purple-500 via-violet-600 to-fuchsia-700":
      path.coverColor === "purple",
    "from-pink-500 via-rose-500 to-red-600": path.coverColor === "pink",
    "from-red-500 via-red-600 to-rose-700": path.coverColor === "red",
    "from-teal-500 via-cyan-600 to-sky-700": path.coverColor === "teal",
    "from-indigo-500 via-indigo-600 to-purple-700":
      path.coverColor === "indigo" ||
      !["blue", "green", "orange", "purple", "pink", "red", "teal", "indigo"].includes(
        path.coverColor,
      ),
  });

  return (
    <div className="p-4 lg:p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/training")}
        className="mb-4 cursor-pointer gap-1"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </Button>

      <div className={cn("relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white", gradient)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{path.icon ?? "🎯"}</span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Route className="size-3.5" />
                  Jalur Pembelajaran
                </span>
                {!path.isPublished ? (
                  <span className="rounded-full border border-white/40 px-2.5 py-1">
                    Draft
                  </span>
                ) : null}
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {path.title}
            </h1>
            <p className="max-w-2xl text-sm text-white/90">
              {path.description}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span>
                {path.completedCount}/{path.totalCount} kelas selesai
              </span>
              <div className="h-1.5 w-40 rounded-full bg-white/20">
                <div
                  className="h-1.5 rounded-full bg-white"
                  style={{ width: `${path.percent}%` }}
                />
              </div>
              <span className="font-semibold">{path.percent}%</span>
            </div>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer"
                onClick={handleTogglePublish}
              >
                {path.isPublished ? (
                  <>
                    <EyeOff className="size-4" /> Jadikan draft
                  </>
                ) : (
                  <>
                    <Eye className="size-4" /> Publikasikan
                  </>
                )}
              </Button>
              <LearningPathFormDialog
                mode="edit"
                initialValues={{
                  pathId: path._id,
                  title: path.title,
                  description: path.description,
                  coverColor: path.coverColor,
                  icon: path.icon,
                  category: path.category,
                }}
                trigger={
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                  >
                    <Pencil className="size-4" /> Ubah
                  </Button>
                }
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus jalur?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Kelas individu tidak akan terhapus, hanya jalurnya.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Batal
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Kurikulum Jalur</h3>
            <p className="text-xs text-muted-foreground">
              Ikuti kelas secara berurutan untuk hasil terbaik.
            </p>
          </div>
          {isAdmin ? (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="cursor-pointer gap-1">
                  <Plus className="size-4" /> Tambah kelas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah kelas ke jalur</DialogTitle>
                </DialogHeader>
                {availableCourses.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Tidak ada kelas yang bisa ditambahkan.
                  </p>
                ) : (
                  <Select
                    value={selectedCourseId}
                    onValueChange={setSelectedCourseId}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCourses.map((c) => (
                        <SelectItem key={c._id} value={String(c._id)}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setAddOpen(false)}
                    className="cursor-pointer"
                  >
                    Batal
                  </Button>
                  <Button
                    disabled={!selectedCourseId}
                    onClick={handleAddCourse}
                    className="cursor-pointer"
                  >
                    Tambah
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        {path.courses.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Belum ada kelas dalam jalur ini.
          </p>
        ) : (
          <ul className="divide-y">
            {path.courses.map((c, idx) => (
              <li key={c._id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    c.enrollmentCompletedAt
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted",
                  )}
                >
                  {c.enrollmentCompletedAt ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <Link
                  to={`/training/${c._id}`}
                  className="flex flex-1 items-center gap-3 hover:text-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lessonCount} pelajaran · {c.enrollmentCount} peserta
                    </p>
                  </div>
                </Link>
                <div className="hidden w-32 space-y-1 sm:block">
                  <Progress value={c.progress} className="h-1.5" />
                  <p className="text-right text-[11px] text-muted-foreground">
                    {c.progress}%
                  </p>
                </div>
                {isAdmin ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeCourseFromPath({ pathId, courseId: c._id })
                        .then(() => toast.success("Kelas dihapus dari jalur"))
                        .catch(() => toast.error("Gagal"))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LearningPathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  if (!pathId) {
    return <p className="p-10 text-center">Jalur tidak ditemukan.</p>;
  }
  return (
    <>
      <AuthLoading>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-10">
          <p className="text-muted-foreground">Silakan masuk untuk melihat jalur.</p>
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <LearningPathDetailInner pathId={pathId as Id<"learningPaths">} />
      </Authenticated>
    </>
  );
}
