import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

// Pengaturan tampilan area kop untuk NOTA (memo), satu baris per tenant.
// Nota tidak memakai kop surat; area kop hanya menampilkan sebuah label judul
// yang dapat diatur tiap tenant. Contoh: "NOTA", "NOTA DINAS", "MEMO".

// Judul default bila tenant belum mengatur apa pun.
export const DEFAULT_MEMO_HEADER_TITLE = "NOTA";

// Gaya garis default untuk area kop nota (dipakai bila tenant belum mengatur).
// Garis atas lebih tebal, garis bawah lebih tipis, warna abu-abu gelap.
export const DEFAULT_MEMO_LINE = {
  topLineShow: true,
  topLineColor: "#1f2937",
  topLineWidth: 4,
  bottomLineShow: true,
  bottomLineColor: "#1f2937",
  bottomLineWidth: 2,
} as const;

export type MemoSettings = {
  headerTitle: string;
  topLineShow: boolean;
  topLineColor: string;
  topLineWidth: number;
  bottomLineShow: boolean;
  bottomLineColor: string;
  bottomLineWidth: number;
  // Logo opsional kop nota. `logoUrl` sudah di-resolve dari storage agar siap
  // dipakai renderer; `logoStorageId` disertakan agar form dapat mempertahankan
  // logo yang sudah ada saat menyimpan tanpa mengunggah ulang.
  logoUrl: string | null;
  logoStorageId: Id<"_storage"> | null;
};

// Ambil pengguna + organisasi EFEKTIF (mengikuti tenant yang sedang dipilih
// bila caller adalah super admin dengan grant aktif).
async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  }
  return { user, organizationId: organizationId ?? null };
}

// Cari baris pengaturan milik tenant. Baris lama tanpa organizationId (legacy)
// dipakai sebagai cadangan agar tetap kompatibel.
async function findRow(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Doc<"letterMemoSettings"> | null> {
  if (organizationId) {
    const scoped = await ctx.db
      .query("letterMemoSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();
    if (scoped) return scoped;
  }
  // Fallback legacy: baris tanpa organisasi.
  return await ctx.db
    .query("letterMemoSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", undefined))
    .first();
}

/**
 * Semua pengguna terautentikasi: baca judul kop nota tenant. Dipakai saat
 * merender dokumen (pratinjau, cetak/PDF, editor, ekspor Word).
 */
export const get = query({
  args: {},
  handler: async (ctx): Promise<MemoSettings> => {
    const { organizationId } = await requireAuth(ctx);
    const row = await findRow(ctx, organizationId);
    const title = row?.headerTitle?.trim();
    return {
      headerTitle: title && title.length > 0 ? title : DEFAULT_MEMO_HEADER_TITLE,
      topLineShow: row?.topLineShow ?? DEFAULT_MEMO_LINE.topLineShow,
      topLineColor: row?.topLineColor ?? DEFAULT_MEMO_LINE.topLineColor,
      topLineWidth: row?.topLineWidth ?? DEFAULT_MEMO_LINE.topLineWidth,
      bottomLineShow: row?.bottomLineShow ?? DEFAULT_MEMO_LINE.bottomLineShow,
      bottomLineColor: row?.bottomLineColor ?? DEFAULT_MEMO_LINE.bottomLineColor,
      bottomLineWidth: row?.bottomLineWidth ?? DEFAULT_MEMO_LINE.bottomLineWidth,
      logoUrl: row?.logoStorageId ? await ctx.storage.getUrl(row.logoStorageId) : null,
      logoStorageId: row?.logoStorageId ?? null,
    };
  },
});

/**
 * Simpan judul kop nota untuk tenant. Judul kosong akan mengembalikan ke
 * default "NOTA". Judul dibatasi panjangnya agar tetap muat di area kop.
 */
export const update = mutation({
  args: {
    headerTitle: v.string(),
    topLineShow: v.optional(v.boolean()),
    topLineColor: v.optional(v.string()),
    topLineWidth: v.optional(v.number()),
    bottomLineShow: v.optional(v.boolean()),
    bottomLineColor: v.optional(v.string()),
    bottomLineWidth: v.optional(v.number()),
    // Logo opsional. `logoStorageId` diisi bila ada logo baru diunggah; bila
    // dihilangkan, logo yang ada dipertahankan. `removeLogo: true` menghapus
    // logo yang tersimpan.
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    removeLogo: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user, organizationId } = await requireAuth(ctx);

    const trimmed = args.headerTitle.trim().slice(0, 60);
    const now = new Date().toISOString();

    // Batasi ketebalan garis pada rentang wajar (0.5–12 px) bila diberikan.
    const clampWidth = (w: number | undefined): number | undefined =>
      w === undefined ? undefined : Math.max(0.5, Math.min(12, w));

    const lineFields = {
      topLineShow: args.topLineShow,
      topLineColor: args.topLineColor?.trim() || undefined,
      topLineWidth: clampWidth(args.topLineWidth),
      bottomLineShow: args.bottomLineShow,
      bottomLineColor: args.bottomLineColor?.trim() || undefined,
      bottomLineWidth: clampWidth(args.bottomLineWidth),
    };

    const existing = await findRow(ctx, organizationId);

    // Tentukan logo final: hapus bila diminta, pakai yang baru bila diunggah,
    // atau pertahankan yang lama. Bersihkan file lama dari storage bila diganti.
    const resolveLogo = (): {
      logoStorageId: Id<"_storage"> | undefined;
      logoFileName: string | undefined;
    } => {
      if (args.removeLogo) {
        return { logoStorageId: undefined, logoFileName: undefined };
      }
      if (args.logoStorageId) {
        return { logoStorageId: args.logoStorageId, logoFileName: args.logoFileName };
      }
      return {
        logoStorageId: existing?.logoStorageId,
        logoFileName: existing?.logoFileName,
      };
    };
    const logo = resolveLogo();

    // Hapus berkas logo lama bila diganti dengan yang baru atau dihapus.
    const oldStorageId = existing?.logoStorageId;
    if (oldStorageId && oldStorageId !== logo.logoStorageId) {
      await ctx.storage.delete(oldStorageId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        headerTitle: trimmed,
        ...lineFields,
        logoStorageId: logo.logoStorageId,
        logoFileName: logo.logoFileName,
        updatedBy: user._id,
        updatedAt: now,
        // Tautkan baris legacy ke tenant saat ini bila belum tertaut.
        organizationId: existing.organizationId ?? organizationId ?? undefined,
      });
    } else {
      await ctx.db.insert("letterMemoSettings", {
        headerTitle: trimmed,
        ...lineFields,
        logoStorageId: logo.logoStorageId,
        logoFileName: logo.logoFileName,
        updatedBy: user._id,
        updatedAt: now,
        organizationId: organizationId ?? undefined,
      });
    }
  },
});
