import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  MailOpen,
  LayoutDashboard,
  Users,
  MessagesSquare,
  Sparkles,
  Trophy,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DashboardMockup,
  LettersMockup,
  HRMockup,
  CommsMockup,
  AIMockup,
  AwardsMockup,
} from "./DemoMockups.tsx";

type DemoTab = {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  highlights: string[];
  gradient: string;
  Mockup: () => React.JSX.Element;
};

const demoTabs: DemoTab[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    title: "Executive Command Center",
    description:
      "Pantau seluruh operasi kantor dari satu layar — KPI real-time, grafik tren, dan notifikasi prioritas langsung di ujung jari Anda.",
    highlights: [
      "Widget KPI yang bisa dikustomisasi",
      "Grafik tren harian, mingguan, bulanan",
      "Quick actions untuk tugas rutin",
      "Notifikasi prioritas tinggi",
    ],
    gradient: "from-blue-500 to-indigo-600",
    Mockup: DashboardMockup,
  },
  {
    id: "letters",
    icon: MailOpen,
    label: "Surat Digital",
    title: "Smart Correspondence",
    description:
      "Proses surat masuk dan keluar secara digital dengan AI routing, approval multi-level, dan tracking real-time dari awal hingga arsip.",
    highlights: [
      "Registrasi surat otomatis dengan AI",
      "Disposisi bertingkat dengan deadline",
      "Tanda tangan elektronik tersertifikasi",
      "Arsip digital terstruktur & searchable",
    ],
    gradient: "from-violet-500 to-purple-600",
    Mockup: LettersMockup,
  },
  {
    id: "hr",
    icon: Users,
    label: "HR & People",
    title: "People Management Hub",
    description:
      "Kelola seluruh siklus karyawan — dari onboarding, absensi, cuti, performa, hingga pengembangan karier dalam satu platform terintegrasi.",
    highlights: [
      "Onboarding & offboarding otomatis",
      "Absensi, cuti, dan lembur digital",
      "Performance review & OKR tracking",
      "Talent pool & succession planning",
    ],
    gradient: "from-emerald-500 to-teal-600",
    Mockup: HRMockup,
  },
  {
    id: "comms",
    icon: MessagesSquare,
    label: "Komunikasi",
    title: "Corporate Communication Hub",
    description:
      "Satukan seluruh komunikasi internal — pengumuman, forum diskusi, polling, kotak saran, dan penghargaan dalam satu ekosistem.",
    highlights: [
      "Berita & pengumuman terpusat",
      "Forum diskusi per topik & departemen",
      "Polling & survei kepuasan",
      "Apresiasi & penghargaan karyawan",
    ],
    gradient: "from-amber-500 to-orange-600",
    Mockup: CommsMockup,
  },
  {
    id: "ai",
    icon: Sparkles,
    label: "AI Assistant",
    title: "AI-Powered Productivity",
    description:
      "Asisten AI yang memahami konteks organisasi Anda — bantu drafting surat, ringkasan laporan, analisis data, dan navigasi fitur platform.",
    highlights: [
      "Drafting surat otomatis",
      "Ringkasan dokumen & laporan",
      "Rekomendasi tindakan cerdas",
      "Navigasi fitur dengan voice/text",
    ],
    gradient: "from-rose-500 to-pink-600",
    Mockup: AIMockup,
  },
  {
    id: "awards",
    icon: Trophy,
    label: "Penghargaan",
    title: "Recognition & Awards",
    description:
      "Bangun budaya apresiasi — berikan penghargaan, rayakan milestone, dan dorong engagement karyawan secara sistematis.",
    highlights: [
      "Sistem poin & badge gamifikasi",
      "Nominasi & voting transparan",
      "Perayaan ulang tahun & anniversary",
      "Leaderboard & achievement board",
    ],
    gradient: "from-cyan-500 to-sky-600",
    Mockup: AwardsMockup,
  },
];

export default function ProductDemoSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = demoTabs[activeIdx];

  return (
    <section
      id="demo"
      className="border-t bg-gradient-to-b from-background via-muted/10 to-background py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Jelajahi Platform
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Lihat Star e-Office Beraksi
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Klik modul di bawah untuk melihat bagaimana Star e-Office
            mentransformasi setiap aspek administrasi perkantoran.
          </p>
        </motion.div>

        {/* Tab Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-10 flex flex-wrap justify-center gap-2"
        >
          {demoTabs.map((tab, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveIdx(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                    : "border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14"
          >
            {/* Left: Info */}
            <div className="space-y-6">
              {/* Badge */}
              <div
                className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${active.gradient} px-4 py-1.5 text-xs font-bold text-white shadow-sm`}
              >
                <active.icon className="size-3.5" />
                {active.label}
              </div>

              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {active.title}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {active.description}
              </p>

              {/* Highlights */}
              <div className="space-y-3">
                {active.highlights.map((h, i) => (
                  <motion.div
                    key={h}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${active.gradient}`}
                    >
                      <ChevronRight className="size-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">
                      {h}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Interactive Mockup */}
            <div className="relative">
              <div
                className={`absolute -inset-4 rounded-3xl bg-gradient-to-br ${active.gradient} opacity-[0.06] blur-2xl`}
              />
              <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/8">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-400/60" />
                    <div className="size-3 rounded-full bg-amber-400/60" />
                    <div className="size-3 rounded-full bg-emerald-400/60" />
                  </div>
                  <div className="ml-3 flex-1 rounded-md bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
                    star-eoffice.app/{active.id}
                  </div>
                </div>

                {/* Interactive mockup content */}
                <div className="relative min-h-[360px] overflow-hidden bg-muted/10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                    >
                      <active.Mockup />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
