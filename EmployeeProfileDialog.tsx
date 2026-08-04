import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  Copy,
  Check,
  Cake,
  Award,
  HeartHandshake,
  MessageSquare,
  Info,
  Link2,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  formatIsoFullDate,
  formatMonthDay,
} from "@/pages/celebrations/_lib/celebrations-utils.ts";
import CreateRecognitionDialog from "@/pages/recognitions/_components/CreateRecognitionDialog.tsx";

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} disalin`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
      {copyable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="size-4 text-primary" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

export default function EmployeeProfileDialog({
  userId,
  open,
  onOpenChange,
  onOpenDottedLines,
}: {
  userId: Id<"users"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, shows a shortcut to manage secondary/coordination lines. */
  onOpenDottedLines?: (userId: Id<"users">) => void;
}) {
  const employee = useQuery(
    api.users.getEmployeeById,
    userId ? { userId } : "skip",
  );
  const customFieldDefs = useQuery(api.directoryFields.list, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isSelf = currentUser && employee && currentUser._id === employee._id;
  const startConversation = useMutation(api.messages.startConversation);
  const navigate = useNavigate();
  const [startingChat, setStartingChat] = useState(false);

  const handleSendMessage = async () => {
    if (!employee || isSelf) return;
    setStartingChat(true);
    try {
      const conversationId = await startConversation({
        otherUserId: employee._id,
      });
      onOpenChange(false);
      navigate(`/messages/${conversationId}`);
    } catch {
      toast.error("Gagal memulai percakapan");
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Profil Karyawan</DialogTitle>
          <DialogDescription>
            Lihat detail kontak dan informasi karyawan.
          </DialogDescription>
        </DialogHeader>

        {employee === undefined ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : employee === null ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Karyawan tidak ditemukan.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                {employee.avatarUrl ? (
                  <AvatarImage
                    src={employee.avatarUrl}
                    alt={employee.name ?? ""}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                  {getInitials(employee.name).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold">
                  {employee.name ?? "Tanpa Nama"}
                </h2>
                <p className="truncate text-sm text-muted-foreground">
                  {employee.jobTitle ?? "Belum ada jabatan"}
                </p>
                {employee.department ? (
                  <Badge variant="secondary" className="mt-2">
                    {employee.department}
                  </Badge>
                ) : null}
              </div>
            </div>

            {employee.bio ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-foreground/90">
                {employee.bio}
              </p>
            ) : null}

            <Separator />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Informasi Kontak
              </h3>
              <InfoRow
                icon={Mail}
                label="Email"
                value={employee.email}
                copyable
              />
              <InfoRow
                icon={Phone}
                label="Telepon"
                value={employee.phone}
                copyable
              />
              <InfoRow icon={MapPin} label="Lokasi" value={employee.location} />
              <InfoRow
                icon={Briefcase}
                label="Jabatan"
                value={employee.jobTitle}
              />
              <InfoRow
                icon={Building2}
                label="Departemen"
                value={employee.department}
              />
              <InfoRow
                icon={Cake}
                label="Ulang Tahun"
                value={
                  employee.birthday ? formatMonthDay(employee.birthday) : undefined
                }
              />
              <InfoRow
                icon={Cake}
                label="Tanggal Lahir"
                value={
                  employee.dateOfBirth
                    ? formatIsoFullDate(employee.dateOfBirth)
                    : undefined
                }
              />
              <InfoRow
                icon={Award}
                label="Mulai Bekerja"
                value={
                  employee.startDate
                    ? formatIsoFullDate(employee.startDate)
                    : undefined
                }
              />
              {(customFieldDefs ?? []).map((def) => {
                const raw = (employee.customFields ?? {})[def._id];
                if (!raw) return null;
                const display =
                  def.type === "date" ? formatIsoFullDate(raw) : raw;
                return (
                  <InfoRow
                    key={def._id}
                    icon={Info}
                    label={def.label}
                    value={display}
                  />
                );
              })}
            </div>

            {onOpenDottedLines ? (
              <>
                <Separator />
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenDottedLines(employee._id);
                  }}
                >
                  <Link2 className="size-4 text-amber-500" />
                  Garis Koordinasi
                </Button>
              </>
            ) : null}

            {!isSelf ? (
              <>
                <Separator />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    onClick={() => {
                      void handleSendMessage();
                    }}
                    disabled={startingChat}
                    className="gap-2"
                  >
                    <MessageSquare className="size-4" />
                    {startingChat ? "Membuka..." : "Kirim Pesan"}
                  </Button>
                  <CreateRecognitionDialog
                    initialRecipientId={employee._id}
                    trigger={
                      <Button variant="secondary" className="gap-2">
                        <HeartHandshake className="size-4" />
                        Kirim Apresiasi
                      </Button>
                    }
                  />
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
