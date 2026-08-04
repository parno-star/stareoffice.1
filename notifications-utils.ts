import {
  Megaphone,
  CalendarCheck,
  CalendarPlus,
  MessageCircle,
  LifeBuoy,
  HeartHandshake,
  Lightbulb,
  Bell,
  MessageSquare,
  Receipt,
  Rocket,
  Package,
  Trophy,
  ScrollText,
  GraduationCap,
  Wallet,
  UserSearch,
  Target,
  HeartPulse,
  AlarmClock,
  BarChart3,
  Building2,
  ClipboardCheck,
  CheckCircle2,
  CheckCheck,
  XCircle,
  RotateCcw,
  Users,
  PhoneCall,
  Video,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export type NotificationMeta = {
  icon: LucideIcon;
  color: string; // text color
  bg: string; // bg circle
  label: string;
};

export function getNotificationMeta(type: string): NotificationMeta {
  switch (type) {
    case "announcement":
      return {
        icon: Megaphone,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Pengumuman",
      };
    case "announcement_comment":
      return {
        icon: MessageSquare,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Komentar berita",
      };
    case "leave_new":
      return {
        icon: CalendarPlus,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        label: "Pengajuan cuti",
      };
    case "leave_reviewed":
      return {
        icon: CalendarCheck,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Keputusan cuti",
      };
    case "forum_reply":
      return {
        icon: MessageCircle,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-100 dark:bg-indigo-500/20",
        label: "Forum",
      };
    case "ticket_new":
    case "ticket_comment":
    case "ticket_status":
      return {
        icon: LifeBuoy,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-100 dark:bg-rose-500/20",
        label: "Bantuan IT",
      };
    case "recognition_received":
    case "recognition_reaction":
      return {
        icon: HeartHandshake,
        color: "text-pink-600 dark:text-pink-400",
        bg: "bg-pink-100 dark:bg-pink-500/20",
        label: "Apresiasi",
      };
    case "suggestion_response":
      return {
        icon: Lightbulb,
        color: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-500/20",
        label: "Saran",
      };
    case "comment":
      return {
        icon: MessageSquare,
        color: "text-slate-600 dark:text-slate-300",
        bg: "bg-slate-100 dark:bg-slate-500/20",
        label: "Komentar",
      };
    case "direct_message":
      return {
        icon: MessageSquare,
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-100 dark:bg-sky-500/20",
        label: "Pesan langsung",
      };
    case "expense_new":
    case "expense_reviewed":
    case "expense_paid":
      return {
        icon: Receipt,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-100 dark:bg-teal-500/20",
        label: "Reimbursement",
      };
    case "onboarding_started":
    case "onboarding_completed":
    case "onboarding_checkin_submitted":
    case "onboarding_checkin_reviewed":
      return {
        icon: Rocket,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-100 dark:bg-violet-500/20",
        label: "Onboarding",
      };
    case "event_new":
    case "event_updated":
      return {
        icon: CalendarPlus,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Acara",
      };
    case "asset_assigned":
    case "asset_returned":
      return {
        icon: Package,
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-100 dark:bg-orange-500/20",
        label: "Aset",
      };
    case "award_received":
    case "award_announced":
    case "award_congratulation":
      return {
        icon: Trophy,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Penghargaan",
      };
    case "course_published":
    case "course_completed":
    case "course_assigned":
    case "course_certificate":
      return {
        icon: GraduationCap,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        label: "Pelatihan",
      };
    case "policy_published":
    case "policy_updated":
      return {
        icon: ScrollText,
        color: "text-primary",
        bg: "bg-primary/10",
        label: "Kebijakan",
      };
    case "payslip_published":
      return {
        icon: Wallet,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Slip Gaji",
      };
    case "recruitment_interview":
    case "recruitment_new_candidate":
      return {
        icon: UserSearch,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-100 dark:bg-violet-500/20",
        label: "Rekrutmen",
      };
    case "okr_assigned":
    case "okr_checkin":
      return {
        icon: Target,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-100 dark:bg-indigo-500/20",
        label: "OKR",
      };
    case "engagement_survey":
    case "engagement_closed":
      return {
        icon: HeartPulse,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-100 dark:bg-rose-500/20",
        label: "Survei Engagement",
      };
    case "task_deadline_reminder":
      return {
        icon: AlarmClock,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-500/20",
        label: "Deadline Tugas",
      };
    case "event_reminder":
      return {
        icon: CalendarCheck,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-100 dark:bg-violet-500/20",
        label: "Pengingat Event",
      };
    case "leave_pending_reminder":
      return {
        icon: AlarmClock,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Pengingat Cuti",
      };
    case "weekly_digest":
      return {
        icon: BarChart3,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-100 dark:bg-indigo-500/20",
        label: "Ringkasan Mingguan",
      };
    case "org_created":
      return {
        icon: Building2,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Pendaftaran Organisasi",
      };
    case "org_activated":
      return {
        icon: Building2,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Organisasi Disetujui",
      };
    case "org_rejected":
      return {
        icon: Building2,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-500/20",
        label: "Pendaftaran Ditolak",
      };
    case "member_request":
      return {
        icon: UserSearch,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        label: "Permintaan Anggota",
      };
    case "letter_turn":
      return {
        icon: ClipboardCheck,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        label: "Giliran Persetujuan",
      };
    case "letter_approved_step":
      return {
        icon: CheckCircle2,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Surat Disetujui",
      };
    case "letter_completed":
      return {
        icon: CheckCheck,
        color: "text-green-600 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-500/20",
        label: "Surat Selesai",
      };
    case "letter_rejected":
      return {
        icon: XCircle,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-500/20",
        label: "Surat Ditolak",
      };
    case "letter_revision":
      return {
        icon: RotateCcw,
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-100 dark:bg-orange-500/20",
        label: "Perlu Revisi",
      };
    case "seat_added":
      return {
        icon: Users,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        label: "Kursi Tambahan",
      };
    case "call_invite":
      return {
        icon: PhoneCall,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-100 dark:bg-violet-500/20",
        label: "Undangan Panggilan",
      };
    case "zoom_invite":
      return {
        icon: Video,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        label: "Undangan Zoom",
      };
    default:
      return {
        icon: Bell,
        color: "text-muted-foreground",
        bg: "bg-muted",
        label: "Notifikasi",
      };
  }
}

export function formatRelative(ts: number): string {
  try {
    return formatDistanceToNow(new Date(ts), {
      addSuffix: true,
      locale: idLocale,
    });
  } catch {
    return "";
  }
}

export function formatAbsolute(ts: number): string {
  try {
    return format(new Date(ts), "d MMM yyyy, HH:mm", { locale: idLocale });
  } catch {
    return "";
  }
}
