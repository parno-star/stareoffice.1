import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Building2,
  Crown,
  Pencil,
  Plus,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { DepartmentGroup } from "../_lib/org-utils.ts";
import {
  countDirectReports,
  colorClasses,
  getInitials,
  type ColorToken,
} from "../_lib/org-utils.ts";
import PersonCard from "./PersonCard.tsx";
import { cn } from "@/lib/utils.ts";

export type DepartmentMeta = {
  department: Doc<"departments">;
  head: Doc<"users"> | null;
  memberCount: number;
};

export default function DepartmentView({
  groups,
  officialDepartments,
  allUsers,
  onSelectUser,
  isAdmin,
  onEditManager,
  onAddOfficial,
  onEditOfficial,
  onDeleteOfficial,
}: {
  groups: Array<DepartmentGroup>;
  officialDepartments: Array<DepartmentMeta>;
  allUsers: Array<Doc<"users">>;
  onSelectUser: (id: Id<"users">) => void;
  isAdmin: boolean;
  onEditManager: (user: Doc<"users">) => void;
  onAddOfficial: () => void;
  onEditOfficial: (d: Doc<"departments">) => void;
  onDeleteOfficial: (d: Doc<"departments">) => void;
}) {
  // Build a lookup from department-name -> official metadata
  const metaByName = new Map<string, DepartmentMeta>();
  for (const m of officialDepartments) {
    metaByName.set(m.department.name, m);
  }

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Departemen Resmi</p>
            <p className="text-xs text-muted-foreground">
              Tetapkan kepala departemen, warna, dan metadata resmi.
            </p>
          </div>
          <Button size="sm" onClick={onAddOfficial} className="gap-1.5">
            <Plus className="size-4" />
            Departemen Baru
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => {
          const meta = metaByName.get(group.department);
          const color: ColorToken = (meta?.department.color as ColorToken) ?? "blue";
          const c = colorClasses(color);
          return (
            <Card
              key={group.department}
              className={cn("overflow-hidden relative")}
            >
              <div className={cn("absolute left-0 top-0 h-1 w-full", c.bgSolid)} />
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg text-lg",
                      c.bg,
                      c.text,
                    )}
                  >
                    {meta?.department.icon ?? <Building2 className="size-5" />}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {group.department}
                    </CardTitle>
                    {meta?.department.description ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {meta.department.description}
                      </p>
                    ) : (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {group.members.length} anggota
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", c.border, c.text)}
                  >
                    {group.members.length}
                  </Badge>
                  {isAdmin && meta ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          onEditOfficial(meta.department);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          onDeleteOfficial(meta.department);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {meta?.head ? (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2",
                      c.border,
                      c.bg,
                    )}
                  >
                    <Avatar className="size-8">
                      {meta.head.avatarUrl ? (
                        <AvatarImage
                          src={meta.head.avatarUrl}
                          alt={meta.head.name ?? ""}
                        />
                      ) : null}
                      <AvatarFallback
                        className={cn("text-xs font-semibold", c.text)}
                      >
                        {getInitials(meta.head.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <Crown className={cn("size-3", c.text)} />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Kepala Departemen
                        </span>
                      </div>
                      <p className="truncate text-sm font-semibold">
                        {meta.head.name ?? "Tanpa Nama"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {group.members.slice(0, 5).map((u) => (
                    <PersonCard
                      key={u._id}
                      user={u}
                      directReportCount={countDirectReports(u._id, allUsers)}
                      onClick={() => onSelectUser(u._id)}
                      isAdmin={isAdmin}
                      onEditManager={() => onEditManager(u)}
                      compact
                    />
                  ))}
                  {group.members.length > 5 ? (
                    <p className="pl-2 text-[11px] text-muted-foreground">
                      dan {group.members.length - 5} anggota lainnya...
                    </p>
                  ) : null}
                </div>

                {meta ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between gap-2"
                  >
                    <Link to={`/organization/department/${meta.department._id}`}>
                      Lihat detail departemen
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={onAddOfficial}
                  >
                    <Plus className="size-3.5" />
                    Jadikan departemen resmi
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
