import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MailOpen,
  Clock,
  MessagesSquare,
  Sparkles,
  Bell,
  Search,
} from "lucide-react";

export type TourStep = {
  id: string;
  /** CSS selector or data-tour attribute value */
  target: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** "top" | "bottom" | "left" | "right" — preferred position */
  position: "top" | "bottom" | "left" | "right";
};

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-welcome']",
    title: "Selamat Datang!",
    description:
      "Ini adalah dashboard utama Anda. Di sini Anda bisa melihat ringkasan surat, statistik, dan aktivitas terbaru.",
    icon: LayoutDashboard,
    position: "bottom",
  },
  {
    id: "search",
    target: "[data-tour='search-bar']",
    title: "Pencarian Cepat",
    description:
      "Gunakan pencarian untuk menemukan karyawan, dokumen, atau informasi apa pun dengan cepat. Tekan Ctrl+K untuk membuka.",
    icon: Search,
    position: "bottom",
  },
  {
    id: "notifications",
    target: "[data-tour='notifications-bell']",
    title: "Notifikasi",
    description:
      "Pantau semua notifikasi penting di sini — persetujuan, disposisi, dan pengumuman terbaru.",
    icon: Bell,
    position: "bottom",
  },
  {
    id: "letters",
    target: "[data-tour='nav-letters']",
    title: "Kelola Surat",
    description:
      "Modul surat-menyurat digital. Buat, kirim, terima, dan kelola disposisi surat masuk & keluar.",
    icon: MailOpen,
    position: "right",
  },
  {
    id: "attendance",
    target: "[data-tour='nav-attendance']",
    title: "Absensi",
    description:
      "Catat kehadiran harian Anda dengan sekali klik. Pantau riwayat kehadiran dan statistik bulanan.",
    icon: Clock,
    position: "right",
  },
  {
    id: "forum",
    target: "[data-tour='nav-forum']",
    title: "Forum Diskusi",
    description:
      "Bergabung dalam diskusi dengan rekan kerja, berbagi ide, dan berkolaborasi secara terbuka.",
    icon: MessagesSquare,
    position: "right",
  },
  {
    id: "chatbot",
    target: "[data-tour='nav-chatbot']",
    title: "Asisten AI",
    description:
      "Asisten AI siap membantu Anda 24/7 — dari menulis surat, menjawab pertanyaan kebijakan, hingga analisis data.",
    icon: Sparkles,
    position: "right",
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "profile",
    label: "Lengkapi Profil",
    description: "Tambahkan foto, jabatan, dan informasi kontak",
    path: "/directory",
    icon: LayoutDashboard,
  },
  {
    id: "letter",
    label: "Buat Surat Pertama",
    description: "Coba buat surat keluar baru dari modul surat",
    path: "/letters",
    icon: MailOpen,
  },
  {
    id: "attendance",
    label: "Absen Pertama Kali",
    description: "Catat kehadiran hari ini dengan Clock In",
    path: "/attendance",
    icon: Clock,
  },
  {
    id: "forum",
    label: "Bergabung di Forum",
    description: "Baca atau buat topik diskusi pertama Anda",
    path: "/forum",
    icon: MessagesSquare,
  },
  {
    id: "chatbot",
    label: "Coba Asisten AI",
    description: "Ajukan pertanyaan pertama Anda ke Asisten AI",
    path: "/chatbot",
    icon: Sparkles,
  },
];
