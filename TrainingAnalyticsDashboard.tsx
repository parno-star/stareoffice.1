import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  BookOpen,
  GraduationCap,
  Award,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { getCategoryConfig } from "../_lib/training-utils.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-bold leading-none">{value}</p>
            {hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrainingAnalyticsDashboard() {
  const analytics = useQuery(api.training.analytics.getAnalytics, {});

  if (analytics === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const maxEnroll = Math.max(
    1,
    ...analytics.topCourses.map((c) => c.enrollmentCount),
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={BookOpen}
          label="Total Kelas"
          value={analytics.totals.courseCount}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          hint={`${analytics.totals.publishedCount} dipublikasikan`}
        />
        <StatTile
          icon={Users}
          label="Pendaftaran Aktif"
          value={analytics.totals.enrollmentCount}
          accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          hint={`${analytics.totals.activeLearners} peserta unik`}
        />
        <StatTile
          icon={CheckCircle2}
          label="Tingkat Penyelesaian"
          value={`${analytics.totals.averageCompletionRate}%`}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          hint={`${analytics.totals.completedEnrollmentCount} kelas selesai`}
        />
        <StatTile
          icon={Award}
          label="Sertifikat Terbit"
          value={analytics.totals.certificateCount}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Kelas Terpopuler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              analytics.topCourses.map((c) => (
                <div key={c.courseId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.enrollmentCount} peserta · {c.completionRate}% selesai
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{
                        width: `${Math.round((c.enrollmentCount / maxEnroll) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Progres per Departemen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.byDepartment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              analytics.byDepartment.slice(0, 8).map((d) => (
                <div key={d.department} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">
                      {d.department}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.completedCount}/{d.enrollmentCount} ·{" "}
                      {d.completionRate}%
                    </span>
                  </div>
                  <Progress value={d.completionRate} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4" /> Sebaran Kategori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.byCategory.map((c) => {
                const cat = getCategoryConfig(c.category);
                const Icon = cat.icon;
                return (
                  <div
                    key={c.category}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                  >
                    <div
                      className={`flex size-8 items-center justify-center rounded-lg ${cat.iconBg}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.courseCount} kelas · {c.enrollmentCount} peserta
                      </p>
                    </div>
                  </div>
                );
              })}
              {analytics.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Sertifikat Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.recentCertificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada sertifikat yang diterbitkan.
              </p>
            ) : (
              <ul className="space-y-2">
                {analytics.recentCertificates.map((c) => (
                  <li
                    key={c.serial}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.userName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.courseTitle}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p className="font-mono">{c.serial}</p>
                      <p>
                        {format(new Date(c.issuedAt), "d MMM yyyy", {
                          locale: idLocale,
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
