import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { PollListItem } from "@/convex/polls";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  Lock,
  MoreVertical,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  formatCloseCountdown,
  formatClosesAt,
  formatCreated,
  getInitials,
} from "../_lib/polls-utils.ts";

type Props = {
  poll: PollListItem;
  currentUserId: Id<"users"> | null;
  isAdmin: boolean;
};

export default function PollCard({ poll, currentUserId, isAdmin }: Props) {
  const [selected, setSelected] = useState<Array<string>>([]);
  const [submitting, setSubmitting] = useState(false);

  const voteMutation = useMutation(api.polls.vote);
  const closeMutation = useMutation(api.polls.closePoll);
  const removeMutation = useMutation(api.polls.removePoll);

  const isOwner = currentUserId !== null && poll.authorId === currentUserId;
  const canManage = isOwner || isAdmin;
  const canVote = !poll.hasVoted && !poll.isClosed;

  const toggleOption = (id: string) => {
    if (poll.allowMultiple) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setSelected([id]);
    }
  };

  const handleVote = async () => {
    if (selected.length === 0) {
      toast.error("Pilih minimal satu jawaban");
      return;
    }
    setSubmitting(true);
    try {
      await voteMutation({ pollId: poll._id, optionIds: selected });
      toast.success("Suara Anda telah tercatat");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memberi suara");
      } else {
        toast.error("Gagal memberi suara");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    try {
      await closeMutation({ pollId: poll._id });
      toast.success("Polling ditutup");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menutup polling");
      } else {
        toast.error("Gagal menutup polling");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await removeMutation({ pollId: poll._id });
      toast.success("Polling dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus polling");
      } else {
        toast.error("Gagal menghapus polling");
      }
    }
  };

  const countdown = formatCloseCountdown(poll.closesAt);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-tight">
                {poll.question}
              </h3>
              {poll.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {poll.description}
                </p>
              ) : null}
            </div>
          </div>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!poll.isClosed ? (
                  <DropdownMenuItem onClick={handleClose}>
                    <Lock className="mr-2 size-4" />
                    Tutup Polling
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Hapus
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus polling ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Polling dan seluruh suaranya akan dihapus permanen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {poll.isClosed ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="size-3" />
              Ditutup
            </Badge>
          ) : (
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Aktif
            </Badge>
          )}
          {poll.allowMultiple ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" />
              Pilihan ganda
            </Badge>
          ) : null}
          {poll.isAnonymous ? (
            <Badge variant="secondary" className="gap-1">
              <EyeOff className="size-3" />
              Anonim
            </Badge>
          ) : null}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" />
            <span>{poll.voteCount} suara</span>
          </div>
          {countdown ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              <span title={formatClosesAt(poll.closesAt)}>{countdown}</span>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Options */}
        {poll.canSeeResults ? (
          <ResultsView poll={poll} />
        ) : (
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  disabled={!canVote}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left text-sm transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  {poll.allowMultiple ? (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOption(opt.id)}
                      className="pointer-events-none"
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {isSelected ? (
                        <span className="size-2 rounded-full bg-primary-foreground" />
                      ) : null}
                    </span>
                  )}
                  <span className="flex-1">{opt.text}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Actions and footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6">
              {poll.authorAvatar ? (
                <AvatarImage src={poll.authorAvatar} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[10px]">
                {getInitials(poll.authorName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">
              {poll.authorName ?? "Karyawan"} · {formatCreated(poll._creationTime)}
            </span>
          </div>
          {canVote && !poll.canSeeResults ? (
            <Button
              size="sm"
              onClick={handleVote}
              disabled={submitting || selected.length === 0}
              className="gap-1.5"
            >
              <Check className="size-4" />
              {submitting ? "Mengirim..." : "Kirim Suara"}
            </Button>
          ) : null}
          {poll.hasVoted && !poll.isClosed ? (
            <Badge
              variant="secondary"
              className="gap-1 bg-primary/10 text-primary"
            >
              <CheckCircle2 className="size-3" />
              Suara tercatat
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsView({ poll }: { poll: PollListItem }) {
  const maxVote = Math.max(1, ...poll.options.map((o) => o.voteCount));
  return (
    <div className="space-y-2.5">
      {poll.options.map((opt) => {
        const isWinner =
          poll.voteCount > 0 && opt.voteCount === maxVote && opt.voteCount > 0;
        return (
          <div
            key={opt.id}
            className={cn(
              "rounded-lg border p-3",
              opt.isSelected
                ? "border-primary/60 bg-primary/5"
                : "bg-muted/30",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {opt.isSelected ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3 text-primary-foreground" />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "truncate text-sm",
                    opt.isSelected && "font-medium",
                    isWinner && "font-semibold",
                  )}
                >
                  {opt.text}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-muted-foreground tabular-nums">
                  {opt.voteCount} suara
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    isWinner ? "text-primary" : "text-foreground",
                  )}
                >
                  {opt.percentage}%
                </span>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isWinner ? "bg-primary" : "bg-primary/40",
                )}
                style={{ width: `${opt.percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
