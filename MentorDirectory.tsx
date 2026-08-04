import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Sparkles, Star, UserCircle2, Users } from "lucide-react";
import { useState } from "react";
import { CATEGORY_OPTIONS } from "@/pages/training/_lib/training-utils.ts";
import RequestMentorshipDialog from "./RequestMentorshipDialog.tsx";

export default function MentorDirectory({
  currentUserId,
}: {
  currentUserId: string | undefined;
}) {
  const [category, setCategory] = useState<string>("all");
  const [acceptingOnly, setAcceptingOnly] = useState(true);

  const mentors = useQuery(api.training.mentors.listMentors, {
    category,
    acceptingOnly,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full cursor-pointer sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={acceptingOnly ? "default" : "secondary"}
            size="sm"
            className="cursor-pointer"
            onClick={() => setAcceptingOnly((v) => !v)}
          >
            <Sparkles className="mr-1 size-3.5" /> Terima permintaan
          </Button>
        </div>
      </div>

      {mentors === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : mentors.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Belum ada mentor</EmptyTitle>
            <EmptyDescription>
              Jadilah mentor pertama dengan membuat profil di tab Anda.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => {
            const user = m.user;
            const isMe = user?._id === currentUserId;
            const slotsLeft = Math.max(0, m.capacity - m.activeMentees);
            return (
              <Card key={m._id} className="flex h-full flex-col overflow-hidden">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-12">
                      <AvatarImage src={user?.avatarUrl} />
                      <AvatarFallback>
                        {(user?.name ?? "M").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {user?.name ?? "Mentor"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.jobTitle ?? ""}
                        {user?.department ? ` · ${user.department}` : ""}
                      </p>
                    </div>
                    {m.averageRating ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <Star className="size-3 fill-current" />
                        {m.averageRating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">
                    {m.headline}
                  </p>
                  <p className="line-clamp-3 text-xs text-muted-foreground">
                    {m.bio}
                  </p>
                  {m.expertise.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {m.expertise.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
                        >
                          {t}
                        </span>
                      ))}
                      {m.expertise.length > 4 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                          +{m.expertise.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserCircle2 className="size-3.5" />
                      {m.activeMentees}/{m.capacity} mentee
                    </span>
                    <span>{m.sessionCount} sesi</span>
                  </div>
                  {!isMe ? (
                    m.isAcceptingRequests && slotsLeft > 0 && user ? (
                      <RequestMentorshipDialog
                        trigger={
                          <Button size="sm" className="cursor-pointer">
                            Minta mentorship
                          </Button>
                        }
                        mentorId={user._id}
                        mentorName={user.name ?? "Mentor"}
                      />
                    ) : (
                      <Button size="sm" variant="secondary" disabled>
                        {!m.isAcceptingRequests ? "Belum menerima" : "Penuh"}
                      </Button>
                    )
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      Profil Anda
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
