import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Inbox, MessageSquare, Users2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.js";
import { formatScorePercent } from "@/pages/engagement/_lib/engagement-utils.ts";

export default function SurveyResultsDialog({
  open,
  onOpenChange,
  surveyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: Id<"engagementSurveys"> | null;
}) {
  const survey = useQuery(
    api.engagement.getSurvey,
    surveyId ? { surveyId } : "skip",
  );
  const results = useQuery(
    api.engagement.getSurveyResults,
    surveyId ? { surveyId } : "skip",
  );
  const loading = survey === undefined || results === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Hasil Survei{survey ? `: ${survey.title}` : ""}
          </DialogTitle>
          <DialogDescription>
            Ringkasan jawaban dan sentimen responden.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {!loading && results && (
          <div className="space-y-6">
            {results.responseCount === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>Belum ada respons</EmptyTitle>
                  <EmptyDescription>
                    Respons akan muncul di sini setelah karyawan mengisi survei.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <SummaryStat
                    label="Total Respons"
                    value={String(results.responseCount)}
                  />
                  <SummaryStat
                    label="Skor Sentimen"
                    value={formatScorePercent(results.averageScore)}
                  />
                  <SummaryStat
                    label="Jumlah Pertanyaan"
                    value={String(results.questionResults.length)}
                  />
                </div>

                {results.departmentBreakdown.length > 0 && (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users2 className="size-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm">
                        Breakdown per Departemen
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {results.departmentBreakdown.map((d) => (
                        <div
                          key={d.department}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex-1 min-w-0 truncate font-medium">
                            {d.department}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">
                              {d.responseCount} respons
                            </span>
                            <Badge variant="secondary">
                              {formatScorePercent(d.averageScore)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="space-y-3">
                  {results.questionResults.map((q, idx) => (
                    <Card key={q.questionId} className="p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="secondary">#{idx + 1}</Badge>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{q.text}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="capitalize">
                              {q.type.replace("_", " ")}
                            </span>
                            <span>·</span>
                            <span>{q.responseCount} respons</span>
                            {q.averageNumeric !== null && (
                              <>
                                <span>·</span>
                                <span>
                                  Rata-rata: {q.averageNumeric.toFixed(1)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {q.distribution.length > 0 && (
                        <div className="space-y-2">
                          {q.distribution.map((d) => (
                            <div key={d.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{d.label}</span>
                                <span className="text-muted-foreground">
                                  {d.count} ({d.percentage}%)
                                </span>
                              </div>
                              <Progress value={d.percentage} />
                            </div>
                          ))}
                        </div>
                      )}

                      {q.textAnswers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MessageSquare className="size-3" />
                            <span>Contoh Jawaban ({q.textAnswers.length})</span>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {q.textAnswers.map((ans, i) => (
                              <div
                                key={i}
                                className="rounded-md border bg-muted/30 p-3 text-sm"
                              >
                                <p className="whitespace-pre-wrap">
                                  {ans.value}
                                </p>
                                {ans.userName && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    — {ans.userName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {q.responseCount === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          Belum ada jawaban untuk pertanyaan ini.
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
