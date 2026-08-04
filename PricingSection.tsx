import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  Users,
  HardDrive,
  Headphones,
  Crown,
  Rocket,
  Building2,
  Zap,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { sortFeaturesByMenuOrder } from "@/pages/membership-settings/_lib/feature-catalog.ts";

type PlanTier = {
  name: string;
  slug: string;
  price: string;
  priceUnit: string;
  description: string;
  icon: LucideIcon;
  color: string;
  badgeBg: string;
  popular: boolean;
  limits: { employees: string; storage: string; support: string };
  coreFeatures: string[];
  extras: string[];
  disabledFeatures: string[];
};

// Static fallback when no plans are in the database
const FALLBACK_PLANS: PlanTier[] = [
  {
    name: "Gratis",
    slug: "free",
    price: "Rp 0",
    priceUnit: "selamanya",
    description: "Mulai kelola tim kecil Anda tanpa biaya",
    icon: Zap,
    color: "from-slate-500 to-slate-600",
    badgeBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    popular: false,
    limits: { employees: "5 karyawan", storage: "500 MB", support: "Komunitas" },
    coreFeatures: [
      "Direktori Karyawan",
      "Absensi & Cuti dasar",
      "Pengumuman (baca)",
      "Pesan & Notifikasi",
      "Perayaan otomatis",
      "Dokumen Saya",
    ],
    extras: [],
    disabledFeatures: [
      "Penggajian",
      "Rekrutmen",
      "Pelatihan",
      "OKR & Kinerja",
      "Asisten AI",
    ],
  },
  {
    name: "Starter",
    slug: "starter",
    price: "Rp 25rb",
    priceUnit: "/user/bulan",
    description: "Operasional HR lengkap untuk tim berkembang",
    icon: Rocket,
    color: "from-blue-500 to-blue-600",
    badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    popular: false,
    limits: { employees: "50 karyawan", storage: "5 GB", support: "Email" },
    coreFeatures: [
      "Semua fitur Gratis",
      "Penggajian (Payroll)",
      "Dokumen & Kebijakan",
      "Onboarding karyawan",
      "Kelola Surat & Kalender",
      "Apresiasi & Polling",
      "Tugas & Proyek (10 aktif)",
      "Pemesanan Ruangan",
    ],
    extras: [],
    disabledFeatures: [
      "Rekrutmen & ATS",
      "Pelatihan (LMS)",
      "OKR & Goals",
      "Asisten AI",
    ],
  },
  {
    name: "Professional",
    slug: "professional",
    price: "Rp 65rb",
    priceUnit: "/user/bulan",
    description: "Solusi lengkap pengembangan SDM perusahaan",
    icon: Crown,
    color: "from-accent to-emerald-600",
    badgeBg: "bg-accent/10 text-accent dark:bg-accent/20",
    popular: true,
    limits: { employees: "200 karyawan", storage: "50 GB", support: "Prioritas" },
    coreFeatures: [
      "Semua fitur Starter",
      "Rekrutmen & ATS",
      "Pelatihan (LMS)",
      "OKR & Penilaian Kinerja",
      "Jenjang Karier",
      "Reimbursement & Travel",
      "Asisten AI (Chatbot HR)",
      "Wiki & Knowledge Base",
      "Forum, Saran, Penghargaan",
      "Inventaris & Aset",
      "Pulse Survey & Helpdesk",
      "Proyek Unlimited",
    ],
    extras: [],
    disabledFeatures: [
      "Feedback 360°",
      "Talent Management",
      "Analitik Advanced",
    ],
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    price: "Custom",
    priceUnit: "hubungi kami",
    description: "Kontrol penuh untuk korporasi besar",
    icon: Building2,
    color: "from-primary to-indigo-700",
    badgeBg: "bg-primary/10 text-primary dark:bg-primary/20",
    popular: false,
    limits: {
      employees: "Unlimited",
      storage: "Unlimited",
      support: "Dedicated AM",
    },
    coreFeatures: [
      "Semua fitur Professional",
      "Feedback 360°",
      "Talent Management",
      "Analitik Advanced & Custom",
      "Admin Dashboard lanjutan",
      "Audit Trail & RBAC granular",
      "Asisten AI Premium",
      "API Access & Webhook",
      "Dedicated Account Manager",
    ],
    extras: [],
    disabledFeatures: [],
  },
];

// Map slug to icon and visual style for DB-sourced plans
const SLUG_VISUALS: Record<string, { icon: LucideIcon; color: string; badgeBg: string }> = {
  free: { icon: Zap, color: "from-slate-500 to-slate-600", badgeBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  starter: { icon: Rocket, color: "from-blue-500 to-blue-600", badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  professional: { icon: Crown, color: "from-accent to-emerald-600", badgeBg: "bg-accent/10 text-accent dark:bg-accent/20" },
  enterprise: { icon: Building2, color: "from-primary to-indigo-700", badgeBg: "bg-primary/10 text-primary dark:bg-primary/20" },
};

const DEFAULT_VISUALS = { icon: Rocket, color: "from-blue-500 to-blue-600", badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" };

const SUPPORT_LABELS: Record<string, string> = {
  community: "Komunitas",
  email: "Email",
  priority: "Prioritas",
  dedicated: "Dedicated AM",
};

function formatStorage(mb: number): string {
  if (mb === 0) return "Unlimited";
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
  return `${mb} MB`;
}

function formatEmployees(max: number): string {
  if (max === 0) return "Unlimited";
  return `${max} karyawan`;
}

const limitIcons = {
  employees: Users,
  storage: HardDrive,
  support: Headphones,
} as const;

const limitLabels: Record<string, string> = {
  employees: "Karyawan",
  storage: "Penyimpanan",
  support: "Dukungan",
};

export default function PricingSection() {
  const navigate = useNavigate();
  const dbPlans = useQuery(api.membership.listActive, {});
  const activePromos = useQuery(api.promos.listActive, {});

  // Convert DB plans to display format, or use fallback
  const plans: PlanTier[] = dbPlans && dbPlans.length > 0
    ? dbPlans.map((p) => {
        const visuals = SLUG_VISUALS[p.slug] ?? DEFAULT_VISUALS;
        return {
          name: p.name,
          slug: p.slug,
          price: p.price,
          priceUnit: p.priceUnit,
          description: p.description,
          icon: visuals.icon,
          color: visuals.color,
          badgeBg: visuals.badgeBg,
          popular: p.isPopular,
          limits: {
            employees: formatEmployees(p.maxEmployees),
            storage: formatStorage(p.maxStorageMb),
            support: SUPPORT_LABELS[p.supportLevel] ?? p.supportLevel,
          },
          coreFeatures: sortFeaturesByMenuOrder(p.coreFeatures),
          extras: [],
          disabledFeatures: sortFeaturesByMenuOrder(p.disabledFeatures),
        };
      })
    : FALLBACK_PLANS;

  return (
    <section id="harga" className="border-t bg-muted/30 py-24">
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
            Paket & Harga
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Pilih Paket yang Tepat untuk Organisasi Anda
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Mulai gratis dan upgrade kapan saja sesuai kebutuhan. Semua paket
            termasuk keamanan enterprise-grade dan update rutin.
          </p>
        </motion.div>

        {/* Active Promo Banners */}
        {activePromos && activePromos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-10 flex flex-col gap-3"
          >
            {activePromos.slice(0, 3).map((promo) => (
              <div
                key={promo._id}
                className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-5 py-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                  <Tag className="size-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{promo.name}</p>
                  {promo.description && (
                    <p className="text-xs text-muted-foreground truncate">{promo.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <code className="rounded-md bg-accent/15 px-2.5 py-1 text-xs font-bold tracking-wider text-accent">
                    {promo.code}
                  </code>
                  {promo.discountPercent > 0 && (
                    <span className="text-xs font-bold text-accent">-{promo.discountPercent}%</span>
                  )}
                  {promo.extraUsers > 0 && (
                    <span className="text-xs font-bold text-accent">+{promo.extraUsers} user</span>
                  )}
                  {promo.extraStorageMb > 0 && (
                    <span className="text-xs font-bold text-accent">
                      +{promo.extraStorageMb >= 1024 ? `${Math.round(promo.extraStorageMb / 1024)} GB` : `${promo.extraStorageMb} MB`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Pricing Cards */}
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.slug}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                  plan.popular &&
                    "border-accent shadow-accent/10 ring-2 ring-accent/20 scale-[1.02] lg:scale-105",
                )}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1 text-xs font-bold text-white shadow-lg shadow-accent/30">
                      <Sparkles className="size-3" />
                      Paling Populer
                    </div>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                        plan.color,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {plan.priceUnit}
                    </span>
                  </div>
                </div>

                {/* Limits */}
                <div className="mb-6 space-y-2.5 rounded-xl bg-muted/50 p-4">
                  {(
                    Object.entries(plan.limits) as [
                      keyof typeof limitIcons,
                      string,
                    ][]
                  ).map(([key, value]) => {
                    const LimitIcon = limitIcons[key];
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <LimitIcon className="size-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {limitLabels[key]}:
                        </span>
                        <span className="ml-auto text-xs font-semibold">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Features */}
                <div className="mb-6 flex-1 space-y-2.5">
                  {plan.coreFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Check className="size-2.5" strokeWidth={3} />
                      </div>
                      <span className="text-sm leading-tight">{feature}</span>
                    </div>
                  ))}
                  {plan.disabledFeatures.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-2.5 opacity-40"
                    >
                      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <X className="size-2.5" strokeWidth={3} />
                      </div>
                      <span className="text-sm leading-tight line-through">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="mt-auto">
                  {plan.slug === "enterprise" ? (
                    <Button
                      className="w-full cursor-pointer gap-2"
                      variant="secondary"
                      size="lg"
                    >
                      Hubungi Sales
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <>
                      <Unauthenticated>
                        <SignInButton>
                          <Button
                            className={cn(
                              "w-full cursor-pointer gap-2",
                              plan.popular &&
                                "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20",
                            )}
                            variant={plan.popular ? "default" : "secondary"}
                            size="lg"
                          >
                            {plan.slug === "free"
                              ? "Mulai Gratis"
                              : `Pilih ${plan.name}`}
                            <ArrowRight className="size-4" />
                          </Button>
                        </SignInButton>
                      </Unauthenticated>
                      <Authenticated>
                        <Button
                          className={cn(
                            "w-full cursor-pointer gap-2",
                            plan.popular &&
                              "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20",
                          )}
                          variant={plan.popular ? "default" : "secondary"}
                          size="lg"
                          onClick={() => navigate("/home")}
                        >
                          {plan.slug === "free"
                            ? "Mulai Gratis"
                            : `Pilih ${plan.name}`}
                          <ArrowRight className="size-4" />
                        </Button>
                      </Authenticated>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 text-center text-sm text-muted-foreground"
        >
          Semua paket termasuk SSL, backup harian, dan update fitur otomatis.
          Butuh paket khusus?{" "}
          <span className="font-medium text-accent cursor-pointer hover:underline">
            Hubungi tim kami
          </span>
        </motion.p>
      </div>
    </section>
  );
}
