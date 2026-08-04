"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import type { Id } from "./_generated/dataModel.d.ts";

type HistoryMessage = { role: string; content: string };

type ContextShape = {
  user: {
    id: string;
    name: string;
    email: string;
    jobTitle: string;
    department: string;
    location: string;
    role: string;
    managerName: string | null;
    startDate: string | null;
  };
  todayStr: string;
  leave: {
    annualQuota: number;
    usedDaysThisYear: number;
    remainingDays: number;
    recent: Array<{
      type: string;
      startDate: string;
      endDate: string;
      dayCount: number;
      status: string;
      reason: string;
    }>;
  };
  attendance: {
    hasClockedInToday: boolean;
    clockInAt: string | null;
    clockOutAt: string | null;
    isLate: boolean;
  };
  upcomingEvents: Array<{
    title: string;
    startDate: string;
    startTime: string | null;
    location: string | null;
    category: string;
  }>;
  announcements: Array<{
    title: string;
    summary: string;
    priority: string;
    publishedAt: string;
  }>;
  policies: Array<{ title: string; summary: string; category: string }>;
  expenses: { pendingCount: number; pendingTotalIdr: number };
  tasks: Array<{
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }>;
  notifications: { unreadCount: number };
  payroll: {
    period: string;
    netSalary: number;
    grossSalary: number;
    status: string;
  } | null;
  objectives: Array<{
    title: string;
    progress: number;
    health: string;
    status: string;
    period: string;
  }>;
  enrollments: Array<{ title: string; progress: number; completed: boolean }>;
};

const APP_PAGES: ReadonlyArray<{ path: string; label: string; description: string; quickAction?: string }> = [
  { path: "/dashboard", label: "Dashboard", description: "Ringkasan aktivitas & shortcut", quickAction: "Lihat dashboard" },
  { path: "/leave", label: "Pengajuan Cuti", description: "Ajukan dan lihat status cuti", quickAction: "Ajukan cuti" },
  { path: "/attendance", label: "Absensi", description: "Clock in/out dan riwayat absen", quickAction: "Clock in sekarang" },
  { path: "/expenses", label: "Reimbursement", description: "Ajukan biaya dan uang muka", quickAction: "Ajukan reimbursement" },
  { path: "/payroll", label: "Payroll", description: "Lihat slip gaji bulanan", quickAction: "Lihat slip gaji" },
  { path: "/documents", label: "Dokumen", description: "SOP, formulir, dan kebijakan" },
  { path: "/my-documents", label: "Dokumen Saya", description: "Arsip pribadi Anda" },
  { path: "/policies", label: "Kebijakan Perusahaan", description: "Policy dan tanda tangan" },
  { path: "/training", label: "Pelatihan", description: "Kursus e-learning", quickAction: "Cari pelatihan" },
  { path: "/mentorship", label: "Mentorship", description: "Cari mentor atau peer group" },
  { path: "/performance", label: "Penilaian Kinerja", description: "Review performa periodik" },
  { path: "/okr", label: "OKR & Goals", description: "Objectives dan key results", quickAction: "Update OKR" },
  { path: "/engagement", label: "Survei Engagement", description: "Isi survei & wellness" },
  { path: "/recognitions", label: "Apresiasi", description: "Beri apresiasi antar rekan", quickAction: "Beri apresiasi" },
  { path: "/awards", label: "Penghargaan", description: "Hall of fame perusahaan" },
  { path: "/calendar", label: "Kalender", description: "Agenda perusahaan & event", quickAction: "Lihat kalender" },
  { path: "/projects", label: "Tugas & Proyek", description: "Kanban tugas tim", quickAction: "Lihat tugas saya" },
  { path: "/wiki", label: "Wiki", description: "Basis pengetahuan internal" },
  { path: "/directory", label: "Direktori", description: "Profil karyawan" },
  { path: "/organization", label: "Struktur Organisasi", description: "Bagan organisasi & 9-box" },
  { path: "/forum", label: "Forum", description: "Diskusi terbuka" },
  { path: "/suggestions", label: "Kotak Saran", description: "Kirim ide perbaikan" },
  { path: "/support", label: "Bantuan IT", description: "Tiket dukungan IT", quickAction: "Buat tiket IT" },
  { path: "/rooms", label: "Pemesanan Ruangan", description: "Booking ruang meeting", quickAction: "Pesan ruangan" },
  { path: "/assets", label: "Inventaris & Aset", description: "Aset perusahaan" },
  { path: "/jobs", label: "Lowongan Internal", description: "Lowongan posisi internal" },
  { path: "/recruitment", label: "Rekrutmen ATS", description: "Pipeline kandidat (admin)" },
  { path: "/letters", label: "Kelola Surat", description: "Buat dan kirim surat resmi", quickAction: "Buat surat baru" },
  { path: "/messages", label: "Pesan", description: "Kirim pesan ke rekan kerja", quickAction: "Kirim pesan" },
  { path: "/notifications", label: "Notifikasi", description: "Semua pemberitahuan Anda" },
  { path: "/fund-requests", label: "Pengajuan Dana", description: "Ajukan uang muka atau dana operasional", quickAction: "Ajukan dana" },
  { path: "/travel", label: "Perjalanan Dinas", description: "Ajukan perjalanan dinas", quickAction: "Ajukan perjalanan" },
];

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildSystemPrompt(ctx: ContextShape): string {
  const pagesList = APP_PAGES.map((p) => `- ${p.label} (${p.path}): ${p.description}`).join("\n");

  const leaveHistoryText = ctx.leave.recent.length
    ? ctx.leave.recent
        .map(
          (r) =>
            `  - ${r.type} ${r.startDate} s/d ${r.endDate} (${r.dayCount} hari, status: ${r.status})`,
        )
        .join("\n")
    : "  - Belum ada pengajuan cuti tercatat";

  const upcomingText = ctx.upcomingEvents.length
    ? ctx.upcomingEvents
        .map(
          (e) =>
            `  - ${e.startDate}${e.startTime ? ` ${e.startTime}` : ""} – ${e.title}${e.location ? ` @ ${e.location}` : ""} [${e.category}]`,
        )
        .join("\n")
    : "  - Tidak ada event dalam waktu dekat";

  const announcementsText = ctx.announcements.length
    ? ctx.announcements.map((a) => `  - [${a.priority}] ${a.title} — ${a.summary}`).join("\n")
    : "  - Tidak ada pengumuman aktif";

  const policiesText = ctx.policies.length
    ? ctx.policies.slice(0, 12).map((p) => `  - ${p.title} (${p.category}): ${p.summary}`).join("\n")
    : "  - Belum ada kebijakan aktif";

  const objectivesText = ctx.objectives.length
    ? ctx.objectives
        .map(
          (o) => `  - ${o.title} — ${o.period}, progress ${Math.round(o.progress)}% (${o.health})`,
        )
        .join("\n")
    : "  - Belum ada OKR Anda miliki";

  const tasksText = ctx.tasks.length
    ? ctx.tasks
        .map(
          (t) =>
            `  - ${t.title} (${t.priority}${t.dueDate ? `, due ${t.dueDate}` : ""})`,
        )
        .join("\n")
    : "  - Tidak ada tugas terbuka";

  const enrollmentsText = ctx.enrollments.length
    ? ctx.enrollments
        .slice(0, 8)
        .map((e) => `  - ${e.title} — progress ${Math.round(e.progress)}%${e.completed ? " (selesai)" : ""}`)
        .join("\n")
    : "  - Belum ada kursus yang diambil";

  const payrollText = ctx.payroll
    ? `Slip gaji terakhir: periode ${ctx.payroll.period}, status ${ctx.payroll.status}, gaji bersih ${formatIdr(ctx.payroll.netSalary)}`
    : "Belum ada slip gaji terpublikasi";

  // Build productivity insights
  const insights: string[] = [];
  if (!ctx.attendance.hasClockedInToday) {
    insights.push("Anda belum clock-in hari ini. Jangan lupa absen di /attendance.");
  }
  if (ctx.leave.remainingDays <= 3 && ctx.leave.remainingDays > 0) {
    insights.push(`Sisa cuti Anda tinggal ${ctx.leave.remainingDays} hari. Rencanakan dengan bijak.`);
  }
  if (ctx.tasks.length > 0) {
    const urgent = ctx.tasks.filter((t) => t.priority === "high" || t.priority === "urgent");
    if (urgent.length > 0) {
      insights.push(`Ada ${urgent.length} tugas prioritas tinggi/urgent yang perlu segera ditangani.`);
    }
  }
  if (ctx.notifications.unreadCount > 5) {
    insights.push(`Ada ${ctx.notifications.unreadCount} notifikasi belum dibaca. Cek di /notifications.`);
  }
  if (ctx.objectives.some((o) => o.health === "at_risk" || o.health === "off_track")) {
    insights.push("Beberapa OKR Anda berstatus at-risk. Pertimbangkan untuk update progress di /okr.");
  }

  const insightsBlock = insights.length > 0
    ? `\nPRODUCTIVITY INSIGHTS (proaktif sampaikan jika relevan):\n${insights.map((i) => `- ${i}`).join("\n")}`
    : "";

  return `Anda adalah Starfa, asisten AI cerdas berbahasa Indonesia untuk platform digital office "Star e-Office". Anda adalah asisten yang sangat berpengetahuan, proaktif, dan membantu — bukan hanya untuk HR tapi juga navigasi platform, produktivitas, dan workflow harian.

KEPRIBADIAN & GAYA:
- Ramah, profesional, dan ringkas — jawaban langsung ke inti
- Gunakan format Markdown (bold, bullet list, code block) untuk kejelasan
- Berikan jawaban langsung, lalu detail singkat jika diperlukan
- Proaktif: jika ada insight atau reminder relevan, sebutkan tanpa diminta
- Jika relevan, sebutkan halaman/fitur yang harus dibuka dengan format: **[Nama Halaman](/path)**
- Jika pengguna bertanya tentang fitur yang belum mereka gunakan, jelaskan manfaatnya dan cara memulai
- Jawab SINGKAT (maks ~8 baris) kecuali diminta detail lebih

KEMAMPUAN UTAMA:
1. **HR & Kepegawaian**: Cuti, absensi, gaji, benefit, kebijakan, reimbursement
2. **Navigasi Platform**: Bantu pengguna menemukan fitur yang tepat di Star e-Office
3. **Produktivitas**: Saran tindakan harian, reminder deadline, dan prioritas tugas
4. **Pembelajaran**: Rekomendasi pelatihan berdasarkan peran dan progres
5. **OKR & Performa**: Update progress, health check, dan saran improvement
6. **Workflow**: Panduan langkah-langkah proses (ajukan cuti, reimbursement, surat, dll)

BATASAN TOPIK (SANGAT PENTING):
- Anda HANYA boleh menjawab pertanyaan yang berkaitan dengan platform Star e-Office dan hal-hal kerja/kantor (HR, kepegawaian, navigasi fitur, produktivitas, pembelajaran, OKR, kebijakan, workflow, dan data konteks pengguna).
- Jika pengguna bertanya hal di luar topik tersebut (misalnya politik, gosip, resep masakan, pengetahuan umum, coding, hiburan, atau topik apa pun yang tidak terkait Star e-Office), JANGAN dijawab. Tolak dengan sopan dan singkat, lalu arahkan kembali ke hal yang bisa Anda bantu.
- Contoh penolakan: "Maaf, saya hanya bisa membantu seputar Star e-Office seperti cuti, absensi, gaji, tugas, dan fitur kantor lainnya. Ada yang bisa saya bantu terkait itu?"
- Jangan mengarang jawaban untuk topik di luar lingkup ini meskipun Anda tahu jawabannya.

ATURAN PENTING:
- Jangan mengarang data. Jika tidak yakin, minta klarifikasi atau arahkan ke HR/admin
- Jangan menampilkan informasi pribadi karyawan lain
- Untuk tindakan langsung (ajukan cuti, approve, dll): jelaskan langkah singkat dan arahkan ke halaman terkait
- Selalu akhiri dengan 2-3 saran follow-up yang relevan dan berguna

SARAN FOLLOW-UP:
Setiap jawaban HARUS diakhiri dengan section "follow-up suggestions" menggunakan format khusus di akhir jawaban:
---suggestions---
Saran 1 singkat
Saran 2 singkat
Saran 3 singkat
---end-suggestions---

Contoh:
---suggestions---
Lihat detail sisa cuti tahun ini
Ajukan cuti untuk minggu depan
Cek kebijakan cuti tahunan
---end-suggestions---

Pastikan saran relevan dengan topik percakapan dan konteks pengguna. Saran harus berupa kalimat pendek yang bisa langsung diketik sebagai pertanyaan baru.

DATA KONTEKS PENGGUNA (bersifat rahasia, jangan dibaca ulang mentah-mentah):
Hari ini: ${ctx.todayStr}
Nama: ${ctx.user.name || "(belum diisi)"} — ${ctx.user.jobTitle || "Karyawan"} di departemen ${ctx.user.department || "-"}
Peran sistem: ${ctx.user.role}
Atasan: ${ctx.user.managerName ?? "(belum tercatat)"}
Tanggal mulai: ${ctx.user.startDate ?? "(tidak tercatat)"}

Cuti tahun ini:
  - Kuota: ${ctx.leave.annualQuota} hari
  - Terpakai: ${ctx.leave.usedDaysThisYear} hari
  - Sisa: ${ctx.leave.remainingDays} hari
Riwayat cuti terbaru:
${leaveHistoryText}

Absensi hari ini: ${ctx.attendance.hasClockedInToday ? `sudah clock-in${ctx.attendance.isLate ? " (terlambat)" : ""}` : "belum clock-in"}${ctx.attendance.clockOutAt ? ", sudah clock-out" : ""}

Event mendatang:
${upcomingText}

Pengumuman aktif:
${announcementsText}

Kebijakan perusahaan:
${policiesText}

Reimbursement Anda: ${ctx.expenses.pendingCount} pengajuan menunggu review (total ${formatIdr(ctx.expenses.pendingTotalIdr)})

${payrollText}

OKR Anda:
${objectivesText}

Tugas terbuka:
${tasksText}

Kursus:
${enrollmentsText}

Notifikasi belum dibaca: ${ctx.notifications.unreadCount}
${insightsBlock}

PETA HALAMAN APLIKASI (gunakan untuk mengarahkan pengguna):
${pagesList}

Jika pengguna bertanya di luar topik Star e-Office (HR/kantor/produktivitas), TOLAK dengan sopan dan singkat sesuai BATASAN TOPIK di atas, jangan menjawab pertanyaan tersebut, lalu arahkan kembali ke hal yang bisa Anda bantu. Tetap akhiri dengan saran follow-up yang relevan dengan Star e-Office.`;
}

function parseSuggestions(content: string): { cleanContent: string; suggestions: string[] } {
  const suggestionsRegex = /---suggestions---\n([\s\S]*?)---end-suggestions---/;
  const match = content.match(suggestionsRegex);

  if (!match) {
    return { cleanContent: content.trim(), suggestions: [] };
  }

  const cleanContent = content.replace(suggestionsRegex, "").trim();
  const suggestions = match[1]
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);

  return { cleanContent, suggestions };
}

export const sendMessage = action({
  args: {
    sessionId: v.id("aiChatSessions"),
    prompt: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ messageId: Id<"aiChatMessages">; content: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Anda harus masuk untuk menggunakan asisten AI.");
    }
    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new Error("Pesan tidak boleh kosong.");
    }
    if (prompt.length > 2000) {
      throw new Error("Pesan terlalu panjang (maks 2000 karakter).");
    }

    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) {
      throw new Error("Pengguna tidak ditemukan.");
    }

    await ctx.runMutation(internal.chatbot.appendUserMessage, {
      sessionId: args.sessionId,
      userId: me._id,
      content: prompt,
    });

    const assistantMessageId: Id<"aiChatMessages"> = await ctx.runMutation(
      internal.chatbot.appendAssistantPending,
      {
        sessionId: args.sessionId,
        userId: me._id,
      },
    );

    try {
      const context = (await ctx.runQuery(internal.chatbot.buildContext, {
        userId: me._id,
      })) as ContextShape | null;

      if (!context) {
        throw new Error("Konteks pengguna tidak tersedia.");
      }

      const history = (await ctx.runQuery(internal.chatbot.loadHistory, {
        sessionId: args.sessionId,
        limit: 20,
      })) as HistoryMessage[];

      const openai = new OpenAI({
        baseURL: "https://ai-gateway.hercules.app/v1",
        apiKey: process.env.HERCULES_API_KEY,
      });

      const systemPrompt = buildSystemPrompt(context);
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];
      for (const m of history) {
        if (m.role === "user" || m.role === "assistant") {
          messages.push({
            role: m.role as "user" | "assistant",
            content: m.content,
          });
        }
      }

      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages,
      });

      const rawContent =
        response.choices[0]?.message?.content?.trim() ??
        "Maaf, saya belum memiliki jawaban untuk pertanyaan itu.";

      // Parse suggestions from the response
      const { cleanContent, suggestions } = parseSuggestions(rawContent);

      await ctx.runMutation(internal.chatbot.finalizeAssistantMessage, {
        messageId: assistantMessageId,
        sessionId: args.sessionId,
        content: cleanContent,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      });

      return { messageId: assistantMessageId, content: cleanContent };
    } catch (error) {
      const message =
        error instanceof OpenAI.APIError
          ? `AI Gateway: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Gagal menghubungi layanan AI.";
      await ctx.runMutation(internal.chatbot.failAssistantMessage, {
        messageId: assistantMessageId,
        errorMessage: message,
      });
      throw new Error(message);
    }
  },
});
