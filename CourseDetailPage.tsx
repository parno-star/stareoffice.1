import { useNavigate, useParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  Users,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  FileQuestion,
  Pencil,
  Plus,
  PlayCircle,
  Star,
  Trash2,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  formatDuration,
  getCategoryConfig,
  getColorConfig,
  getLevelConfig,
} from "./_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import LessonViewer from "./_components/LessonViewer.tsx";
import LessonFormDialog from "./_components/LessonFormDialog.tsx";
import CourseFormDialog from "./_components/CourseFormDialog.tsx";
import QuizEditorDialog from "./_components/QuizEditorDialog.tsx";
import QuizTakeDialog from "./_components/QuizTakeDialog.tsx";
import CertificateDialog from "./_components/CertificateDialog.tsx";
import CourseReviewsSection from "./_components/CourseReviewsSection.tsx";
import CourseAssignmentsPanel from "./_components/CourseAssignmentsPanel.tsx";
import LessonDiscussion from "./_components/LessonDiscussion.tsx";
import SessionsPanel from "./_components/SessionsPanel.tsx";
import PrereqsPanel from "./_components/PrereqsPanel.tsx";
import BookmarkButton from "./_components/BookmarkButton.tsx";
import SurveyEditorDialog, {
  SurveyTakeDialog,
} from "./_components/SurveyDialog.tsx";
import CourseSkillsPanel from "./_components/CourseSkillsPanel.tsx";
import { isAdminRole } from "@/convex/roles.ts";

function CourseDetailInner({ courseId }: { courseId: Id<"courses"> }) {
  const navigate = useNavigate();
  const course = useQuery(api.courses.getCourse, { id: courseId });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isAdmin = isAdminRole(currentUser?.role);
  const enrollees = useQuery(
    api.courses.getCourseEnrollees,
    isAdmin ? { courseId } : "skip",
  );
  const enroll = useMutation(api.courses.enroll);
  const unenroll = useMutation(api.courses.unenroll);
  const setPublished = useMutation(api.courses.setPublished);
  const removeCourse = useMutation(api.courses.removeCourse);
  const removeLesson = useMutation(api.courses.removeLesson);
  const touch = useMutation(api.courses.touchLastAccessed);
  const [activeLessonId, setActiveLessonId] = useState<
    Id<"courseLessons"> | null
  >(null);
  const [busy, setBusy] = useState(false);

  const lessons = useMemo(() => course?.lessons ?? [], [course]);
  const completedIds = useMemo(
    () => new Set(course?.enrollment?.completedLessonIds ?? []),
    [course],
  );

  // Pick first unseen lesson by default
  useEffect(() => {
    if (!course || lessons.length === 0) return;
    if (activeLessonId) return;
    const firstIncomplete = lessons.find((l) => !completedIds.has(l._id));
    setActiveLessonId((firstIncomplete ?? lessons[0])._id);
  }, [course, lessons, completedIds, activeLessonId]);

  // Update last accessed timestamp when viewing a course with enrollment
  useEffect(() => {
    if (course?.enrollment) {
      touch({ courseId }).catch(() => {});
    }
  }, [course?.enrollment, courseId, touch]);

  if (course === undefined) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }
  if (course === null) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Kelas tidak ditemukan.</p>
        <Button
          variant="ghost"
          onClick={() => navigate("/training")}
          className="mt-3 cursor-pointer"
        >
          Kembali ke daftar kelas
        </Button>
      </div>
    );
  }

  const cat = getCategoryConfig(course.category);
  const level = getLevelConfig(course.level);
  const color = getColorConfig(course.coverColor);
  const CatIcon = cat.icon;
  const isEnrolled = Boolean(course.enrollment);
  const progress = course.enrollment?.progress ?? 0;
  const isCompleted = Boolean(course.enrollment?.completedAt);
  const lessonsDone =
    course.lessonCount > 0 &&
    (course.enrollment?.completedLessonCount ?? 0) >= course.lessonCount;
  const quizPassed = course.quiz ? course.quiz.hasPassed : true;
  const canTakeQuiz = Boolean(course.quiz) && isEnrolled;
  const quizLocked =
    course.quiz &&
    course.quiz.maxAttempts !== undefined &&
    course.quiz.attemptCount >= course.quiz.maxAttempts &&
    !course.quiz.hasPassed;

  const handleEnroll = async () => {
    setBusy(true);
    try {
      await enroll({ courseId });
      toast.success("Anda terdaftar di kelas ini");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal mendaftar")
          : "Gagal mendaftar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleUnenroll = async () => {
    setBusy(true);
    try {
      await unenroll({ courseId });
      toast.success("Anda keluar dari kelas ini");
    } catch {
      toast.error("Gagal");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublish = async () => {
    try {
      await setPublished({ id: courseId, isPublished: !course.isPublished });
      toast.success(
        course.isPublished ? "Kelas dijadikan draft" : "Kelas dipublikasikan",
      );
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleDeleteCourse = async () => {
    try {
      await removeCourse({ id: courseId });
      toast.success("Kelas dihapus");
      navigate("/training");
    } catch {
      toast.error("Gagal menghapus kelas");
    }
  };

  const handleDeleteLesson = async (id: Id<"courseLessons">) => {
    try {
      await removeLesson({ id });
      toast.success("Pelajaran dihapus");
      if (activeLessonId === id) {
        setActiveLessonId(null);
      }
    } catch {
      toast.error("Gagal menghapus pelajaran");
    }
  };

  const activeLessonIndex = lessons.findIndex((l) => l._id === activeLessonId);
  const goPrev =
    activeLessonIndex > 0
      ? () => setActiveLessonId(lessons[activeLessonIndex - 1]._id)
      : undefined;
  const goNext =
    activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1
      ? () => setActiveLessonId(lessons[activeLessonIndex + 1]._id)
      : undefined;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/training")}
          className="cursor-pointer gap-1"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
      </div>

      {/* Hero */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-6 sm:p-8",
          color.cover,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/90">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <CatIcon className="size-3.5" />
                {cat.label}
              </span>
              <span className={cn("rounded-full px-2.5 py-1", level.badge)}>
                {level.label}
              </span>
              {!course.isPublished ? (
                <span className="rounded-full border border-white/40 px-2.5 py-1">
                  Draft
                </span>
              ) : null}
              {course.isAssigned ? (
                <span className="rounded-full bg-amber-500/80 px-2.5 py-1 text-white">
                  Wajib
                  {course.assignmentDueDate
                    ? ` · tenggat ${course.assignmentDueDate}`
                    : ""}
                </span>
              ) : null}
              {(course.averageRating ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2.5 py-1">
                  <Star className="size-3 fill-amber-300 text-amber-300" />
                  {(course.averageRating ?? 0).toFixed(1)}
                  {course.reviewCount
                    ? ` (${course.reviewCount})`
                    : ""}
                </span>
              ) : null}
              {course.quiz ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <FileQuestion className="size-3.5" />
                  Kuis · lulus {course.quiz.passingScore}%
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white text-balance sm:text-3xl">
              {course.title}
            </h1>
            <p className="max-w-2xl text-sm text-white/90">
              {course.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3.5" />
                {course.lessonCount} pelajaran
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDuration(course.durationMinutes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {course.enrollmentCount} peserta
              </span>
              {course.instructorName ? (
                <span>Instruktur: {course.instructorName}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEnrolled ? (
              isCompleted ? (
                <Badge
                  variant="outline"
                  className="border-white/30 bg-white/15 text-white"
                >
                  <CheckCircle2 className="mr-1 size-3.5" /> Selesai
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleUnenroll}
                  disabled={busy}
                  className="cursor-pointer"
                >
                  <UserMinus className="size-4" /> Keluar
                </Button>
              )
            ) : (
              <Button
                size="sm"
                onClick={handleEnroll}
                disabled={busy || !course.isPublished}
                className="cursor-pointer"
              >
                <UserPlus className="size-4" /> Daftar
              </Button>
            )}
            {course.certificate ? (
              <CertificateDialog
                certificate={course.certificate}
                trigger={
                  <Button
                    size="sm"
                    className="cursor-pointer bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <Award className="size-4" /> Lihat Sertifikat
                  </Button>
                }
              />
            ) : null}
            {isEnrolled && isCompleted ? (
              <SurveyTakeDialog
                courseId={courseId}
                trigger={
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer gap-1"
                  >
                    Umpan balik
                  </Button>
                }
              />
            ) : null}
            <BookmarkButton
              courseId={courseId}
              variant="secondary"
              size="sm"
            />
            {isAdmin ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleTogglePublish}
                  className="cursor-pointer"
                >
                  {course.isPublished ? (
                    <>
                      <EyeOff className="size-4" /> Jadikan draft
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" /> Publikasikan
                    </>
                  )}
                </Button>
                <CourseFormDialog
                  mode="edit"
                  initialValues={{
                    courseId,
                    title: course.title,
                    description: course.description,
                    category: course.category,
                    level: course.level,
                    durationMinutes: course.durationMinutes,
                    coverColor: course.coverColor,
                    instructorName: course.instructorName,
                  }}
                  trigger={
                    <Button size="sm" variant="secondary" className="cursor-pointer">
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
                      <AlertDialogTitle>Hapus kelas ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Semua pelajaran, kuis, sertifikat, dan data pendaftaran
                        akan terhapus. Tindakan ini tidak dapat dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer">
                        Batal
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteCourse}
                        className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
        </div>

        {isEnrolled ? (
          <div className="relative mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-white/90">
              <span>Progress Anda</span>
              <span>
                {course.enrollment?.completedLessonCount ?? 0} dari{" "}
                {course.lessonCount} pelajaran ({progress}%)
                {course.quiz
                  ? quizPassed
                    ? " · Kuis lulus"
                    : " · Kuis belum lulus"
                  : ""}
              </span>
            </div>
            <Progress
              value={progress}
              className="h-2 bg-white/20 [&_[data-slot=progress-indicator]]:bg-white"
            />
          </div>
        ) : null}
      </div>

      {/* Quiz callout card */}
      {course.quiz && isEnrolled ? (
        <div
          className={cn(
            "mt-4 rounded-xl border p-4",
            course.quiz.hasPassed
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  course.quiz.hasPassed
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white",
                )}
              >
                {course.quiz.hasPassed ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <FileQuestion className="size-5" />
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {course.quiz.hasPassed
                    ? "Anda telah lulus kuis"
                    : lessonsDone
                      ? "Selesaikan kuis untuk memperoleh sertifikat"
                      : "Selesaikan semua pelajaran, lalu kerjakan kuis"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {course.quiz.questionCount} pertanyaan · lulus{" "}
                  {course.quiz.passingScore}%
                  {course.quiz.bestScore !== null
                    ? ` · Skor terbaik ${course.quiz.bestScore}%`
                    : ""}
                  {course.quiz.maxAttempts
                    ? ` · ${course.quiz.attemptCount}/${course.quiz.maxAttempts} percobaan`
                    : ""}
                </p>
              </div>
            </div>
            <QuizTakeDialog
              courseId={courseId}
              trigger={
                <Button
                  disabled={!canTakeQuiz || Boolean(quizLocked)}
                  className="cursor-pointer"
                >
                  {course.quiz.hasPassed
                    ? "Lihat hasil kuis"
                    : quizLocked
                      ? "Percobaan habis"
                      : "Kerjakan kuis"}
                </Button>
              }
            />
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="learn" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="learn" className="cursor-pointer">
            Belajar
          </TabsTrigger>
          <TabsTrigger value="sessions" className="cursor-pointer">
            Sesi
          </TabsTrigger>
          <TabsTrigger value="prereqs" className="cursor-pointer">
            Prasyarat
          </TabsTrigger>
          <TabsTrigger value="skills" className="cursor-pointer">
            Keahlian
          </TabsTrigger>
          <TabsTrigger value="reviews" className="cursor-pointer">
            Ulasan
          </TabsTrigger>
          {isAdmin ? (
            <>
              <TabsTrigger value="peserta" className="cursor-pointer">
                Peserta
              </TabsTrigger>
              <TabsTrigger value="kuis" className="cursor-pointer">
                Kuis
              </TabsTrigger>
              <TabsTrigger value="survei" className="cursor-pointer">
                Survei
              </TabsTrigger>
              <TabsTrigger value="tugas" className="cursor-pointer">
                Penugasan
              </TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="learn" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Lessons list */}
            <div className="rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Kurikulum</h3>
                  <p className="text-xs text-muted-foreground">
                    {course.lessonCount} pelajaran ·{" "}
                    {formatDuration(course.durationMinutes)}
                  </p>
                </div>
                {isAdmin ? (
                  <LessonFormDialog
                    courseId={courseId}
                    trigger={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="cursor-pointer"
                      >
                        <Plus className="size-4" />
                      </Button>
                    }
                  />
                ) : null}
              </div>
              {lessons.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Belum ada pelajaran.
                  {isAdmin ? (
                    <div className="mt-3">
                      <LessonFormDialog
                        courseId={courseId}
                        trigger={
                          <Button
                            size="sm"
                            className="cursor-pointer gap-1"
                          >
                            <Plus className="size-4" /> Tambah pelajaran
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <ul className="max-h-[560px] divide-y overflow-y-auto">
                  {lessons.map((l, idx) => {
                    const isActive = l._id === activeLessonId;
                    const isDone = completedIds.has(l._id);
                    return (
                      <li
                        key={l._id}
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3 transition-colors",
                          isActive ? "bg-muted" : "hover:bg-muted/50",
                        )}
                      >
                        <button
                          onClick={() => setActiveLessonId(l._id)}
                          className="flex flex-1 items-center gap-3 text-left cursor-pointer"
                        >
                          {isDone ? (
                            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : isActive ? (
                            <PlayCircle className="size-5 shrink-0 text-primary" />
                          ) : (
                            <Circle className="size-5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Pelajaran {idx + 1}
                            </p>
                            <p
                              className={cn(
                                "truncate text-sm",
                                isActive ? "font-semibold" : "font-medium",
                              )}
                            >
                              {l.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(l.durationMinutes)}
                              {l.hasVideo ? " · Video" : ""}
                            </p>
                          </div>
                        </button>
                        {isAdmin ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Hapus pelajaran ini?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Materi pelajaran akan hilang secara permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="cursor-pointer">
                                  Batal
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteLesson(l._id)}
                                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Active lesson viewer + discussion */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 sm:p-6">
                {activeLessonId ? (
                  <LessonViewer
                    lessonId={activeLessonId}
                    lessonOrder={activeLessonIndex}
                    totalLessons={lessons.length}
                    onPrev={goPrev}
                    onNext={goNext}
                  />
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
                    <PlayCircle className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Pilih pelajaran untuk mulai belajar.
                    </p>
                  </div>
                )}
              </div>
              {activeLessonId ? (
                <div className="rounded-xl border bg-card p-4 sm:p-6">
                  <LessonDiscussion lessonId={activeLessonId} />
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <SessionsPanel courseId={courseId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="prereqs" className="mt-4">
          <div className="rounded-xl border bg-card p-5">
            <PrereqsPanel courseId={courseId} isAdmin={isAdmin} />
          </div>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <div className="rounded-xl border bg-card p-5">
            <CourseSkillsPanel courseId={courseId} isAdmin={isAdmin} />
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <CourseReviewsSection
            courseId={courseId}
            isEnrolled={isEnrolled}
          />
        </TabsContent>

        {isAdmin ? (
          <>
            <TabsContent value="peserta" className="mt-4">
              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Peserta Terdaftar</h3>
                  <p className="text-xs text-muted-foreground">
                    Lihat progress peserta untuk kelas ini.
                  </p>
                </div>
                {enrollees === undefined ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : enrollees.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Belum ada peserta terdaftar.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {enrollees.map((p) => (
                      <li
                        key={p.userId}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                          {p.userAvatar ? (
                            <img
                              src={p.userAvatar}
                              alt={p.userName ?? ""}
                              className="size-9 rounded-full object-cover"
                            />
                          ) : (
                            (p.userName ?? "?").slice(0, 1)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.userName ?? "Anonim"}
                          </p>
                          {p.userDepartment ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {p.userDepartment}
                            </p>
                          ) : null}
                        </div>
                        <div className="w-40 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span>{p.progress}%</span>
                            {p.completedAt ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                Selesai
                              </span>
                            ) : null}
                          </div>
                          <Progress value={p.progress} className="h-1.5" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="kuis" className="mt-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Kuis akhir kelas</h3>
                    <p className="text-xs text-muted-foreground">
                      {course.quiz
                        ? `${course.quiz.questionCount} pertanyaan · lulus ${course.quiz.passingScore}%`
                        : "Belum ada kuis untuk kelas ini."}
                    </p>
                  </div>
                  <QuizEditorDialog
                    courseId={courseId}
                    trigger={
                      <Button size="sm" className="cursor-pointer gap-1">
                        <Pencil className="size-4" />
                        {course.quiz ? "Ubah kuis" : "Buat kuis"}
                      </Button>
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="survei" className="mt-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Survei feedback</h3>
                    <p className="text-xs text-muted-foreground">
                      Kumpulkan umpan balik peserta setelah kelas selesai.
                    </p>
                  </div>
                  <SurveyEditorDialog
                    courseId={courseId}
                    trigger={
                      <Button size="sm" className="cursor-pointer gap-1">
                        <Pencil className="size-4" /> Ubah survei
                      </Button>
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tugas" className="mt-4">
              <CourseAssignmentsPanel courseId={courseId} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  if (!courseId) {
    return <p className="p-10 text-center">Kelas tidak ditemukan.</p>;
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
          <p className="text-muted-foreground">
            Silakan masuk untuk melihat kelas.
          </p>
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <CourseDetailInner courseId={courseId as Id<"courses">} />
      </Authenticated>
    </>
  );
}
