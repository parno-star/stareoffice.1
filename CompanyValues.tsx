import { motion } from "motion/react";
import { cn } from "@/lib/utils.ts";

type ValueItem = {
  icon: string;
  title: string;
  description: string;
};

type CompanyValuesProps = {
  values: ValueItem[];
};

const cardColors = [
  "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
  "from-amber-500/10 to-amber-600/5 border-amber-500/20",
  "from-violet-500/10 to-violet-600/5 border-violet-500/20",
  "from-rose-500/10 to-rose-600/5 border-rose-500/20",
  "from-cyan-500/10 to-cyan-600/5 border-cyan-500/20",
];

export default function CompanyValues({ values }: CompanyValuesProps) {
  if (values.length === 0) return null;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {values.map((value, i) => (
        <motion.div
          key={value.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
          className={cn(
            "rounded-xl border bg-gradient-to-br p-5 transition-shadow hover:shadow-md",
            cardColors[i % cardColors.length]
          )}
        >
          <div className="text-3xl mb-3">{value.icon}</div>
          <h3 className="text-sm font-semibold">{value.title}</h3>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {value.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
