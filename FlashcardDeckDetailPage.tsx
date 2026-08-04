import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  ArrowLeft,
  CheckCircle2,
  Layers,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Shuffle,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { getColorConfig } from "./_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";
import { isAdminRole } from "@/convex/roles.ts";
import DeckFormDialog from "./_components/DeckFormDialog.tsx";

function AddCardForm({ deckId }: { deckId: Id<"flashcardDecks"> }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const addCard = useMutation(api.training.flashcards.addCard);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (front.trim().length === 0 || back.trim().length === 0) {
      toast.error("Depan dan belakang wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await addCard({
        deckId,
        front: front.trim(),
        back: back.trim(),
        hint: hint.trim() || undefined,
      });
      toast.success("Kartu ditambahkan");
      setFront("");
      setBack("");
      setHint("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <p className="text-sm font-semibold">Tambah kartu baru</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="card-front">Depan</Label>
          <Textarea
            id="card-front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            placeholder="Pertanyaan / istilah"
            maxLength={300}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-back">Belakang</Label>
          <Textarea
            id="card-back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={2}
            placeholder="Jawaban / definisi"
            maxLength={500}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="card-hint">Petunjuk (opsional)</Label>
        <Input
          id="card-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Hint singkat"
          maxLength={200}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={submitting}
        className="cursor-pointer gap-1"
      >
        <Plus className="size-4" /> Tambah kartu
      </Button>
    </form>
  );
}

function EditCardInline({
  card,
  onClose,
}: {
  card: Doc<"flashcards">;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [hint, setHint] = useState(card.hint ?? "");
  const [saving, setSaving] = useState(false);
  const updateCard = useMutation(api.training.flashcards.updateCard);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCard({
        id: card._id,
        front: front.trim(),
        back: back.trim(),
        hint: hint.trim() || undefined,
      });
      toast.success("Kartu diperbarui");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <Textarea
        value={front}
        onChange={(e) => setFront(e.target.value)}
        rows={2}
        placeholder="Depan"
      />
      <Textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        rows={2}
        placeholder="Belakang"
      />
      <Input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Petunjuk (opsional)"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={onClose}
          disabled={saving}
        >
          Batal
        </Button>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
        >
          Simpan
        </Button>
      </div>
    </div>
  );
}

type QualityChoice = {
  value: number;
  label: string;
  hint: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
};

const QUALITY_CHOICES: Array<QualityChoice> = [
  {
    value: 0,
    label: "Lagi",
    hint: "< 10 menit",
    className:
      "bg-rose-500 hover:bg-rose-600 text-white dark:bg-rose-600 dark:hover:bg-rose-500",
    icon: XCircle,
  },
  {
    value: 3,
    label: "Bisa",
    hint: "Ulangi di interval berikutnya",
    className:
      "bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500",
    icon: CheckCircle2,
  },
  {
    value: 5,
    label: "Mudah",
    hint: "Interval lebih panjang",
    className:
      "bg-sky-500 hover:bg-sky-600 text-white dark:bg-sky-600 dark:hover:bg-sky-500",
    icon: CheckCircle2,
  },
];

function StudySession({
  deck,
  onDone,
}: {
  deck: Doc<"flashcardDecks">;
  onDone: () => void;
}) {
  const session = useQuery(api.training.flashcards.startSession, {
    deckId: deck._id,
    limit: 30,
  });
  const reviewCard = useMutation(api.training.flashcards.reviewCard);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const queue = useMemo(() => {
    if (!session) return [];
    // Use shuffleSeed to re-shuffle only when user clicks shuffle.
    if (shuffleSeed === 0) return session.queue;
    const arr = [...session.queue];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [session, shuffleSeed]);

  if (session === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (session.queue.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="mt-3 text-lg font-semibold">
            Hebat! Tidak ada kartu yang perlu ditinjau.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua kartu sudah hafal. Kembali nanti saat kartu berikutnya jatuh
            tempo.
          </p>
          <Button
            type="button"
            onClick={onDone}
            variant="secondary"
            className="mt-4 cursor-pointer"
          >
            Selesai
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (index >= queue.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="mt-3 text-lg font-semibold">
            Sesi selesai. {reviewed} kartu direview.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kartu akan muncul lagi sesuai jadwal spaced repetition.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIndex(0);
                setReviewed(0);
                setFlipped(false);
                setShuffleSeed(Date.now());
              }}
              className="cursor-pointer gap-1"
            >
              <RefreshCw className="size-4" /> Ulangi sesi
            </Button>
            <Button
              type="button"
              onClick={onDone}
              className="cursor-pointer"
            >
              Kembali ke deck
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = queue[index];

  const handleRate = async (quality: number) => {
    try {
      await reviewCard({ cardId: current.card._id, quality });
      setReviewed((r) => r + 1);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Kartu {index + 1} / {queue.length}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Jatuh tempo: <b>{session.totals.due}</b> · Baru:{" "}
            <b>{session.totals.new}</b>
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 cursor-pointer"
            onClick={() => setShuffleSeed(Date.now())}
            title="Acak urutan"
          >
            <Shuffle className="size-4" />
          </Button>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          "relative flex min-h-[260px] w-full cursor-pointer items-center justify-center rounded-2xl border-2 p-8 text-center transition-all",
          flipped
            ? "border-primary/50 bg-gradient-to-br from-primary/5 via-card to-card"
            : "border-border bg-card hover:border-primary/30",
        )}
      >
        <div className="max-w-xl space-y-3">
          {!flipped ? (
            <>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Depan
              </p>
              <p className="text-2xl font-semibold leading-snug text-balance">
                {current.card.front}
              </p>
              {current.card.hint ? (
                <p className="mt-4 text-xs italic text-muted-foreground">
                  Petunjuk: {current.card.hint}
                </p>
              ) : null}
              <p className="mt-6 text-xs text-muted-foreground">
                Klik untuk membalik kartu
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Belakang
              </p>
              <p className="text-2xl font-semibold leading-snug text-balance text-primary">
                {current.card.back}
              </p>
              <p className="mt-6 text-xs text-muted-foreground">
                Seberapa baik Anda mengingatnya?
              </p>
            </>
          )}
        </div>
      </button>
      {flipped ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {QUALITY_CHOICES.map((q) => (
            <Button
              key={q.value}
              type="button"
              onClick={() => {
                void handleRate(q.value);
              }}
              className={cn(
                "h-auto cursor-pointer flex-col gap-1 py-3",
                q.className,
              )}
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <q.icon className="size-4" />
                {q.label}
              </span>
              <span className="text-xs opacity-90">{q.hint}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setFlipped(true)}
          className="w-full cursor-pointer"
        >
          Lihat jawaban
        </Button>
      )}
    </div>
  );
}

function DeckDetailInner({ deckId }: { deckId: Id<"flashcardDecks"> }) {
  const deck = useQuery(api.training.flashcards.getDeck, { id: deckId });
  const stats = useQuery(api.training.flashcards.startSession, {
    deckId,
    limit: 30,
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isAdmin = isAdminRole(currentUser?.role);
  const navigate = useNavigate();
  const deleteCard = useMutation(api.training.flashcards.deleteCard);
  const deleteDeck = useMutation(api.training.flashcards.deleteDeck);
  const resetProgress = useMutation(api.training.flashcards.resetDeckProgress);
  const [studyOpen, setStudyOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<Id<"flashcards"> | null>(
    null,
  );

  if (deck === undefined) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (deck === null) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>Deck tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Mungkin deck sudah dihapus. Kembali ke daftar flashcard.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const handleDeleteDeck = async () => {
    if (
      !window.confirm(
        "Hapus deck ini beserta semua kartu dan progress belajar?",
      )
    ) {
      return;
    }
    try {
      await deleteDeck({ id: deckId });
      toast.success("Deck dihapus");
      navigate("/training?tab=flashcards");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menghapus")
          : "Gagal menghapus";
      toast.error(msg);
    }
  };

  const handleResetProgress = async () => {
    if (!window.confirm("Reset progress belajar Anda untuk deck ini?")) return;
    try {
      await resetProgress({ deckId });
      toast.success("Progress direset");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleDeleteCard = async (id: Id<"flashcards">) => {
    if (!window.confirm("Hapus kartu ini?")) return;
    try {
      await deleteCard({ id });
      toast.success("Kartu dihapus");
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
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 cursor-pointer"
      >
        <Link to="/training?tab=flashcards">
          <ArrowLeft className="size-4" /> Kembali ke flashcard
        </Link>
      </Button>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-2xl p-6 text-white sm:flex-row sm:items-center sm:justify-between",
          getColorConfig(deck.coverColor).cover,
        )}
      >
        <div className="flex items-start gap-4">
          <span className="text-5xl">{deck.icon ?? "🃏"}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-balance">
              {deck.title}
            </h1>
            {deck.description ? (
              <p className="mt-1 text-sm text-white/90">{deck.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
                {deck.cards.length} kartu
              </span>
              {!deck.isPublished ? (
                <span className="rounded-full border border-white/40 px-2 py-0.5">
                  Draft
                </span>
              ) : null}
              {stats ? (
                <>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
                    Jatuh tempo: {stats.totals.due}
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
                    Baru: {stats.totals.new}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="cursor-pointer gap-1 bg-white text-foreground hover:bg-white/90"
            onClick={() => setStudyOpen(true)}
            disabled={deck.cards.length === 0}
          >
            <Play className="size-4" /> Mulai belajar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer gap-1"
            onClick={() => {
              void handleResetProgress();
            }}
          >
            <Undo2 className="size-4" /> Reset progress
          </Button>
          {isAdmin ? (
            <>
              <DeckFormDialog
                mode="edit"
                initialValues={{
                  id: deck._id,
                  title: deck.title,
                  description: deck.description,
                  category: deck.category,
                  coverColor: deck.coverColor,
                  icon: deck.icon,
                  isPublished: deck.isPublished,
                }}
                trigger={
                  <Button
                    variant="secondary"
                    className="cursor-pointer gap-1"
                  >
                    <Pencil className="size-4" /> Ubah deck
                  </Button>
                }
              />
              <Button
                type="button"
                variant="secondary"
                className="cursor-pointer gap-1 text-destructive"
                onClick={() => {
                  void handleDeleteDeck();
                }}
              >
                <Trash2 className="size-4" /> Hapus
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {studyOpen ? (
        <StudySession deck={deck} onDone={() => setStudyOpen(false)} />
      ) : null}

      {isAdmin ? <AddCardForm deckId={deck._id} /> : null}

      <div>
        <p className="mb-2 text-sm font-semibold">Daftar kartu</p>
        {deck.cards.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers />
              </EmptyMedia>
              <EmptyTitle>Belum ada kartu</EmptyTitle>
              <EmptyDescription>
                {isAdmin
                  ? "Tambahkan kartu pertama di atas."
                  : "Admin belum menambahkan kartu ke deck ini."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {deck.cards.map((c, i) => (
              <Card key={c._id}>
                <CardContent className="space-y-3 p-4">
                  {editingCardId === c._id ? (
                    <EditCardInline
                      card={c}
                      onClose={() => setEditingCardId(null)}
                    />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Kartu #{i + 1}
                        </p>
                        {isAdmin ? (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 cursor-pointer"
                              onClick={() => setEditingCardId(c._id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 cursor-pointer text-destructive"
                              onClick={() => {
                                void handleDeleteCard(c._id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Depan
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {c.front}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Belakang
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-primary">
                            {c.back}
                          </p>
                        </div>
                      </div>
                      {c.hint ? (
                        <p className="text-xs italic text-muted-foreground">
                          Petunjuk: {c.hint}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlashcardDeckDetailPage() {
  const { deckId } = useParams<{ deckId: Id<"flashcardDecks"> }>();
  return (
    <>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-8 w-64" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-10">
          <p className="text-muted-foreground">
            Silakan masuk untuk melihat flashcard.
          </p>
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        {deckId ? <DeckDetailInner deckId={deckId} /> : null}
      </Authenticated>
    </>
  );
}
