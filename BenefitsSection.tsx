import { motion } from "motion/react";
import {
  Rocket,
  TrendingDown,
  ShieldCheck,
  Gauge,
  Globe2,
  BarChart3,
} from "lucide-react";

const benefits = [
  {
    icon: Rocket,
    title: "Percepatan Proses 10x",
    description:
      "Proses yang sebelumnya memakan hari kini selesai dalam menit. AI-powered routing dan smart automation memangkas birokrasi secara drastis.",
    stat: "3 hari → 15 menit",
    color: "from-violet-500 to-indigo-600",
  },
  {
    icon: TrendingDown,
    title: "Efisiensi Biaya Operasional",
    description:
      "Eliminasi biaya kertas, tinta, kurir, dan ruang arsip fisik. Otomasi mengurangi overhead administratif hingga puluhan persen.",
    stat: "Hemat Rp 500jt+/th",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: ShieldCheck,
    title: "Zero Trust Security",
    description:
      "Arsitektur keamanan berlapis — enkripsi AES-256, MFA, RBAC granular, dan audit trail menyeluruh untuk proteksi total.",
    stat: "ISO 27001 Ready",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: Gauge,
    title: "SLA 99.9% Uptime",
    description:
      "Infrastruktur high-availability memastikan platform selalu tersedia. Monitoring 24/7 dan auto-recovery menjaga kontinuitas operasi.",
    stat: "0 downtime kritis",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Globe2,
    title: "Akses Multi-Platform",
    description:
      "Responsive design untuk desktop, tablet, dan smartphone. Bekerja dari mana saja dengan pengalaman yang konsisten di semua device.",
    stat: "Desktop + Mobile",
    color: "from-cyan-500 to-sky-600",
  },
  {
    icon: BarChart3,
    title: "Data-Driven Decision",
    description:
      "Executive dashboard dengan predictive analytics, heatmap produktivitas, dan KPI monitoring real-time untuk keputusan strategis.",
    stat: "Real-time analytics",
    color: "from-rose-500 to-pink-600",
  },
];

export default function BenefitsSection() {
  return (
    <section className="border-t py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Dampak Nyata
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Transformasi yang Terukur untuk Organisasi Anda
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Bukan sekedar digitalisasi — Star e-Office mengakselerasi kinerja
            organisasi dengan hasil yang langsung terasa.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1"
            >
              {/* Background accent blob */}
              <div
                className={`absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br ${item.color} opacity-[0.05] transition-transform duration-500 group-hover:scale-[1.8]`}
              />

              <div className="relative">
                {/* Icon */}
                <div
                  className={`mb-5 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg shadow-black/10`}
                >
                  <item.icon className="size-5" />
                </div>

                {/* Title */}
                <h3 className="mb-2 text-lg font-bold">{item.title}</h3>

                {/* Description */}
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>

                {/* Stat badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${item.color} px-3.5 py-1.5 text-xs font-bold text-white shadow-sm`}
                >
                  {item.stat}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
