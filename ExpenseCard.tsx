import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Check,
  X,
  Trash2,
  Paperclip,
  BadgeDollarSign,
  MoreVertical,
  Calendar,
  ExternalLink,
  Wallet,
  Building2,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { ExpenseWithUser } from "@/convex/expenses.ts";
import {
  getStatusConfig,
  formatCurrency,
  formatExpenseDate,
  PAYMENT_METHOD_LABELS,
  buildCategoryDisplayMap,
  resolveCategoryDisplay,
  type PaymentMethod,
} from "../_lib/expense-utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import ReviewExpenseDialog from "./ReviewExpenseDialog.tsx";
import MarkPaidDialog from "./MarkPaidDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

type Props = {
  expense: ExpenseWithUser;
  isAdmin: boolean;
  currentUserId: Id<"users"> | null;
  // Bulk selection (optional). When set, renders a checkbox.
  selected?: boolean;
  onToggleSelect?: (id: Id<"expenseReports">) => void;
};

export default function ExpenseCard({
  expense,
  isAdmin,
  currentUserId,
  selected,
  onToggleSelect,
}: Props) {
  const categoryList = useQuery(api.expenseCategories.list, {});
  const categoryMap = useMemo(
    () => buildCategoryDisplayMap(categoryList ?? []),
    [categoryList],
  );
  const categoryConfig = resolveCategoryDisplay(expense.category, categoryMap);
  const statusConfig = getStatusConfig(expense.status);
  const CategoryIcon = categoryConfig.icon;

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const remove = useMutation(api.expenses.remove);

  const canDelete =
    isAdmin ||
    (expense.userId === currentUserId && expense.status === "pending");

  const handleDelete = async () => {
    try {
      await remove({ id: expense._id });
      toast.success("Pengajuan dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus pengajuan");
      } else {
        toast.error("Gagal menghapus pengajuan");
      }
    }
  };

  const openReview = (mode: "approve" | "reject") => {
    setReviewMode(mode);
    setReviewOpen(true);
  };

  const paymentLabel =
    expense.paymentMethod &&
    expense.paymentMethod in PAYMENT_METHOD_LABELS
      ? PAYMENT_METHOD_LABELS[expense.paymentMethod as PaymentMethod]
      : null;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {onToggleSelect && isAdmin ? (
              <div className="shrink-0 pt-1">
                <Checkbox
                  checked={!!selected}
                  onCheckedChange={() => onToggleSelect(expense._id)}
                  aria-label="Pilih pengajuan"
                />
              </div>
            ) : null}
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${categoryConfig.iconBg}`}
            >
              <CategoryIcon className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">
                    {expense.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={categoryConfig.badge}
                    >
                      {categoryConfig.label}
                    </Badge>
                    <Badge variant="outline" className={statusConfig.badge}>
                      {statusConfig.label}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatExpenseDate(expense.expenseDate)}
                    </span>
                    {expense.userDepartment ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />
                        {expense.userDepartment}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {formatCurrency(expense.amount)}
                    </p>
                    {paymentLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {paymentLabel}
                        {expense.paymentReference
                          ? ` · ${expense.paymentReference}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {canDelete ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={handleDelete}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>

              {expense.description ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {expense.description}
                </p>
              ) : null}

              {expense.cashAdvanceTitle ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-1 text-xs">
                  <Wallet className="size-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-violet-700 dark:text-violet-300">
                    Uang muka: {expense.cashAdvanceTitle}
                  </span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    {expense.userAvatar ? (
                      <AvatarImage src={expense.userAvatar} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(expense.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{expense.userName ?? "Karyawan"}</span>
                </div>
                {expense.receiptUrl ? (
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Paperclip className="size-3" />
                    {expense.receiptFileName ?? "Lihat kuitansi"}
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              {expense.reviewNote ? (
                <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    Catatan dari{" "}
                    {expense.reviewerName ?? "Admin"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {expense.reviewNote}
                  </p>
                </div>
              ) : null}

              {isAdmin && expense.status === "pending" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => openReview("approve")}
                    className="gap-1 cursor-pointer"
                  >
                    <Check className="size-4" />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openReview("reject")}
                    className="gap-1 cursor-pointer"
                  >
                    <X className="size-4" />
                    Tolak
                  </Button>
                </div>
              ) : null}

              {isAdmin && expense.status === "approved" ? (
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={() => setMarkPaidOpen(true)}
                    className="gap-1 cursor-pointer"
                  >
                    <BadgeDollarSign className="size-4" />
                    Tandai sudah dibayar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <ReviewExpenseDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        expenseId={expense._id}
        mode={reviewMode}
        expenseTitle={expense.title}
      />
      <MarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        expenseIds={[expense._id]}
        title={expense.title}
      />
    </>
  );
}
