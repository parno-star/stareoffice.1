import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";

type Snapshot = {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  avgProgress: number;
};

export default function TrainingSnapshotCard({
  snapshot,
}: {
  snapshot: Snapshot;
}) {
  const { completed, inProgress, notStarted, totalEnrollments } = snapshot;
  const pct = (n: number) =>
    totalEnrollments === 0 ? 0 : Math.round((n / totalEnrollments) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pelatihan & E-Learning</CardTitle>
        <p className="text-xs text-muted-foreground">
          {snapshot.publishedCourses} kursus aktif dari total{" "}
          {snapshot.totalCourses}. {totalEnrollments} enrollment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completed}
            </p>
            <p className="text-xs text-muted-foreground">Selesai</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {inProgress}
            </p>
            <p className="text-xs text-muted-foreground">Berjalan</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {notStarted}
            </p>
            <p className="text-xs text-muted-foreground">Belum Dimulai</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Rata-rata progres</span>
            <span className="text-muted-foreground">
              {snapshot.avgProgress}%
            </span>
          </div>
          <Progress value={snapshot.avgProgress} className="h-2" />
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Selesai</span>
            <span>{pct(completed)}%</span>
          </div>
          <Progress value={pct(completed)} className="h-1.5" />
          <div className="flex items-center justify-between pt-1">
            <span>Berjalan</span>
            <span>{pct(inProgress)}%</span>
          </div>
          <Progress value={pct(inProgress)} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
