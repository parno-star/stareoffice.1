import { useQuery } from "convex/react";
import { Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AlertTriangle, Users, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils.ts";

function PlanLimitBannerInner() {
  const usage = useQuery(api.planAccess.getOrgUsage, {});

  if (!usage) return null;

  const warnings: { icon: typeof AlertTriangle; text: string; severe: boolean }[] = [];

  // Employee limit
  if (usage.maxEmployees > 0) {
    const pct = Math.round((usage.employeeCount / usage.maxEmployees) * 100);
    if (usage.isOverEmployeeLimit) {
      warnings.push({
        icon: Users,
        text: `Batas karyawan tercapai (${usage.employeeCount}/${usage.maxEmployees}). Penambahan karyawan baru diblokir sampai paket ditingkatkan.`,
        severe: true,
      });
    } else if (pct >= 95) {
      warnings.push({
        icon: Users,
        text: `Penggunaan karyawan ${pct}% (${usage.employeeCount}/${usage.maxEmployees}). Segera tingkatkan paket sebelum mencapai batas.`,
        severe: true,
      });
    } else if (pct >= 80) {
      warnings.push({
        icon: Users,
        text: `Penggunaan karyawan ${pct}% (${usage.employeeCount}/${usage.maxEmployees}). Pertimbangkan untuk meningkatkan paket.`,
        severe: false,
      });
    }
  }

  // Storage limit
  if (usage.maxStorageMb > 0) {
    const pct = (usage.storageMb / usage.maxStorageMb) * 100;
    if (usage.isOverStorageLimit) {
      warnings.push({
        icon: HardDrive,
        text: `Batas penyimpanan terlampaui (${usage.storageMb} MB / ${usage.maxStorageMb} MB). Upload file mungkin dibatasi.`,
        severe: true,
      });
    } else if (pct >= 80) {
      warnings.push({
        icon: HardDrive,
        text: `Mendekati batas penyimpanan (${usage.storageMb} MB / ${usage.maxStorageMb} MB).`,
        severe: false,
      });
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((w, i) => {
        const Icon = w.icon;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              w.severe
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30"
            )}
          >
            {w.severe ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <Icon className="size-3.5 shrink-0" />
            )}
            <span className="flex-1">{w.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Shows a warning banner when the organisation is near or over plan limits.
 * Place inside the DashboardLayout, wrapped in <Authenticated>.
 */
export default function PlanLimitBanner() {
  return (
    <Authenticated>
      <PlanLimitBannerInner />
    </Authenticated>
  );
}
