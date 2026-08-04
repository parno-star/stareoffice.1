import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
  ArrowLeft,
  Send,
  Trash2,
  MessageCircle,
  Ticket as TicketIcon,
  UserCog,
  CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { isAdminRole } from "@/convex/roles.ts";
import {
  getCategoryConfig,
  getPriorityConfig,
  getStatusConfig,
  getInitials,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "./_lib/support-utils.ts";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

function AuthorBlock({
  name,
  avatar,
  subtitle,
}: {
  name: string | null;
  avatar: string | null;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-9">
        {avatar ? <AvatarImage src={avatar} alt={name ?? ""} /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">
          {name ?? "Tidak diketahui"}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [commentContent, setCommentContent] = useState("");
  const [posting, setPosting] = useState(false);

  const id = ticketId as Id<"tickets">;
  const ticket = useQuery(api.tickets.getTicket, { ticketId: id });
  const comments = useQuery(api.tickets.listComments, { ticketId: id });
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const addComment = useMutation(api.tickets.addComment);
  const updateStatus = useMutation(api.tickets.updateStatus);
  const assignToMe = useMutation(api.tickets.assignToMe);
  const removeTicket = useMutation(api.tickets.removeTicket);

  if (ticket === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (ticket === null) {
    return (
      <div className="mx-auto max-w-3xl p-4 lg:p-6">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <TicketIcon />
            </ErrorStateMedia>
            <ErrorStateTitle>Tiket tidak ditemukan</ErrorStateTitle>
            <ErrorStateDescription>
              Tiket ini mungkin sudah dihapus atau Anda tidak memiliki akses.
            </ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" onClick={() => navigate("/support")}>
              Kembali ke Bantuan IT
            </Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const categoryCfg = getCategoryConfig(ticket.category);
  const priorityCfg = getPriorityConfig(ticket.priority);
  const statusCfg = getStatusConfig(ticket.status);
  const CategoryIcon = categoryCfg.icon;
  const PriorityIcon = priorityCfg.icon;
  const StatusIcon = statusCfg.icon;

  const isAdmin = isAdminRole(currentUser?.role);
  const isOwner = currentUser?._id === ticket.authorId;
  const canDelete = isOwner || isAdmin;
  const canClose = isOwner && ticket.status !== "closed";
  const isActive = ticket.status !== "resolved" && ticket.status !== "closed";

  const handleComment = async () => {
    const content = commentContent.trim();
    if (content.length === 0) {
      toast.error("Komentar tidak boleh kosong");
      return;
    }
    setPosting(true);
    try {
      await addComment({ ticketId: id, content });
      setCommentContent("");
      toast.success("Komentar terkirim");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim komentar");
      } else {
        toast.error("Gagal mengirim komentar");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus({ ticketId: id, status: newStatus });
      toast.success("Status diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui status");
      } else {
        toast.error("Gagal memperbarui status");
      }
    }
  };

  const handleAssign = async () => {
    try {
      await assignToMe({ ticketId: id });
      toast.success("Tiket berhasil diambil");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengambil tiket");
      } else {
        toast.error("Gagal mengambil tiket");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await removeTicket({ ticketId: id });
      toast.success("Tiket dihapus");
      navigate("/support");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus tiket");
      } else {
        toast.error("Gagal menghapus tiket");
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/support")}
        className="cursor-pointer gap-2 -ml-2"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Daftar Tiket
      </Button>

      {/* Main ticket */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("gap-1 text-xs", statusCfg.badge)}
                >
                  <StatusIcon className="size-3" />
                  {statusCfg.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("gap-1 text-xs", priorityCfg.badge)}
                >
                  <PriorityIcon className="size-3" />
                  {priorityCfg.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("gap-1 text-xs", categoryCfg.badge)}
                >
                  <CategoryIcon className="size-3" />
                  {categoryCfg.label}
                </Badge>
              </div>
              <h1 className="text-xl font-bold leading-snug sm:text-2xl">
                {ticket.title}
              </h1>
            </div>
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus tiket?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Semua komentar akan ikut dihapus. Tindakan ini tidak
                      dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void handleDelete();
                      }}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          <AuthorBlock
            name={ticket.authorName}
            avatar={ticket.authorAvatar}
            subtitle={format(
              new Date(ticket._creationTime),
              "d MMM yyyy, HH:mm",
              { locale: idLocale },
            )}
          />

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {ticket.description}
          </div>

          {/* Assignee row */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <UserCog className="size-3.5" />
              <span>
                Ditangani:{" "}
                <span className="font-medium text-foreground/80">
                  {ticket.assigneeName ?? "Belum ditugaskan"}
                </span>
              </span>
            </span>
          </div>

          {/* Admin / Owner actions */}
          {isAdmin || canClose ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {isAdmin ? (
                <>
                  <Select
                    value={ticket.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {!ticket.assigneeId ||
                  ticket.assigneeId !== currentUser?._id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleAssign}
                      className="gap-1.5"
                    >
                      <UserCog className="size-4" />
                      Ambil Tiket
                    </Button>
                  ) : null}
                </>
              ) : null}
              {canClose && !isAdmin ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatusChange("closed")}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-4" />
                  Tandai Selesai
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Komunikasi ({ticket.commentCount})
        </h2>
        {comments === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>Belum ada komentar</EmptyTitle>
              <EmptyDescription>
                Tambahkan informasi tambahan atau balasan dari tim IT.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          comments.map((comment) => {
            const timeAgo = formatDistanceToNow(
              new Date(comment._creationTime),
              { addSuffix: true, locale: idLocale },
            );
            const isAdminComment =
              ticket.assigneeId === comment.authorId ||
              comment.authorId !== ticket.authorId;
            return (
              <Card
                key={comment._id}
                className={cn(
                  isAdminComment &&
                    comment.authorId !== ticket.authorId &&
                    "border-primary/30 bg-primary/5",
                )}
              >
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <AuthorBlock
                      name={comment.authorName}
                      avatar={comment.authorAvatar}
                      subtitle={timeAgo}
                    />
                    {comment.authorId !== ticket.authorId ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-primary/30 bg-primary/10 text-xs text-primary"
                      >
                        <UserCog className="size-3" />
                        Tim IT
                      </Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {comment.content}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Comment form */}
      {isActive ? (
        <Card>
          <CardContent className="space-y-3">
            <label className="text-sm font-semibold">Tulis Komentar</label>
            <Textarea
              rows={4}
              placeholder="Tambahkan informasi, tanya-jawab, atau update..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              disabled={posting}
              maxLength={3000}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {commentContent.length}/3000
              </p>
              <Button
                onClick={handleComment}
                disabled={posting || commentContent.trim().length === 0}
                className="cursor-pointer gap-2"
              >
                <Send className="size-4" />
                {posting ? "Mengirim..." : "Kirim Komentar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Tiket ini sudah {statusCfg.label.toLowerCase()}. Komentar tidak dapat
          ditambahkan.
        </div>
      )}
    </div>
  );
}
