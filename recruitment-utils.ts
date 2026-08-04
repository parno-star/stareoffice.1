export const RECRUITMENT_STAGES = [
  "sourced",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export type RecruitmentStage = (typeof RECRUITMENT_STAGES)[number];

export const ACTIVE_STAGES: ReadonlyArray<RecruitmentStage> = [
  "sourced",
  "applied",
  "screening",
  "interview",
  "offer",
];

export const PIPELINE_STAGES: ReadonlyArray<RecruitmentStage> = [
  "sourced",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
];

export const STAGE_CONFIG: Record<
  RecruitmentStage,
  { label: string; badge: string; column: string }
> = {
  sourced: {
    label: "Sourced",
    badge: "border-slate-300 text-slate-700 dark:text-slate-200 bg-slate-500/10",
    column:
      "bg-slate-500/5 border-slate-200 dark:border-slate-700/40",
  },
  applied: {
    label: "Melamar",
    badge: "border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-500/10",
    column: "bg-blue-500/5 border-blue-200 dark:border-blue-700/40",
  },
  screening: {
    label: "Screening",
    badge:
      "border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10",
    column: "bg-indigo-500/5 border-indigo-200 dark:border-indigo-700/40",
  },
  interview: {
    label: "Interview",
    badge:
      "border-violet-300 text-violet-700 dark:text-violet-300 bg-violet-500/10",
    column: "bg-violet-500/5 border-violet-200 dark:border-violet-700/40",
  },
  offer: {
    label: "Offer",
    badge:
      "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-500/10",
    column: "bg-amber-500/5 border-amber-200 dark:border-amber-700/40",
  },
  hired: {
    label: "Diterima",
    badge:
      "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
    column:
      "bg-emerald-500/5 border-emerald-200 dark:border-emerald-700/40",
  },
  rejected: {
    label: "Ditolak",
    badge: "border-red-300 text-red-700 dark:text-red-300 bg-red-500/10",
    column: "bg-red-500/5 border-red-200 dark:border-red-700/40",
  },
  withdrawn: {
    label: "Mundur",
    badge:
      "border-orange-300 text-orange-700 dark:text-orange-300 bg-orange-500/10",
    column: "bg-orange-500/5 border-orange-200 dark:border-orange-700/40",
  },
};

export const JOB_STATUSES = ["draft", "open", "on_hold", "closed"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  { label: string; badge: string }
> = {
  draft: {
    label: "Draft",
    badge: "border-slate-300 text-slate-700 dark:text-slate-200 bg-slate-500/10",
  },
  open: {
    label: "Terbuka",
    badge:
      "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  },
  on_hold: {
    label: "Ditahan",
    badge:
      "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-500/10",
  },
  closed: {
    label: "Ditutup",
    badge: "border-red-300 text-red-700 dark:text-red-300 bg-red-500/10",
  },
};

export const EMPLOYMENT_TYPES = [
  { value: "fulltime", label: "Full-time" },
  { value: "parttime", label: "Part-time" },
  { value: "contract", label: "Kontrak" },
  { value: "internship", label: "Magang" },
  { value: "temporary", label: "Temporer" },
] as const;

export const LEVELS = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
] as const;

export const CANDIDATE_SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "jobsite", label: "Job Site" },
  { value: "event", label: "Event / Job Fair" },
  { value: "agency", label: "Agensi" },
  { value: "website", label: "Website Karir" },
  { value: "other", label: "Lainnya" },
] as const;

export const CANDIDATE_STATUSES = [
  { value: "active", label: "Aktif" },
  { value: "hired", label: "Diterima" },
  { value: "archived", label: "Diarsipkan" },
  { value: "blacklisted", label: "Blacklist" },
] as const;

export const INTERVIEW_TYPES = [
  { value: "screening", label: "Screening" },
  { value: "technical", label: "Teknis" },
  { value: "behavioral", label: "Behavioral" },
  { value: "culture_fit", label: "Culture Fit" },
  { value: "final", label: "Final" },
  { value: "other", label: "Lainnya" },
] as const;

export const INTERVIEW_FORMATS = [
  { value: "online", label: "Online" },
  { value: "onsite", label: "Onsite" },
  { value: "phone", label: "Telepon" },
] as const;

export function formatIDR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSalaryRange(
  min: number | undefined,
  max: number | undefined,
): string {
  if (!min && !max) return "Gaji dirundingkan";
  if (min && max) {
    return `${formatIDR(min)} – ${formatIDR(max)}`;
  }
  if (min) return `Mulai ${formatIDR(min)}`;
  if (max) return `Hingga ${formatIDR(max)}`;
  return "-";
}
