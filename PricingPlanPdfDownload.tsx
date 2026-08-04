import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

// Formats the max employees limit exactly like the "Paket" settings tab.
function formatEmployees(max: number): string {
  return max === 0 ? "Unlimited" : String(max);
}

// Formats storage the same way the plan cards do (MB -> GB).
function formatStorage(mb: number): string {
  if (mb === 0) return "Unlimited";
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
  return `${mb} MB`;
}

// Formats the per-user price. -1 means custom/contact-us.
function formatPrice(pricePerUserMonth: number): string {
  if (pricePerUserMonth < 0) return "Custom";
  if (pricePerUserMonth === 0) return "Rp 0";
  return `Rp ${pricePerUserMonth.toLocaleString("id-ID")}`;
}

// Reads a value for a given plan slug from the live plans, falling back to a
// static value when the plan is not present in the database.
function planValue(
  bySlug: Record<string, Doc<"membershipPlans">>,
  slug: string,
  read: (plan: Doc<"membershipPlans">) => string,
  fallback: string,
): string {
  const plan = bySlug[slug];
  return plan ? read(plan) : fallback;
}

// Color palette
const PRIMARY: [number, number, number] = [42, 63, 101];
const ACCENT: [number, number, number] = [0, 137, 150];
const LIGHT_BG: [number, number, number] = [245, 248, 250];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const GRAY_TEXT: [number, number, number] = [100, 100, 100];
const CHECK_GREEN: [number, number, number] = [39, 174, 96];
const CROSS_RED: [number, number, number] = [200, 60, 60];

function addPageHeader(doc: jsPDF, title: string, yPos: number): number {
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(title, 105, 18, { align: "center" });
  doc.setTextColor(...DARK_TEXT);
  return yPos;
}

function addSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...ACCENT);
  doc.rect(14, y - 5, 182, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(text, 105, y + 1, { align: "center" });
  doc.setTextColor(...DARK_TEXT);
  return y + 12;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 275) {
    doc.addPage();
    return 20;
  }
  return y;
}

export default function PricingPlanPdfDownload() {
  const [generating, setGenerating] = useState(false);
  const dbPlans = useQuery(api.membership.listActive, {});

  const handleDownload = () => {
    setGenerating(true);
    try {
      // Index live plans by slug so the PDF numbers always match the "Paket"
      // settings tab (single source of truth in the database).
      const bySlug: Record<string, Doc<"membershipPlans">> = {};
      for (const p of dbPlans ?? []) {
        bySlug[p.slug] = p;
      }

      const empFree = planValue(bySlug, "free", (p) => formatEmployees(p.maxEmployees), "10");
      const empStarter = planValue(bySlug, "starter", (p) => formatEmployees(p.maxEmployees), "50");
      const empPro = planValue(bySlug, "professional", (p) => formatEmployees(p.maxEmployees), "200");
      const empEnt = planValue(bySlug, "enterprise", (p) => formatEmployees(p.maxEmployees), "Unlimited");

      const stFree = planValue(bySlug, "free", (p) => formatStorage(p.maxStorageMb), "500 MB");
      const stStarter = planValue(bySlug, "starter", (p) => formatStorage(p.maxStorageMb), "5 GB");
      const stPro = planValue(bySlug, "professional", (p) => formatStorage(p.maxStorageMb), "50 GB");
      const stEnt = planValue(bySlug, "enterprise", (p) => formatStorage(p.maxStorageMb), "Unlimited");

      const prFree = planValue(bySlug, "free", (p) => formatPrice(p.pricePerUserMonth), "Rp 0");
      const prStarter = planValue(bySlug, "starter", (p) => formatPrice(p.pricePerUserMonth), "Rp 25.000");
      const prPro = planValue(bySlug, "professional", (p) => formatPrice(p.pricePerUserMonth), "Rp 65.000");
      const prEnt = planValue(bySlug, "enterprise", (p) => formatPrice(p.pricePerUserMonth), "Custom");

      const doc = new jsPDF();

      // ──────── HALAMAN 1: Cover & Ringkasan ────────────────────────────
      addPageHeader(doc, "Proposal Struktur Paket HRIS", 35);

      let y = 38;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...GRAY_TEXT);
      doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 14, y);
      y += 5;
      doc.text("Disusun oleh: Tim Produk HRIS", 14, y);
      y += 10;

      doc.setTextColor(...DARK_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Ringkasan Eksekutif", 14, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const summary = [
        "Dokumen ini berisi rekomendasi struktur paket produk HRIS yang terdiri dari 4 tier:",
        "Gratis, Starter, Professional, dan Enterprise. Setiap tier dirancang untuk",
        "memenuhi kebutuhan segmen pasar yang berbeda, mulai dari usaha kecil hingga",
        "korporasi besar. Pembagian fitur mencakup fitur inti (pembeda utama antar tier)",
        "dan fitur non-inti (penambah nilai di setiap tier).",
      ];
      for (const line of summary) {
        doc.text(line, 14, y);
        y += 5;
      }
      y += 5;

      // Tabel ringkasan tier
      y = addSectionTitle(doc, "1. Ringkasan Struktur Paket", y);

      autoTable(doc, {
        startY: y,
        head: [["", "Gratis", "Starter", "Professional", "Enterprise"]],
        body: [
          ["Target", "Usaha kecil / coba-coba", "Tim berkembang", "Perusahaan menengah", "Korporasi besar"],
          ["Maks Karyawan", empFree, empStarter, empPro, empEnt],
          ["Penyimpanan", stFree, stStarter, stPro, stEnt],
          ["Harga /user/bln", prFree, prStarter, prPro, prEnt],
          ["Dukungan", "Komunitas", "Email", "Prioritas", "Dedicated AM"],
        ],
        theme: "grid",
        headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 8, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 8, textColor: DARK_TEXT },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 32 },
          1: { halign: "center", cellWidth: 34 },
          2: { halign: "center", cellWidth: 34 },
          3: { halign: "center", cellWidth: 38 },
          4: { halign: "center", cellWidth: 38 },
        },
        alternateRowStyles: { fillColor: LIGHT_BG },
        margin: { left: 14, right: 14 },
      });

      y = (doc as ReturnType<typeof jsPDF.prototype.addPage> & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      y += 10;

      // ──────── Fitur Inti per Tier ─────────────────────────────────────
      y = checkPageBreak(doc, y, 60);
      y = addSectionTitle(doc, "2. Fitur Inti per Tier", y);

      autoTable(doc, {
        startY: y,
        head: [["Fitur Inti", "Gratis", "Starter", "Professional", "Enterprise"]],
        body: [
          ["Direktori Karyawan", "v", "v", "v", "v"],
          ["Absensi", "v", "v", "v", "v"],
          ["Pengajuan Cuti", "v", "v", "v", "v"],
          ["Pengumuman", "v", "v", "v", "v"],
          ["Penyimpanan", stFree, stStarter, stPro, stEnt],
          ["Penggajian (Payroll)", "-", "v", "v", "v"],
          ["Dokumen Perusahaan", "-", "v", "v", "v"],
          ["Onboarding", "-", "v", "v", "v"],
          ["Event Perusahaan", "-", "v", "v", "v"],
          ["Rekrutmen & ATS", "-", "-", "v", "v"],
          ["Pelatihan (LMS)", "-", "-", "v", "v"],
          ["OKR & Goals", "-", "-", "v", "v"],
          ["Penilaian Kinerja", "-", "-", "v", "v"],
          ["Jenjang Karier", "-", "-", "v", "v"],
          ["Reimbursement", "-", "-", "v", "v"],
          ["Feedback 360°", "-", "-", "-", "v"],
          ["Talent Management", "-", "-", "-", "v"],
          ["Dashboard Analitik Advanced", "-", "-", "-", "v"],
          ["Inventaris & Aset", "-", "-", "-", "v"],
        ],
        theme: "grid",
        headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 7.5, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7.5, textColor: DARK_TEXT, halign: "center" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 50 } },
        alternateRowStyles: { fillColor: LIGHT_BG },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = String(data.cell.raw);
            if (val === "v") {
              data.cell.styles.textColor = CHECK_GREEN;
              data.cell.styles.fontStyle = "bold";
            } else if (val === "-") {
              data.cell.styles.textColor = CROSS_RED;
            } else if (val.includes("MB") || val.includes("GB") || val === "Unlimited") {
              data.cell.styles.textColor = ACCENT;
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      // ──────── HALAMAN 2: Fitur Non-Inti ───────────────────────────────
      doc.addPage();
      addPageHeader(doc, "Fitur Non-Inti per Tier", 35);
      y = 38;

      y = addSectionTitle(doc, "3. Fitur Non-Inti / Tambahan per Tier", y);

      autoTable(doc, {
        startY: y,
        head: [["Fitur Non-Inti", "Gratis", "Starter", "Pro", "Enterprise"]],
        body: [
          ["Pesan & Notifikasi", "v", "v", "v", "v"],
          ["Berita & Pengumuman", "v", "v", "v", "v"],
          ["Perayaan", "v", "v", "v", "v"],
          ["Dokumen Saya", "v", "v", "v", "v"],
          ["Kelola Surat", "-", "v", "v", "v"],
          ["Kalender Bersama", "-", "v", "v", "v"],
          ["Apresiasi", "-", "v", "v", "v"],
          ["Polling & Survei", "-", "v", "v", "v"],
          ["Dokumen & Kebijakan", "-", "v", "v", "v"],
          ["Tugas & Proyek", "-", "Terbatas", "v", "v"],
          ["Pemesanan Ruangan", "-", "v", "v", "v"],
          ["Asisten AI", "-", "-", "v", "v (Premium)"],
          ["Forum & Kotak Saran", "-", "-", "v", "v"],
          ["Penghargaan & Galeri", "-", "-", "v", "v"],
          ["Wiki & Knowledge Base", "-", "-", "v", "v"],
          ["Pengajuan Dana & Travel", "-", "-", "v", "v"],
          ["Inventaris & Aset", "-", "-", "v", "v"],
          ["Event Perusahaan", "-", "-", "v", "v"],
          ["Pulse Survey", "-", "-", "v", "v"],
          ["Bantuan IT (Helpdesk)", "-", "-", "v", "v"],
          ["Advanced Analytics", "-", "-", "-", "v"],
          ["Admin Dashboard", "-", "-", "-", "v"],
          ["Audit & Keamanan", "-", "-", "-", "v"],
        ],
        theme: "grid",
        headStyles: { fillColor: ACCENT, textColor: WHITE, fontSize: 7.5, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7.5, textColor: DARK_TEXT, halign: "center" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 48 } },
        alternateRowStyles: { fillColor: LIGHT_BG },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = String(data.cell.raw);
            if (val === "v" || val.startsWith("v ")) {
              data.cell.styles.textColor = CHECK_GREEN;
              data.cell.styles.fontStyle = "bold";
            } else if (val === "-") {
              data.cell.styles.textColor = CROSS_RED;
            } else if (val === "Terbatas") {
              data.cell.styles.textColor = [200, 150, 0] as [number, number, number];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      // ──────── HALAMAN 3: Detail per Tier ──────────────────────────────
      doc.addPage();
      addPageHeader(doc, "Detail Filosofi per Tier", 35);
      y = 38;

      const tierDetails = [
        {
          name: "GRATIS",
          color: GRAY_TEXT,
          target: "Usaha kecil / startup yang ingin mencoba platform",
          philosophy: "Cukup untuk merasakan \"rasa\" platform, mendorong upgrade ke tier berbayar.",
          highlights: [
            `Direktori Karyawan (maks ${empFree} orang)`,
            `Penyimpanan: ${stFree} (dokumen, foto, lampiran)`,
            "Absensi & Pengajuan Cuti dasar",
            "Pesan & Notifikasi",
            "Berita & Pengumuman (baca saja)",
            "Perayaan otomatis (ulang tahun, anniversary)",
            "Dokumen Saya (upload/download pribadi)",
            "Dukungan: Komunitas",
          ],
        },
        {
          name: `STARTER — ${prStarter}/user/bln`,
          color: [0, 100, 180] as [number, number, number],
          target: `Tim berkembang (maks ${empStarter} karyawan) yang butuh operasional HR lengkap`,
          philosophy: "Tim bisa berkolaborasi dan mengelola administrasi dasar. Tier paling populer untuk UKM.",
          highlights: [
            "+ Semua fitur Gratis",
            `+ Penyimpanan: ${stStarter}`,
            "+ Penggajian (Payroll)",
            "+ Dokumen Perusahaan & Kebijakan",
            "+ Onboarding karyawan baru",
            "+ Kelola Surat & Kalender bersama",
            "+ Apresiasi antar karyawan & Polling",
            "+ Tugas & Proyek (maks 10 proyek aktif)",
            "+ Pemesanan Ruangan",
            "+ Dukungan: Email",
          ],
        },
        {
          name: `PROFESSIONAL — ${prPro}/user/bln`,
          color: ACCENT,
          target: `Perusahaan menengah (maks ${empPro} karyawan) fokus pengembangan SDM`,
          philosophy: "\"Sweet spot\" — fitur paling lengkap untuk harga terjangkau, cocok untuk perusahaan yang serius mengelola SDM.",
          highlights: [
            "+ Semua fitur Starter",
            `+ Penyimpanan: ${stPro}`,
            "+ Rekrutmen & ATS, Pelatihan (LMS)",
            "+ OKR & Goals, Penilaian Kinerja, Jenjang Karier",
            "+ Reimbursement, Pengajuan Dana, Perjalanan Dinas",
            "+ Asisten AI (Chatbot HR)",
            "+ Forum, Kotak Saran, Penghargaan, Galeri",
            "+ Wiki & Knowledge Base",
            "+ Inventaris & Aset, Event Perusahaan",
            "+ Pulse Survey, Bantuan IT (Helpdesk)",
            "+ Tugas & Proyek (unlimited)",
            "+ Dukungan: Prioritas",
          ],
        },
        {
          name: "ENTERPRISE — Custom",
          color: PRIMARY,
          target: "Korporasi besar (unlimited karyawan) dengan kebutuhan kompleks",
          philosophy: "Bukan hanya fitur lebih banyak, tapi kualitas lebih tinggi: kontrol penuh, insight mendalam, keamanan enterprise-grade.",
          highlights: [
            "+ Semua fitur Professional",
            `+ Penyimpanan: ${stEnt} (tanpa batas)`,
            "+ Feedback 360°, Talent Management",
            "+ Dashboard Analitik Advanced & Custom Reports",
            "+ Dashboard Admin & Pengaturan Pengguna lanjutan",
            "+ Audit Trail & Role-based access granular",
            "+ Asisten AI Premium (prioritas, lebih cerdas)",
            "+ API Access & Webhook (masa depan)",
            "+ Dukungan: Dedicated Account Manager",
          ],
        },
      ];

      for (const tier of tierDetails) {
        y = checkPageBreak(doc, y, 55);

        // Tier name banner
        doc.setFillColor(...tier.color);
        doc.roundedRect(14, y - 1, 182, 8, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...WHITE);
        doc.text(tier.name, 105, y + 4.5, { align: "center" });
        y += 12;

        doc.setTextColor(...DARK_TEXT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Target:", 16, y);
        doc.setFont("helvetica", "normal");
        doc.text(tier.target, 34, y);
        y += 5;

        doc.setFont("helvetica", "bold");
        doc.text("Filosofi:", 16, y);
        doc.setFont("helvetica", "normal");
        const philLines = doc.splitTextToSize(tier.philosophy, 154);
        doc.text(philLines, 34, y);
        y += philLines.length * 4 + 3;

        doc.setFont("helvetica", "bold");
        doc.text("Fitur utama:", 16, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        for (const item of tier.highlights) {
          y = checkPageBreak(doc, y, 6);
          doc.setFillColor(200, 220, 240);
          doc.circle(20, y - 1, 1, "F");
          doc.text(item, 24, y);
          y += 4.5;
        }
        y += 6;
      }

      // ──────── HALAMAN 4: Catatan & Pertimbangan ───────────────────────
      y = checkPageBreak(doc, y, 50);
      if (y < 40) {
        addPageHeader(doc, "Catatan & Pertimbangan", 35);
        y = 38;
      } else {
        y = addSectionTitle(doc, "4. Catatan & Pertimbangan", y);
      }

      const notes = [
        "1. Gratis sengaja minimal — tujuannya agar pengguna merasakan platform lalu tertarik upgrade.",
        "2. Starter sudah cukup fungsional — ini tier yang akan paling banyak dipilih UKM.",
        "3. Professional jadi \"sweet spot\" — fitur paling lengkap untuk harga terjangkau.",
        "4. Enterprise fokus pada kontrol & insight — bukan hanya fitur lebih banyak, tapi kualitas lebih tinggi.",
        "5. Harga bersifat rekomendasi dan dapat disesuaikan berdasarkan riset pasar lebih lanjut.",
        "6. Batas karyawan per tier dapat diubah sesuai strategi bisnis.",
        "7. Fitur dapat dipindahkan antar tier sebelum implementasi final.",
        "8. Penyimpanan mencakup semua file: dokumen karyawan, lampiran cuti/reimbursement, foto profil, materi pelatihan, galeri, dan file lainnya. Kuota berlaku per organisasi, bukan per karyawan.",
        "9. Jika kuota penyimpanan habis, pengguna akan diminta upgrade atau menghapus file lama sebelum bisa mengunggah file baru.",
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...DARK_TEXT);
      for (const note of notes) {
        y = checkPageBreak(doc, y, 8);
        const lines = doc.splitTextToSize(note, 170);
        doc.text(lines, 16, y);
        y += lines.length * 5 + 2;
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_TEXT);
        doc.text(`Dokumen Rekomendasi Paket HRIS — Halaman ${i} dari ${pageCount}`, 105, 290, { align: "center" });
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 285, 196, 285);
      }

      doc.save("Rekomendasi-Paket-HRIS.pdf");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={generating} className="cursor-pointer gap-2">
      {generating ? (
        <>
          <Spinner />
          Membuat PDF...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download Rekomendasi Paket (PDF)
        </>
      )}
    </Button>
  );
}
