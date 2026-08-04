import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { BriefcaseBusiness, Search } from "lucide-react";
import JobCard from "./JobCard.tsx";
import JobFormDialog from "./JobFormDialog.tsx";
import { JOB_STATUSES, JOB_STATUS_CONFIG } from "../_lib/recruitment-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function JobsTab({
  onOpenJob,
}: {
  onOpenJob: (id: Id<"recruitmentJobs">) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [department, setDepartment] = useState("all");

  const jobs = useQuery(api.recruitment.jobs.list, {
    status,
    department,
    search: search.trim() || undefined,
  });
  const departments = useQuery(api.recruitment.jobs.listDepartments, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari posisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Departemen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Departemen</SelectItem>
            {(departments ?? []).map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {JOB_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JobFormDialog mode="create" />
      </div>

      {jobs === undefined ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BriefcaseBusiness />
            </EmptyMedia>
            <EmptyTitle>Belum ada lowongan</EmptyTitle>
            <EmptyDescription>
              Buat lowongan eksternal pertama untuk memulai proses rekrutmen.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} onOpen={onOpenJob} />
          ))}
        </div>
      )}
    </div>
  );
}
