import { useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ArrowLeft,
  Building2,
  Crown,
  Users as UsersIcon,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import EmployeeProfileDialog from "@/pages/directory/_components/EmployeeProfileDialog.tsx";
import PersonCard from "./_components/PersonCard.tsx";
import { colorClasses, getInitials, type ColorToken } from "./_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

function DetailContent({ departmentId }: { departmentId: Id<"departments"> }) {
  const navigate = useNavigate();
  const departments = useQuery(api.organization.listDepartments, {});
  const allUsers = useQuery(api.organization.listAll, {});

  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const dept = useMemo(() => {
    if (!departments) return null;
    return departments.find((d) => d.department._id === departmentId) ?? null;
  }, [departments, departmentId]);

  const members = useMemo(() => {
    if (!dept || !allUsers) return [];
    return allUsers
      .filter((u) => (u.department ?? "") === dept.department.name)
      .sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "id", {
          sensitivity: "base",
        }),
      );
  }, [dept, allUsers]);

  // Basic analytics per department
  const analytics = useMemo(() => {
    if (!members) return null;
    const managerIds = new Set<string>();
    for (const u of members) {
      if (u.managerId) managerIds.add(u.managerId);
    }
    const jobTitles = new Map<string, number>();
    for (const u of members) {
      if (u.jobTitle) {
        jobTitles.set(u.jobTitle, (jobTitles.get(u.jobTitle) ?? 0) + 1);
      }
    }
    const topTitles = Array.from(jobTitles.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return {
      total: members.length,
      managerCount: members.filter((u) => managerIds.has(u._id)).length,
      topTitles,
    };
  }, [members]);

  const isLoading = departments === undefined || allUsers === undefined;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!dept) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/organization")}
          className="mb-4 gap-1"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Departemen tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Departemen mungkin sudah dihapus atau tautannya tidak valid.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const color = (dept.department.color as ColorToken) ?? "blue";
  const c = colorClasses(color);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/organization")}
          className="gap-1"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/organization" className="hover:underline">
            Struktur Organisasi
          </Link>
          <ChevronRight className="size-3" />
          <span className="truncate">{dept.department.name}</span>
        </div>
      </div>

      {/* Header card */}
      <Card className={cn("overflow-hidden pt-0")}>
        <div className={cn("h-2 w-full", c.bgSolid)} />
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl",
                c.bg,
                c.text,
              )}
            >
              {dept.department.icon ?? <Building2 className="size-7" />}
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {dept.department.name}
              </h1>
              {dept.department.description ? (
                <p className="text-sm text-muted-foreground">
                  {dept.department.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge
                  variant="outline"
                  className={cn("gap-1", c.border, c.text)}
                >
                  <UsersIcon className="size-3" />
                  {members.length} anggota
                </Badge>
              </div>
            </div>
          </div>

          {dept.head ? (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                c.border,
                c.bg,
              )}
            >
              <Avatar className="size-12">
                {dept.head.avatarUrl ? (
                  <AvatarImage
                    src={dept.head.avatarUrl}
                    alt={dept.head.name ?? ""}
                  />
                ) : null}
                <AvatarFallback
                  className={cn("text-sm font-semibold", c.text)}
                >
                  {getInitials(dept.head.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <Crown className={cn("size-3.5", c.text)} />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Kepala Departemen
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {dept.head.name ?? "Tanpa Nama"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dept.head.jobTitle ?? "—"}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Stats */}
      {analytics ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Anggota</p>
              <p className="text-2xl font-bold tabular-nums">{analytics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Atasan di Departemen</p>
              <p className="text-2xl font-bold tabular-nums">
                {analytics.managerCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Jabatan Unik</p>
              <p className="text-2xl font-bold tabular-nums">
                {analytics.topTitles.length}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Top job titles */}
      {analytics && analytics.topTitles.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">Jabatan Terbanyak</p>
            <div className="flex flex-wrap gap-2">
              {analytics.topTitles.map((t) => (
                <Badge key={t.title} variant="secondary" className="gap-1">
                  {t.title}
                  <span className="rounded bg-background px-1 text-[10px] font-bold">
                    {t.count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Member list */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Anggota Departemen</h2>
        {members.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Belum ada anggota</EmptyTitle>
              <EmptyDescription>
                Isi field &ldquo;Departemen&rdquo; pada profil karyawan dengan nama{" "}
                {dept.department.name}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {members.map((u) => (
              <PersonCard
                key={u._id}
                user={u}
                directReportCount={0}
                onClick={() => {
                  setSelectedUserId(u._id);
                  setProfileOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <EmployeeProfileDialog
        userId={selectedUserId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}

export default function DepartmentDetailPage() {
  const { departmentId } = useParams();
  return (
    <>
      <AuthLoading>
        <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="p-6 text-center text-sm text-muted-foreground">
          Silakan masuk untuk melihat departemen.
        </div>
      </Unauthenticated>
      <Authenticated>
        {departmentId ? (
          <DetailContent departmentId={departmentId as Id<"departments">} />
        ) : null}
      </Authenticated>
    </>
  );
}
