// Shared role + menu definitions used by both backend and frontend.
// Keeping this in /convex means it can be imported from both sides.
//
// ===== 14 GLOBAL STANDARD ROLES =====
//
// System / Platform Level
//   1. super_admin     – Full access all features & tenants
//   2. admin           – Org administrator (no system-level changes)
//   3. it_support      – Technical access, audit log, password reset
//
// HR & People
//   4. hr_manager      – Full HR module access
//   5. hr_staff        – Talent acquisition, onboarding
//   6. ld_specialist   – Training, mentorship, certification
//   7. payroll_officer – Payroll & compensation
//
// Finance & Operations
//   8. finance_manager – Approve budgets, financial reports
//   9. finance_staff   – Input fund requests, basic reports
//  10. approver        – Cross-department review & approval
//
// Management
//  11. director        – Executive dashboard, analytics, read-only
//  12. department_head – Manage team, approve leave/requests
//  13. team_lead       – Monitor team performance
//
// End User
//  14. employee        – Self-service: attendance, leave, profile
//  15. contractor      – Limited project-based access

export const ROLE_VALUES = [
  "super_admin",
  "admin",
  "it_support",
  "hr_manager",
  "hr_staff",
  "ld_specialist",
  "payroll_officer",
  "finance_manager",
  "finance_staff",
  "approver",
  "director",
  "department_head",
  "team_lead",
  "employee",
  "contractor",
] as const;

export type Role = (typeof ROLE_VALUES)[number];

export function isRole(value: string | undefined | null): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin:     "Super Admin",
  admin:           "Administrator",
  it_support:      "IT Support",
  hr_manager:      "HR Manager",
  hr_staff:        "HR Staff / Recruiter",
  ld_specialist:   "L&D Specialist",
  payroll_officer: "Payroll Officer",
  finance_manager: "Finance Manager",
  finance_staff:   "Finance Staff",
  approver:        "Approver / Reviewer",
  director:        "Director / C-Level",
  department_head: "Department Head",
  team_lead:       "Team Lead / Supervisor",
  employee:        "Karyawan",
  contractor:      "Contractor / Freelance",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin:
    "Akses penuh ke semua fitur dan pengaturan platform, termasuk mengelola peran dan multi-tenant.",
  admin:
    "Mengelola konten, karyawan, dan operasional harian organisasi (tidak dapat mengubah sistem platform).",
  it_support:
    "Akses teknis: audit log, reset password, dan pemantauan sistem. Tidak dapat mengubah data bisnis.",
  hr_manager:
    "Akses penuh modul HR: rekrutmen, onboarding, pelatihan, payroll, talent management, dan analytics SDM.",
  hr_staff:
    "Fokus pada talent acquisition dan onboarding karyawan baru. Akses terbatas pada modul rekrutmen.",
  ld_specialist:
    "Kelola program pelatihan, mentorship, sertifikasi, dan pengembangan kompetensi karyawan.",
  payroll_officer:
    "Mengelola penggajian, komponen gaji, slip gaji, dan periode payroll karyawan.",
  finance_manager:
    "Menyetujui anggaran, mengelola reimbursement, pengajuan dana, dan laporan keuangan organisasi.",
  finance_staff:
    "Input pengajuan dana, reimbursement, dan pelaporan keuangan dasar. Perlu persetujuan Finance Manager.",
  approver:
    "Pejabat peninjau lintas departemen: menyetujui pengajuan dana, reimbursement, dan perjalanan dinas.",
  director:
    "Eksekutif / C-Level: akses dashboard eksekutif, analytics, dan laporan strategis (read-only).",
  department_head:
    "Kepala departemen: mengelola tim, menyetujui cuti/izin, memantau kinerja dan proyek departemen.",
  team_lead:
    "Pemimpin tim: memantau performa anggota tim, koordinasi tugas, dan menyetujui permintaan level tim.",
  employee:
    "Akses standar karyawan: absensi, cuti, pengajuan, profil diri, dan fitur kolaborasi.",
  contractor:
    "Akses terbatas berbasis proyek untuk tenaga kontrak dan freelance. Tidak ada akses data sensitif.",
};

// ---- Legacy role mapping -----------------------------------------------
// Maps old roles to the new 14-role schema to maintain backward compatibility.
export function normalizeRole(value: string | undefined | null): Role {
  // Legacy treasurer → finance_manager
  if (value === "treasurer") return "finance_manager";
  // Legacy supervisor → department_head
  if (value === "supervisor") return "department_head";
  // Legacy hr_manager (old 7-role) → hr_manager (same)
  // Legacy finance_manager (old 7-role) → finance_manager (same)
  // Legacy approver (old 7-role) → approver (same)
  if (isRole(value)) return value;
  return "employee";
}

// ---- Menu definitions --------------------------------------------------

export type MenuKey =
  | "home"
  | "dashboard"
  | "my_profile"
  | "directory"
  | "leave"
  | "attendance"
  | "projects"
  | "messages"
  | "calendar"
  | "documents"
  | "my_documents"
  | "wiki"
  | "expenses"
  | "fund_requests"
  | "finance_dashboard"
  | "finance_audit"
  | "finance_settings"
  | "travel"
  | "onboarding"
  | "training"
  | "mentorship"
  | "news"
  | "forum"
  | "suggestions"
  | "support"
  | "gallery"
  | "celebrations"
  | "recognitions"
  | "awards"
  | "polls"
  | "rooms"
  | "calls"
  | "organization"
  | "teams"
  | "assets"
  | "jobs"
  | "performance"
  | "grading"
  | "talent"
  | "notifications"
  | "reports"
  | "analytics"
  | "policies"
  | "payroll"
  | "recruitment"
  | "okr"
  | "engagement"
  | "feedback360"
  | "pulse"
  | "offboarding"
  | "events"
  | "career_path"
  | "career_planning"
  | "chatbot"
  | "admin"
  | "user_management"
  | "letters"
  | "document_archive"
  | "data_privacy"
  | "membership_settings"
  | "promo_settings"
  | "membership_dashboard"
  | "billing"
  | "profile_verification";

export type MenuDef = {
  key: MenuKey;
  label: string;
  description: string;
  path: string;
  alwaysOn?: boolean;
};

export const MENU_ITEMS: ReadonlyArray<MenuDef> = [
  { key: "home",           label: "Beranda",                 description: "Halaman selamat datang organisasi",                path: "/home",         alwaysOn: true },
  { key: "dashboard",      label: "Dashboard",               description: "Halaman beranda portal",                            path: "/dashboard",    alwaysOn: true },
  { key: "my_profile",     label: "Data Profil Saya",        description: "Lihat dan kelola profil, keahlian, dan riwayat Anda", path: "/my-profile", alwaysOn: true },
  { key: "directory",      label: "Direktori Karyawan",      description: "Daftar karyawan & profil",                         path: "/directory" },
  { key: "leave",          label: "Pengajuan Cuti",           description: "Cuti pribadi & persetujuan",                       path: "/leave" },
  { key: "attendance",     label: "Absensi",                  description: "Clock in / clock out",                             path: "/attendance" },
  { key: "projects",       label: "Tugas & Proyek",           description: "Project board & tugas",                            path: "/projects" },
  { key: "messages",       label: "Pesan",                    description: "Pesan langsung antar karyawan",                    path: "/messages" },
  { key: "calendar",       label: "Kalender",                 description: "Event & jadwal perusahaan",                        path: "/calendar" },
  { key: "documents",      label: "Dokumen",                  description: "SOP, kebijakan, formulir",                         path: "/documents" },
  { key: "my_documents",   label: "Dokumen Saya",             description: "Arsip dokumen pribadi karyawan",                   path: "/my-documents" },
  { key: "wiki",           label: "Wiki",                     description: "Basis pengetahuan internal",                       path: "/wiki" },
  { key: "expenses",       label: "Reimbursement",            description: "Pengajuan biaya & persetujuan",                    path: "/expenses" },
  { key: "fund_requests",  label: "Pengajuan Dana",           description: "Pengajuan & persetujuan dana operasional",         path: "/fund-requests" },
  { key: "finance_dashboard", label: "Dashboard Keuangan",    description: "Monitor pengajuan, SLA, tren pengeluaran",          path: "/finance-dashboard" },
  { key: "finance_audit",     label: "Audit Trail Keuangan",   description: "Riwayat lengkap aksi pengajuan dana & laporan",      path: "/finance-audit" },
  { key: "finance_settings",  label: "Pengaturan Keuangan",    description: "Konfigurasi alur & jenjang persetujuan keuangan",   path: "/finance-settings" },
  { key: "travel",         label: "Perjalanan Dinas",         description: "Pengajuan & persetujuan perjalanan dinas",         path: "/travel" },
  { key: "onboarding",     label: "Onboarding",               description: "Checklist karyawan baru",                          path: "/onboarding" },
  { key: "training",       label: "Pelatihan",                description: "Kursus & e-learning",                              path: "/training" },
  { key: "mentorship",     label: "Mentorship & Peer",        description: "Mentor, mentee, dan grup belajar peer",            path: "/mentorship" },
  { key: "news",           label: "Berita & Pengumuman",      description: "Pusat berita & pengumuman internal",               path: "/news" },
  { key: "forum",          label: "Forum Diskusi",            description: "Diskusi terbuka karyawan",                         path: "/forum" },
  { key: "suggestions",    label: "Kotak Saran",              description: "Ide & masukan karyawan",                           path: "/suggestions" },
  { key: "support",        label: "Bantuan IT",               description: "Tiket dukungan IT",                                path: "/support" },
  { key: "gallery",        label: "Galeri Kegiatan",          description: "Foto acara perusahaan",                            path: "/gallery" },
  { key: "celebrations",   label: "Perayaan",                 description: "Ultah & anniversary karyawan",                     path: "/celebrations" },
  { key: "recognitions",   label: "Apresiasi",                description: "Penghargaan antar karyawan",                       path: "/recognitions" },
  { key: "awards",         label: "Penghargaan",              description: "Employee of the month & hall of fame",             path: "/awards" },
  { key: "polls",          label: "Polling & Survei",         description: "Pemungutan pendapat",                              path: "/polls" },
  { key: "rooms",          label: "Pemesanan Ruangan",        description: "Booking ruang meeting",                            path: "/rooms" },
  { key: "calls",          label: "Panggilan Suara & Video",  description: "Panggilan audio/video terintegrasi antar rekan",   path: "/calls" },
  { key: "organization",   label: "Struktur Organisasi",      description: "Bagan organisasi",                                 path: "/organization" },
  { key: "teams",          label: "Tim Lintas Departemen",    description: "Tim/squad kolaboratif lintas departemen",          path: "/teams" },
  { key: "assets",         label: "Inventaris & Aset",        description: "Pengelolaan aset perusahaan",                      path: "/assets" },
  { key: "jobs",           label: "Lowongan Internal",        description: "Lowongan kerja internal",                          path: "/jobs" },
  { key: "performance",    label: "Penilaian Kinerja",        description: "Review kinerja periodik",                          path: "/performance" },
  { key: "grading",        label: "Grading & Job Evaluation", description: "Evaluasi jabatan WTW Global Grading System",       path: "/grading" },
  { key: "talent",         label: "Talent Management",        description: "Nine Box, IDP, kalibrasi talenta, & succession",  path: "/talent" },
  { key: "notifications",  label: "Notifikasi",               description: "Pusat notifikasi",                                 path: "/notifications", alwaysOn: true },
  { key: "reports",        label: "Laporan & Analitik",       description: "Insight HR dan grafik perusahaan",                 path: "/reports" },
  { key: "analytics",      label: "Dashboard Analitik HR",    description: "Dashboard eksekutif: demografi, retention, biaya SDM", path: "/analytics" },
  { key: "policies",       label: "Kebijakan Perusahaan",     description: "Regulasi & policy wajib dibaca karyawan",          path: "/policies" },
  { key: "payroll",        label: "Payroll & Gaji",           description: "Slip gaji, komponen, dan periode payroll",         path: "/payroll" },
  { key: "recruitment",    label: "Rekrutmen & ATS",          description: "Kelola lowongan eksternal, kandidat, pipeline hiring", path: "/recruitment" },
  { key: "okr",            label: "OKR & Goals",              description: "Objectives, key results, dan check-in kemajuan",  path: "/okr" },
  { key: "engagement",     label: "Survei Engagement",        description: "Survei engagement, wellness, dan mood karyawan",  path: "/engagement" },
  { key: "feedback360",    label: "Feedback 360°",            description: "Siklus feedback multi-rater",                     path: "/feedback360" },
  { key: "pulse",          label: "Pulse Survey",             description: "Survei pulse singkat & pelacakan sentimen",        path: "/pulse" },
  { key: "offboarding",    label: "Offboarding & Exit",       description: "Resign, exit clearance, handover, exit interview", path: "/offboarding" },
  { key: "events",         label: "Event Perusahaan & RSVP",  description: "Gathering, townhall, workshop, acara resmi",      path: "/events" },
  { key: "career_path",    label: "Jenjang Karier Saya",      description: "Jenjang karier yang Anda ikuti: level, progres, training & KPI", path: "/career-path" },
  { key: "career_planning",label: "Perencanaan Karier",       description: "Kelola jalur karier, level, persyaratan, & penugasan karyawan (HR)", path: "/career-planning" },
  { key: "chatbot",        label: "Asisten AI",               description: "Chatbot HR untuk pertanyaan & tugas sehari-hari", path: "/chatbot", alwaysOn: true },
  { key: "admin",          label: "Dashboard Admin",          description: "Statistik & pengelolaan konten",                  path: "/admin" },
  { key: "user_management",label: "Pengaturan Pengguna",      description: "Kelola peran & akses menu",                       path: "/settings/users" },
  { key: "letters",              label: "Manajemen Surat",          description: "Surat masuk, keluar, disposisi & persetujuan",    path: "/letters", alwaysOn: true },
  { key: "document_archive",     label: "Arsip Dokumen",            description: "Arsip terpusat surat final beserta salinan PDF & jejak audit akses", path: "/document-archive" },
  { key: "data_privacy",         label: "Privasi & Akses Data",     description: "Kontrol izin akses data oleh penyedia aplikasi & jejak auditnya", path: "/data-privacy" },
  { key: "membership_settings", label: "Pengaturan Paket",         description: "Kelola paket keanggotaan, harga, & fitur",        path: "/membership-settings" },
  { key: "promo_settings",      label: "Promo & Upgrade",          description: "Kelola promo, diskon, dan permintaan upgrade",     path: "/promo-settings" },
  { key: "membership_dashboard", label: "Pemantauan Keanggotaan", description: "Dashboard monitoring keanggotaan, distribusi plan, & upgrade", path: "/membership-dashboard" },
  { key: "billing",              label: "Langganan & Pembayaran",   description: "Masa berlaku langganan & pengajuan pembayaran organisasi", path: "/billing" },
  { key: "profile_verification", label: "Verifikasi Profil",     description: "Tinjau dan verifikasi permintaan perubahan data profil karyawan", path: "/profile-verification" },
];

export const MENU_KEYS: ReadonlyArray<MenuKey> = MENU_ITEMS.map((m) => m.key);

// Platform-owner-only menus. These control the SaaS platform itself (pricing,
// promos, cross-tenant membership monitoring) and must never be exposed to a
// company's own Administrator — only the Super Admin manages them.
export const SUPER_ADMIN_ONLY_MENUS: ReadonlyArray<MenuKey> = [
  "membership_settings", // Pengaturan Paket
  "promo_settings", // Promo & Upgrade
  "membership_dashboard", // Pemantauan Keanggotaan
];

// ---- Default menu visibility per role ---------------------------------
// Super admin always sees ALL menus regardless of stored permissions.

const ALL_MENUS: ReadonlyArray<MenuKey> = [...MENU_KEYS];

// ---- Base menu set (Lapis 1 + Lapis 2) --------------------------------
// Every INTERNAL role gets these by default so the portal behaves like a
// standard employee self-service + collaboration workspace. Organisations can
// still fine-tune them per role. Contractors (external) stay intentionally
// limited and do NOT receive the base set.
//
// Lapis 1 – self-service pribadi (kebutuhan dasar tiap karyawan).
// Lapis 2 – kolaborasi & budaya perusahaan.
// Note: alwaysOn menus (home, dashboard, my_profile, notifications, chatbot)
// are enforced separately and are not repeated here.

// Lapis 1 – self-service pribadi (kebutuhan harian tiap karyawan).
const BASIC_SELF_MENUS: ReadonlyArray<MenuKey> = [
  "directory","leave","attendance","messages","calendar","my_documents",
  "documents","policies","expenses","suggestions","support","news","career_path",
];

// Lapis 2 – kolaborasi & budaya perusahaan.
const BASIC_COLLAB_MENUS: ReadonlyArray<MenuKey> = [
  "projects","forum","wiki","gallery","celebrations","recognitions","awards",
  "polls","rooms","calls","events","organization","training",
];

const BASE_MENUS: ReadonlyArray<MenuKey> = [
  ...BASIC_SELF_MENUS,
  ...BASIC_COLLAB_MENUS,
];

// Merge the base set into a role's manager-level extras, returning a unique list
// in canonical MENU_KEYS order.
function withBase(extra: ReadonlyArray<MenuKey>): ReadonlyArray<MenuKey> {
  const set = new Set<MenuKey>([...BASE_MENUS, ...extra]);
  return MENU_KEYS.filter((m) => set.has(m));
}

// ---- Menu groups (for grouping the access-control cards) ---------------
// Cards mirror the SIDEBAR structure so admins can immediately see which part
// of the navigation a permission affects. Groups roll up into two big
// sections:
//   - "umum_dasar"          : cross-functional menus used by almost everyone
//   - "spesifik_fungsional" : menus specific to a function / department
export type MenuSectionId = "umum_dasar" | "spesifik_fungsional";

// ---- SINGLE SOURCE OF TRUTH: sidebar structure ------------------------------
// This is the ONE place that defines how menus are grouped AND ordered. BOTH
// the sidebar navigation (DashboardLayout) and the access-control cards
// ("Akses Menu per Peran") derive their grouping + order from this array, so
// the two can never drift apart. To move a menu between groups or reorder it,
// edit only this array — the sidebar and the cards both follow automatically.
//
// Icons and any sidebar-specific labels live in the frontend (DashboardLayout)
// keyed by MenuKey; grouping and order come from here.
//
// Note: always-on core menus (home, dashboard, my_profile, notifications,
// chatbot, letters) still appear here in their natural sidebar position, but on
// the access-control cards they are collected into a dedicated locked "Menu
// Inti" group. Super-Admin-only menus are collected into a "Menu Platform"
// group there. Everything else follows the group + order below exactly.
export type SidebarGroupId =
  | "umum"
  | "ruang_saya"
  | "komunikasi"
  | "tim_kinerja"
  | "sumber_daya"
  | "manajemen_sdm"
  | "keuangan"
  | "administrasi";

export type SidebarGroupDef = {
  id: SidebarGroupId;
  label: string;
  description: string;
  section: MenuSectionId;
  menus: ReadonlyArray<MenuKey>;
};

export const SIDEBAR_GROUPS: ReadonlyArray<SidebarGroupDef> = [
  {
    id: "umum",
    label: "Umum",
    description: "Akses cepat lintas fungsi (kalender, arsip dokumen).",
    section: "umum_dasar",
    menus: [
      "dashboard", "chatbot", "notifications", "calendar", "letters",
      "document_archive",
    ],
  },
  {
    id: "ruang_saya",
    label: "Ruang Saya",
    description: "Layanan mandiri harian karyawan.",
    section: "umum_dasar",
    menus: [
      "attendance", "leave", "expenses", "fund_requests", "travel", "projects",
      "career_path",
    ],
  },
  {
    id: "komunikasi",
    label: "Komunikasi",
    description: "Komunikasi, kolaborasi, dan budaya perusahaan.",
    section: "umum_dasar",
    menus: [
      "messages", "news", "forum", "polls", "suggestions", "celebrations",
      "recognitions", "awards", "gallery",
    ],
  },
  {
    id: "tim_kinerja",
    label: "Tim & Kinerja",
    description: "Pengelolaan tim, penilaian kinerja, OKR, dan engagement.",
    section: "spesifik_fungsional",
    menus: ["teams", "performance", "okr", "feedback360", "engagement", "pulse"],
  },
  {
    id: "sumber_daya",
    label: "Sumber Daya",
    description: "Ruangan, aset, dokumen, dan basis pengetahuan.",
    section: "umum_dasar",
    menus: [
      "rooms", "calls", "assets", "events", "documents", "my_documents", "wiki",
      "policies",
    ],
  },
  {
    id: "manajemen_sdm",
    label: "Manajemen SDM",
    description: "Fungsi SDM: direktori, rekrutmen, payroll, talenta, analitik.",
    section: "spesifik_fungsional",
    menus: [
      "directory", "profile_verification", "organization", "grading", "jobs",
      "recruitment", "onboarding", "career_planning", "training", "talent",
      "mentorship", "reports", "analytics", "offboarding", "payroll",
    ],
  },
  {
    id: "keuangan",
    label: "Keuangan",
    description: "Pengelolaan keuangan organisasi (bukan pengajuan pribadi).",
    section: "spesifik_fungsional",
    menus: ["finance_dashboard", "finance_audit", "finance_settings"],
  },
  {
    id: "administrasi",
    label: "Administrasi",
    description: "Fungsi sistem, admin, privasi data, dan billing.",
    section: "spesifik_fungsional",
    menus: ["admin", "user_management", "data_privacy", "billing", "support"],
  },
];

// Each card group id matches a sidebar group, plus "core" (mandatory always-on
// menus) and "platform" (Super-Admin-only modules).
export type MenuGroupId = "core" | SidebarGroupId | "platform";

function isCoreMenu(key: MenuKey): boolean {
  return MENU_ITEMS.find((m) => m.key === key)?.alwaysOn === true;
}

// Resolve the card group a menu belongs to. Always-on menus are "core"; super
// admin modules are "platform". Anything not explicitly placed in a sidebar
// group falls back to "administrasi" so newly added menus still appear.
export function getMenuGroup(key: MenuKey): MenuGroupId {
  if (isCoreMenu(key)) return "core";
  if (SUPER_ADMIN_ONLY_MENUS.includes(key)) return "platform";
  for (const group of SIDEBAR_GROUPS) {
    if (group.menus.includes(key)) return group.id;
  }
  return "administrasi";
}

// Ordered menu keys for a card group, following the sidebar order. Core menus
// live in the "core" group and super-admin menus in "platform"; both are
// stripped out of the regular sidebar groups so they aren't shown twice.
export function getGroupMenuKeys(groupId: MenuGroupId): ReadonlyArray<MenuKey> {
  if (groupId === "core") {
    return MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key);
  }
  if (groupId === "platform") {
    return SUPER_ADMIN_ONLY_MENUS;
  }
  const group = SIDEBAR_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  return group.menus.filter(
    (k) => !isCoreMenu(k) && !SUPER_ADMIN_ONLY_MENUS.includes(k),
  );
}

export type MenuGroupDef = {
  id: MenuGroupId;
  sectionId: MenuSectionId;
  label: string;
  description: string;
};

export type MenuSectionDef = {
  id: MenuSectionId;
  label: string;
  description: string;
};

// The two big headers shown above the grouped cards.
export const MENU_SECTIONS: ReadonlyArray<MenuSectionDef> = [
  {
    id: "umum_dasar",
    label: "Umum Dasar",
    description: "Menu lintas fungsi yang dipakai oleh hampir semua peran.",
  },
  {
    id: "spesifik_fungsional",
    label: "Spesifik Fungsional",
    description: "Menu khusus untuk fungsi atau bagian tertentu.",
  },
];

// Fixed defs for the two synthetic card groups (not real sidebar groups).
const CORE_GROUP: MenuGroupDef = {
  id: "core",
  sectionId: "umum_dasar",
  label: "Menu Inti (Wajib)",
  description: "Selalu aktif untuk semua peran dan tidak dapat dinonaktifkan.",
};
const PLATFORM_GROUP: MenuGroupDef = {
  id: "platform",
  sectionId: "spesifik_fungsional",
  label: "Menu Platform",
  description: "Khusus Super Admin untuk mengelola platform SaaS.",
};

// Card group display order, built automatically from SIDEBAR_GROUPS so the
// cards always match the sidebar. Within each big section groups keep their
// sidebar order; "Menu Inti" leads Umum Dasar and "Menu Platform" closes
// Spesifik Fungsional.
export const MENU_GROUPS: ReadonlyArray<MenuGroupDef> = [
  CORE_GROUP,
  ...SIDEBAR_GROUPS.filter((g) => g.section === "umum_dasar").map((g) => ({
    id: g.id,
    sectionId: g.section,
    label: g.label,
    description: g.description,
  })),
  ...SIDEBAR_GROUPS.filter((g) => g.section === "spesifik_fungsional").map(
    (g) => ({
      id: g.id,
      sectionId: g.section,
      label: g.label,
      description: g.description,
    }),
  ),
  PLATFORM_GROUP,
];

// 2. Admin – full org management (excludes super-admin-only menus like membership/promo)
const ADMIN_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","finance_dashboard","finance_audit","finance_settings","travel","onboarding",
  "mentorship","teams","assets","jobs",
  "performance","grading","talent","reports","analytics",
  "payroll","recruitment","okr","engagement","feedback360","pulse","offboarding",
  "career_planning","admin","user_management","letters","document_archive","data_privacy","billing","profile_verification",
]);

// 3. IT Support – technical & audit access + the shared base set.
// Every account gets the base layers (self-service + collaboration) enabled by
// default; org admins can still disable individual menus per role afterwards.
const IT_SUPPORT_MENUS: ReadonlyArray<MenuKey> = withBase([
  "support",
]);

// 4. HR Manager – full HR modules
const HR_MANAGER_MENUS: ReadonlyArray<MenuKey> = withBase([
  "onboarding","mentorship","teams",
  "jobs","performance","grading","talent","reports","analytics",
  "payroll","recruitment","okr","engagement","feedback360","pulse","offboarding",
  "letters","document_archive","profile_verification",
]);

// 5. HR Staff / Recruiter – recruitment & onboarding focused
const HR_STAFF_MENUS: ReadonlyArray<MenuKey> = withBase([
  "onboarding","teams","jobs","recruitment",
  "engagement","letters","document_archive",
]);

// 6. L&D Specialist – learning & development
const LD_SPECIALIST_MENUS: ReadonlyArray<MenuKey> = withBase([
  "onboarding","mentorship","teams","jobs","performance",
  "engagement","feedback360",
]);

// 7. Payroll Officer – payroll & compensation
const PAYROLL_OFFICER_MENUS: ReadonlyArray<MenuKey> = withBase([
  "teams","payroll","reports",
]);

// 8. Finance Manager – budgets & financial oversight
const FINANCE_MANAGER_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","finance_dashboard","finance_audit","finance_settings","travel",
  "teams","payroll","reports","analytics",
]);

// 9. Finance Staff – input & basic reporting
const FINANCE_STAFF_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","finance_dashboard","finance_audit","travel",
]);

// 10. Approver / Reviewer – cross-dept approvals
const APPROVER_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","finance_dashboard","travel","teams","letters","document_archive",
]);

// 11. Director / C-Level – executive read-only
const DIRECTOR_MENUS: ReadonlyArray<MenuKey> = withBase([
  "teams","reports","analytics","performance","grading","talent","okr",
  "engagement","pulse","payroll","finance_dashboard","finance_audit",
]);

// 12. Department Head – team management + approvals
const DEPARTMENT_HEAD_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","finance_dashboard","travel","mentorship",
  "teams","assets","jobs","performance","grading","talent",
  "reports","analytics","payroll","recruitment","okr","engagement","feedback360",
  "pulse","offboarding","letters","document_archive",
]);

// 13. Team Lead / Supervisor – team monitoring
const TEAM_LEAD_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","travel","mentorship",
  "teams","assets","jobs","performance","okr",
  "engagement","feedback360","letters","document_archive",
]);

// 14. Employee – standard self-service
// Note: "grading" (Grading & Job Evaluation) is a managerial menu and is
// intentionally NOT part of the employee default set.
const EMPLOYEE_MENUS: ReadonlyArray<MenuKey> = withBase([
  "fund_requests","travel","assets","jobs","performance",
  "payroll","okr","engagement","feedback360","pulse","offboarding","letters","document_archive",
]);

// 15. Contractor / Freelance – limited project-based, but still receives the
// shared base set so the three default layers (core + self-service +
// collaboration) are enabled for every account out of the box. Org admins can
// disable individual menus per role afterwards.
const CONTRACTOR_MENUS: ReadonlyArray<MenuKey> = withBase([]);

export const DEFAULT_ROLE_MENUS: Record<Role, ReadonlyArray<MenuKey>> = {
  super_admin:     ALL_MENUS,
  admin:           ADMIN_MENUS,
  it_support:      IT_SUPPORT_MENUS,
  hr_manager:      HR_MANAGER_MENUS,
  hr_staff:        HR_STAFF_MENUS,
  ld_specialist:   LD_SPECIALIST_MENUS,
  payroll_officer: PAYROLL_OFFICER_MENUS,
  finance_manager: FINANCE_MANAGER_MENUS,
  finance_staff:   FINANCE_STAFF_MENUS,
  approver:        APPROVER_MENUS,
  director:        DIRECTOR_MENUS,
  department_head: DEPARTMENT_HEAD_MENUS,
  team_lead:       TEAM_LEAD_MENUS,
  employee:        EMPLOYEE_MENUS,
  contractor:      CONTRACTOR_MENUS,
};

// ---- Authorization helpers --------------------------------------------

/** true for super_admin and admin */
export function isAdminRole(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin";
}

/** true only for super_admin */
export function isSuperAdminRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === "super_admin";
}

/**
 * true ONLY for a genuine company administrator (role exactly "admin"),
 * NOT the platform super admin. Use this to gate tenant-side consent actions
 * (approving/denying vendor data-access requests) so the vendor can never
 * self-approve while viewing a company through an active grant.
 */
export function isCompanyAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === "admin";
}

/** Roles that can manage financial operations */
export function canManageFinance(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return (
    r === "super_admin" || r === "admin" ||
    r === "finance_manager" || r === "payroll_officer"
  );
}

/** Roles that can manage operations settings (task stages & priorities) */
export function canManageOperations(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin";
}

/** Roles that can approve requests */
export function canApprove(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return (
    r === "super_admin" || r === "admin" || r === "finance_manager" ||
    r === "department_head" || r === "approver" || r === "team_lead"
  );
}

/** Roles that can manage team / people */
export function canManageTeam(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return (
    r === "super_admin" || r === "admin" || r === "hr_manager" ||
    r === "department_head" || r === "team_lead"
  );
}

/** Roles with HR module access */
export function isHRRole(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return (
    r === "super_admin" || r === "admin" ||
    r === "hr_manager" || r === "hr_staff" || r === "ld_specialist"
  );
}

/** Roles with executive analytics read access */
export function isExecutiveRole(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return (
    r === "super_admin" || r === "admin" || r === "director" ||
    r === "department_head" || r === "hr_manager"
  );
}
