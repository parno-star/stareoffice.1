import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Users,
  Search,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  Plus,
} from "lucide-react";
import CandidateFormDialog from "./CandidateFormDialog.tsx";
import AddToJobDialog from "./AddToJobDialog.tsx";
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
} from "../_lib/recruitment-utils.ts";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default function CandidatesTab({
  onOpenCandidate,
}: {
  onOpenCandidate: (id: Id<"candidates">) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("all");
  const [addToJobCandidate, setAddToJobCandidate] = useState<Id<"candidates"> | null>(null);

  const candidates = useQuery(api.recruitment.candidates.list, {
    status,
    source,
    search: search.trim() || undefined,
  });
  const setStatusMutation = useMutation(api.recruitment.candidates.setStatus);
  const removeMutation = useMutation(api.recruitment.candidates.remove);

  const handleStatus = async (id: Id<"candidates">, s: string) => {
    try {
      await setStatusMutation({ id, status: s });
      toast.success("Status diperbarui");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleRemove = async (id: Id<"candidates">) => {
    if (!confirm("Hapus kandidat ini? Semua lamaran terkait akan dihapus.")) {
      return;
    }
    try {
      await removeMutation({ id });
      toast.success("Kandidat dihapus");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama kandidat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sumber" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sumber</SelectItem>
            {CANDIDATE_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {CANDIDATE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CandidateFormDialog mode="create" />
      </div>

      {candidates === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Belum ada kandidat</EmptyTitle>
            <EmptyDescription>
              Tambahkan kandidat pertama atau ubah filter pencarian Anda.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c) => {
            const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
            return (
              <Card
                key={c._id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => onOpenCandidate(c._id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>{initialsOf(fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{fullName}</h3>
                        <Badge variant="outline" className="capitalize">
                          {CANDIDATE_SOURCES.find((s) => s.value === c.source)
                            ?.label ?? c.source}
                        </Badge>
                        <Badge variant="secondary" className="capitalize">
                          {CANDIDATE_STATUSES.find((s) => s.value === c.status)
                            ?.label ?? c.status}
                        </Badge>
                      </div>
                      {c.currentTitle ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          <Briefcase className="mr-1 inline size-3.5" />
                          {c.currentTitle}
                          {c.currentCompany ? ` · ${c.currentCompany}` : ""}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3.5" />
                          {c.email}
                        </span>
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3.5" />
                            {c.phone}
                          </span>
                        ) : null}
                        <span>
                          {c.activeApplicationCount} lamaran aktif ·{" "}
                          {c.applicationCount} total
                        </span>
                        {c.ownerName ? (
                          <span>Recruiter: {c.ownerName}</span>
                        ) : null}
                      </div>
                      {c.skills.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.skills.slice(0, 6).map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                          {c.skills.length > 6 ? (
                            <span className="text-[10px] text-muted-foreground">
                              +{c.skills.length - 6}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="flex flex-col items-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setAddToJobCandidate(c._id)}
                      >
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Tambahkan</span>
                      </Button>
                      <div className="flex items-center gap-1">
                        {c.resumeUrl ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="cursor-pointer"
                          >
                            <a
                              href={c.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        {c.linkedinUrl ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="cursor-pointer"
                          >
                            <a
                              href={c.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {CANDIDATE_STATUSES.filter(
                              (s) => s.value !== c.status,
                            ).map((s) => (
                              <DropdownMenuItem
                                key={s.value}
                                onClick={() => handleStatus(c._id, s.value)}
                                className="cursor-pointer"
                              >
                                Ubah ke {s.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              onClick={() => handleRemove(c._id)}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="size-4" />
                              Hapus kandidat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddToJobDialog
        candidateId={addToJobCandidate}
        onClose={() => setAddToJobCandidate(null)}
      />
    </div>
  );
}
