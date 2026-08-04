import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  Play,
  FileText,
  Clock,
  Users,
  CheckCircle,
} from "lucide-react";

const highlights = [
  "Manajemen surat digital end-to-end",
  "Polling, survei, kotak saran, penghargaan & fungsi Corporate Communication lainnya",
  "On boarding, training, talent pool & fungsi HR lainnya",
  "Arsip digital terstruktur & aman",
];

const miniStats = [
  { icon: FileText, value: "100+", label: "Surat" },
  { icon: Users, value: "50+", label: "User" },
  { icon: Clock, value: "99.9%", label: "Uptime" },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-background to-accent/6" />
      <div className="absolute -top-24 right-0 size-[360px] rounded-full bg-gradient-to-br from-primary/8 to-accent/8 blur-[80px]" />
      <div className="absolute -bottom-24 -left-12 size-[300px] rounded-full bg-gradient-to-tr from-accent/6 to-primary/6 blur-[80px]" />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 lg:py-14">
        <div className="grid gap-7 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-10">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Platform e-Office Terlengkap
            </motion.div>

            {/* Headline */}
            <h1 className="text-balance text-2xl font-extrabold leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl">
              Digitalisasi Administrasi{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Manajemen Kantor
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="absolute -bottom-1 left-0 h-1 w-full origin-left rounded-full bg-gradient-to-r from-primary/40 to-accent/40"
                />
              </span>{" "}
              Terpadu &amp; Komprehensif
            </h1>

            {/* Subtitle */}
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Star e-Office mengefisienkan seluruh proses administrasi manajemen
              perkantoran — dari administrasi manajemen operasional harian, general affair,
              human resource, finance, dan lainnya hingga information technology dalam satu platform.
            </p>

            {/* Highlights */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {highlights.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
                  className="flex items-start gap-2 text-xs text-foreground/80"
                >
                  <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {item}
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Unauthenticated>
                <SignInButton>
                  <Button size="default" className="cursor-pointer gap-2 text-sm shadow-xl shadow-primary/25">
                    Mulai Gratis
                    <ArrowRight className="size-4" />
                  </Button>
                </SignInButton>
              </Unauthenticated>
              <Authenticated>
                <Button
                  size="default"
                  className="cursor-pointer gap-2 text-sm shadow-xl shadow-primary/25"
                  onClick={() => navigate("/home")}
                >
                  Buka Dashboard
                  <ArrowRight className="size-4" />
                </Button>
              </Authenticated>
              <AuthLoading>
                <Skeleton className="h-10 w-36" />
              </AuthLoading>
              {/* Lihat Demo - hidden for now
              <button className="group flex cursor-pointer items-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-muted-foreground/30 transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Play className="size-3.5 ml-0.5" />
                </span>
                Lihat Demo
              </button>
              */}
            </div>

            {/* Mini stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="flex items-center gap-5 border-t border-border/50 pt-4"
            >
              {miniStats.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <s.icon className="size-3.5 text-primary/60" />
                  <span className="text-xs font-bold text-foreground">{s.value}</span>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right - Device Mockup PNG */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="relative hidden lg:flex flex-col items-center"
          >
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/8 to-primary/6 blur-xl" />
            <img
              src="https://hercules-cdn.com/file_AgzKVimkO9BvTGUg8zX5DQHw"
              alt="Tampilan dashboard Star e-Office di desktop dan mobile"
              className="relative w-full max-w-[380px]"
            />
            <p className="relative mt-3 text-center text-[11px] text-muted-foreground">
              Tampilan dashboard Star e-Office di desktop dan mobile — akses dari mana saja, kapan saja.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
