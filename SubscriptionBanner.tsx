import { useQuery } from "convex/react";
import { Authenticated } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { CalendarClock, ShieldAlert, AlertTriangle, Rocket } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale/id";
import { cn } from "@/lib/utils.ts";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMMM yyyy", { locale: idLocale });
}

function SubscriptionBannerInner() {
  const data = useQuery(api.subscriptionBilling.getMySubscription, {});

  if (!data) return null;

  const { status, paidUntil, daysUntilDue, isReadOnly } = data.subscription;
  const isTrial = data.isTrial;

  // Only warn for problem states. Active / no_subscription show nothing —
  // EXCEPT for trial orgs, where we always show a gentle trial reminder while
  // the trial is still active so the admin knows the clock is ticking.
  if (status !== "due_soon" && status !== "overdue" && status !== "expired") {
    if (isTrial && daysUntilDue !== null && daysUntilDue > 0) {
      return (
        <div className="px-4 pt-3 lg:px-6">
          <Link
            to="/billing"
            className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
          >
            <Rocket className="size-3.5 shrink-0" />
            <span className="flex-1">
              Mode trial aktif — berakhir dalam {daysUntilDue} hari (
              {formatDate(paidUntil)}). Berlangganan untuk membuka semua fitur.
            </span>
            <span className="shrink-0 underline underline-offset-2">
              Berlangganan
            </span>
          </Link>
        </div>
      );
    }
    return null;
  }

  let icon = CalendarClock;
  let text: string;
  let severe = false;

  if (status === "expired" || isReadOnly) {
    icon = ShieldAlert;
    severe = true;
    text = isTrial
      ? `Masa trial berakhir ${formatDate(paidUntil)}. Akses dalam mode hanya-baca — tambah, ubah, dan hapus data diblokir. Berlangganan untuk membuka akses penuh.`
      : `Masa langganan berakhir ${formatDate(paidUntil)}. Akses dalam mode hanya-baca — tambah, ubah, dan hapus data diblokir sampai pembayaran diselesaikan.`;
  } else if (status === "overdue") {
    icon = AlertTriangle;
    severe = true;
    text = isTrial
      ? `Masa trial berakhir ${formatDate(paidUntil)}. Segera berlangganan agar akses tidak beralih ke mode hanya-baca.`
      : `Langganan menunggak sejak ${formatDate(paidUntil)}. Selesaikan pembayaran segera untuk menghindari mode hanya-baca.`;
  } else {
    // due_soon
    const dayText =
      daysUntilDue !== null && daysUntilDue > 0
        ? `dalam ${daysUntilDue} hari (${formatDate(paidUntil)})`
        : `hari ini (${formatDate(paidUntil)})`;
    text = isTrial
      ? `Masa trial berakhir ${dayText}. Segera berlangganan untuk membuka semua fitur dan mempertahankan akses penuh.`
      : `Langganan akan jatuh tempo ${dayText}. Segera lakukan pembayaran agar akses tetap penuh.`;
  }

  const Icon = icon;

  return (
    <div className="px-4 pt-3 lg:px-6">
      <Link
        to="/billing"
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
          severe
            ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15"
            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/30",
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1">{text}</span>
        <span className="shrink-0 underline underline-offset-2">
          Kelola pembayaran
        </span>
      </Link>
    </div>
  );
}

/**
 * Shows a subscription status banner (due soon / overdue / expired) that links
 * to the billing page. Place inside DashboardLayout, wrapped in <Authenticated>.
 */
export default function SubscriptionBanner() {
  return (
    <Authenticated>
      <SubscriptionBannerInner />
    </Authenticated>
  );
}
