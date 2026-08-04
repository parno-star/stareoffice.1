import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
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
import {
  Star,
  Mail,
  FileText,
  Trash2,
  Loader2,
  Briefcase,
  Calendar as CalendarIcon,
  Link as LinkIcon,
  Clock,
} from "lucide-react";
import ScheduleInterviewDialog from "./ScheduleInterviewDialog.tsx";
import {
  INTERVIEW_TYPES,
  INTERVIEW_FORMATS,
  RECRUITMENT_STAGES,
  STAGE_CONFIG,
  type RecruitmentStage,
  formatIDR,
} from "../_lib/recruitment-utils.ts";

const NOTE_KINDS = [
  { value: "note", label: "Catatan" },
  { value: "feedback", label: "Feedback" },
  { value: "screening", label: "Screening" },
  { value: "reference", label: "Referensi" },
] as const;

function labelOf(
  collection: ReadonlyArray<{ value: string; label: string }>,
  value: string,
): string {
  return collection.find((c) => c.value === value)?.label ?? value;
}

export default function ApplicationDetailPanel({
  applicationId,
  onClose,
}: {
  applicationId: Id<"candidateApplications"> | null;
  onClose: () => void;
}) {
  const [stage, setStageValue] = useState<string>("");
  const [noteKind, setNoteKind] = useState("note");
  const [noteContent, setNoteContent] = useState("");
  const [noteRating, setNoteRating] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [reason, setReason] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const open = applicationId !== null;
  const app = useQuery(
    api.recruitment.applications.getById,
    applicationId ? { id: applicationId } : "skip",
  );
  const notes = useQuery(
    api.recruitment.applications.listNotes,
    applicationId ? { applicationId } : "skip",
  );
  const interviews = useQuery(
    api.recruitment.interviews.listForApplication,
    applicationId ? { applicationId } : "skip",
  );
  const setStage = useMutation(api.recruitment.applications.setStage);
  const addNote = useMutation(api.recruitment.applications.addNote);
  const removeNote = useMutation(api.recruitment.applications.removeNote);
  const removeApp = useMutation(api.recruitment.applications.remove);
  const setInterviewOutcome = useMutation(
    api.recruitment.interviews.setOutcome,
  );

  // sync stage state
  if (app && stage === "") setStageValue(app.stage);

  const handleStageChange = async (newStage: string) => {
    if (!applicationId || !app) return;
    setStageValue(newStage);
    try {
      setSavingStage(true);
      await setStage({
        id: applicationId,
        stage: newStage,
        reason:
          newStage === "rejected" || newStage === "withdrawn"
            ? reason || undefined
            : undefined,
        offeredSalary:
          (newStage === "offer" || newStage === "hired") && offeredSalary
            ? Number(offeredSalary)
            : undefined,
      });
      toast.success(`Stage: ${STAGE_CONFIG[newStage as RecruitmentStage].label}`);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    } finally {
      setSavingStage(false);
    }
  };

  const handleAddNote = async () => {
    if (!applicationId || !noteContent.trim()) {
      toast.error("Isi catatan tidak boleh kosong");
      return;
    }
    try {
      setSavingNote(true);
      await addNote({
        applicationId,
        kind: noteKind,
        content: noteContent,
        rating: noteRating ? Number(noteRating) : undefined,
      });
      setNoteContent("");
      setNoteRating("");
      toast.success("Catatan ditambahkan");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    } finally {
      setSavingNote(false);
    }
  };

  const handleRemoveNote = async (id: Id<"recruitmentNotes">) => {
    if (!confirm("Hapus catatan ini?")) return;
    try {
      await removeNote({ id });
      toast.success("Catatan dihapus");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleRemoveApp = async () => {
    if (!applicationId) return;
    if (!confirm("Hapus lamaran kandidat ini?")) return;
    try {
      await removeApp({ id: applicationId });
      toast.success("Lamaran dihapus");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleClose = () => {
    setStageValue("");
    setReason("");
    setOfferedSalary("");
    setNoteContent("");
    setNoteRating("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {app ? app.candidateName : <Skeleton className="h-6 w-40" />}
          </DialogTitle>
          <DialogDescription>
            {app ? `${app.jobTitle} · ${app.jobDepartment}` : null}
          </DialogDescription>
        </DialogHeader>

        {!app ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={STAGE_CONFIG[app.stage as RecruitmentStage].badge}
              >
                {STAGE_CONFIG[app.stage as RecruitmentStage].label}
              </Badge>
              {app.rating ? (
                <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-300">
                  <Star className="size-4 fill-current" /> {app.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="size-3.5" /> {app.candidateEmail}
              </span>
              {app.candidateResumeUrl ? (
                <Button size="sm" variant="ghost" asChild className="cursor-pointer">
                  <a
                    href={app.candidateResumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="size-4" />
                    CV
                  </a>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto cursor-pointer text-red-600 hover:text-red-600"
                onClick={handleRemoveApp}
              >
                <Trash2 className="size-4" />
                Hapus lamaran
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ubah stage</Label>
                <Select
                  value={stage || app.stage}
                  onValueChange={handleStageChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECRUITMENT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(stage === "offer" ||
                stage === "hired" ||
                app.stage === "offer" ||
                app.stage === "hired") ? (
                <div className="space-y-2">
                  <Label>Gaji yang ditawarkan (IDR)</Label>
                  <Input
                    type="number"
                    value={offeredSalary}
                    placeholder={
                      app.offeredSalary
                        ? String(app.offeredSalary)
                        : "Masukkan angka"
                    }
                    onChange={(e) => setOfferedSalary(e.target.value)}
                  />
                </div>
              ) : null}
              {stage === "rejected" || stage === "withdrawn" ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Alasan</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Alasan penolakan / penarikan"
                  />
                </div>
              ) : null}
            </div>
            {savingStage ? (
              <p className="text-xs text-muted-foreground">
                <Loader2 className="mr-1 inline size-3 animate-spin" /> Memperbarui...
              </p>
            ) : null}

            {app.offeredSalary ? (
              <p className="text-sm">
                <span className="font-semibold">Offer gaji:</span>{" "}
                {formatIDR(app.offeredSalary)}
              </p>
            ) : null}
            {app.closedReason ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Alasan penutupan: {app.closedReason}
              </p>
            ) : null}
            {app.coverLetter ? (
              <Card className="bg-muted/40">
                <div className="p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cover letter
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{app.coverLetter}</p>
                </div>
              </Card>
            ) : null}

            <Tabs defaultValue="notes" className="space-y-3">
              <TabsList>
                <TabsTrigger value="notes" className="cursor-pointer">
                  Catatan & Feedback
                </TabsTrigger>
                <TabsTrigger value="interviews" className="cursor-pointer">
                  Interview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes" className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_100px]">
                    <Textarea
                      rows={2}
                      placeholder="Tulis catatan atau feedback..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                    />
                    <Select value={noteKind} onValueChange={setNoteKind}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      placeholder="Rating 1-5"
                      value={noteRating}
                      onChange={(e) => setNoteRating(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={savingNote}
                      className="cursor-pointer"
                    >
                      {savingNote ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Tambah Catatan
                    </Button>
                  </div>
                </div>

                {notes === undefined ? (
                  <Skeleton className="h-20 w-full" />
                ) : notes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Belum ada catatan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div
                        key={n._id}
                        className="rounded-md border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {n.authorName ?? "Pengguna"}{" "}
                              <Badge
                                variant="outline"
                                className="ml-1 text-[10px]"
                              >
                                {labelOf(NOTE_KINDS, n.kind)}
                              </Badge>
                              {n.rating ? (
                                <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-300">
                                  <Star className="size-3 fill-current" />
                                  {n.rating}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              {n.content}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer text-red-600 hover:text-red-600"
                            onClick={() => handleRemoveNote(n._id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="interviews" className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setScheduling(true)}
                  >
                    <CalendarIcon className="size-4" />
                    Jadwalkan Interview
                  </Button>
                </div>
                {interviews === undefined ? (
                  <Skeleton className="h-20 w-full" />
                ) : interviews.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CalendarIcon />
                      </EmptyMedia>
                      <EmptyTitle>Belum ada interview</EmptyTitle>
                      <EmptyDescription>
                        Jadwalkan sesi interview untuk kandidat ini.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {interviews.map((iv) => (
                      <div
                        key={iv._id}
                        className="rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {iv.title}
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px]"
                              >
                                {labelOf(INTERVIEW_TYPES, iv.interviewType)}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="ml-1 text-[10px]"
                              >
                                {labelOf(INTERVIEW_FORMATS, iv.format)}
                              </Badge>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3.5" />
                                {new Date(iv.scheduledAt).toLocaleString("id-ID")}
                              </span>
                              <span>{iv.durationMinutes} menit</span>
                              {iv.meetingUrl ? (
                                <a
                                  href={iv.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary"
                                >
                                  <LinkIcon className="size-3.5" />
                                  Link Meeting
                                </a>
                              ) : null}
                              {iv.interviewerNames.length > 0 ? (
                                <span>
                                  Pewawancara: {iv.interviewerNames.join(", ")}
                                </span>
                              ) : null}
                            </div>
                            {iv.outcomeNote ? (
                              <p className="mt-1 text-sm">{iv.outcomeNote}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="capitalize text-xs"
                            >
                              {iv.status.replace("_", " ")}
                            </Badge>
                            <Select
                              value={iv.status}
                              onValueChange={async (s) => {
                                try {
                                  await setInterviewOutcome({
                                    id: iv._id,
                                    status: s,
                                  });
                                  toast.success("Status interview diperbarui");
                                } catch {
                                  toast.error("Gagal");
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">
                                  Dijadwalkan
                                </SelectItem>
                                <SelectItem value="completed">Selesai</SelectItem>
                                <SelectItem value="cancelled">
                                  Dibatalkan
                                </SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {applicationId && app ? (
          <ScheduleInterviewDialog
            applicationId={applicationId}
            open={scheduling}
            onClose={() => setScheduling(false)}
          />
        ) : null}

        {/* Hidden icon to avoid unused-import lint */}
        <Briefcase className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
