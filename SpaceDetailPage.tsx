import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  ArrowLeft,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { isAdminRole } from "@/convex/roles.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import ArticleCard from "@/pages/wiki/_components/ArticleCard.tsx";
import ArticleFormDialog from "@/pages/wiki/_components/ArticleFormDialog.tsx";
import SpaceFormDialog from "@/pages/wiki/_components/SpaceFormDialog.tsx";
import {
  getSpaceColorClasses,
} from "@/pages/wiki/_lib/wiki-utils.ts";
import { toast } from "sonner";

export default function SpaceDetailPage() {
  const params = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const spaceId = params.spaceId as Id<"wikiSpaces">;
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const space = useQuery(api.wiki.getSpace, { spaceId });
  const articles = useQuery(api.wiki.listArticles, {
    spaceId,
    search: debouncedSearch.trim() || undefined,
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const deleteSpace = useMutation(api.wiki.deleteSpace);

  const canManage =
    space && currentUser
      ? space.authorId === currentUser._id || isAdminRole(currentUser.role)
      : false;

  const handleDelete = async () => {
    try {
      await deleteSpace({ spaceId });
      toast.success("Space dihapus");
      navigate("/wiki");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menghapus")
          : "Gagal menghapus";
      toast.error(msg);
    }
  };

  if (space === undefined) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (space === null) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Space tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Space ini mungkin sudah dihapus.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/wiki")}>Kembali ke Wiki</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const colors = getSpaceColorClasses(space.color);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/wiki")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Semua space
        </Button>
      </div>

      <div
        className={`flex flex-col items-start gap-4 rounded-xl border p-5 md:flex-row md:items-center ${colors.softBg}`}
      >
        <div
          className={`flex size-14 items-center justify-center rounded-xl text-3xl ${colors.tile}`}
        >
          {space.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{space.name}</h1>
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Opsi space"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <SpaceFormDialog
                    mode="edit"
                    initialValues={{
                      spaceId: space._id,
                      name: space.name,
                      description: space.description ?? "",
                      icon: space.icon,
                      color: space.color,
                    }}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="size-4" />
                        Ubah space
                      </DropdownMenuItem>
                    }
                  />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" />
                    Hapus space
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          {space.description ? (
            <p className="mt-1 text-sm text-foreground/80">
              {space.description}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {space.articleCount}{" "}
            {space.articleCount === 1 ? "artikel" : "artikel"}
          </p>
        </div>
        <ArticleFormDialog
          defaultSpaceId={space._id}
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Tulis artikel
            </Button>
          }
          onSaved={(id) => navigate(`/wiki/article/${id}`)}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Cari artikel di ${space.name}...`}
          className="pl-9"
        />
      </div>

      {articles === undefined ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedSearch.trim() ? "Tidak ada hasil" : "Belum ada artikel"}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedSearch.trim()
                ? "Coba kata kunci lain atau buat artikel baru."
                : "Mulai menulis artikel pertama di space ini."}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedSearch.trim() ? (
            <EmptyContent>
              <ArticleFormDialog
                defaultSpaceId={space._id}
                trigger={
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />
                    Tulis artikel
                  </Button>
                }
                onSaved={(id) => navigate(`/wiki/article/${id}`)}
              />
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard
              key={a._id}
              article={a}
              showSpace={false}
              onClick={() => navigate(`/wiki/article/${a._id}`)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus space?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua artikel di space ini akan ikut terhapus dan tidak dapat
              dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void handleDelete();
              }}
            >
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
