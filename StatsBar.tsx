import { motion, useInView, useSpring, useTransform } from "motion/react";
import { useRef, useEffect, useState } from "react";
import { Building2, FileText, Users, Clock, TrendingUp, Award } from "lucide-react";

const stats = [
  { icon: Building2, value: 250, suffix: "+", label: "Instansi & Perusahaan" },
  { icon: FileText, value: 2.5, suffix: "M+", label: "Surat Diproses", decimals: 1 },
  { icon: Users, value: 50, suffix: "rb+", label: "Pengguna Aktif" },
  { icon: Clock, value: 99.9, suffix: "%", label: "Uptime Sistem", decimals: 1 },
  { icon: TrendingUp, value: 70, suffix: "%", label: "Efisiensi Meningkat" },
  { icon: Award, value: 15, suffix: "+", label: "Penghargaan" },
];

function AnimatedCounter({
  value,
  suffix,
  decimals = 0,
}: {
  value: number;
  suffix: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayed, setDisplayed] = useState("0");

  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const rounded = useTransform(spring, (v: number) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString(),
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplayed(v));
    return unsub;
  }, [rounded]);

  return (
    <span ref={ref} className="tabular-nums">
      {displayed}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  return (
    <section className="relative border-y border-border/40 bg-gradient-to-r from-primary/3 via-card/80 to-accent/3 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-3 gap-6 px-6 py-14 md:grid-cols-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="flex flex-col items-center gap-2 text-center"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/8">
              <stat.icon className="size-4.5 text-primary" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              <AnimatedCounter
                value={stat.value}
                suffix={stat.suffix}
                decimals={stat.decimals}
              />
            </p>
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
