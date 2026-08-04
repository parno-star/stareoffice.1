import { motion } from "motion/react";
import {
  PhoneCall,
  Mic,
  Video,
  ShieldCheck,
  Gauge,
  Sparkles,
  MonitorUp,
  MessageSquare,
} from "lucide-react";

const highlights = [
  {
    icon: Mic,
    title: "Audio-first, hemat biaya",
    description:
      "Panggilan suara jernih sebagai default untuk rapat cepat tanpa boros kuota. Aktifkan video hanya saat benar-benar dibutuhkan.",
  },
  {
    icon: Video,
    title: "Video sekali klik",
    description:
      "Naik ke tatap muka, berbagi layar, dan chat langsung dari ruangan panggilan yang sama — tanpa aplikasi tambahan.",
  },
  {
    icon: ShieldCheck,
    title: "Aman per organisasi",
    description:
      "Setiap panggilan terisolasi di dalam organisasi Anda. Hanya anggota yang berhak yang bisa memulai dan bergabung.",
  },
  {
    icon: Gauge,
    title: "Kuota terkendali",
    description:
      "Admin menetapkan batas menit per bulan. Pemakaian terpantau real-time dan reset otomatis tiap awal bulan.",
  },
];

export default function CallsSection() {
  return (
    <section className="relative overflow-hidden border-t py-24">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Baru: Panggilan Terintegrasi
          </div>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Rapat suara &amp; video, langsung di dalam kantor digital Anda
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Tidak perlu lagi berpindah aplikasi. Mulai panggilan audio atau video
            dengan rekan satu organisasi, terhubung ke pemesanan ruangan, dan
            kendalikan biaya lewat kuota — semuanya dalam satu platform.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {highlights.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Call UI mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10">
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PhoneCall className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    Rapat Koordinasi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3 peserta · 12:04
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            {/* Participants grid */}
            <div className="grid grid-cols-2 gap-3 p-5">
              {[
                { name: "Andi P.", accent: "from-violet-500 to-indigo-600" },
                { name: "Sari W.", accent: "from-rose-500 to-pink-600" },
                { name: "Budi S.", accent: "from-emerald-500 to-teal-600" },
                { name: "Rina M.", accent: "from-amber-500 to-orange-600" },
              ].map((p) => (
                <div
                  key={p.name}
                  className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted"
                >
                  <div
                    className={`flex size-12 items-center justify-center rounded-full bg-gradient-to-br ${p.accent} text-base font-bold text-white shadow-lg`}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 border-t bg-muted/40 px-5 py-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                <Mic className="size-4" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                <Video className="size-4" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                <MonitorUp className="size-4" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                <MessageSquare className="size-4" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
                <PhoneCall className="size-4 rotate-[135deg]" />
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
