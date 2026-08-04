import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  MailOpen,
  Clock,
  Users,
  FolderKanban,
  MessagesSquare,
  Sparkles,
  GraduationCap,
  CalendarDays,
} from "lucide-react";

const shortcuts = [
  { icon: MailOpen, label: "Kelola Surat", path: "/letters", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { icon: Clock, label: "Absensi", path: "/attendance", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { icon: Users, label: "Direktori", path: "/directory", color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  { icon: FolderKanban, label: "Tugas & Proyek", path: "/projects", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  { icon: MessagesSquare, label: "Forum", path: "/forum", color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
  { icon: Sparkles, label: "Asisten AI", path: "/chatbot", color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { icon: GraduationCap, label: "Pelatihan", path: "/training", color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" },
  { icon: CalendarDays, label: "Kalender", path: "/calendar", color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
];

export default function QuickShortcuts() {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
      {shortcuts.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
            onClick={() => navigate(item.path)}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border bg-card p-3 transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className={`flex size-10 items-center justify-center rounded-lg ${item.color}`}>
              <Icon className="size-5" />
            </div>
            <span className="text-xs font-medium text-center">{item.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
