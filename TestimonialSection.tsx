import { motion } from "motion/react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    name: "Dr. Hendra Wijaya, M.M.",
    role: "Sekretaris Daerah",
    org: "Pemerintah Kota Bandung",
    text: "Sejak menggunakan Star e-Office, proses disposisi yang dulu memakan 3 hari kini bisa selesai dalam hitungan jam. Transformasi digital yang nyata.",
    rating: 5,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    name: "Ir. Siti Rahmawati",
    role: "Direktur Administrasi",
    org: "PT Telkom Indonesia",
    text: "Pengelolaan 5.000+ surat per bulan menjadi jauh lebih efisien. Dashboard eksekutif membantu kami memantau KPI administrasi secara real-time.",
    rating: 5,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    name: "Ahmad Fauzi, S.H.",
    role: "Kepala Biro Umum",
    org: "Kementerian Keuangan",
    text: "Fitur tanda tangan digital dan audit trail memberikan keamanan dan keabsahan hukum yang kami butuhkan. Compliance tidak pernah semudah ini.",
    rating: 5,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    name: "Dewi Kartika, M.Sc.",
    role: "VP Operations",
    org: "Bank Mandiri",
    text: "Workflow approval multi-level di Star e-Office sangat fleksibel. Kami bisa konfigurasi sesuai struktur organisasi tanpa perlu development tambahan.",
    rating: 5,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    name: "Prof. Budi Santoso, Ph.D.",
    role: "Rektor",
    org: "Universitas Padjajaran",
    text: "Seluruh administrasi akademik dan korespondensi antar fakultas kini berjalan paperless. Efisiensi kampus meningkat drastis sejak implementasi Star e-Office.",
    rating: 5,
    gradient: "from-rose-500 to-pink-600",
  },
  {
    name: "Ratna Permata, MBA",
    role: "Chief Operating Officer",
    org: "PT Pertamina",
    text: "Dengan 30.000+ karyawan, kami butuh sistem yang scalable. Star e-Office terbukti handal mengelola volume dokumen enterprise kami tanpa hambatan.",
    rating: 5,
    gradient: "from-cyan-500 to-sky-600",
  },
];

export default function TestimonialSection() {
  const [page, setPage] = useState(0);
  const perPage = 2;
  const totalPages = Math.ceil(testimonials.length / perPage);
  const visibleTestimonials = testimonials.slice(page * perPage, page * perPage + perPage);

  return (
    <section
      id="testimoni"
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
            Testimoni
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Dipercaya oleh Para Pemimpin Organisasi
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Dengar langsung dari mereka yang telah merasakan manfaat
            transformasi digital bersama Star e-Office.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {visibleTestimonials.map((t, i) => (
            <motion.div
              key={`${page}-${t.name}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border bg-card p-7 transition-all duration-300 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1"
            >
              {/* Background glow */}
              <div
                className={`absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br ${t.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.06]`}
              />

              {/* Quote icon */}
              <Quote className="absolute right-6 top-6 size-10 text-muted-foreground/6" />

              <div className="relative">
                {/* Stars */}
                <div className="mb-5 flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star
                      key={si}
                      className="size-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Text */}
                <p className="mb-7 text-sm leading-relaxed text-foreground/80">
                  {`"${t.text}"`}
                </p>

                {/* Author */}
                <div className="flex items-center gap-3.5 border-t pt-5">
                  <div
                    className={`flex size-11 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-bold text-white shadow-lg shadow-black/10`}
                  >
                    {t.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {t.role} &middot; {t.org}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pagination dots + arrows */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="cursor-pointer rounded-full border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`size-2.5 cursor-pointer rounded-full transition-all duration-200 ${
                  i === page
                    ? "bg-primary scale-125"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="cursor-pointer rounded-full border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
