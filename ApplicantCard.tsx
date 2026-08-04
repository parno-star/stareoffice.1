import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import {
  Paperclip,
  ExternalLink,
  ChevronDown,
  Mail,
  Briefcase,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { ApplicationWithUser } from "@/convex/jobs.ts";
import { getApplicationStatusConfig } from "../_lib/job-utils.ts";
import ReviewApplicationDialog from "./ReviewApplicationDialog.tsx";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

type Props = {
  application: ApplicationWithUser;
  canReview: boolean;
};

export default function ApplicantCard({ application, canReview }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const statusConfig = getApplicationStatusConfig(application.status);

  return (
    <>
      <Card>
        <CardContent className="p-4 sm:p-5">
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="flex flex-wrap items-start gap-3">
              <Avatar className="size-10 shrink-0">
                {application.applicantAvatar ? (
                  <AvatarImage src={application.applicantAvatar} />
                ) : null}
                <AvatarFallback>
                  {getInitials(application.applicantName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate font-semibold">
                    {application.applicantName ?? "Karyawan"}
                  </h4>
                  <Badge variant="outline" className={statusConfig.badge}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {application.applicantJobTitle ? (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="size-3" />
                      {application.applicantJobTitle}
                    </span>
                  ) : null}
                  {application.applicantDepartment ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3" />
                      {application.applicantDepartment}
                    </span>
                  ) : null}
                  {application.applicantEmail ? (
                    <a
                      href={`mailto:${application.applicantEmail}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Mail className="size-3" />
                      {application.applicantEmail}
                    </a>
                  ) : null}
                  <span>
                    Dilamar{" "}
                    {formatDistanceToNowStrict(
                      new Date(application._creationTime),
                      { locale: idLocale, addSuffix: true },
                    )}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canReview &&
                application.status !== "withdrawn" &&
                application.status !== "accepted" &&
                application.status !== "rejected" ? (
                  <Button
                    size="sm"
                    onClick={() => setReviewOpen(true)}
                    className="cursor-pointer"
                  >
                    Tinjau
                  </Button>
                ) : null}
                <CollapsibleTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="cursor-pointer"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Surat Lamaran
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {application.coverLetter}
                </p>
              </div>

              {application.resumeUrl ? (
                <a
                  href={application.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  <Paperclip className="size-3.5" />
                  {application.resumeFileName ?? "Lihat CV"}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}

              {application.reviewNote ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    Catatan dari {application.reviewerName ?? "reviewer"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {application.reviewNote}
                  </p>
                </div>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <ReviewApplicationDialog
        applicationId={application._id}
        applicantName={application.applicantName}
        currentStatus={application.status}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </>
  );
}
