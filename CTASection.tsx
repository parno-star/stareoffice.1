import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Zap, Phone } from "lucide-react";

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="border-t py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/95 to-accent px-8 py-20 text-center sm:px-16"
        >
          {/* Background effects */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08),transparent_50%)]" />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative space-y-8">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Zap className="size-8 text-white" />
            </div>

            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Siap Transformasi Digital<br className="hidden sm:block" />Administrasi Kantor Anda?
            </h2>
            <p className="mx-auto max-w-xl text-lg text-white/80">
              Bergabunglah dengan banyak organisasi yang telah meningkatkan 
              efisiensi administrasi dengan Star e-Office.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Unauthenticated>
                <SignInButton>
                  <Button
                    size="lg"
                    className="cursor-pointer gap-2 bg-white text-primary shadow-xl hover:bg-white/90"
                  >
                    Mulai Gratis Sekarang
                    <ArrowRight className="size-5" />
                  </Button>
                </SignInButton>
              </Unauthenticated>
              <Authenticated>
                <Button
                  size="lg"
                  className="cursor-pointer gap-2 bg-white text-primary shadow-xl hover:bg-white/90"
                  onClick={() => navigate("/home")}
                >
                  Buka Dashboard
                  <ArrowRight className="size-5" />
                </Button>
              </Authenticated>
              <Button
                size="lg"
                className="cursor-pointer gap-2 border-2 border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <Phone className="size-4" />
                Hubungi Sales
              </Button>
            </div>

            {/* Trust note removed */}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
