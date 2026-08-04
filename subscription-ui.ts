import type { SubscriptionStatus } from "@/convex/lib/subscription.ts";

/** Display metadata for each subscription status (Bahasa Indonesia). */
export const SUBSCRIPTION_STATUS_META: Record<
  SubscriptionStatus,
  { label: string; badgeClass: string; tone: "green" | "amber" | "red" | "gray" }
> = {
  active: {
    label: "Aktif",
    badgeClass:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
    tone: "green",
  },
  due_soon: {
    label: "Akan jatuh tempo",
    badgeClass:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
    tone: "amber",
  },
  overdue: {
    label: "Menunggak",
    badgeClass:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700",
    tone: "amber",
  },
  expired: {
    label: "Kedaluwarsa",
    badgeClass:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
    tone: "red",
  },
  no_subscription: {
    label: "Belum berlangganan",
    badgeClass:
      "bg-muted text-muted-foreground border-transparent",
    tone: "gray",
  },
};

/** Display metadata for a payment status. */
export const PAYMENT_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  verified: {
    label: "Terverifikasi",
    badgeClass:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
  },
  pending: {
    label: "Menunggu verifikasi",
    badgeClass:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
  },
  rejected: {
    label: "Ditolak",
    badgeClass:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  },
};

/** Format a numeric IDR amount as Rupiah. */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Label for a billing cycle length in months. */
export function cycleLabel(months: number): string {
  if (months === 1) return "1 bulan";
  if (months === 12) return "1 tahun";
  return `${months} bulan`;
}
