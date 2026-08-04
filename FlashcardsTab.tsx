import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Layers, Plus, Flame, Target, CalendarClock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CATEGORY_OPTIONS,
  getColorConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";
import DeckFormDialog from "./DeckFormDialog.tsx";

export default function FlashcardsTab({ isAdmin }: { isAdmin: boolean }) {
  const [category, setCategory] = useState("all");
  const decks = useQuery(api.training.flashcards.listDecks, {
    category,
    includeUnpublished: isAdmin,
  });
  const stats = useQuery(api.training.flashcards.getMyFlashcardStats, {});

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deck tersedia</p>
              <p className="text-xl font-bold">{stats?.totalDecks ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Target className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sudah dipelajari</p>
              <p className="text-xl font-bold">
                {stats ? `${stats.learned} / ${stats.totalCards}` : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jatuh tempo hari ini</p>
              <p className="text-xl font-bold">{stats?.dueToday ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Flame className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Akurasi ingat</p>
              <p className="text-xl font-bold">
                {stats ? `${stats.accuracy}%` : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full cursor-pointer sm:w-56">
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
        {isAdmin ? (
          <DeckFormDialog
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <Plus className="size-4" /> Deck baru
              </Button>
            }
          />
        ) : null}
      </div>
      {decks === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>Belum ada deck flashcard</EmptyTitle>
            <EmptyDescription>
              Flashcard membantu memperkuat ingatan dengan pengulangan
              berjangka (spaced repetition).
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin ? (
            <EmptyContent>
              <DeckFormDialog
                trigger={
                  <Button size="sm" className="cursor-pointer gap-1">
                    <Plus className="size-4" /> Buat deck
                  </Button>
                }
              />
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <Link
              key={d._id}
              to={`/training/flashcards/${d._id}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div
                className={cn(
                  "flex items-center gap-3 p-4 text-white",
                  getColorConfig(d.coverColor).cover,
                )}
              >
                <span className="text-3xl">{d.icon ?? "🃏"}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold">{d.title}</p>
                  <p className="mt-0.5 text-xs text-white/85">
                    {d.cardCount} kartu
                  </p>
                </div>
                {!d.isPublished ? (
                  <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium">
                    Draft
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                {d.description ? (
                  <p className="line-clamp-2 text-muted-foreground">
                    {d.description}
                  </p>
                ) : (
                  <p className="line-clamp-2 italic text-muted-foreground">
                    Tanpa deskripsi
                  </p>
                )}
                <div className="mt-auto grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">{d.dueCount}</p>
                    <p className="text-[10px] uppercase tracking-wide">Jatuh tempo</p>
                  </div>
                  <div className="rounded-md bg-blue-500/10 p-2 text-blue-700 dark:text-blue-300">
                    <p className="font-semibold">{d.newCount}</p>
                    <p className="text-[10px] uppercase tracking-wide">Baru</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                    <p className="font-semibold">{d.learnedCount}</p>
                    <p className="text-[10px] uppercase tracking-wide">Hafal</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
