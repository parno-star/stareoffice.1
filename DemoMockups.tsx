import { motion } from "motion/react";
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Bell,
  CheckCircle2,
  Send,
  MessageSquare,
  Award,
  Star,
  ThumbsUp,
  Calendar,
  ArrowUpRight,
  Clock,
} from "lucide-react";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" as const },
  }),
};

/* ─── Dashboard Mockup ─── */
export function DashboardMockup() {
  const kpis = [
    { label: "Surat Masuk", value: "128", change: "+12%", color: "bg-blue-500" },
    { label: "Surat Keluar", value: "94", change: "+8%", color: "bg-emerald-500" },
    { label: "Disposisi", value: "67", change: "-3%", color: "bg-violet-500" },
    { label: "Selesai", value: "312", change: "+24%", color: "bg-amber-500" },
  ];

  const chartBars = [65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95, 70];

  return (
    <div className="space-y-3 p-4">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            custom={i}
            className="rounded-lg border bg-background/80 p-2.5"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <div className={`size-2 rounded-full ${kpi.color}`} />
              <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold">{kpi.value}</span>
              <span className="text-[10px] font-medium text-emerald-500">{kpi.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Aktivitas Bulanan</span>
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <TrendingUp className="size-3" />
            <span>+18%</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 80 }}>
          {chartBars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.5, ease: "easeOut" as const }}
              className="flex-1 rounded-t bg-gradient-to-t from-primary/80 to-primary/40"
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>Jan</span><span>Mar</span><span>Jun</span><span>Sep</span><span>Des</span>
        </div>
      </motion.div>

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <span className="mb-2 block text-xs font-semibold">Aktivitas Terbaru</span>
        {[
          { text: "Surat masuk baru dari Dinas Pendidikan", time: "2m", icon: FileText },
          { text: "Disposisi disetujui oleh Sekretaris", time: "15m", icon: CheckCircle2 },
          { text: "3 notifikasi baru menunggu", time: "1h", icon: Bell },
        ].map((item, i) => (
          <motion.div
            key={item.text}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1, duration: 0.25 }}
            className="flex items-center gap-2 border-b last:border-0 py-1.5"
          >
            <item.icon className="size-3.5 shrink-0 text-primary/60" />
            <span className="flex-1 truncate text-[11px]">{item.text}</span>
            <span className="text-[10px] text-muted-foreground">{item.time}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Surat Digital Mockup ─── */
export function LettersMockup() {
  const letters = [
    { from: "Dinas Pendidikan", subject: "Permintaan Data Guru 2026", status: "Baru", statusColor: "bg-blue-500", date: "14 Mei" },
    { from: "Kemenkes RI", subject: "Undangan Rapat Koordinasi", status: "Proses", statusColor: "bg-amber-500", date: "13 Mei" },
    { from: "BPKP Pusat", subject: "Laporan Audit Semester I", status: "Selesai", statusColor: "bg-emerald-500", date: "12 Mei" },
    { from: "Bank Indonesia", subject: "Kerjasama Program Literasi", status: "Proses", statusColor: "bg-amber-500", date: "11 Mei" },
    { from: "Pemkot Bandung", subject: "Disposisi Perihal IMB Baru", status: "Baru", statusColor: "bg-blue-500", date: "10 Mei" },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2"
      >
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Cari surat...</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium">128 surat</span>
      </motion.div>

      {/* Letter list */}
      <div className="space-y-1.5">
        {letters.map((letter, i) => (
          <motion.div
            key={letter.subject}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            custom={i}
            className="flex items-center gap-3 rounded-lg border bg-background/80 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {letter.from.split(" ").slice(0, 2).map(w => w[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[11px] font-semibold">{letter.from}</span>
                <span className="text-[9px] text-muted-foreground">{letter.date}</span>
              </div>
              <span className="block truncate text-[10px] text-muted-foreground">{letter.subject}</span>
            </div>
            <div className={`shrink-0 rounded-full ${letter.statusColor} px-2 py-0.5 text-[9px] font-bold text-white`}>
              {letter.status}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── HR & People Mockup ─── */
export function HRMockup() {
  const employees = [
    { name: "Siti Rahmawati", role: "Manager HR", dept: "SDM", avatar: "SR", status: "Online" },
    { name: "Ahmad Fauzi", role: "Staff Legal", dept: "Hukum", avatar: "AF", status: "Away" },
    { name: "Dewi Kartika", role: "Analis Data", dept: "IT", avatar: "DK", status: "Online" },
  ];

  const hrStats = [
    { label: "Total Karyawan", value: "247", icon: Users },
    { label: "Hadir Hari Ini", value: "231", icon: CheckCircle2 },
    { label: "Cuti", value: "12", icon: Calendar },
    { label: "Baru Bulan Ini", value: "5", icon: ArrowUpRight },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {hrStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            custom={i}
            className="rounded-lg border bg-background/80 p-2 text-center"
          >
            <stat.icon className="mx-auto mb-1 size-4 text-primary/60" />
            <div className="text-base font-bold">{stat.value}</div>
            <div className="text-[9px] text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Attendance chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <span className="mb-2 block text-xs font-semibold">Kehadiran Minggu Ini</span>
        <div className="flex items-end gap-2" style={{ height: 50 }}>
          {["Sen", "Sel", "Rab", "Kam", "Jum"].map((day, i) => {
            const heights = [95, 92, 88, 96, 90];
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heights[i]}%` }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.4, ease: "easeOut" as const }}
                  className="w-full rounded-t bg-gradient-to-t from-emerald-500/80 to-emerald-400/40"
                />
                <span className="text-[9px] text-muted-foreground">{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Employee list */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.3 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <span className="mb-2 block text-xs font-semibold">Karyawan Terbaru</span>
        {employees.map((emp, i) => (
          <motion.div
            key={emp.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.25 }}
            className="flex items-center gap-2.5 border-b last:border-0 py-2"
          >
            <div className="relative flex size-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {emp.avatar}
              <div className={`absolute -bottom-0 -right-0 size-2 rounded-full border border-background ${emp.status === "Online" ? "bg-emerald-500" : "bg-amber-400"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold">{emp.name}</span>
              <span className="text-[9px] text-muted-foreground">{emp.role} &middot; {emp.dept}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Communication Mockup ─── */
export function CommsMockup() {
  const announcements = [
    { title: "Rapat Koordinasi Bulanan", category: "Pengumuman", time: "1 jam lalu", urgent: true },
    { title: "Survei Kepuasan Karyawan Q2", category: "Survei", time: "3 jam lalu", urgent: false },
    { title: "Selamat! Employee of the Month", category: "Penghargaan", time: "Kemarin", urgent: false },
  ];

  const pollData = [
    { label: "Sangat Puas", pct: 45 },
    { label: "Puas", pct: 32 },
    { label: "Cukup", pct: 18 },
    { label: "Kurang", pct: 5 },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Pengumuman", count: "24", icon: MessageSquare },
          { label: "Polling Aktif", count: "3", icon: ThumbsUp },
          { label: "Saran Baru", count: "17", icon: Send },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            custom={i}
            className="rounded-lg border bg-background/80 p-2.5 text-center"
          >
            <s.icon className="mx-auto mb-1 size-4 text-amber-500" />
            <div className="text-sm font-bold">{s.count}</div>
            <div className="text-[9px] text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Live poll */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <span className="mb-0.5 block text-xs font-semibold">Survei Kepuasan Karyawan</span>
        <span className="mb-2 block text-[10px] text-muted-foreground">89 responden</span>
        <div className="space-y-2">
          {pollData.map((item, i) => (
            <div key={item.label} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span>{item.label}</span>
                <span className="font-semibold">{item.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ delay: 0.4 + i * 0.08, duration: 0.5, ease: "easeOut" as const }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feed */}
      <div className="space-y-1.5">
        {announcements.map((item, i) => (
          <motion.div
            key={item.title}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            custom={i + 3}
            className="flex items-center gap-2.5 rounded-lg border bg-background/80 px-3 py-2"
          >
            {item.urgent && <div className="size-1.5 shrink-0 rounded-full bg-destructive animate-pulse" />}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold">{item.title}</span>
              <span className="text-[9px] text-muted-foreground">{item.category} &middot; {item.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Assistant Mockup ─── */
export function AIMockup() {
  const chatMessages = [
    { role: "user" as const, text: "Buatkan draft surat undangan rapat koordinasi" },
    { role: "ai" as const, text: "Siap, saya sudah menyiapkan draft surat undangan rapat koordinasi dengan format resmi. Berikut ringkasannya:" },
    { role: "ai" as const, text: "Perihal: Undangan Rapat Koordinasi\nNomor: 001/UN/V/2026\nTujuan: Seluruh Kepala Divisi\nTanggal: 20 Mei 2026" },
  ];

  return (
    <div className="flex h-full flex-col p-4">
      {/* Chat header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-3 flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5"
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 shadow-sm">
          <BarChart3 className="size-4 text-white" />
        </div>
        <div>
          <span className="block text-xs font-semibold">Star AI Assistant</span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 space-y-2.5">
        {chatMessages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.25, duration: 0.35, ease: "easeOut" as const }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "border bg-background/80 rounded-bl-sm"
              }`}
            >
              {msg.text.split("\n").map((line, li) => (
                <span key={li} className="block">{line}</span>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.3 }}
          className="flex justify-start"
        >
          <div className="flex items-center gap-1 rounded-2xl border bg-background/80 px-3 py-2 rounded-bl-sm">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
              className="size-1.5 rounded-full bg-muted-foreground"
            />
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
              className="size-1.5 rounded-full bg-muted-foreground"
            />
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
              className="size-1.5 rounded-full bg-muted-foreground"
            />
          </div>
        </motion.div>
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="mt-3 flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2"
      >
        <span className="flex-1 text-[11px] text-muted-foreground">Tanya sesuatu...</span>
        <Send className="size-3.5 text-primary" />
      </motion.div>
    </div>
  );
}

/* ─── Awards Mockup ─── */
export function AwardsMockup() {
  const leaderboard = [
    { name: "Siti Rahmawati", dept: "SDM", points: 2450, rank: 1 },
    { name: "Ahmad Fauzi", dept: "Legal", points: 2120, rank: 2 },
    { name: "Dewi Kartika", dept: "IT", points: 1890, rank: 3 },
    { name: "Budi Santoso", dept: "Finance", points: 1650, rank: 4 },
  ];

  const badges = ["Top Performer", "Team Player", "Innovator", "On-Time King"];

  return (
    <div className="space-y-3 p-4">
      {/* Featured award */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 p-3 dark:from-amber-950/30 dark:to-orange-950/30"
      >
        <div className="mb-2 flex items-center gap-2">
          <Award className="size-5 text-amber-500" />
          <span className="text-xs font-bold">Employee of the Month</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white shadow-lg">
            SR
          </div>
          <div>
            <span className="block text-sm font-bold">Siti Rahmawati</span>
            <span className="text-[10px] text-muted-foreground">Manager HR &middot; Dept. SDM</span>
            <div className="mt-1 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, si) => (
                <Star key={si} className="size-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex flex-wrap gap-1.5"
      >
        {badges.map((badge, i) => (
          <motion.span
            key={badge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 + i * 0.06, duration: 0.25 }}
            className="rounded-full bg-gradient-to-r from-cyan-500 to-sky-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm"
          >
            {badge}
          </motion.span>
        ))}
      </motion.div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="rounded-lg border bg-background/80 p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Leaderboard</span>
          <Clock className="size-3 text-muted-foreground" />
        </div>
        {leaderboard.map((person, i) => (
          <motion.div
            key={person.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.25 }}
            className="flex items-center gap-2.5 border-b last:border-0 py-1.5"
          >
            <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
              person.rank === 1 ? "bg-amber-400 text-white" :
              person.rank === 2 ? "bg-slate-300 text-slate-700" :
              person.rank === 3 ? "bg-amber-600/80 text-white" :
              "bg-muted text-muted-foreground"
            }`}>{person.rank}</span>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold">{person.name}</span>
              <span className="text-[9px] text-muted-foreground">{person.dept}</span>
            </div>
            <span className="text-[11px] font-bold text-primary">{person.points.toLocaleString()}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
