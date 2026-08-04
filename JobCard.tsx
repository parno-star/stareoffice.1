import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  MapPin,
  Building2,
  Calendar,
  Users as UsersIcon,
  ArrowRight,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { JobWithMeta } from "@/convex/jobs.ts";
import {
  formatJobDate,
  formatSalaryRange,
  getApplicationStatusConfig,
  getEmploymentTypeConfig,
  getLevelConfig,
  getStatusConfig,
  isJobClosingSoon,
} from "../_lib/job-utils.ts";

type Props = {
  job: JobWithMeta;
};

export default function JobCard({ job }: Props) {
  const navigate = useNavigate();
  const employment = getEmploymentTypeConfig(job.employmentType);
  const level = getLevelConfig(job.level);
  const status = getStatusConfig(job.status);
  const EmploymentIcon = employment.icon;
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const closingSoon = job.status === "open" && isJobClosingSoon(job.closingDate);

  const summary = job.description.replace(/[#*_`>]/g, "").trim().slice(0, 200);

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-colors hover:border-primary/40"
      onClick={() => navigate(`/jobs/${job._id}`)}
    >
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={status.badge}>
                {status.label}
              </Badge>
              {closingSoon ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                >
                  Segera ditutup
                </Badge>
              ) : null}
              {job.myApplicationStatus ? (
                <Badge
                  variant="outline"
                  className={
                    getApplicationStatusConfig(job.myApplicationStatus).badge
                  }
                >
                  Lamaran:{" "}
                  {getApplicationStatusConfig(job.myApplicationStatus).label}
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight group-hover:text-primary">
              {job.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" />
                {job.department}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {job.location}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 gap-1 cursor-pointer opacity-60 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/jobs/${job._id}`);
            }}
          >
            Detail
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={employment.badge}>
            <EmploymentIcon className="size-3" />
            {employment.label}
          </Badge>
          <Badge variant="outline" className={level.badge}>
            {level.label}
          </Badge>
          {salary ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80">
              <Wallet className="size-3.5" />
              {salary}
            </span>
          ) : null}
        </div>

        {summary ? (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {summary}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="size-3.5" />
            {job.applicationCount} pelamar
          </span>
          {job.closingDate ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Tutup {formatJobDate(job.closingDate)}
            </span>
          ) : (
            <span className="text-muted-foreground/70">Tanpa batas waktu</span>
          )}
          {job.postedByName ? (
            <span className="ml-auto">Posted by {job.postedByName}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
