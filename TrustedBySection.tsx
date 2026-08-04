import { motion } from "motion/react";

const trustedOrgs = [
  { name: "Kementerian Keuangan", abbr: "KK", gradient: "from-blue-600 to-indigo-600" },
  { name: "Bank Indonesia", abbr: "BI", gradient: "from-sky-600 to-blue-600" },
  { name: "PT Telkom Indonesia", abbr: "TI", gradient: "from-red-500 to-rose-600" },
  { name: "Kementerian BUMN", abbr: "KB", gradient: "from-violet-600 to-purple-600" },
  { name: "PLN", abbr: "PL", gradient: "from-cyan-600 to-teal-600" },
  { name: "Pertamina", abbr: "PT", gradient: "from-emerald-600 to-green-600" },
  { name: "BRI", abbr: "BR", gradient: "from-blue-500 to-sky-600" },
  { name: "Bank Mandiri", abbr: "BM", gradient: "from-amber-500 to-yellow-600" },
  { name: "Garuda Indonesia", abbr: "GI", gradient: "from-teal-600 to-emerald-600" },
  { name: "Pos Indonesia", abbr: "PI", gradient: "from-orange-500 to-red-500" },
  { name: "Bukalapak", abbr: "BK", gradient: "from-pink-500 to-rose-500" },
  { name: "XL Axiata", abbr: "XL", gradient: "from-blue-600 to-violet-600" },
];

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...trustedOrgs, ...trustedOrgs];

  return (
    <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-4"
        animate={{ x: reverse ? ["0%", "-50%"] : ["-50%", "0%"] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 35,
            ease: "linear",
          },
        }}
      >
        {items.map((org, i) => (
          <div
            key={`${org.name}-${i}`}
            className="group flex shrink-0 items-center gap-3.5 rounded-xl border bg-card/80 px-5 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className={`flex size-10 items-center justify-center rounded-lg bg-gradient-to-br ${org.gradient} shadow-sm transition-transform duration-300 group-hover:scale-110`}
            >
              <span className="text-xs font-bold text-white">
                {org.abbr}
              </span>
            </div>
            <span className="whitespace-nowrap text-sm font-medium text-foreground/70 transition-colors group-hover:text-foreground">
              {org.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function TrustedBySection() {
  return (
    <section className="border-b border-border/40 py-14">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dipercaya oleh ratusan instansi dan perusahaan terkemuka di Indonesia
          </p>
        </motion.div>
      </div>

      <div className="space-y-4">
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>
    </section>
  );
}
