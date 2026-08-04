import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Helpers ----------------------------------------------------------------

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({ message: "Akses ditolak. Hanya admin yang diperbolehkan.", code: "FORBIDDEN" });
  }
  return user;
}

// ---- Queries ----------------------------------------------------------------

/** List all membership plans ordered by display order */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("membershipPlans")
      .withIndex("by_order")
      .collect();
  },
});

/** List only active membership plans */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("membershipPlans")
      .withIndex("by_order")
      .collect();
    return all.filter((p) => p.isActive);
  },
});

/** Get a single plan by ID */
export const getById = query({
  args: { planId: v.id("membershipPlans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.planId);
  },
});

// ---- Mutations --------------------------------------------------------------

/** Create a new membership plan */
export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.string(),
    priceUnit: v.string(),
    pricePerUserMonth: v.number(),
    maxEmployees: v.number(),
    maxStorageMb: v.number(),
    supportLevel: v.string(),
    coreFeatures: v.array(v.string()),
    disabledFeatures: v.array(v.string()),
    order: v.number(),
    isPopular: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Ensure slug is unique
    const existing = await ctx.db
      .query("membershipPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      throw new ConvexError({ message: `Slug "${args.slug}" sudah digunakan`, code: "CONFLICT" });
    }

    return await ctx.db.insert("membershipPlans", {
      ...args,
      createdBy: user._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Update an existing membership plan */
export const update = mutation({
  args: {
    planId: v.id("membershipPlans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.string()),
    priceUnit: v.optional(v.string()),
    pricePerUserMonth: v.optional(v.number()),
    maxEmployees: v.optional(v.number()),
    maxStorageMb: v.optional(v.number()),
    supportLevel: v.optional(v.string()),
    coreFeatures: v.optional(v.array(v.string())),
    disabledFeatures: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    isPopular: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) {
      throw new ConvexError({ message: "Paket tidak ditemukan", code: "NOT_FOUND" });
    }

    const { planId, ...updates } = args;
    // Remove undefined values
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(planId, patch);
  },
});

/** Delete a membership plan */
export const remove = mutation({
  args: { planId: v.id("membershipPlans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) {
      throw new ConvexError({ message: "Paket tidak ditemukan", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.planId);
  },
});

/** Seed default plans from the pricing section data */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    // Check if plans already exist
    const existing = await ctx.db
      .query("membershipPlans")
      .withIndex("by_order")
      .first();
    if (existing) {
      throw new ConvexError({ message: "Paket sudah ada. Hapus semua paket jika ingin reset.", code: "CONFLICT" });
    }

    const now = new Date().toISOString();
    const defaults = [
      {
        slug: "free",
        name: "Gratis",
        description: "Mulai kelola tim kecil Anda tanpa biaya",
        price: "Rp 0",
        priceUnit: "selamanya",
        pricePerUserMonth: 0,
        maxEmployees: 10,
        maxStorageMb: 500,
        supportLevel: "community",
        coreFeatures: [
          "Direktori Karyawan",
          "Absensi & Cuti dasar",
          "Pengumuman (baca)",
          "Pesan & Notifikasi",
          "Perayaan otomatis",
          "Dokumen Saya",
        ],
        disabledFeatures: [
          "Asisten AI",
          "OKR & Kinerja",
          "Rekrutmen",
          "Pelatihan",
          "Penggajian",
        ],
        order: 1,
        isPopular: false,
        isActive: true,
      },
      {
        slug: "starter",
        name: "Starter",
        description: "Operasional HR lengkap untuk tim berkembang",
        price: "Rp 25rb",
        priceUnit: "/user/bulan",
        pricePerUserMonth: 25000,
        maxEmployees: 50,
        maxStorageMb: 5120,
        supportLevel: "email",
        coreFeatures: [
          "Semua fitur Gratis",
          "Tugas & Proyek (10 aktif)",
          "Kelola Surat & Kalender",
          "Apresiasi & Polling",
          "Dokumen & Kebijakan",
          "Pemesanan Ruangan",
          "Onboarding karyawan",
          "Penggajian (Payroll)",
        ],
        disabledFeatures: [
          "OKR & Goals",
          "Rekrutmen & ATS",
          "Pelatihan (LMS)",
          "Asisten AI",
        ],
        order: 2,
        isPopular: false,
        isActive: true,
      },
      {
        slug: "professional",
        name: "Professional",
        description: "Solusi lengkap pengembangan SDM perusahaan",
        price: "Rp 65rb",
        priceUnit: "/user/bulan",
        pricePerUserMonth: 65000,
        maxEmployees: 200,
        maxStorageMb: 51200,
        supportLevel: "priority",
        coreFeatures: [
          "Semua fitur Starter",
          "Asisten AI (Chatbot HR)",
          "Reimbursement & Travel",
          "Tugas & Proyek",
          "Proyek Unlimited",
          "Jenjang Karier",
          "Forum, Saran, Penghargaan",
          "OKR & Penilaian Kinerja",
          "Pulse Survey & Helpdesk",
          "Wiki & Knowledge Base",
          "Inventaris & Aset",
          "Rekrutmen & ATS",
          "Pelatihan (LMS)",
        ],
        disabledFeatures: [
          "Feedback 360°",
          "Talent Management",
          "Analitik Advanced",
        ],
        order: 3,
        isPopular: true,
        isActive: true,
      },
      {
        slug: "enterprise",
        name: "Enterprise",
        description: "Kontrol penuh untuk korporasi besar",
        price: "Custom",
        priceUnit: "hubungi kami",
        pricePerUserMonth: -1,
        maxEmployees: 0,
        maxStorageMb: 0,
        supportLevel: "dedicated",
        coreFeatures: [
          "Semua fitur Professional",
          "Asisten AI Premium",
          "Feedback 360°",
          "Talent Management",
          "Analitik Advanced & Custom",
          "Admin Dashboard lanjutan",
          "Audit Trail & RBAC granular",
          "API Access & Webhook",
          "Dedicated Account Manager",
        ],
        disabledFeatures: [],
        order: 4,
        isPopular: false,
        isActive: true,
      },
    ];

    for (const plan of defaults) {
      await ctx.db.insert("membershipPlans", {
        ...plan,
        createdBy: user._id,
        updatedAt: now,
      });
    }
  },
});
