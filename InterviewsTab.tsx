import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Calendar, Clock, Link as LinkIcon, Users } from "lucide-react";
import ApplicationDetailPanel from "./ApplicationDetailPanel.tsx";
import { INTERVIEW_FORMATS, INTERVIEW_TYPES } from "../_lib/recruitment-utils.ts";

function labelOf(
  collection: ReadonlyArray<{ value: string; label: string }>,
  value: string,
): string {
  return collection.find((c) => c.value === value)?.label ?? value;
}

export default function InterviewsTab() {
  const interviews = useQuery(api.recruitment.interviews.listUpcoming, {
    days: 30,
  });
  const [openApp, setOpenApp] = useState<Id<"candidateApplications"> | null>(
    null,
  );

  if (interviews === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Calendar />
          </EmptyMedia>
          <EmptyTitle>Tidak ada interview terjadwal</EmptyTitle>
          <EmptyDescription>
            Interview yang akan datang dalam 30 hari akan muncul di sini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {interviews.map((iv) => (
        <Card
          key={iv._id}
          className="cursor-pointer transition-colors hover:border-primary/40"
          onClick={() => setOpenApp(iv.applicationId)}
        >
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{iv.candidateName}</h3>
                  <Badge variant="outline">
                    {labelOf(INTERVIEW_TYPES, iv.interviewType)}
                  </Badge>
                  <Badge variant="secondary">
                    {labelOf(INTERVIEW_FORMATS, iv.format)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {iv.title} · {iv.jobTitle}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {new Date(iv.scheduledAt).toLocaleString("id-ID")}
                  </span>
                  <span>{iv.durationMinutes} menit</span>
                  {iv.meetingUrl ? (
                    <a
                      href={iv.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkIcon className="size-3.5" /> Link
                    </a>
                  ) : null}
                  {iv.interviewerNames.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {iv.interviewerNames.join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <ApplicationDetailPanel
        applicationId={openApp}
        onClose={() => setOpenApp(null)}
      />
    </div>
  );
}
