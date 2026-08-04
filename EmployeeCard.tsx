import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Mail, Phone, MapPin } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function EmployeeCard({
  employee,
  onClick,
}: {
  employee: Doc<"users">;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
    >
      <CardContent className="flex items-start gap-4">
        <Avatar className="size-14">
          {employee.avatarUrl ? (
            <AvatarImage src={employee.avatarUrl} alt={employee.name ?? ""} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(employee.name).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground">
                {employee.name ?? "Tanpa Nama"}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {employee.jobTitle ?? "Belum ada jabatan"}
              </p>
            </div>
            {employee.department ? (
              <Badge variant="secondary" className="shrink-0">
                {employee.department}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1 pt-1 text-xs text-muted-foreground">
            {employee.email ? (
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
            ) : null}
            {employee.phone ? (
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                <span className="truncate">{employee.phone}</span>
              </div>
            ) : null}
            {employee.location ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{employee.location}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
