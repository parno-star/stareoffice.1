import { motion } from "motion/react";
import {
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  Server,
  Globe2,
  BadgeCheck,
} from "lucide-react";

const securityItems = [
  {
    icon: Lock,
    title: "Enkripsi End-to-End",
    description:
      "Seluruh data dienkripsi saat transit (TLS 1.3) dan saat tersimpan (AES-256). Tidak ada celah akses tanpa otorisasi.",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: ShieldCheck,
    title: "Multi-Factor Authentication",
    description:
      "Keamanan berlapis dengan MFA, SSO/SAML, dan integrasi Active Directory — memastikan hanya user terverifikasi yang masuk.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: Eye,
    title: "Complete Audit Trail",
    description:
      "Setiap aktivitas tercatat: timestamp, user ID, IP address, dan detail aksi — untuk akuntabilitas dan forensik digital.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: KeyRound,
    title: "Granular Access Control",
    description:
      "RBAC berbasis jabatan, unit kerja, dan level kewenangan. Kontrol akses hingga level dokumen individual.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: Server,
    title: "Data Center Tier-III",
    description:
      "Data tersimpan di data center berstandar Tier-III di Indonesia dengan redundansi penuh sesuai regulasi lokal.",
    gradient: "from-cyan-500 to-sky-600",
  },
  {
    icon: Globe2,
    title: "Regulatory Compliance",
    description:
      "Memenuhi ISO 27001, UU Perlindungan Data Pribadi (UU PDP), dan standar keamanan TTE dari BSSN Indonesia.",
    gradient: "from-rose-500 to-pink-600",
  },
];

const certifications = [
  "ISO 27001",
  "UU PDP Compliant",
  "Tier-III DC",
  "BSSN TTE",
  "AES-256",
  "SSO/SAML",
  "TLS 1.3",
  "SOC 2 Type II",
];

export default function SecuritySection() {
  return (
    <section id="keamanan" className="border-t py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Enterprise Security
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Proteksi Data Setara Standar Perbankan
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Arsitektur keamanan berlapis yang memenuhi standar internasional
            untuk melindungi data sensitif organisasi Anda.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {securityItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1"
            >
              {/* Hover glow */}
              <div
                className={`absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br ${item.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.07]`}
              />

              <div className="relative">
                <div
                  className={`mb-5 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-white shadow-lg shadow-black/10 transition-transform duration-300 group-hover:scale-110`}
                >
                  <item.icon className="size-5" />
                </div>
                <h3 className="mb-2 text-base font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Certification badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-3"
        >
          {certifications.map((cert) => (
            <div
              key={cert}
              className="flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-foreground"
            >
              <BadgeCheck className="size-3.5 text-accent" />
              {cert}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
