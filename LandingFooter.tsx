import { motion } from "motion/react";
import { Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";

type FooterLink = { label: string; href?: string };

const footerLinks: { title: string; links: FooterLink[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Fitur", href: "#fitur" },
      { label: "Demo", href: "#demo" },
      { label: "Modul", href: "#modul" },
      { label: "Keamanan", href: "#keamanan" },
      { label: "Harga", href: "#harga" },
    ],
  },
  {
    title: "Solusi",
    links: [
      { label: "Pemerintahan" },
      { label: "BUMN & Korporasi" },
      { label: "Universitas" },
      { label: "Rumah Sakit" },
      { label: "Organisasi Nirlaba" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Tentang Kami" },
      { label: "Karier" },
      { label: "Blog" },
      { label: "Kebijakan Privasi" },
      { label: "Syarat & Ketentuan" },
    ],
  },
];

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  const scrollTo = (href: string | undefined) => {
    if (!href) return;
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="border-t bg-card/80">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="space-y-5"
          >
            <div className="flex items-center gap-3">
              <img
                src="https://hercules-cdn.com/file_7bF1THHF8b3fr9mKoxvzuiHn"
                alt="Star e-Office"
                className="size-10 rounded-xl"
              />
              <span className="text-xl font-bold">Star e-Office</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Platform e-office corporate terdepan untuk digitalisasi
              administrasi perkantoran di Indonesia.
            </p>

            {/* Contact info */}
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0" />
                <span>Bandung, Indonesia</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0" />
                <span>+62 811-229-1110</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0" />
                <span>info@stareoffice.com</span>
              </div>
            </div>
          </motion.div>

          {/* Link columns */}
          {footerLinks.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.08, duration: 0.3 }}
            >
              <h4 className="mb-4 text-sm font-bold">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => scrollTo(link.href)}
                      className="group flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                      {link.href && (
                        <ArrowUpRight className="size-3 opacity-0 transition-all group-hover:opacity-100" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Star e-Office. Star Digital Office untuk
            organisasi modern Indonesia.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span className="cursor-pointer transition-colors hover:text-foreground">Privasi</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">Ketentuan</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">Cookie</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
