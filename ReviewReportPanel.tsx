import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { MessageSquare, Quote, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  RELATIONSHIP_BADGE,
  RELATIONSHIP_LABELS,
  formatScore,
  scoreColor,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";

// Progress isn't in deps list yet - fall back to a manual bar
function Bar({ value }: { value: number | null }) {
  const v = value ?? 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
        style={{ width: `${Math.min(Math.max(v, 0), 100)}%` }}
      />
    </div>
  );
}

export default function ReviewReportPanel({
  reviewId,
}: {
  reviewId: Id<"feedback360Reviews">;
}) {
  const report = useQuery(api.feedback360.reviews.getReviewReport, {
    reviewId,
  });

  if (report === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (report === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Laporan belum tersedia.
        </CardContent>
      </Card>
    );
  }

  if (!report.isShared && !report.canViewDetails) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <ShieldCheck className="size-8 text-muted-foreground" />
          <p className="font-medium">Laporan belum dibagikan</p>
          <p className="text-sm text-muted-foreground">
            Admin akan membagikan hasil lengkap setelah cukup feedback terkumpul.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overall = report.review.overallScore;
  const summary = report.reviewerSummary;
  const groups: Array<{
    key: "self" | "manager" | "peer" | "report";
    label: string;
    score: number | null;
    submitted: number;
    total: number;
  }> = [
    {
      key: "self",
      label: "Diri Sendiri",
      score: report.review.selfScore,
      submitted: summary.self.submitted,
      total: summary.self.total,
    },
    {
      key: "manager",
      label: "Atasan",
      score: report.review.managerScore,
      submitted: summary.manager.submitted,
      total: summary.manager.total,
    },
    {
      key: "peer",
      label: "Rekan",
      score: report.review.peerScore,
      submitted: summary.peer.submitted,
      total: summary.peer.total,
    },
    {
      key: "report",
      label: "Bawahan",
      score: report.review.reportScore,
      submitted: summary.report.submitted,
      total: summary.report.total,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header / score summary */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {report.cycle.periodLabel}
              </p>
              <h3 className="text-lg font-bold">{report.cycle.title}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Skor Keseluruhan</p>
              <p className={cn("text-3xl font-bold", scoreColor(overall))}>
                {formatScore(overall)}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {groups.map((g) => (
              <div
                key={g.key}
                className={cn(
                  "rounded-lg border p-3",
                  RELATIONSHIP_BADGE[g.key],
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  {g.label}
                </p>
                <p className={cn("mt-1 text-2xl font-bold", scoreColor(g.score))}>
                  {formatScore(g.score)}
                </p>
                <p className="text-[11px] opacity-80">
                  {g.submitted}/{g.total} respons
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h4 className="font-semibold">Rincian per pertanyaan</h4>
              <p className="text-xs text-muted-foreground">
                Nilai rating dan jawaban bebas dari setiap sudut pandang.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {report.questions.map((q, idx) => (
              <div
                key={q.questionId}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      #{idx + 1}
                      {q.category ? ` · ${q.category}` : ""}
                    </p>
                    <p className="text-sm font-medium">{q.text}</p>
                  </div>
                  {q.type === "rating" ? (
                    <p className={cn("text-lg font-bold", scoreColor(q.overall))}>
                      {formatScore(q.overall)}
                    </p>
                  ) : (
                    <Badge variant="secondary">Teks</Badge>
                  )}
                </div>

                {q.type === "rating" ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    {(["self", "manager", "peer", "report"] as const).map(
                      (rel) => (
                        <div key={rel}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {RELATIONSHIP_LABELS[rel]}
                            </span>
                            <span className={cn("font-semibold", scoreColor(q[rel]))}>
                              {formatScore(q[rel])}
                            </span>
                          </div>
                          <Bar value={q[rel]} />
                        </div>
                      ),
                    )}
                  </div>
                ) : null}

                {q.textAnswers.length > 0 ? (
                  <div className="space-y-2">
                    {q.textAnswers.map((t, i) => (
                      <div
                        key={i}
                        className="rounded-md border-l-2 border-primary/40 bg-muted/40 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border text-[10px]",
                              RELATIONSHIP_BADGE[t.relationship],
                            )}
                          >
                            {RELATIONSHIP_LABELS[t.relationship]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t.author ?? "Anonim"}
                          </span>
                        </div>
                        <p className="text-sm">{t.value}</p>
                      </div>
                    ))}
                  </div>
                ) : q.type === "text" ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada jawaban untuk pertanyaan ini.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strengths & improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                <Quote className="size-4" />
              </div>
              <h4 className="font-semibold">Kekuatan</h4>
            </div>
            {report.strengthsByRelationship.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada tanggapan.
              </p>
            ) : (
              <div className="space-y-2">
                {report.strengthsByRelationship.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-md border-l-2 border-emerald-400 bg-emerald-500/5 p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[10px]",
                          RELATIONSHIP_BADGE[s.relationship],
                        )}
                      >
                        {RELATIONSHIP_LABELS[s.relationship]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.author ?? "Anonim"}
                      </span>
                    </div>
                    <p>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-rose-500/10 text-rose-500">
                <Quote className="size-4" />
              </div>
              <h4 className="font-semibold">Area Pengembangan</h4>
            </div>
            {report.improvementsByRelationship.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada tanggapan.
              </p>
            ) : (
              <div className="space-y-2">
                {report.improvementsByRelationship.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-md border-l-2 border-rose-400 bg-rose-500/5 p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[10px]",
                          RELATIONSHIP_BADGE[s.relationship],
                        )}
                      >
                        {RELATIONSHIP_LABELS[s.relationship]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.author ?? "Anonim"}
                      </span>
                    </div>
                    <p>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
