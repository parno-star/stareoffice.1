import type { Role } from "@/convex/roles.ts";

// Color badges for each of the 14 roles
export const ROLE_COLORS: Record<Role, string> = {
  super_admin:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-400/30",
  admin:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-400/30",
  it_support:
    "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/30",
  hr_manager:
    "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-400/30",
  hr_staff:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-400/30",
  ld_specialist:
    "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-500/10 dark:text-lime-300 dark:border-lime-400/30",
  payroll_officer:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/30",
  finance_manager:
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-400/30",
  finance_staff:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/30",
  approver:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/30",
  director:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-400/30",
  department_head:
    "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-400/30",
  team_lead:
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-400/30",
  employee:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-400/30",
  contractor:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-400/30",
};

// Dot color class for role tabs (just the background colour)
export const ROLE_DOT_COLORS: Record<Role, string> = {
  super_admin:     "bg-purple-500",
  admin:           "bg-blue-500",
  it_support:      "bg-cyan-500",
  hr_manager:      "bg-teal-500",
  hr_staff:        "bg-green-500",
  ld_specialist:   "bg-lime-500",
  payroll_officer: "bg-emerald-500",
  finance_manager: "bg-yellow-500",
  finance_staff:   "bg-amber-500",
  approver:        "bg-orange-500",
  director:        "bg-rose-500",
  department_head: "bg-pink-500",
  team_lead:       "bg-fuchsia-500",
  employee:        "bg-slate-500",
  contractor:      "bg-zinc-500",
};
