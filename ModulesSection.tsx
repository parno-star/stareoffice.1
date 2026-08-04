import { motion } from "motion/react";
import {
  FileText,
  BrainCircuit,
  Workflow,
  Megaphone,
  Users,
  BarChart3,
  Fingerprint,
  Archive,
  Bell,
  CalendarCheck,
  GraduationCap,
  Cog,
} from "lucide-react";

const modules = [
  {
    group: "Digital Office Core",
    description:
      "Mesin utama administrasi digital — dari persuratan cerdas hingga arsip terstruktur.",
    gradient: "from-blue-600 to-indigo-600",
    bgAccent: "bg-blue-500/5",
    items: [
      { icon: FileText, label: "Smart Correspondence", desc: "Surat masuk & keluar AI-assisted" },
      { icon: Workflow, label: "Approval Engine", desc: "Multi-level adaptive workflow" },
      { icon: Fingerprint, label: "Digital Signature", desc: "e-Sign tersertifikasi BSSN" },
      { icon: Archive, label: "Digital Archive", desc: "Arsip terstruktur & searchable" },
    ],
  },
  {
    group: "People & Communication",
    description:
      "Ekosistem lengkap untuk mengelola SDM dan komunikasi internal organisasi.",
    gradient: "from-emerald-600 to-teal-600",
    bgAccent: "bg-emerald-500/5",
    items: [
      { icon: Users, label: "HR Management", desc: "Onboarding, talent & performance" },
      { icon: Megaphone, label: "Corporate Comms", desc: "Polling, survei & pengumuman" },
      { icon: GraduationCap, label: "Training Center", desc: "E-learning & sertifikasi" },
      { icon: CalendarCheck, label: "Agenda & Meeting", desc: "Penjadwalan terpusat" },
    ],
  },
  {
    group: "Intelligence & Control",
    description:
      "Dashboard eksekutif, AI analytics, dan kontrol operasional real-time.",
    gradient: "from-violet-600 to-purple-600",
    bgAccent: "bg-violet-500/5",
    items: [
      { icon: BarChart3, label: "Executive Dashboard", desc: "KPI & predictive analytics" },
      { icon: BrainCircuit, label: "AI Insights", desc: "Rekomendasi & anomaly detection" },
      { icon: Bell, label: "Smart Notifications", desc: "Push, email & in-app alerts" },
      { icon: Cog, label: "System Config", desc: "Role, akses & integrasi API" },
    ],
  },
];

export default function ModulesSection() {
  return (
    <section
      id="modul"
      className="border-t bg-gradient-to-b from-muted/20 to-background py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Ekosistem Terintegrasi
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Tiga Pilar Strategis Star e-Office
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Arsitektur modular yang mencakup seluruh kebutuhan manajemen
            perkantoran modern — dari operasional hingga strategis.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {modules.map((mod, gi) => (
            <motion.div
              key={mod.group}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: gi * 0.12 }}
              className={`group rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-lg ${mod.bgAccent}`}
            >
              {/* Gradient top bar */}
              <div
                className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${mod.gradient}`}
              />

              <div className="p-6">
                {/* Module group badge */}
                <div
                  className={`mb-2 inline-flex items-center rounded-lg bg-gradient-to-r ${mod.gradient} px-3.5 py-1.5 shadow-sm`}
                >
                  <span className="text-sm font-bold text-white">
                    {mod.group}
                  </span>
                </div>
                <p className="mb-5 text-sm text-muted-foreground">
                  {mod.description}
                </p>

                <div className="space-y-1.5">
                  {mod.items.map((item, ii) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.3,
                        delay: gi * 0.12 + ii * 0.06,
                      }}
                      className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-background/70"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/50">
                        <item.icon className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {item.desc}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
