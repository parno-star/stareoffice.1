import { motion } from "motion/react";
import {
  BrainCircuit,
  Workflow,
  LayoutDashboard,
  Megaphone,
  Users,
  ShieldCheck,
  Fingerprint,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight: string;
  gradient: string;
  iconBg: string;
  span?: string;
};

const features: Feature[] = [
  {
    icon: BrainCircuit,
    title: "AI-Powered Document Intelligence",
    description:
      "Otomasi cerdas yang memproses, mengklasifikasi, dan merutekan dokumen secara instan. Analisis konten, ekstraksi data, dan rekomendasi tindakan — semua digerakkan AI.",
    highlight: "Proses 10x lebih cepat",
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    span: "lg:col-span-2",
  },
  {
    icon: Workflow,
    title: "Smart Workflow Engine",
    description:
      "Mesin approval multi-level yang adaptif — eskalasi otomatis, delegasi dinamis, dan parallel routing untuk kecepatan maksimal.",
    highlight: "Zero bottleneck",
    gradient: "from-blue-600 via-cyan-600 to-teal-600",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: LayoutDashboard,
    title: "Executive Command Center",
    description:
      "Dashboard real-time dengan KPI, heatmap aktivitas, dan predictive analytics. Pantau seluruh operasi kantor dari satu layar.",
    highlight: "Real-time insights",
    gradient: "from-emerald-600 via-green-600 to-teal-600",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Megaphone,
    title: "Corporate Communication Hub",
    description:
      "Polling, survei kepuasan, kotak saran digital, penghargaan karyawan, dan pengumuman terpusat — semua dalam satu ekosistem komunikasi internal.",
    highlight: "Engagement 3x lipat",
    gradient: "from-amber-600 via-orange-600 to-red-600",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    span: "lg:col-span-2",
  },
  {
    icon: Users,
    title: "HR & Talent Management",
    description:
      "Onboarding digital, training tracker, talent pool, performance review, dan succession planning — kelola SDM secara strategis.",
    highlight: "End-to-end HR",
    gradient: "from-rose-600 via-pink-600 to-fuchsia-600",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: Fingerprint,
    title: "Digital Signature & Verification",
    description:
      "Tanda tangan elektronik tersertifikasi dengan keabsahan hukum penuh sesuai UU ITE dan regulasi BSSN Indonesia.",
    highlight: "Legal & certified",
    gradient: "from-cyan-600 via-sky-600 to-blue-600",
    iconBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    description:
      "Enkripsi AES-256, multi-factor auth, role-based access control, audit trail lengkap, dan compliance ISO 27001 & UU PDP.",
    highlight: "ISO 27001 certified",
    gradient: "from-slate-600 via-gray-600 to-zinc-600",
    iconBg: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  {
    icon: Sparkles,
    title: "Smart Automation & Integration",
    description:
      "Penomoran otomatis, template cerdas, reminder deadline, dan integrasi API terbuka untuk koneksi dengan sistem yang sudah ada.",
    highlight: "Fully extensible",
    gradient: "from-indigo-600 via-violet-600 to-purple-600",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
];

export default function FeaturesSection() {
  return (
    <section id="fitur" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Fitur Strategis
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Teknologi Kantor Modern yang Mengubah Cara Kerja
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Delapan pilar strategis yang mentransformasi administrasi perkantoran
            menjadi ekosistem digital terintegrasi, cerdas, dan siap masa depan.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className={`group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1 ${feature.span ?? ""}`}
            >
              {/* Gradient accent line at top */}
              <div
                className={`h-1 w-full bg-gradient-to-r ${feature.gradient} opacity-70 transition-opacity group-hover:opacity-100`}
              />

              {/* Background glow on hover */}
              <div
                className={`absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.06]`}
              />

              <div className="relative p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Icon & highlight */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-11 items-center justify-center rounded-xl ${feature.iconBg} transition-transform duration-300 group-hover:scale-110`}
                      >
                        <feature.icon className="size-5" />
                      </div>
                      <span
                        className={`inline-flex rounded-full bg-gradient-to-r ${feature.gradient} px-3 py-1 text-[11px] font-bold text-white shadow-sm`}
                      >
                        {feature.highlight}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold leading-tight">
                      {feature.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
