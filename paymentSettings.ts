import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireTenant } from "./lib/tenant";

export type BankTransferSettings = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
};

const DEFAULT_INSTRUCTIONS =
  "Transfer sesuai nominal paket yang dipilih, lalu cantumkan nomor referensi/bukti transfer saat mendaftar. Aktivasi dilakukan setelah pembayaran diverifikasi Super Admin.";

async function requireSuperAdmin(
  ctx: Parameters<typeof requireTenant>[0],
): Promise<Id<"users">> {
  const { userId, isSuperAdmin } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });
  if (!isSuperAdmin) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya Super Admin yang dapat mengubah pengaturan pembayaran",
    });
  }
  return userId;
}

/**
 * Public: returns the FIRST active bank account shown during registration.
 * Kept for backward compatibility with older callers; new UI uses
 * `listActiveBankAccounts` to display every active account.
 */
export const getBankTransfer = query({
  args: {},
  handler: async (ctx): Promise<BankTransferSettings> => {
    const account = await ctx.db
      .query("bankAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (!account) {
      return {
        bankName: "",
        accountNumber: "",
        accountHolder: "",
        instructions: DEFAULT_INSTRUCTIONS,
      };
    }
    return {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      instructions: account.instructions ?? DEFAULT_INSTRUCTIONS,
    };
  },
});

export type BankAccount = {
  _id: Doc<"bankAccounts">["_id"];
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
  isActive: boolean;
};

function toBankAccount(doc: Doc<"bankAccounts">): BankAccount {
  return {
    _id: doc._id,
    bankName: doc.bankName,
    accountNumber: doc.accountNumber,
    accountHolder: doc.accountHolder,
    instructions: doc.instructions ?? "",
    isActive: doc.isActive,
  };
}

/** Public: every ACTIVE bank account, shown to registrants paying by transfer. */
export const listActiveBankAccounts = query({
  args: {},
  handler: async (ctx): Promise<BankAccount[]> => {
    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return accounts.map(toBankAccount);
  },
});

/** Super admin only: every bank account (active and inactive) for management. */
export const listBankAccounts = query({
  args: {},
  handler: async (ctx): Promise<BankAccount[]> => {
    await requireSuperAdmin(ctx);
    const accounts = await ctx.db.query("bankAccounts").collect();
    return accounts.map(toBankAccount);
  },
});

/** Super admin only: add a new bank account. */
export const addBankAccount = mutation({
  args: {
    bankName: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    instructions: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireSuperAdmin(ctx);
    const bankName = args.bankName.trim();
    const accountNumber = args.accountNumber.trim();
    const accountHolder = args.accountHolder.trim();
    if (!bankName || !accountNumber || !accountHolder) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama bank, nomor rekening, dan atas nama wajib diisi",
      });
    }
    await ctx.db.insert("bankAccounts", {
      bankName,
      accountNumber,
      accountHolder,
      instructions: args.instructions.trim(),
      isActive: args.isActive,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Super admin only: update an existing bank account. */
export const updateBankAccount = mutation({
  args: {
    id: v.id("bankAccounts"),
    bankName: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    instructions: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireSuperAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Rekening tidak ditemukan",
      });
    }
    const bankName = args.bankName.trim();
    const accountNumber = args.accountNumber.trim();
    const accountHolder = args.accountHolder.trim();
    if (!bankName || !accountNumber || !accountHolder) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama bank, nomor rekening, dan atas nama wajib diisi",
      });
    }
    await ctx.db.patch(args.id, {
      bankName,
      accountNumber,
      accountHolder,
      instructions: args.instructions.trim(),
      isActive: args.isActive,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Super admin only: delete a bank account. */
export const deleteBankAccount = mutation({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Rekening tidak ditemukan",
      });
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * DEPRECATED: kept so any stale client calls do not break. Writes to the first
 * active bank account if one exists, otherwise creates a new one.
 */
export const updateBankTransfer = mutation({
  args: {
    bankName: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    instructions: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireSuperAdmin(ctx);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("bankAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        bankName: args.bankName.trim(),
        accountNumber: args.accountNumber.trim(),
        accountHolder: args.accountHolder.trim(),
        instructions: args.instructions.trim(),
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("bankAccounts", {
        bankName: args.bankName.trim(),
        accountNumber: args.accountNumber.trim(),
        accountHolder: args.accountHolder.trim(),
        instructions: args.instructions.trim(),
        isActive: true,
        updatedBy: userId,
        updatedAt: now,
      });
    }
  },
});
