import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Search,
  Building2,
  Mail,
  Phone,
  Copy,
  ShieldCheck,
  Crown,
  Contact,
  CircleDollarSign,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { ROLE_LABELS } from "@/convex/roles";
import type { Role } from "@/convex/roles";
import { useDebounce } from "@/hooks/use-debounce.ts";

// Human-readable label + color for each billing status.
const BILLING_META: Record<
  string,
  { label: string; className: string }
> = {
  no_subscription: {
    label: "Belum berlangganan",
    className:
      "bg-muted text-muted-foreground border-transparent",
  },
  active: {
    label: "Aktif",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  },
  due_soon: {
    label: "Segera jatuh tempo",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
  overdue: {
    label: "Menunggak",
    className:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  },
  expired: {
    label: "Kedaluwarsa",
    className:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} disalin`);
  } catch {
    toast.error("Gagal menyalin");
  }
}

export default function ResponsiblesTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  const rows = useQuery(api.superAdmin.listCompanyResponsibles, {
    search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
  });

  return (
    <div className="space-y-4 mt-4">
      {/* Intro */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Daftar penanggung jawab administratif resmi tiap perusahaan (para
          administrator). Mereka adalah perwakilan perusahaan untuk urusan
          pembayaran, koordinasi teknis, dan administrasi. Data karyawan lain
          tetap terlindungi.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari perusahaan atau nama PJ..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {rows === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Contact />
            </EmptyMedia>
            <EmptyTitle>Tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Coba ubah kata kunci pencarian.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const billing =
              BILLING_META[row.billingStatus] ?? BILLING_META.no_subscription;
            return (
              <Card key={row.organizationId}>
                <CardContent className="py-4 space-y-3">
                  {/* Company header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm">
                          {row.orgName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {row.orgPlan}
                        </Badge>
                        {!row.orgIsActive && (
                          <Badge variant="secondary" className="text-xs">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                      {(row.orgEmail || row.orgPhone) && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap pl-6">
                          {row.orgEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {row.orgEmail}
                            </span>
                          )}
                          {row.orgPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {row.orgPhone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Billing status */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        className={`text-xs flex items-center gap-1 ${billing.className}`}
                      >
                        <CircleDollarSign className="w-3 h-3" />
                        {billing.label}
                      </Badge>
                      {row.billingPaidUntil && (
                        <span className="text-[11px] text-muted-foreground">
                          Bayar s/d {formatDate(row.billingPaidUntil)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Responsibles */}
                  {row.responsibles.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Belum ada penanggung jawab administratif terdaftar untuk
                      perusahaan ini.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {row.responsibles.map((p) => (
                        <div
                          key={p.userId}
                          className="rounded-md border bg-background px-3 py-2"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {p.name}
                            </span>
                            {p.isCreator && (
                              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                Pendaftar
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {ROLE_LABELS[p.role as Role] ?? p.role}
                            </Badge>
                            {p.accountStatus !== "active" && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                              >
                                {p.accountStatus === "pending_approval"
                                  ? "Menunggu"
                                  : p.accountStatus === "suspended"
                                    ? "Nonaktif"
                                    : p.accountStatus}
                              </Badge>
                            )}
                          </div>
                          {p.jobTitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.jobTitle}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {p.email && (
                              <div className="flex items-center gap-1">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-xs cursor-pointer"
                                >
                                  <a href={`mailto:${p.email}`}>
                                    <Mail className="w-3 h-3" />
                                    Email
                                  </a>
                                </Button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(
                                      p.email ?? "",
                                      "Email",
                                    )
                                  }
                                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Salin email"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {p.phone && (
                              <div className="flex items-center gap-1">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-xs cursor-pointer"
                                >
                                  <a href={`tel:${p.phone}`}>
                                    <Phone className="w-3 h-3" />
                                    {p.phone}
                                  </a>
                                </Button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(
                                      p.phone ?? "",
                                      "Nomor telepon",
                                    )
                                  }
                                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Salin nomor"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {!p.email && !p.phone && (
                              <span className="text-xs text-muted-foreground">
                                Tidak ada kontak
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
