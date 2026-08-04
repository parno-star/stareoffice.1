import { Card, CardContent } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Sparkles,
  Users,
  Briefcase,
  Calendar,
  StickyNote,
  Route,
  MessageCircleHeart,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { getInitials, formatDate } from "../_lib/onboarding-utils.ts";
import PhaseTimeline from "./PhaseTimeline.tsx";
import MyCheckinsSection from "./MyCheckinsSection.tsx";

export default function MyOnboardingView() {
  const data = useQuery(api.onboarding.getMine, {});

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (data === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle>Belum ada onboarding aktif</EmptyTitle>
          <EmptyDescription>
            Tim HR akan memulai checklist onboarding Anda saat Anda resmi
            bergabung. Cek lagi nanti!
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-14">
              {data.userAvatar ? <AvatarImage src={data.userAvatar} /> : null}
              <AvatarFallback>{getInitials(data.userName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">
                  Selamat datang, {data.userName ?? "Karyawan"}!
                </h2>
                <Badge
                  variant="outline"
                  className={
                    data.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                      : data.status === "paused"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                  }
                >
                  {data.status === "completed"
                    ? "Selesai"
                    : data.status === "paused"
                      ? "Ditunda"
                      : "Aktif"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ikuti perjalanan onboarding dari pra-boarding hingga 3 bulan
                pertama.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">
                {data.progress.percent}%
              </p>
              <p className="text-xs text-muted-foreground">
                {data.progress.done}/{data.progress.total} selesai
              </p>
            </div>
          </div>
          <Progress value={data.progress.percent} className="mt-4" />

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
              <Calendar className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mulai kerja</p>
                <p className="truncate font-medium">
                  {formatDate(data.startDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
              <Briefcase className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Manajer</p>
                <p className="truncate font-medium">
                  {data.managerName ?? "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Buddy</p>
                <p className="truncate font-medium">
                  {data.buddyName ?? "-"}
                </p>
              </div>
            </div>
          </div>

          {data.notes ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="whitespace-pre-wrap">{data.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Route className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Perjalanan Onboarding Anda
          </h3>
        </div>
        {data.tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Belum ada tugas di checklist Anda.
          </p>
        ) : (
          <PhaseTimeline
            tasks={data.tasks}
            startDate={data.startDate}
            canToggle={true}
            canDelete={false}
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircleHeart className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Check-in & Feedback
          </h3>
        </div>
        <MyCheckinsSection />
      </div>
    </div>
  );
}
