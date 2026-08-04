import { motion } from "motion/react";
import {
  ScanLine,
  BrainCircuit,
  GitBranch,
  CheckCircle2,
  FolderArchive,
  ChevronRight,
} from "lucide-react";

const steps = [
  {
    icon: ScanLine,
    number: "01",
    title: "Capture & Classify",
    description:
      "Dokumen masuk dipindai dan diklasifikasi secara otomatis. AI mengenali jenis dokumen, mengekstrak metadata, dan menetapkan nomor agenda.",
    color: "from-blue-500 to-blue-600",
    dot: "bg-blue-500",
  },
  {
    icon: BrainCircuit,
    number: "02",
    title: "Smart Routing",
    description:
      "Sistem merutekan dokumen ke pejabat yang tepat berdasarkan jenis, urgensi, dan struktur organisasi. Tanpa intervensi manual.",
    color: "from-violet-500 to-violet-600",
    dot: "bg-violet-500",
  },
  {
    icon: GitBranch,
    number: "03",
    title: "Parallel Approval",
    description:
      "Proses approval berjalan paralel dan bertingkat. Eskalasi otomatis saat melebihi batas waktu, dengan notifikasi real-time di setiap tahap.",
    color: "from-emerald-500 to-emerald-600",
    dot: "bg-emerald-500",
  },
  {
    icon: CheckCircle2,
    number: "04",
    title: "Execute & Track",
    description:
      "Pelaksana menindaklanjuti dan melaporkan progres secara real-time. Dashboard memantau status seluruh disposisi yang aktif.",
    color: "from-amber-500 to-amber-600",
    dot: "bg-amber-500",
  },
  {
    icon: FolderArchive,
    number: "05",
    title: "Archive & Analyze",
    description:
      "Seluruh dokumen dan riwayat tindakan diarsipkan digital. Analytics menghasilkan insight untuk perbaikan proses berkelanjutan.",
    color: "from-rose-500 to-rose-600",
    dot: "bg-rose-500",
  },
];

export default function WorkflowSection() {
  return (
    <section
      id="alur-kerja"
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
            Intelligent Workflow
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Dari Input hingga Arsip — Otomatis & Transparan
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Lima tahap terotomasi yang memastikan setiap dokumen diproses
            dengan cepat, tepat, dan terlacak penuh.
          </p>
        </motion.div>

        {/* Desktop: horizontal timeline */}
        <div className="hidden lg:block">
          {/* Connector line */}
          <div className="relative">
            <div className="absolute left-[10%] right-[10%] top-8 h-0.5 bg-gradient-to-r from-blue-400/40 via-violet-400/40 via-emerald-400/40 via-amber-400/40 to-rose-400/40" />
          </div>

          <div className="grid grid-cols-5 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative text-center"
              >
                {/* Step icon */}
                <div
                  className={`relative z-10 mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-lg`}
                >
                  <step.icon className="size-7" />
                </div>

                {/* Arrow */}
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-6 z-20 translate-x-1/2">
                    <ChevronRight className="size-5 text-muted-foreground/30" />
                  </div>
                )}

                <div className="rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Step {step.number}
                  </span>
                  <h3 className="mb-2 text-sm font-bold">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="relative lg:hidden">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-blue-400/30 via-emerald-400/30 to-rose-400/30" />

          <div className="space-y-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative flex gap-5 pl-2"
              >
                <div
                  className={`relative z-10 flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} text-white shadow-lg`}
                >
                  <step.icon className="size-5" />
                </div>

                <div className="flex-1 rounded-2xl border bg-card p-5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Step {step.number}
                  </span>
                  <h3 className="text-sm font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
