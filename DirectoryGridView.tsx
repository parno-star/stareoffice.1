import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Mail, Phone, MapPin, Users as UsersIcon } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  colorForDepartment,
  COLOR_CLASSES,
  getInitials,
} from "../_lib/directory-utils.ts";
import EmployeeActionsMenu from "./EmployeeActionsMenu.tsx";
import { computeCompleteness } from "../_lib/directory-completeness.ts";
import { CompletenessRing, IncompleteBadge } from "./CompletenessIndicators.tsx";
import AccountStatusBadge from "./AccountStatusBadge.tsx";

export default function DirectoryGridView({
  entries,
  onSelect,
  currentUserId,
  canManage,
  customFieldDefs,
}: {
  entries: Array<DirectoryEntry>;
  onSelect: (id: Id<"users">) => void;
  currentUserId?: Id<"users"> | null;
  canManage?: boolean;
  customFieldDefs?: Array<Doc<"directoryFields">>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => {
        const tone = COLOR_CLASSES[colorForDepartment(entry.user.department)];
        const isSelf = currentUserId === entry.user._id;
        // Admins see the indicator on every card; regular employees only on
        // their own card as a personal reminder.
        const showCompleteness = canManage || isSelf;
        const completeness = computeCompleteness(
          entry.user,
          customFieldDefs ?? [],
        );
        return (
          <Card
            key={entry.user._id}
            onClick={() => onSelect(entry.user._id)}
            className="group cursor-pointer overflow-hidden pt-0 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            {/* Colored accent strip */}
            <div className={`h-1.5 w-full ${tone.accent}`} />
            <CardContent className="flex items-start gap-4 pt-4">
              <Avatar className="size-14 ring-2 ring-background">
                {entry.user.avatarUrl ? (
                  <AvatarImage
                    src={entry.user.avatarUrl}
                    alt={entry.user.name ?? ""}
                  />
                ) : null}
                <AvatarFallback
                  className={`${tone.chip} font-semibold`}
                >
                  {getInitials(entry.user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight group-hover:text-primary">
                      {entry.user.name ?? "Tanpa Nama"}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {entry.user.jobTitle ?? "Belum ada jabatan"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {entry.user.department ? (
                        <Badge
                          variant="secondary"
                          className={`${tone.chip} border-transparent`}
                        >
                          {entry.user.department}
                        </Badge>
                      ) : null}
                      {showCompleteness ? (
                        <IncompleteBadge result={completeness} />
                      ) : null}
                      {canManage ? (
                        <AccountStatusBadge user={entry.user} />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {showCompleteness && !completeness.isComplete ? (
                      <CompletenessRing percent={completeness.percent} />
                    ) : null}
                    {canManage ? (
                      <EmployeeActionsMenu
                        employee={entry.user}
                        canDelete={!isSelf}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                  {entry.user.email ? (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{entry.user.email}</span>
                    </div>
                  ) : null}
                  {entry.user.phone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3.5 shrink-0" />
                      <span className="truncate">{entry.user.phone}</span>
                    </div>
                  ) : null}
                  {entry.user.location ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{entry.user.location}</span>
                    </div>
                  ) : null}
                  {entry.directReportCount > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="size-3.5 shrink-0" />
                      <span>{entry.directReportCount} bawahan langsung</span>
                    </div>
                  ) : null}
                </div>

                {entry.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {entry.skills.slice(0, 3).map((s) => (
                      <span
                        key={s.skill}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                      >
                        {s.skill}
                      </span>
                    ))}
                    {entry.skills.length > 3 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        +{entry.skills.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
