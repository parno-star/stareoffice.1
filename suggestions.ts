import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Receipt,
  Wallet,
  GraduationCap,
  Goal,
  ScrollText,
  ClipboardCheck,
  Sparkles,
  FileText,
  DoorOpen,
  FolderKanban,
  HeartHandshake,
  Plane,
  LifeBuoy,
} from "lucide-react";

export type SuggestionCategory = "hr" | "productivity" | "learning" | "explore";

export type SuggestionPrompt = {
  id: string;
  icon: LucideIcon;
  label: string;
  prompt: string;
  accent: string;
  category: SuggestionCategory;
};

export const SUGGESTION_CATEGORIES: ReadonlyArray<{ key: SuggestionCategory; label: string }> = [
  { key: "hr", label: "HR & Kepegawaian" },
  { key: "productivity", label: "Produktivitas" },
  { key: "learning", label: "Pembelajaran" },
  { key: "explore", label: "Jelajahi Fitur" },
];

export const SUGGESTION_PROMPTS: ReadonlyArray<SuggestionPrompt> = [
  // HR & Kepegawaian
  {
    id: "leave-balance",
    icon: Calendar,
    label: "Sisa cuti saya",
    prompt: "Berapa sisa cuti saya tahun ini dan bagaimana cara mengajukan?",
    accent: "from-blue-500/20 to-blue-500/0 text-blue-700 dark:text-blue-300",
    category: "hr",
  },
  {
    id: "clock-in",
    icon: ClipboardCheck,
    label: "Status absensi hari ini",
    prompt: "Apakah saya sudah clock in hari ini? Bagaimana status absensi saya?",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-700 dark:text-emerald-300",
    category: "hr",
  },
  {
    id: "reimburse",
    icon: Receipt,
    label: "Ajukan reimbursement",
    prompt: "Bagaimana cara mengajukan reimbursement dan dokumen apa yang diperlukan?",
    accent: "from-teal-500/20 to-teal-500/0 text-teal-700 dark:text-teal-300",
    category: "hr",
  },
  {
    id: "payslip",
    icon: Wallet,
    label: "Slip gaji terakhir",
    prompt: "Tampilkan ringkasan slip gaji terakhir saya.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-700 dark:text-amber-300",
    category: "hr",
  },
  {
    id: "policy",
    icon: ScrollText,
    label: "Kebijakan WFH",
    prompt: "Jelaskan kebijakan work from home dan jam kerja perusahaan.",
    accent: "from-rose-500/20 to-rose-500/0 text-rose-700 dark:text-rose-300",
    category: "hr",
  },
  {
    id: "travel",
    icon: Plane,
    label: "Ajukan perjalanan dinas",
    prompt: "Bagaimana cara mengajukan perjalanan dinas dan apa saja yang perlu disiapkan?",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-700 dark:text-sky-300",
    category: "hr",
  },

  // Produktivitas
  {
    id: "daily-summary",
    icon: Sparkles,
    label: "Ringkasan hari ini",
    prompt: "Beri ringkasan apa yang harus saya lakukan hari ini: tugas, event, deadline, dan hal penting lainnya.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-700 dark:text-fuchsia-300",
    category: "productivity",
  },
  {
    id: "okr",
    icon: Goal,
    label: "Update OKR saya",
    prompt: "Apa saja OKR saya yang masih aktif dan mana yang perlu update segera?",
    accent: "from-violet-500/20 to-violet-500/0 text-violet-700 dark:text-violet-300",
    category: "productivity",
  },
  {
    id: "tasks-priority",
    icon: FolderKanban,
    label: "Tugas prioritas saya",
    prompt: "Tugas apa saja yang perlu saya kerjakan dan mana yang paling urgent?",
    accent: "from-orange-500/20 to-orange-500/0 text-orange-700 dark:text-orange-300",
    category: "productivity",
  },
  {
    id: "appreciation",
    icon: HeartHandshake,
    label: "Beri apresiasi rekan",
    prompt: "Bagaimana cara memberi apresiasi kepada rekan kerja di platform ini?",
    accent: "from-pink-500/20 to-pink-500/0 text-pink-700 dark:text-pink-300",
    category: "productivity",
  },

  // Learning
  {
    id: "training",
    icon: GraduationCap,
    label: "Rekomendasi pelatihan",
    prompt: "Pelatihan apa yang sebaiknya saya ambil berdasarkan peran dan progres belajar saya?",
    accent: "from-indigo-500/20 to-indigo-500/0 text-indigo-700 dark:text-indigo-300",
    category: "learning",
  },
  {
    id: "my-courses",
    icon: GraduationCap,
    label: "Progres kursus saya",
    prompt: "Bagaimana progres kursus dan pelatihan yang sedang saya ikuti?",
    accent: "from-cyan-500/20 to-cyan-500/0 text-cyan-700 dark:text-cyan-300",
    category: "learning",
  },

  // Explore
  {
    id: "letter",
    icon: FileText,
    label: "Buat surat resmi",
    prompt: "Bagaimana cara membuat surat resmi di Star e-Office?",
    accent: "from-slate-500/20 to-slate-500/0 text-slate-700 dark:text-slate-300",
    category: "explore",
  },
  {
    id: "room-booking",
    icon: DoorOpen,
    label: "Pesan ruang meeting",
    prompt: "Bagaimana cara memesan ruang meeting untuk rapat besok?",
    accent: "from-lime-500/20 to-lime-500/0 text-lime-700 dark:text-lime-300",
    category: "explore",
  },
  {
    id: "it-support",
    icon: LifeBuoy,
    label: "Bantuan IT",
    prompt: "Saya butuh bantuan IT. Bagaimana cara membuat tiket dukungan?",
    accent: "from-red-500/20 to-red-500/0 text-red-700 dark:text-red-300",
    category: "explore",
  },
  {
    id: "surprise",
    icon: Sparkles,
    label: "Kejutkan saya",
    prompt: "Beri satu insight menarik tentang status HR saya hari ini dan 1 tindakan yang sebaiknya saya lakukan.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-700 dark:text-fuchsia-300",
    category: "explore",
  },
];
