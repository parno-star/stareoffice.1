import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import {
  ArrowLeft,
  Archive,
  Heart,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  Users,
  Users2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { getColorConfig } from "@/pages/training/_lib/training-utils.ts";
import PeerGroupFormDialog from "./_components/PeerGroupFormDialog.tsx";

const POST_KINDS: Array<{ value: string; label: string }> = [
  { value: "question", label: "Pertanyaan" },
  { value: "insight", label: "Insight" },
  { value: "resource", label: "Sumber daya" },
  { value: "update", label: "Update" },
];

function PeerGroupDetailInner() {
  const params = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const groupId = params.groupId as Id<"peerGroups">;
  const group = useQuery(api.training.peerGroups.getGroup, { groupId });
  const posts = useQuery(api.training.peerGroups.listPosts, { groupId });

  const createPost = useMutation(api.training.peerGroups.createPost);
  const deletePost = useMutation(api.training.peerGroups.deletePost);
  const toggleLike = useMutation(api.training.peerGroups.togglePostLike);
  const leaveGroup = useMutation(api.training.peerGroups.leaveGroup);
  const archiveGroup = useMutation(api.training.peerGroups.archiveGroup);
  const deleteGroup = useMutation(api.training.peerGroups.deleteGroup);

  const [content, setContent] = useState("");
  const [kind, setKind] = useState("insight");
  const [replyOpenFor, setReplyOpenFor] = useState<Id<"peerGroupPosts"> | null>(
    null,
  );
  const [replyContent, setReplyContent] = useState("");

  if (group === undefined || posts === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (group === null) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2 />
            </EmptyMedia>
            <EmptyTitle>Grup tidak ditemukan</EmptyTitle>
            <EmptyDescription>Mungkin telah dihapus.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => navigate("/mentorship?tab=groups")}
            >
              Kembali ke daftar grup
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const color = getColorConfig(group.coverColor);

  const handleCreate = async () => {
    if (!content.trim()) return;
    try {
      await createPost({ groupId, content, kind });
      setContent("");
      toast.success("Terkirim");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleReply = async (parentId: Id<"peerGroupPosts">) => {
    if (!replyContent.trim()) return;
    try {
      await createPost({
        groupId,
        content: replyContent,
        kind: "insight",
        parentId,
      });
      setReplyContent("");
      setReplyOpenFor(null);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Keluar dari grup ini?")) return;
    try {
      await leaveGroup({ groupId });
      toast.success("Anda keluar dari grup");
      navigate("/mentorship?tab=groups");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Hapus grup secara permanen?")) return;
    try {
      await deleteGroup({ groupId });
      toast.success("Grup dihapus");
      navigate("/mentorship?tab=groups");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveGroup({ groupId });
      toast.success("Status grup diperbarui");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer self-start"
        onClick={() => navigate("/mentorship?tab=groups")}
      >
        <ArrowLeft className="mr-1 size-4" /> Kembali
      </Button>

      <Card className="overflow-hidden pt-0">
        <div className={cn("p-6 text-white", color.cover)}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl">{group.icon ?? "🤝"}</span>
            <div className="flex gap-2">
              <span className="rounded-full border border-white/40 px-2 py-0.5 text-[11px]">
                {group.joinPolicy === "open" ? "Terbuka" : "Undangan"}
              </span>
              {group.status === "archived" ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                  Arsip
                </span>
              ) : null}
            </div>
          </div>
          <h1 className="mt-3 text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-sm text-white/85">{group.description}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/85">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {group.memberCount}
              {group.capacity > 0 ? ` / ${group.capacity}` : ""} anggota
            </span>
            {group.cadence ? <span>Jadwal: {group.cadence}</span> : null}
            {group.meetingUrl ? (
              <a
                href={group.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                <Video className="size-3.5" /> Link meeting
              </a>
            ) : null}
          </div>
        </div>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {group.iAmOwner ? (
            <>
              <PeerGroupFormDialog
                mode="edit"
                initialValues={{
                  id: group._id,
                  name: group.name,
                  description: group.description,
                  category: group.category,
                  coverColor: group.coverColor,
                  icon: group.icon,
                  joinPolicy: group.joinPolicy,
                  capacity: group.capacity,
                  cadence: group.cadence,
                  meetingUrl: group.meetingUrl,
                }}
                trigger={
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer gap-1"
                  >
                    <Pencil className="size-4" /> Edit
                  </Button>
                }
              />
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={handleArchive}
              >
                <Archive className="size-4" />
                {group.status === "archived" ? "Aktifkan" : "Arsipkan"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" /> Hapus
              </Button>
            </>
          ) : group.iAmMember ? (
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer"
              onClick={handleLeave}
            >
              Keluar grup
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="discussion" className="space-y-4">
        <TabsList>
          <TabsTrigger value="discussion" className="cursor-pointer">
            Diskusi
          </TabsTrigger>
          <TabsTrigger value="members" className="cursor-pointer">
            Anggota
          </TabsTrigger>
        </TabsList>
        <TabsContent value="discussion" className="space-y-4">
          {group.iAmMember ? (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="w-full cursor-pointer sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Bagikan pertanyaan, insight, atau sumber belajar..."
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="cursor-pointer gap-1"
                  onClick={handleCreate}
                >
                  <Send className="size-4" /> Kirim
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Gabung grup untuk melihat dan berpartisipasi dalam diskusi.
            </p>
          )}
          {group.iAmMember && posts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircle />
                </EmptyMedia>
                <EmptyTitle>Belum ada diskusi</EmptyTitle>
                <EmptyDescription>
                  Jadilah yang pertama berbagi insight atau pertanyaan.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {group.iAmMember
            ? posts.map((p) => (
                <div
                  key={p._id}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={p.author?.avatarUrl} />
                      <AvatarFallback>
                        {(p.author?.name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {p.author?.name ?? "Karyawan"}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                          {POST_KINDS.find((k) => k.value === p.kind)?.label ??
                            p.kind}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p._creationTime).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {p.content}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => toggleLike({ postId: p._id })}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 hover:text-foreground",
                            p.likedByMe && "text-rose-500",
                          )}
                        >
                          <Heart
                            className={cn(
                              "size-3.5",
                              p.likedByMe && "fill-current",
                            )}
                          />
                          {p.likeCount}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyOpenFor(
                              replyOpenFor === p._id ? null : p._id,
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                        >
                          <MessageCircle className="size-3.5" />
                          {p.replyCount}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("Hapus posting ini?")) return;
                            try {
                              await deletePost({ postId: p._id });
                              toast.success("Dihapus");
                            } catch (err) {
                              const msg =
                                err instanceof ConvexError
                                  ? ((err.data as { message?: string })
                                      .message ?? "Gagal")
                                  : "Gagal";
                              toast.error(msg);
                            }
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {p.replies && p.replies.length > 0 ? (
                        <div className="mt-3 space-y-2 border-l pl-3">
                          {p.replies.map((r) => (
                            <div
                              key={r._id}
                              className="flex items-start gap-2"
                            >
                              <Avatar className="size-7">
                                <AvatarImage src={r.author?.avatarUrl} />
                                <AvatarFallback>
                                  {(r.author?.name ?? "?")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 rounded-md bg-muted p-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold">
                                    {r.author?.name}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(
                                      r._creationTime,
                                    ).toLocaleString("id-ID")}
                                  </span>
                                </div>
                                <p className="mt-0.5 whitespace-pre-wrap text-xs">
                                  {r.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {replyOpenFor === p._id ? (
                        <div className="mt-2 flex gap-2">
                          <Textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={2}
                            placeholder="Tulis balasan..."
                          />
                          <Button
                            size="sm"
                            className="cursor-pointer self-start"
                            onClick={() => handleReply(p._id)}
                          >
                            Kirim
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            : null}
        </TabsContent>
        <TabsContent value="members">
          <div className="space-y-2">
            {group.members.map((m) => (
              <div
                key={m._id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <Avatar className="size-9">
                  <AvatarImage src={m.user?.avatarUrl} />
                  <AvatarFallback>
                    {(m.user?.name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user?.name ?? "Karyawan"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.user?.jobTitle ?? ""}
                    {m.user?.department ? ` · ${m.user.department}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    m.role === "owner"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted",
                  )}
                >
                  {m.role === "owner" ? "Owner" : "Anggota"}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PeerGroupDetailPage() {
  return (
    <>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-10 w-64" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-full flex-col items-center justify-center p-10">
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <PeerGroupDetailInner />
      </Authenticated>
    </>
  );
}
