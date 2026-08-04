import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion } from "motion/react";
import {
  MailOpen,
  Users,
  FileText,
  CalendarDays,
} from "lucide-react";

const statConfig = [
  { key: "suratMasuk", icon: MailOpen, label: "Surat Masuk", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
  { key: "totalKaryawan", icon: Users, label: "Total Karyawan", color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400" },
  { key: "suratBulanIni", icon: FileText, label: "Surat Bulan Ini", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { key: "approvalPending", icon: CalendarDays, label: "Menunggu Persetujuan", color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
] as const;

type StatKey = (typeof statConfig)[number]["key"];

export default function QuickStats() {
  const stats = useQuery(api.dashboardStats.getEOfficeStats, {});

  if (stats === undefined) return null;

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {statConfig.map((cfg, i) => {
        const Icon = cfg.icon;
        const value = stats[cfg.key as StatKey] as number;
        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground truncate">{cfg.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
