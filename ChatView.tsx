import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  ArrowLeft,
  CheckCheck,
  CheckSquare,
  MessageCircle,
  MoreVertical,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  dayKey,
  formatBubbleTime,
  formatDayHeader,
  getInitials,
} from "@/pages/messages/_lib/messages-utils.ts";

export default function ChatView({
  conversationId,
  currentUser,
  onBack,
  onConversationDeleted,
}: {
  conversationId: Id<"conversations"> | null;
  currentUser: Doc<"users"> | null | undefined;
  onBack?: () => void;
  onConversationDeleted?: () => void;
}) {
  const conversationData = useQuery(
    api.messages.getConversation,
    conversationId ? { conversationId } : "skip",
  );
  const messages = useQuery(
    api.messages.listMessages,
    conversationId ? { conversationId } : "skip",
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markConversationRead);
  const deleteMessages = useMutation(api.messages.deleteMessages);
  const deleteConversation = useMutation(api.messages.deleteConversation);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteConvOpen, setDeleteConvOpen] = useState(false);
  // Mode pilih pesan: menampilkan kotak centang di setiap pesan milik sendiri
  // agar bisa memilih beberapa pesan lalu menghapusnya sekaligus.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"directMessages">>>(
    new Set(),
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Scroll to latest when messages arrive
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages?.length, conversationId]);

  // Keluar dari mode pilih pesan saat berpindah percakapan.
  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [conversationId]);

  // Mark conversation as read when opened / new messages arrive
  const hasUnreadForMe = useMemo(() => {
    if (!messages || !currentUser) return false;
    return messages.some(
      (m) => m.recipientId === currentUser._id && !m.readAt,
    );
  }, [messages, currentUser]);

  useEffect(() => {
    if (!conversationId) return;
    if (!hasUnreadForMe) return;
    void markRead({ conversationId }).catch(() => {
      /* ignore */
    });
  }, [conversationId, hasUnreadForMe, markRead]);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircle />
            </EmptyMedia>
            <EmptyTitle>Pilih percakapan</EmptyTitle>
            <EmptyDescription>
              Pilih rekan kerja dari daftar di sebelah kiri untuk mulai
              mengobrol.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (conversationData === undefined) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-12 w-48 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-60 rounded-2xl" />
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Conversation was deleted or is no longer accessible.
  if (conversationData === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircle />
            </EmptyMedia>
            <EmptyTitle>Percakapan tidak tersedia</EmptyTitle>
            <EmptyDescription>
              Percakapan ini sudah dihapus atau tidak dapat diakses.
            </EmptyDescription>
          </EmptyHeader>
          {onBack ? (
            <EmptyContent>
              <Button size="sm" onClick={onBack}>
                Kembali ke daftar
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      </div>
    );
  }

  const other = conversationData.otherUser;

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId, content: trimmed });
      setDraft("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ??
            "Gagal mengirim pesan")
          : "Gagal mengirim pesan";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const toggleSelect = (messageId: Id<"directMessages">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const count = await deleteMessages({ messageIds: ids });
      toast.success(`${count} pesan dihapus`);
      exitSelectMode();
    } catch {
      toast.error("Gagal menghapus pesan");
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) return;
    try {
      await deleteConversation({ conversationId });
      toast.success("Percakapan dihapus");
      setDeleteConvOpen(false);
      onConversationDeleted?.();
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ??
            "Gagal menghapus percakapan")
          : "Gagal menghapus percakapan";
      toast.error(msg);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-3 py-3 md:px-4">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="md:hidden"
          >
            <ArrowLeft className="size-5" />
          </Button>
        ) : null}
        <Avatar className="size-10">
          {other?.avatarUrl ? (
            <AvatarImage src={other.avatarUrl} alt={other.name ?? ""} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(other?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {other?.name ?? "Tanpa nama"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {other?.jobTitle
              ? `${other.jobTitle}${other.department ? ` · ${other.department}` : ""}`
              : (other?.department ?? "")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Opsi percakapan">
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSelectMode(true)}>
              <CheckSquare className="size-4" />
              Pilih pesan untuk dihapus
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteConvOpen(true)}
            >
              <Trash2 className="size-4" />
              Hapus percakapan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Toolbar mode pilih pesan */}
      {selectMode ? (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 md:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={exitSelectMode}
            aria-label="Batal memilih"
          >
            <X className="size-5" />
          </Button>
          <span className="text-sm font-medium">
            {selectedIds.size} pesan dipilih
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Hapus
          </Button>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
        {messages === undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-56 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-40 rounded-2xl" />
              <Skeleton className="h-10 w-64 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-10 text-center text-sm text-muted-foreground">
              Mulai percakapan dengan {other?.name ?? "rekan kerja"} Anda.
            </div>
          ) : (
            <div className="space-y-2.5">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const sameDayAsPrev = prev
                  ? dayKey(new Date(prev._creationTime).toISOString()) ===
                    dayKey(new Date(m._creationTime).toISOString())
                  : false;
                const mine = currentUser && m.senderId === currentUser._id;
                const selectable = selectMode && mine;
                const checked = selectedIds.has(m._id);
                return (
                  <div key={m._id}>
                    {!sameDayAsPrev ? (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                          {formatDayHeader(new Date(m._creationTime).toISOString())}
                        </span>
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "flex items-end gap-2",
                        mine ? "justify-end" : "justify-start",
                      )}
                    >
                      {selectable ? (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelect(m._id)}
                          aria-label="Pilih pesan"
                          className="mb-1.5 shrink-0"
                        />
                      ) : null}
                      {!mine ? (
                        <Avatar className="size-7 shrink-0">
                          {other?.avatarUrl ? (
                            <AvatarImage
                              src={other.avatarUrl}
                              alt={other.name ?? ""}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {getInitials(other?.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      <div
                        onClick={selectable ? () => toggleSelect(m._id) : undefined}
                        className={cn(
                          "group relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed md:max-w-[65%]",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                          selectable && "cursor-pointer",
                          selectable && checked && "ring-2 ring-destructive ring-offset-2 ring-offset-background",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {m.content}
                        </p>
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1 text-[10px]",
                            mine
                              ? "justify-end text-primary-foreground/75"
                              : "text-muted-foreground",
                          )}
                        >
                          <span>
                            {formatBubbleTime(
                              new Date(m._creationTime).toISOString(),
                            )}
                          </span>
                          {mine && m.readAt ? (
                            <CheckCheck className="size-3" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Composer */}
      <div className="border-t bg-card p-3">
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pesan untuk ${other?.name ?? "rekan"}...`}
            disabled={sending}
            maxLength={4000}
            autoFocus
          />
          <Button
            onClick={() => {
              void handleSend();
            }}
            disabled={sending || draft.trim().length === 0}
            size="icon"
            aria-label="Kirim pesan"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      {/* Confirm delete whole conversation */}
      <AlertDialog open={deleteConvOpen} onOpenChange={setDeleteConvOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus seluruh percakapan?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua pesan dalam percakapan dengan{" "}
              <span className="font-medium text-foreground">
                {other?.name ?? "rekan kerja ini"}
              </span>{" "}
              akan dihapus permanen untuk kedua belah pihak. Tindakan ini tidak
              dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void handleDeleteConversation();
              }}
            >
              Hapus Percakapan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk delete selected messages */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {selectedIds.size} pesan terpilih?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pesan yang dipilih akan dihapus permanen dan tidak dapat
              dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void handleBulkDelete();
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
