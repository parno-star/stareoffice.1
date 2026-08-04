import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Mail, Phone, ExternalLink } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  colorForDepartment,
  COLOR_CLASSES,
  getInitials,
} from "../_lib/directory-utils.ts";
import { toast } from "sonner";
import EmployeeActionsMenu from "./EmployeeActionsMenu.tsx";
import { computeCompleteness } from "../_lib/directory-completeness.ts";
import { IncompleteBadge } from "./CompletenessIndicators.tsx";
import AccountStatusBadge from "./AccountStatusBadge.tsx";

export default function DirectoryListView({
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
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} disalin`);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="hidden grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <div className="col-span-4">Nama & Jabatan</div>
        <div className="col-span-2">Departemen</div>
        <div className="col-span-3">Kontak</div>
        <div className="col-span-2">Lokasi</div>
        <div className="col-span-1 text-right">Aksi</div>
      </div>
      <ul className="divide-y">
        {entries.map((entry) => {
          const tone = COLOR_CLASSES[colorForDepartment(entry.user.department)];
          const isSelf = currentUserId === entry.user._id;
          const showCompleteness = canManage || isSelf;
          const completeness = computeCompleteness(
            entry.user,
            customFieldDefs ?? [],
          );
          return (
            <li
              key={entry.user._id}
              className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-12 md:items-center md:gap-4"
            >
              <div className="col-span-4 flex items-center gap-3">
                <Avatar className="size-10 shrink-0">
                  {entry.user.avatarUrl ? (
                    <AvatarImage
                      src={entry.user.avatarUrl}
                      alt={entry.user.name ?? ""}
                    />
                  ) : null}
                  <AvatarFallback className={`${tone.chip} font-semibold`}>
                    {getInitials(entry.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelect(entry.user._id)}
                      className="block cursor-pointer truncate text-left font-semibold leading-tight hover:text-primary hover:underline"
                    >
                      {entry.user.name ?? "Tanpa Nama"}
                    </button>
                    {showCompleteness ? (
                      <IncompleteBadge result={completeness} />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.user.jobTitle ?? "—"}
                  </p>
                  {canManage ? (
                    <AccountStatusBadge
                      user={entry.user}
                      className="mt-1 text-[10px]"
                    />
                  ) : null}
                </div>
              </div>
              <div className="col-span-2">
                {entry.user.department ? (
                  <Badge
                    variant="secondary"
                    className={`${tone.chip} border-transparent`}
                  >
                    {entry.user.department}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <div className="col-span-3 flex flex-wrap items-center gap-1">
                {entry.user.email ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => {
                      void copy(entry.user.email ?? "", "Email");
                    }}
                  >
                    <Mail className="size-3.5" />
                    <span className="max-w-[160px] truncate">
                      {entry.user.email}
                    </span>
                  </Button>
                ) : null}
                {entry.user.phone ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => {
                      void copy(entry.user.phone ?? "", "Telepon");
                    }}
                  >
                    <Phone className="size-3.5" />
                    <span className="max-w-[120px] truncate">
                      {entry.user.phone}
                    </span>
                  </Button>
                ) : null}
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                <span className="truncate">{entry.user.location ?? "—"}</span>
              </div>
              <div className="col-span-1 flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onSelect(entry.user._id)}
                  aria-label="Buka profil"
                >
                  <ExternalLink className="size-4" />
                </Button>
                {canManage ? (
                  <EmployeeActionsMenu
                    employee={entry.user}
                    canDelete={!isSelf}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
