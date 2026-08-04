import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Pin,
  Pencil,
  Trash2,
  MoreVertical,
  ShieldCheck,
  Archive,
  CheckCircle2,
  AlertCircle,
  Eye,
  Paperclip,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu.tsx";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { PolicyListItem } from "@/convex/policies.ts";
import {
  formatEffectiveDate,
  formatRelative,
  getPolicyCategory,
} from "../_lib/policy-utils.ts";

type Props = {
  policy: PolicyListItem;
  canManage: boolean;
  onEdit: (policy: PolicyListItem) => void;
};

export default function PolicyCard({ policy, canManage, onEdit }: Props) {
  const navigate = useNavigate();
  const publish = useMutation(api.policies.publish);
  const archive = useMutation(api.policies.archive);
  const remove = useMutation(api.policies.remove);

  const category = getPolicyCategory(policy.category);
  const Icon = category.icon;
  const isDraft = policy.status === "draft";
  const isArchived = policy.status === "archived";

  const handleClick = () => {
    if (isDraft && !canManage) return;
    navigate(`/policies/${policy._id}`);
  };

  const handlePublish = async () => {
    try {
      await publish({ policyId: policy._id });
      toast.success("Kebijakan dipublikasikan");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal mempublikasikan")
          : "Gagal mempublikasikan";
      toast.error(msg);
    }
  };

  const handleArchive = async () => {
    try {
      await archive({ policyId: policy._id });
      toast.success("Kebijakan diarsipkan");
    } catch {
      toast.error("Gagal mengarsipkan");
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Hapus kebijakan ini? Semua data konfirmasi juga akan hilang.",
    );
    if (!confirmed) return;
    try {
      await remove({ policyId: policy._id });
      toast.success("Kebijakan dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/40 hover:shadow-md",
        policy.isPinned && "border-primary/40 shadow-sm",
        isDraft && "opacity-90",
      )}
      onClick={handleClick}
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                category.tone,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {policy.isPinned ? (
                  <Badge variant="secondary" className="gap-1">
                    <Pin className="size-3" />
                    Disematkan
                  </Badge>
                ) : null}
                <Badge variant="outline">{category.label}</Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  v{policy.version}
                </Badge>
                {policy.requiresAcknowledgment ? (
                  policy.hasAcknowledged ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      Disetujui
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300">
                      <AlertCircle className="size-3" />
                      Butuh konfirmasi
                    </Badge>
                  )
                ) : null}
                {isDraft ? (
                  <Badge variant="outline" className="gap-1">
                    <FileText className="size-3" />
                    Draf
                  </Badge>
                ) : null}
                {isArchived ? (
                  <Badge variant="outline" className="gap-1">
                    <Archive className="size-3" />
                    Diarsip
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-base font-semibold leading-tight">
                {policy.title}
              </h3>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {policy.summary}
              </p>
            </div>
          </div>

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Aksi"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onSelect={() => onEdit(policy)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                {isDraft ? (
                  <DropdownMenuItem onSelect={handlePublish}>
                    <ShieldCheck className="size-4" />
                    Publikasikan
                  </DropdownMenuItem>
                ) : null}
                {!isArchived ? (
                  <DropdownMenuItem onSelect={handleArchive}>
                    <Archive className="size-4" />
                    Arsipkan
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {policy.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {policy.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Berlaku: {formatEffectiveDate(policy.effectiveDate)}</span>
          <span>&middot;</span>
          <span>Diperbarui {formatRelative(policy.lastEditedAt)}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              {policy.viewCount}
            </span>
            {policy.requiresAcknowledgment ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3.5" />
                {policy.acknowledgmentCount} konfirmasi
              </span>
            ) : null}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
