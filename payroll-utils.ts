export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIDRCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} rb`;
  }
  return formatIDR(amount);
}

export const PERIOD_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  draft: {
    label: "Draft",
    badge:
      "bg-muted text-muted-foreground border-border",
  },
  processing: {
    label: "Diproses",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  published: {
    label: "Diterbitkan",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  closed: {
    label: "Ditutup",
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
};

export const SLIP_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  draft: {
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
  },
  published: {
    label: "Diterbitkan",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
};

export function formatISODate(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function currentPeriodKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export function monthRange(period: string): { start: string; end: string; pay: string } {
  const [y, m] = period.split("-").map((n) => Number(n));
  if (!y || !m) {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    return { start: iso, end: iso, pay: iso };
  }
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // last day of month
  const pay = new Date(y, m, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(start), end: fmt(end), pay: fmt(pay) };
}
