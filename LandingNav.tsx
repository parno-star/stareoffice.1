import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Menu, X, Phone } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

// Map: nav link id -> section id yang mengontrol visibilitasnya
const ALL_NAV_LINKS = [
  { sectionId: "features", label: "Fitur", href: "#fitur" },
  { sectionId: "demo", label: "Demo", href: "#demo" },
  { sectionId: "modules", label: "Modul", href: "#modul" },
  { sectionId: "workflow", label: "Alur Kerja", href: "#alur-kerja" },
  { sectionId: "security", label: "Keamanan", href: "#keamanan" },
  { sectionId: "testimonial", label: "Testimoni", href: "#testimoni" },
];

export default function LandingNav() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibility = useQuery(api.siteSettings.getLandingSectionVisibility, {});

  // Tampilkan menu nav hanya jika seksi terkait aktif (undefined = loading, tampilkan semua dulu)
  const navLinks = ALL_NAV_LINKS.filter((link) => {
    if (visibility === undefined) return true; // masih loading
    return visibility[link.sectionId] === true;
  });

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="https://hercules-cdn.com/file_7bF1THHF8b3fr9mKoxvzuiHn" alt="Star e-Office" className="size-10 rounded-xl shadow-lg shadow-primary/25" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              Star e-Office
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <a
            href="tel:+6281234567890"
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
          >
            <Phone className="size-3.5" />
            Hubungi Kami
          </a>
          <AuthLoading>
            <Skeleton className="h-9 w-24" />
          </AuthLoading>
          <Unauthenticated>
            <SignInButton>
              <Button size="sm" className="cursor-pointer gap-2 shadow-lg shadow-primary/20">
                Masuk
                <ArrowRight className="size-3.5" />
              </Button>
            </SignInButton>
          </Unauthenticated>
          <Authenticated>
            <Button
              size="sm"
              onClick={() => navigate("/home")}
              className="cursor-pointer gap-2 shadow-lg shadow-primary/20"
            >
              Dashboard
              <ArrowRight className="size-3.5" />
            </Button>
          </Authenticated>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="border-t bg-background px-6 pb-4 lg:hidden"
        >
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="block w-full cursor-pointer rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
}
