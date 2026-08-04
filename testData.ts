// Super-admin-only helper to seed a fully populated SAMPLE organization so the
// scoped-consent access control (Akses Berbasis Lingkup Data) can be
// demonstrated end-to-end without hand-entering data across every module.
//
// It creates:
//   - one organization ("PT Contoh Uji Coba …", marked so it's easy to spot)
//   - a handful of test employees (HR / hr_people scope) — all flagged
//     isTestAccount so they never pollute real headcount / billing
//   - sample letters + policies (letters_documents scope)
//   - a payroll period + payslips, fund requests (finance_payroll scope)
//   - leave requests, attendance records (hr_people scope)
//   - announcements, a direct-message conversation, a calendar event, a forum
//     thread, and a project with tasks (communication scope)
//   - departments and assets with an assignment (org_settings scope)
//
// Everything is tenant-stamped with the new organization's id so it appears
// only when a super admin is viewing that org (and, once a scoped grant is
// approved, only within the approved categories).

import { ConvexError } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

/** Asserts the caller is a super_admin and returns their userId. */
async function requireSuperAdmin(ctx: MutationCtx): Promise<Id<"users">> {
  const { userId, isSuperAdmin } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });
  if (!isSuperAdmin) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya Super Admin yang dapat membuat data uji coba.",
    });
  }
  return userId;
}

/** Generates a unique slug for the sample org so repeat runs never collide. */
async function uniqueSampleSlug(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `uji-coba-${suffix}`;
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!existing) return slug;
  }
  return `uji-coba-${Date.now().toString(36)}`;
}

// Sample employees seeded into the demo org. Roles are chosen so the vendor can
// see meaningful HR data. All are test accounts (excluded from real counts).
const SAMPLE_EMPLOYEES: ReadonlyArray<{
  name: string;
  jobTitle: string;
  department: string;
  role: string;
}> = [
  { name: "Andi Wijaya", jobTitle: "Manajer HR", department: "SDM", role: "hr_manager" },
  { name: "Siti Nurhaliza", jobTitle: "Staf Keuangan", department: "Keuangan", role: "finance_staff" },
  { name: "Budi Santoso", jobTitle: "Staf Administrasi", department: "Umum", role: "employee" },
  { name: "Dewi Lestari", jobTitle: "Sekretaris", department: "Umum", role: "employee" },
  { name: "Rudi Hartono", jobTitle: "Supervisor Operasional", department: "Operasional", role: "manager" },
];

export const seedSampleOrganization = mutation({
  args: {},
  handler: async (ctx): Promise<{ organizationId: Id<"organizations">; name: string; slug: string }> => {
    const superAdminId = await requireSuperAdmin(ctx);
    const now = new Date().toISOString();

    // Reuse the single built-in demo org if it already exists — never create a
    // second one. This keeps "PT Contoh Uji Coba" as one stable default target.
    const existingSample = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("isSampleOrg"), true))
      .first();
    if (existingSample) {
      return {
        organizationId: existingSample._id,
        name: existingSample.name,
        slug: existingSample.slug,
      };
    }

    const name = `PT Contoh Uji Coba`;
    const slug = await uniqueSampleSlug(ctx);

    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      plan: "pro",
      isActive: true,
      isSampleOrg: true,
      createdAt: now,
      address: "Jl. Demonstrasi No. 1, Jakarta",
      phone: "021-0000000",
      website: "https://contoh.example.com",
      createdBy: superAdminId,
    });

    // ── HR / people (hr_people) ──────────────────────────────────────────────
    const employeeIds: Array<Id<"users">> = [];
    for (const emp of SAMPLE_EMPLOYEES) {
      const id = await ctx.db.insert("users", {
        tokenIdentifier: `placeholder:${crypto.randomUUID()}`,
        name: emp.name,
        jobTitle: emp.jobTitle,
        department: emp.department,
        role: emp.role,
        accountStatus: "invited",
        organizationId,
        // Keep demo employees out of real headcount, billing, and analytics.
        isTestAccount: true,
        startDate: "2024-01-15",
        phone: "0812-0000-0000",
      });
      employeeIds.push(id);
    }
    const hrManagerId = employeeIds[0];
    const financeStaffId = employeeIds[1];

    // ── Letters & documents (letters_documents) ──────────────────────────────
    const sampleLetters: ReadonlyArray<{
      type: string;
      subject: string;
      content: string;
      category: string;
    }> = [
      {
        type: "keluar",
        subject: "Undangan Rapat Koordinasi Bulanan",
        content:
          "Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri rapat koordinasi bulanan yang akan diselenggarakan pekan depan.",
        category: "undangan",
      },
      {
        type: "masuk",
        subject: "Permohonan Kerja Sama Vendor",
        content:
          "Bersama surat ini kami mengajukan permohonan kerja sama sebagai penyedia layanan untuk periode tahun berjalan.",
        category: "permohonan",
      },
      {
        type: "keluar",
        subject: "Pemberitahuan Libur Nasional",
        content:
          "Diberitahukan kepada seluruh karyawan bahwa kantor akan diliburkan sehubungan dengan hari libur nasional.",
        category: "pengumuman",
      },
    ];
    for (const [i, letter] of sampleLetters.entries()) {
      await ctx.db.insert("letters", {
        type: letter.type,
        status: i === 0 ? "sent" : "draft",
        subject: letter.subject,
        letterNumber: `001/UJI/${i + 1}`,
        letterDate: "2026-01-10",
        place: "Jakarta",
        classification: "biasa",
        fromName: name,
        toName: i === 1 ? name : "Seluruh Karyawan",
        content: letter.content,
        category: letter.category,
        authorId: hrManagerId,
        organizationId,
        attachmentCount: 0,
        dispositionCount: 0,
        searchText: `${letter.subject} 001/UJI/${i + 1}`.toLowerCase(),
      });
    }

    // ── Payroll (finance_payroll) ────────────────────────────────────────────
    const periodId = await ctx.db.insert("payrollPeriods", {
      period: "2026-01",
      periodLabel: "Januari 2026",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      payDate: "2026-01-28",
      status: "published",
      totalGross: 0, // filled in below after payslips
      totalDeductions: 0,
      totalNet: 0,
      employeeCount: employeeIds.length,
      createdBy: superAdminId,
      publishedAt: now,
      organizationId,
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    for (const [i, empId] of employeeIds.entries()) {
      const emp = SAMPLE_EMPLOYEES[i];
      const basic = 5_000_000 + i * 1_000_000;
      const earnings = basic + 500_000; // basic + tunjangan
      const deductions = Math.round(earnings * 0.05);
      const gross = earnings;
      const net = gross - deductions;
      totalGross += gross;
      totalDeductions += deductions;
      totalNet += net;
      await ctx.db.insert("payslips", {
        periodId,
        userId: empId,
        period: "2026-01",
        basicSalary: basic,
        totalEarnings: earnings,
        totalDeductions: deductions,
        grossSalary: gross,
        netSalary: net,
        status: "published",
        publishedAt: now,
        userName: emp.name,
        userJobTitle: emp.jobTitle,
        userDepartment: emp.department,
        organizationId,
      });
    }
    await ctx.db.patch(periodId, {
      totalGross,
      totalDeductions,
      totalNet,
    });

    // ── Fund requests (finance_payroll) ──────────────────────────────────────
    const sampleFundRequests: ReadonlyArray<{
      title: string;
      purpose: string;
      category: string;
      amount: number;
      status: string;
    }> = [
      {
        title: "Pembelian ATK Kantor",
        purpose: "Pengadaan alat tulis kantor untuk kebutuhan operasional triwulan pertama.",
        category: "procurement",
        amount: 2_500_000,
        status: "pending",
      },
      {
        title: "Reimbursement Perjalanan Dinas",
        purpose: "Penggantian biaya perjalanan dinas ke kantor cabang Surabaya.",
        category: "travel",
        amount: 3_750_000,
        status: "approved",
      },
    ];
    for (const req of sampleFundRequests) {
      await ctx.db.insert("fundRequests", {
        submitterId: financeStaffId,
        userDepartment: "Keuangan",
        title: req.title,
        purpose: req.purpose,
        category: req.category,
        amount: req.amount,
        neededBy: "2026-02-15",
        status: req.status,
        currentApprovalLevel: req.status === "approved" ? 2 : 1,
        totalApprovalLevels: 2,
        submittedAt: now,
        organizationId,
      });
    }

    // ── Communication (communication) ────────────────────────────────────────
    const sampleAnnouncements: ReadonlyArray<{
      title: string;
      content: string;
      priority: string;
    }> = [
      {
        title: "Selamat Datang di Star e-Office",
        content:
          "Platform e-office resmi perusahaan kini aktif. Silakan lengkapi profil Anda dan mulai berkolaborasi.",
        priority: "high",
      },
      {
        title: "Jadwal Pemeliharaan Sistem",
        content:
          "Sistem akan dipelihara pada akhir pekan ini. Mohon simpan pekerjaan Anda sebelum jadwal tersebut.",
        priority: "normal",
      },
    ];
    for (const ann of sampleAnnouncements) {
      await ctx.db.insert("announcements", {
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        status: "published",
        authorId: hrManagerId,
        publishedAt: now,
        organizationId,
      });
    }

    // A direct-message conversation between two sample employees.
    const a = employeeIds[0];
    const b = employeeIds[2];
    const key = a < b ? `${a}__${b}` : `${b}__${a}`;
    const conversationId = await ctx.db.insert("conversations", {
      key,
      userAId: a,
      userBId: b,
      lastMessageAt: now,
      lastMessagePreview: "Baik, terima kasih atas informasinya.",
      lastMessageSenderId: b,
      organizationId,
    });
    await ctx.db.insert("directMessages", {
      conversationId,
      senderId: a,
      recipientId: b,
      content: "Halo, tolong siapkan laporan rapat untuk besok ya.",
      organizationId,
    });
    await ctx.db.insert("directMessages", {
      conversationId,
      senderId: b,
      recipientId: a,
      content: "Baik, terima kasih atas informasinya.",
      organizationId,
    });

    // ── Departments (org_settings) ───────────────────────────────────────────
    const sampleDepartments: ReadonlyArray<{
      name: string;
      color: string;
      icon: string;
      headId: Id<"users">;
    }> = [
      { name: "Sumber Daya Manusia", color: "blue", icon: "👥", headId: employeeIds[0] },
      { name: "Keuangan", color: "emerald", icon: "💰", headId: employeeIds[1] },
      { name: "Operasional", color: "violet", icon: "⚙️", headId: employeeIds[4] },
    ];
    for (const [i, dept] of sampleDepartments.entries()) {
      await ctx.db.insert("departments", {
        name: dept.name,
        color: dept.color,
        icon: dept.icon,
        headId: dept.headId,
        order: i,
        organizationId,
      });
    }

    // ── Leave requests (hr_people) ───────────────────────────────────────────
    const sampleLeave: ReadonlyArray<{
      userId: Id<"users">;
      type: string;
      startDate: string;
      endDate: string;
      dayCount: number;
      reason: string;
      status: string;
    }> = [
      {
        userId: employeeIds[2],
        type: "annual",
        startDate: "2026-02-10",
        endDate: "2026-02-12",
        dayCount: 3,
        reason: "Liburan keluarga.",
        status: "pending",
      },
      {
        userId: employeeIds[3],
        type: "sick",
        startDate: "2026-01-20",
        endDate: "2026-01-21",
        dayCount: 2,
        reason: "Sakit dan perlu istirahat.",
        status: "approved",
      },
    ];
    for (const lv of sampleLeave) {
      await ctx.db.insert("leaveRequests", {
        userId: lv.userId,
        type: lv.type,
        startDate: lv.startDate,
        endDate: lv.endDate,
        dayCount: lv.dayCount,
        reason: lv.reason,
        status: lv.status,
        reviewerId: lv.status === "approved" ? hrManagerId : undefined,
        reviewedAt: lv.status === "approved" ? now : undefined,
        organizationId,
      });
    }

    // ── Attendance (hr_people) ───────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    for (const [i, empId] of employeeIds.entries()) {
      const late = i % 3 === 0;
      await ctx.db.insert("attendanceRecords", {
        userId: empId,
        date: today,
        clockInAt: `${today}T${late ? "08:35" : "07:55"}:00.000Z`,
        clockOutAt: `${today}T17:05:00.000Z`,
        workMinutes: late ? 510 : 550,
        location: "Kantor Pusat",
        isLate: late,
        organizationId,
      });
    }

    // ── Calendar events (communication) ──────────────────────────────────────
    await ctx.db.insert("events", {
      title: "Rapat Koordinasi Bulanan",
      description: "Evaluasi kinerja tim dan rencana kerja bulan berikutnya.",
      category: "meeting",
      startDate: "2026-02-05",
      endDate: "2026-02-05",
      startTime: "09:00",
      endTime: "11:00",
      location: "Ruang Rapat Utama",
      allDay: false,
      authorId: hrManagerId,
      organizationId,
    });

    // ── Forum (communication) ────────────────────────────────────────────────
    const threadId = await ctx.db.insert("forumThreads", {
      title: "Ide untuk kegiatan gathering tahunan",
      content: "Yuk kumpulkan usulan tempat dan konsep acara gathering tahun ini.",
      category: "general",
      authorId: employeeIds[3],
      replyCount: 1,
      lastActivityAt: now,
      organizationId,
    });
    await ctx.db.insert("forumReplies", {
      threadId,
      authorId: employeeIds[4],
      content: "Setuju! Usul saya diadakan di luar kota agar lebih segar.",
      organizationId,
    });

    // ── Projects & tasks (communication) ─────────────────────────────────────
    const projectId = await ctx.db.insert("projects", {
      name: "Digitalisasi Arsip Surat",
      description: "Memindahkan arsip surat fisik ke sistem e-office.",
      status: "active",
      ownerId: hrManagerId,
      memberIds: [hrManagerId, employeeIds[2], employeeIds[3]],
      color: "blue",
      organizationId,
    });
    const sampleTasks: ReadonlyArray<{
      title: string;
      status: string;
      priority: string;
      assigneeId: Id<"users">;
    }> = [
      { title: "Inventarisasi arsip surat 2025", status: "done", priority: "high", assigneeId: employeeIds[2] },
      { title: "Pindai dokumen ke format digital", status: "in_progress", priority: "medium", assigneeId: employeeIds[3] },
      { title: "Verifikasi metadata surat", status: "todo", priority: "low", assigneeId: employeeIds[2] },
    ];
    for (const [i, task] of sampleTasks.entries()) {
      await ctx.db.insert("tasks", {
        projectId,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        authorId: hrManagerId,
        completedAt: task.status === "done" ? now : undefined,
        order: i,
        organizationId,
      });
    }

    // ── Policies (letters_documents) ─────────────────────────────────────────
    const samplePolicies: ReadonlyArray<{
      title: string;
      summary: string;
      content: string;
      category: string;
    }> = [
      {
        title: "Kebijakan Jam Kerja",
        summary: "Aturan jam kerja dan keterlambatan karyawan.",
        content: "Jam kerja kantor adalah 08.00–17.00 dari Senin hingga Jumat. Keterlambatan lebih dari 15 menit akan dicatat.",
        category: "hr",
      },
      {
        title: "Kebijakan Keamanan Data",
        summary: "Panduan menjaga kerahasiaan data perusahaan.",
        content: "Seluruh karyawan wajib menjaga kerahasiaan data perusahaan dan tidak membagikannya ke pihak yang tidak berwenang.",
        category: "it",
      },
    ];
    for (const pol of samplePolicies) {
      await ctx.db.insert("policies", {
        title: pol.title,
        summary: pol.summary,
        content: pol.content,
        category: pol.category,
        version: "1.0",
        status: "published",
        requiresAcknowledgment: true,
        effectiveDate: "2026-01-01",
        tags: ["umum"],
        authorId: hrManagerId,
        lastEditedAt: now,
        publishedAt: now,
        viewCount: 0,
        acknowledgmentCount: 0,
        organizationId,
      });
    }

    // ── Assets (org_settings) ────────────────────────────────────────────────
    const sampleAssets: ReadonlyArray<{
      name: string;
      assetTag: string;
      category: string;
      status: string;
      brand: string;
      holder?: Id<"users">;
    }> = [
      { name: "Laptop Kantor 01", assetTag: "LP-001", category: "laptop", status: "assigned", brand: "Lenovo", holder: employeeIds[0] },
      { name: "Monitor 24 inci", assetTag: "MN-001", category: "monitor", status: "available", brand: "Dell" },
      { name: "Proyektor Ruang Rapat", assetTag: "PR-001", category: "other", status: "available", brand: "Epson" },
    ];
    for (const asset of sampleAssets) {
      const assetId = await ctx.db.insert("assets", {
        name: asset.name,
        assetTag: asset.assetTag,
        category: asset.category,
        status: asset.status,
        brand: asset.brand,
        purchaseDate: "2025-06-01",
        purchasePrice: 8_000_000,
        location: "Kantor Pusat",
        authorId: superAdminId,
        currentHolderId: asset.holder,
        organizationId,
      });
      if (asset.holder) {
        const assignmentId = await ctx.db.insert("assetAssignments", {
          assetId,
          userId: asset.holder,
          assignedAt: now,
          assignedBy: superAdminId,
          note: "Penyerahan perangkat kerja.",
          organizationId,
        });
        await ctx.db.patch(assetId, { currentAssignmentId: assignmentId });
      }
    }

    return { organizationId, name, slug };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Populate the demo org's EMPLOYEE DIRECTORY with 20 realistic dummy employees.
//
// Unlike seedSampleOrganization (whose 5 accounts are isTestAccount and hidden
// from the directory), these 20 are regular, VISIBLE employees so the directory,
// org chart, and department views look fully populated for demos. They are only
// ever added to the built-in sample org ("PT Contoh Uji Coba"), never a real
// tenant, so real headcount elsewhere is unaffected.
//
// Idempotent: if the sample org already has 20+ visible (non-test) employees the
// mutation does nothing, so it is safe to run more than once.
// ─────────────────────────────────────────────────────────────────────────────

type DummyEmployee = {
  name: string;
  jobTitle: string;
  department: string;
  role: string;
  location: string;
  startDate: string;
  dateOfBirth: string;
  // Index into the seeded array for the direct manager, or null for the top.
  managerIndex: number | null;
};

const DIRECTORY_DUMMIES: ReadonlyArray<DummyEmployee> = [
  { name: "Bambang Sutrisno", jobTitle: "Direktur Utama", department: "Manajemen", role: "manager", location: "Jakarta Pusat", startDate: "2018-03-01", dateOfBirth: "1975-06-12", managerIndex: null },
  { name: "Andi Wijaya", jobTitle: "Manajer SDM", department: "Sumber Daya Manusia", role: "hr_manager", location: "Jakarta Pusat", startDate: "2019-05-15", dateOfBirth: "1983-09-21", managerIndex: 0 },
  { name: "Sri Wahyuni", jobTitle: "Manajer Keuangan", department: "Keuangan", role: "manager", location: "Jakarta Pusat", startDate: "2019-07-01", dateOfBirth: "1982-02-14", managerIndex: 0 },
  { name: "Hendra Gunawan", jobTitle: "Manajer Operasional", department: "Operasional", role: "manager", location: "Surabaya", startDate: "2019-09-10", dateOfBirth: "1980-11-30", managerIndex: 0 },
  { name: "Maya Sari", jobTitle: "Manajer Teknologi Informasi", department: "Teknologi Informasi", role: "manager", location: "Jakarta Selatan", startDate: "2020-01-20", dateOfBirth: "1986-04-05", managerIndex: 0 },
  { name: "Agus Salim", jobTitle: "Manajer Pemasaran", department: "Pemasaran", role: "manager", location: "Bandung", startDate: "2020-02-17", dateOfBirth: "1984-08-19", managerIndex: 0 },
  { name: "Dewi Anggraini", jobTitle: "Staf Rekrutmen", department: "Sumber Daya Manusia", role: "employee", location: "Jakarta Pusat", startDate: "2021-06-01", dateOfBirth: "1993-03-25", managerIndex: 1 },
  { name: "Rizky Pratama", jobTitle: "Staf Personalia", department: "Sumber Daya Manusia", role: "employee", location: "Jakarta Pusat", startDate: "2021-08-12", dateOfBirth: "1994-12-02", managerIndex: 1 },
  { name: "Putri Handayani", jobTitle: "Staf Akuntansi", department: "Keuangan", role: "employee", location: "Jakarta Pusat", startDate: "2021-03-08", dateOfBirth: "1992-07-17", managerIndex: 2 },
  { name: "Fajar Nugroho", jobTitle: "Staf Perpajakan", department: "Keuangan", role: "employee", location: "Jakarta Pusat", startDate: "2022-01-10", dateOfBirth: "1995-01-28", managerIndex: 2 },
  { name: "Wahyu Setiawan", jobTitle: "Supervisor Logistik", department: "Operasional", role: "employee", location: "Surabaya", startDate: "2020-11-02", dateOfBirth: "1988-05-09", managerIndex: 3 },
  { name: "Ratna Dewi", jobTitle: "Staf Pengadaan", department: "Operasional", role: "employee", location: "Surabaya", startDate: "2022-04-18", dateOfBirth: "1996-10-11", managerIndex: 3 },
  { name: "Dimas Prakoso", jobTitle: "Software Engineer", department: "Teknologi Informasi", role: "employee", location: "Jakarta Selatan", startDate: "2021-09-06", dateOfBirth: "1994-02-23", managerIndex: 4 },
  { name: "Indah Permata", jobTitle: "Staf Dukungan TI", department: "Teknologi Informasi", role: "employee", location: "Jakarta Selatan", startDate: "2022-07-25", dateOfBirth: "1997-06-30", managerIndex: 4 },
  { name: "Yoga Aditya", jobTitle: "Staf Pemasaran Digital", department: "Pemasaran", role: "employee", location: "Bandung", startDate: "2022-02-14", dateOfBirth: "1995-09-15", managerIndex: 5 },
  { name: "Lestari Ningsih", jobTitle: "Staf Konten Kreatif", department: "Pemasaran", role: "employee", location: "Bandung", startDate: "2023-01-09", dateOfBirth: "1998-11-20", managerIndex: 5 },
  { name: "Bayu Firmansyah", jobTitle: "Staf Umum", department: "Umum", role: "employee", location: "Jakarta Pusat", startDate: "2022-10-03", dateOfBirth: "1996-04-08", managerIndex: 3 },
  { name: "Citra Kirana", jobTitle: "Resepsionis", department: "Umum", role: "employee", location: "Jakarta Pusat", startDate: "2023-03-20", dateOfBirth: "1999-08-13", managerIndex: 1 },
  { name: "Eko Purnomo", jobTitle: "Pengemudi Operasional", department: "Umum", role: "employee", location: "Surabaya", startDate: "2021-12-01", dateOfBirth: "1990-01-05", managerIndex: 3 },
  { name: "Nadia Safitri", jobTitle: "Administrasi Kantor", department: "Umum", role: "employee", location: "Jakarta Pusat", startDate: "2023-05-15", dateOfBirth: "1998-03-27", managerIndex: 1 },
];

/** Builds an email from a full name, e.g. "Andi Wijaya" → "andi.wijaya@contoh.example.com". */
function dummyEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return `${slug}@contoh.example.com`;
}

export const seedDirectoryEmployees = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ organizationId: Id<"organizations">; created: number; skipped: boolean }> => {
    await requireSuperAdmin(ctx);

    // Target the built-in sample org. If it does not exist yet, create it first
    // via the same single-org guarantee used by seedSampleOrganization.
    let sampleOrg = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("isSampleOrg"), true))
      .first();

    // Fall back to any org literally named "PT Contoh Uji Coba" (older demos may
    // predate the isSampleOrg flag).
    if (!sampleOrg) {
      const all = await ctx.db.query("organizations").collect();
      sampleOrg =
        all.find((o) => (o.name ?? "").toLowerCase().includes("contoh uji coba")) ??
        null;
    }

    if (!sampleOrg) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message:
          "Organisasi contoh belum ada. Klik 'Buat Data Uji Coba' terlebih dahulu.",
      });
    }

    const organizationId = sampleOrg._id;

    // Count existing VISIBLE (non-test, non-super-admin) employees. If already
    // populated, do nothing so repeat clicks never create duplicates.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const visibleCount = existing.filter(
      (u) => u.role !== "super_admin" && u.isTestAccount !== true,
    ).length;
    if (visibleCount >= DIRECTORY_DUMMIES.length) {
      return { organizationId, created: 0, skipped: true };
    }

    // Insert everyone first (without managers), then wire up managerId in a
    // second pass so we can reference the generated ids by index.
    const ids: Array<Id<"users">> = [];
    for (const [i, emp] of DIRECTORY_DUMMIES.entries()) {
      const nip = `PCU-${String(i + 1).padStart(3, "0")}`;
      const id = await ctx.db.insert("users", {
        tokenIdentifier: `placeholder:${crypto.randomUUID()}`,
        name: emp.name,
        nip,
        email: dummyEmail(emp.name),
        jobTitle: emp.jobTitle,
        department: emp.department,
        role: emp.role,
        accountStatus: "invited",
        organizationId,
        location: emp.location,
        phone: `0812-${String(3000 + i)}-${String(1000 + i)}`,
        startDate: emp.startDate,
        dateOfBirth: emp.dateOfBirth,
        birthday: emp.dateOfBirth.slice(5), // MM-DD
        bio: `${emp.jobTitle} di divisi ${emp.department}.`,
        // NOTE: intentionally NOT a test account so it appears in the directory.
      });
      ids.push(id);
    }

    // Second pass: set reporting lines.
    for (const [i, emp] of DIRECTORY_DUMMIES.entries()) {
      if (emp.managerIndex !== null) {
        await ctx.db.patch(ids[i], { managerId: ids[emp.managerIndex] });
      }
    }

    return { organizationId, created: ids.length, skipped: false };
  },
});
