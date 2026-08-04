import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireTenant, isScopeBlocked, assertSameTenant } from "./lib/tenant";
import { isSuperAdminBlocked } from "./superAdminDataAccess";
import { notifyUser } from "./notifications";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  // requireTenant menghitung organisasi EFEKTIF: untuk super admin ini adalah
  // tenant yang sedang dipilih (viewingOrganizationId) — bukan organisasi milik
  // super admin itu sendiri. Kita timpa `organizationId` pada objek user yang
  // dikembalikan dengan nilai efektif ini, sehingga SEMUA penyaringan di bawah
  // (me.organizationId) otomatis mengikuti tenant yang sedang dipilih.
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  }
  return { ...user, organizationId: organizationId ?? undefined };
}

// Bangun teks gabungan untuk pencarian arsip: perihal + nomor surat + nomor
// agenda. Dipakai search index "search_text" agar surat bisa ditemukan lewat
// salah satu dari ketiganya.
function buildLetterSearchText(parts: {
  subject?: string | null;
  letterNumber?: string | null;
  agendaNumber?: string | null;
}): string {
  return [parts.subject, parts.letterNumber, parts.agendaNumber]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ")
    .trim();
}

async function pickUserFields(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined | null,
): Promise<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department"> | null> {
  if (!userId) return null;
  const u = await ctx.db.get(userId);
  if (!u) return null;
  return { _id: u._id, name: u.name, jobTitle: u.jobTitle, department: u.department };
}

async function pickUserFieldsShort(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined | null,
): Promise<Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null> {
  if (!userId) return null;
  const u = await ctx.db.get(userId);
  if (!u) return null;
  return { _id: u._id, name: u.name, jobTitle: u.jobTitle };
}

// Signer (pengirim) fields for the official document footer: includes
// department (departemen) and NIP so the signature block can render
// Jabatan, Departemen, tanda tangan, nama, NIP.
async function pickSignerFields(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined | null,
): Promise<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department" | "nip"> | null> {
  if (!userId) return null;
  const u = await ctx.db.get(userId);
  if (!u) return null;
  return { _id: u._id, name: u.name, jobTitle: u.jobTitle, department: u.department, nip: u.nip };
}

// Approver fields include email so the frontend can match the logged-in user
// even when the approval points to an imported (placeholder) directory record
// while the person signs in with a separate real account sharing that email.
async function pickApproverFields(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined | null,
): Promise<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "email"> | null> {
  if (!userId) return null;
  const u = await ctx.db.get(userId);
  if (!u) return null;
  return { _id: u._id, name: u.name, jobTitle: u.jobTitle, email: u.email };
}

// Returns the set of user ids that represent the current person: their own id
// plus any other user records (e.g. imported placeholder directory records)
// that share the same email address. Used so approvals assigned to a
// placeholder record still surface for the person's real signed-in account.
async function getMyUserIds(
  ctx: QueryCtx | MutationCtx,
  me: Doc<"users">,
): Promise<Set<Id<"users">>> {
  const ids = new Set<Id<"users">>([me._id]);
  const myEmail = me.email?.toLowerCase();
  if (myEmail) {
    const all = await ctx.db.query("users").collect();
    for (const u of all) {
      if (u.email && u.email.toLowerCase() === myEmail) ids.add(u._id);
    }
  }
  return ids;
}

// Returns true if the given approval belongs to the current user. Matches by
// user id first, then falls back to email so an approval assigned to an
// imported (placeholder) directory record still matches the person's real
// signed-in account when they share the same email address.
async function approvalBelongsToUser(
  ctx: QueryCtx | MutationCtx,
  approval: Doc<"letterApprovals">,
  me: Doc<"users">,
): Promise<boolean> {
  if (approval.approverId === me._id) return true;
  const myEmail = me.email?.toLowerCase();
  if (!myEmail) return false;
  const approver = await ctx.db.get(approval.approverId);
  return !!approver?.email && approver.email.toLowerCase() === myEmail;
}

// Determines whether the current user is allowed to see a given letter, based
// on the letter's stage in the approval flow. Implements the tiered privacy
// rules for the drafting flow (keluar/internal/memo):
//   - draft/revision/rejected : only the konseptor (author)
//   - review                  : ONLY the approver whose turn it currently is
//                               (pemeriksa, then penyetuju) — not the author,
//                               not approvers who already acted or are waiting
//   - frozen                  : author + every assigned approver (arsip mati)
//   - approved/sent/archived  : all participants — author, every approver,
//                               recipient, and tembusan (CC)
// Incoming letters (masuk) are not part of the drafting flow, so they stay
// visible to their author, recipient, PIC, CC, and disposition chain.
// Admins and super admins always see everything (org scope handled by caller).
// Returns true if any of the caller's ids are a bulk recipient (letterRecipients)
// of the given letter. Cheap: scans the small per-letter roster via index.
async function isBulkRecipientOf(
  ctx: QueryCtx | MutationCtx,
  letterId: Id<"letters">,
  myIds: Set<Id<"users">>,
): Promise<boolean> {
  const rows = await ctx.db
    .query("letterRecipients")
    .withIndex("by_letter", (q) => q.eq("letterId", letterId))
    .collect();
  return rows.some((r) => myIds.has(r.userId));
}

async function canViewLetter(
  ctx: QueryCtx | MutationCtx,
  letter: Doc<"letters">,
  me: Doc<"users">,
  myIds: Set<Id<"users">>,
): Promise<boolean> {
  if (me.role === "super_admin" || me.role === "admin") return true;

  const isAuthor = myIds.has(letter.authorId);
  const isRecipient = !!letter.toUserId && myIds.has(letter.toUserId);
  const isCc = (letter.ccUserIds ?? []).some((id) => myIds.has(id));

  // Penerima massal (surat dikirim ke banyak orang / departemen / seluruh
  // karyawan): setiap orang dalam daftar letterRecipients berhak melihatnya.
  const isBulkRecipient = await isBulkRecipientOf(ctx, letter._id, myIds);

  // Incoming letters: visible to everyone directly connected to handling it.
  if (letter.type === "masuk") {
    if (isAuthor || isRecipient || isCc || isBulkRecipient) return true;
    if (letter.picId && myIds.has(letter.picId)) return true;
    const disps = await ctx.db
      .query("letterDispositions")
      .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
      .collect();
    return disps.some((d) => myIds.has(d.toUserId) || myIds.has(d.fromUserId));
  }

  const status = letter.status;

  // Draft / sedang direvisi / ditolak: only the konseptor who owns it.
  if (status === "draft" || status === "revision" || status === "rejected") {
    return isAuthor;
  }

  // Final states: every participant may see it.
  if (status === "approved" || status === "sent" || status === "archived") {
    if (isAuthor || isRecipient || isCc || isBulkRecipient) return true;
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
      .collect();
    return approvals.some((a) => myIds.has(a.approverId));
  }

  // Frozen (arsip mati): author + every assigned approver, but never recipients.
  if (status === "frozen") {
    if (isAuthor) return true;
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
      .collect();
    return approvals.some((a) => myIds.has(a.approverId));
  }

  // Under review: the konseptor who owns it may always track it, plus the
  // approver whose turn it currently is, plus any approver who has ALREADY
  // acted on it (approved and forwarded) so they can keep monitoring its
  // progress. Approvers who are still waiting their turn cannot see it yet.
  if (status === "review") {
    if (isAuthor) return true;
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
      .collect();
    return approvals.some(
      (a) =>
        myIds.has(a.approverId) &&
        (a.status === "pending" || a.status === "approved" || a.status === "rejected"),
    );
  }

  return isAuthor;
}

async function addHistory(
  ctx: MutationCtx,
  letterId: Id<"letters">,
  actorId: Id<"users">,
  action: string,
  detail?: string,
): Promise<void> {
  await ctx.db.insert("letterHistory", {
    letterId,
    actorId,
    action,
    detail,
    occurredAt: new Date().toISOString(),
  });
}

// Short label for a letter, used in notification titles/messages.
function letterTypeLabel(type: string): string {
  const map: Record<string, string> = {
    keluar: "Surat Keluar",
    masuk: "Surat Masuk",
    internal: "Surat Internal",
    memo: "Nota",
  };
  return map[type] ?? "Surat";
}

// Deep link that opens a specific letter in the Kelola Surat page.
function letterLink(letterId: Id<"letters">): string {
  return `/letters?letterId=${letterId}`;
}

// Notify a single user about a letter-flow event. Safe no-op when userId is
// missing or equals the actor (handled inside notifyUser).
async function notifyLetterUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users"> | undefined | null;
    actorId: Id<"users">;
    letter: Doc<"letters">;
    type: string;
    title: string;
    message: string;
  },
): Promise<void> {
  if (!args.userId) return;
  await notifyUser(ctx, {
    userId: args.userId,
    actorId: args.actorId,
    type: args.type,
    title: args.title,
    message: args.message,
    link: letterLink(args.letter._id),
  });
}

// Collects every distinct participant of a letter: author, recipient, every
// approver, and all internal tembusan (CC). Used to broadcast the "surat
// selesai" notification. Excludes duplicates.
async function collectLetterParticipants(
  ctx: MutationCtx,
  letter: Doc<"letters">,
): Promise<Set<Id<"users">>> {
  const ids = new Set<Id<"users">>();
  ids.add(letter.authorId);
  if (letter.toUserId) ids.add(letter.toUserId);
  for (const cc of letter.ccUserIds ?? []) ids.add(cc);
  const approvals = await ctx.db
    .query("letterApprovals")
    .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
    .collect();
  for (const a of approvals) ids.add(a.approverId);
  // Penerima massal (bila ada).
  const recipients = await ctx.db
    .query("letterRecipients")
    .withIndex("by_letter", (q) => q.eq("letterId", letter._id))
    .collect();
  for (const r of recipients) ids.add(r.userId);
  return ids;
}

// --- Penerima massal (bulk recipients) -------------------------------------
// Menyelesaikan daftar userId penerima berdasarkan mode pemilihan, dengan
// menghormati batasan organisasi (tenant) dan isolasi akun uji yang sama
// seperti direktori karyawan. Mengecualikan pengirim (author) sendiri,
// super_admin, dan akun uji (kecuali pemanggil sendiri akun uji).
type BulkRecipientMode = "department" | "all";

async function resolveGroupRecipientIds(
  ctx: QueryCtx | MutationCtx,
  author: Doc<"users">,
  mode: BulkRecipientMode,
  department: string | undefined,
): Promise<Id<"users">[]> {
  const orgId = author.organizationId;
  const authorIsTest = author.isTestAccount === true;

  const all = await ctx.db.query("users").collect();
  const filtered = all.filter((u) => {
    if (u._id === author._id) return false; // jangan kirim ke diri sendiri
    if (u.role === "super_admin") return false;
    // Isolasi tenant: harus organisasi yang sama. Super admin tanpa izin aktif
    // (orgId null) tidak menjangkau siapa pun lintas organisasi.
    if (u.organizationId !== orgId) return false;
    // Isolasi akun uji: akun uji hanya menjangkau akun uji; sebaliknya kecualikan.
    if (u.isTestAccount === true) {
      if (!authorIsTest) return false;
    } else if (authorIsTest) {
      return false;
    }
    if (mode === "department") {
      if (!department) return false;
      return (u.department ?? "") === department;
    }
    return true; // mode "all"
  });

  return filtered.map((u) => u._id);
}

// Menulis daftar penerima ke tabel letterRecipients untuk satu surat.
// Mengganti daftar lama (bila ada) agar edit konsep tetap konsisten.
async function replaceLetterRecipients(
  ctx: MutationCtx,
  letterId: Id<"letters">,
  entries: Array<{ userId: Id<"users">; source: string; groupLabel?: string }>,
): Promise<void> {
  const existing = await ctx.db
    .query("letterRecipients")
    .withIndex("by_letter", (q) => q.eq("letterId", letterId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  const now = new Date().toISOString();
  // Deduplikasi berdasarkan userId (pertahankan entri pertama).
  const seen = new Set<Id<"users">>();
  for (const e of entries) {
    if (seen.has(e.userId)) continue;
    seen.add(e.userId);
    const u = await ctx.db.get(e.userId);
    await ctx.db.insert("letterRecipients", {
      letterId,
      userId: e.userId,
      organizationId: u?.organizationId,
      source: e.source,
      groupLabel: e.groupLabel,
      deliveredAt: now,
    });
  }
}

// Terapkan pilihan penerima massal ke sebuah surat: menyelesaikan daftar
// penerima sesuai mode, menuliskannya ke letterRecipients, dan menyimpan
// recipientMode/recipientDepartment pada dokumen surat. Bila mode kosong atau
// "individual" tanpa daftar, daftar penerima massal dikosongkan (surat kembali
// menjadi penerima tunggal biasa).
async function applyBulkRecipients(
  ctx: MutationCtx,
  letterId: Id<"letters">,
  author: Doc<"users">,
  opts: {
    mode: string | undefined;
    department: string | undefined;
    userIds: Id<"users">[] | undefined;
  },
): Promise<void> {
  const mode = opts.mode;

  // Tidak ada pengiriman massal → bersihkan daftar & tanda mode.
  if (!mode || mode === "single") {
    await replaceLetterRecipients(ctx, letterId, []);
    await ctx.db.patch(letterId, {
      recipientMode: undefined,
      recipientDepartment: undefined,
    });
    return;
  }

  let entries: Array<{ userId: Id<"users">; source: string; groupLabel?: string }> = [];
  let department: string | undefined;

  if (mode === "individual") {
    const ids = opts.userIds ?? [];
    entries = ids.map((userId) => ({ userId, source: "individual" }));
  } else if (mode === "department") {
    department = opts.department?.trim() || undefined;
    const ids = await resolveGroupRecipientIds(ctx, author, "department", department);
    entries = ids.map((userId) => ({ userId, source: "department", groupLabel: department }));
  } else if (mode === "all") {
    const ids = await resolveGroupRecipientIds(ctx, author, "all", undefined);
    entries = ids.map((userId) => ({ userId, source: "all" }));
  }

  await replaceLetterRecipients(ctx, letterId, entries);
  await ctx.db.patch(letterId, {
    recipientMode: mode,
    recipientDepartment: mode === "department" ? department : undefined,
  });
}

// Generates a short, human-readable, URL-safe verification code (no ambiguous
// characters). Used for QR-based letter authenticity verification.
async function generateUniqueVerificationCode(ctx: MutationCtx): Promise<string> {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const make = () => {
    let s = "";
    for (let i = 0; i < 10; i++) {
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  };
  // Retry a few times to avoid the (extremely unlikely) collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = make();
    const existing = await ctx.db
      .query("letters")
      .withIndex("by_verification_code", (q) => q.eq("verificationCode", code))
      .first();
    if (!existing) return code;
  }
  // Fallback: append a timestamp fragment for guaranteed uniqueness.
  return `${make()}-${Date.now().toString(36).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export const listLetters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAuth(ctx);
    // Super admin data-access gate: when blocked, return an empty page.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    // Scoped consent gate: a vendor viewing this company must have the
    // "Surat & Dokumen" scope approved, otherwise see nothing.
    if (await isScopeBlocked(ctx, "letters_documents")) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    // Scope results to the caller's organization. super_admin (orgId = null/undefined)
    // sees all letters; regular users only see letters from their own organization.
    // Legacy letters without an organizationId are treated as unscoped (accessible to all).
    const orgId = me.organizationId;

    // Test/simulation letters act as an isolated sandbox:
    // - super_admin sees every letter (no test filtering).
    // - a test account sees ONLY letters authored by test accounts.
    // - a regular employee sees ONLY letters NOT authored by test accounts.
    const callerIsSuperAdmin = me.role === "super_admin";
    const callerIsTestAccount = me.isTestAccount === true;
    let testAuthorIds = new Set<Id<"users">>();
    if (!callerIsSuperAdmin) {
      const allUsers = await ctx.db.query("users").collect();
      testAuthorIds = new Set(
        allUsers.filter((u) => u.isTestAccount === true).map((u) => u._id),
      );
    }

    // All user ids that represent the caller (own id + shared-email placeholders),
    // used for stage-based visibility checks.
    const myIds = await getMyUserIds(ctx, me);

    const filterPage = (page: Doc<"letters">[]) => {
      // A super admin without an active grant has no org in scope and must see
      // no letters (never cross-org). Regular users always have an org.
      if (!orgId) return [];
      let scoped = page.filter(
        (l) => !l.organizationId || l.organizationId === orgId,
      );
      if (!callerIsSuperAdmin) {
        scoped = callerIsTestAccount
          ? scoped.filter((l) => testAuthorIds.has(l.authorId))
          : scoped.filter((l) => !testAuthorIds.has(l.authorId));
      }
      return scoped;
    };

    // Enriches each visible letter with the caller's read state so the UI can
    // render unread letters in bold and read letters normally. Also enforces the
    // stage-based privacy rules so a letter only appears to the people entitled
    // to see it at its current stage in the approval flow.
    const enrichPage = async (
      page: Doc<"letters">[],
    ): Promise<Array<Doc<"letters"> & { isRead: boolean }>> => {
      const scoped = filterPage(page);
      const visible: Doc<"letters">[] = [];
      for (const l of scoped) {
        if (await canViewLetter(ctx, l, me, myIds)) visible.push(l);
      }
      return Promise.all(
        visible.map(async (l) => {
          const read = await ctx.db
            .query("letterReads")
            .withIndex("by_user_and_letter", (q) =>
              q.eq("userId", me._id).eq("letterId", l._id),
            )
            .unique();
          return { ...l, isRead: read !== null };
        }),
      );
    };

    // Search path — cari lewat teks gabungan (perihal + nomor surat + nomor agenda).
    if (args.search && args.search.trim() !== "") {
      const results = await ctx.db
        .query("letters")
        .withSearchIndex("search_text", (q) => {
          let sq = q.search("searchText", args.search!);
          if (args.type) sq = sq.eq("type", args.type);
          if (args.status) sq = sq.eq("status", args.status);
          if (args.category) sq = sq.eq("category", args.category);
          return sq;
        })
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }

    // Index path
    if (args.type && args.status) {
      const results = await ctx.db
        .query("letters")
        .withIndex("by_type_and_status", (q) =>
          q.eq("type", args.type!).eq("status", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }
    if (args.type) {
      const results = await ctx.db
        .query("letters")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }
    if (args.status) {
      const results = await ctx.db
        .query("letters")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }

    const results = await ctx.db.query("letters").order("desc").paginate(args.paginationOpts);
    return { ...results, page: await enrichPage(results.page) };
  },
});

// Halaman "Arsip Surat": daftar surat yang sudah dibekukan arsip PDF permanennya
// (dibuat otomatis saat surat dikirim/difinalkan). Mengembalikan tautan unduh PDF
// untuk tiap surat sehingga dapat diunduh langsung dari daftar.
type ArchivedLetter = Doc<"letters"> & {
  archiveUrl: string | null;
};

export const listArchivedLetters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: ArchivedLetter[];
    isDone: boolean;
    continueCursor: string;
  }> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    if (await isScopeBlocked(ctx, "letters_documents")) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const orgId = me.organizationId;
    const callerIsSuperAdmin = me.role === "super_admin";
    const callerIsTestAccount = me.isTestAccount === true;
    let testAuthorIds = new Set<Id<"users">>();
    if (!callerIsSuperAdmin) {
      const allUsers = await ctx.db.query("users").collect();
      testAuthorIds = new Set(
        allUsers.filter((u) => u.isTestAccount === true).map((u) => u._id),
      );
    }
    const myIds = await getMyUserIds(ctx, me);

    // Only letters with a frozen archive PDF qualify as "arsip".
    const isArchived = (l: Doc<"letters">) => !!l.archivePdfStorageId;

    const enrichPage = async (
      page: Doc<"letters">[],
    ): Promise<ArchivedLetter[]> => {
      // No org in scope (super admin without an active grant) → nothing.
      if (!orgId) return [];
      let scoped = page.filter(
        (l) => !l.organizationId || l.organizationId === orgId,
      );
      if (!callerIsSuperAdmin) {
        scoped = callerIsTestAccount
          ? scoped.filter((l) => testAuthorIds.has(l.authorId))
          : scoped.filter((l) => !testAuthorIds.has(l.authorId));
      }
      scoped = scoped.filter(isArchived);
      const visible: Doc<"letters">[] = [];
      for (const l of scoped) {
        if (await canViewLetter(ctx, l, me, myIds)) visible.push(l);
      }
      return Promise.all(
        visible.map(async (l) => ({
          ...l,
          archiveUrl: l.archivePdfStorageId
            ? await ctx.storage.getUrl(l.archivePdfStorageId)
            : null,
        })),
      );
    };

    // Search path — cari lewat teks gabungan (perihal + nomor surat + nomor agenda).
    if (args.search && args.search.trim() !== "") {
      const results = await ctx.db
        .query("letters")
        .withSearchIndex("search_text", (q) => {
          let sq = q.search("searchText", args.search!);
          if (args.type) sq = sq.eq("type", args.type);
          return sq;
        })
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }

    if (args.type) {
      const results = await ctx.db
        .query("letters")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }

    const results = await ctx.db
      .query("letters")
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...results, page: await enrichPage(results.page) };
  },
});

type LetterDetail = {
  letter: Doc<"letters">;
  author: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department"> | null;
  pic: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
  fromUser: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department" | "nip"> | null;
  toUser: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
  attachments: Doc<"letterAttachments">[];
  dispositions: Array<
    Doc<"letterDispositions"> & {
      toUser: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
      fromUser: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
    }
  >;
  approvals: Array<
    Doc<"letterApprovals"> & {
      approver: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "email"> | null;
    }
  >;
  history: Array<
    Doc<"letterHistory"> & { actor: Pick<Doc<"users">, "_id" | "name"> | null }
  >;
  letterhead: (Doc<"letterheads"> & { logoUrl: string | null }) | null;
  ccUsers: Array<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department">>;
  physicalDocUrl: string | null;
  authorSignature: string | null; // base64 signature of the author
};

export const getLetter = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<LetterDetail | null> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return null;
    }
    if (await isScopeBlocked(ctx, "letters_documents")) {
      return null;
    }

    const letter = await ctx.db.get(args.letterId);
    if (!letter) return null;

    // Org scope: a super admin without an active grant (organizationId === null)
    // must not open any org-scoped letter. Legacy letters without an org stay
    // accessible.
    if (letter.organizationId && letter.organizationId !== me.organizationId) {
      return null;
    }

    // Enforce stage-based visibility: a letter's detail is only accessible to
    // the people entitled to see it at its current stage.
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return null;

    const [author, pic, attachments, rawDispositions, rawApprovals, rawHistory, letterhead] =
      await Promise.all([
        pickUserFields(ctx, letter.authorId),
        pickUserFieldsShort(ctx, letter.picId),
        ctx.db
          .query("letterAttachments")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .collect(),
        ctx.db
          .query("letterDispositions")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .collect(),
        ctx.db
          .query("letterApprovals")
          .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
          .order("asc")
          .collect(),
        ctx.db
          .query("letterHistory")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .order("desc")
          .collect(),
        letter.letterheadId ? ctx.db.get(letter.letterheadId) : Promise.resolve(null),
      ]);

    const dispositions = await Promise.all(
      rawDispositions.map(async (d) => ({
        ...d,
        toUser: await pickUserFieldsShort(ctx, d.toUserId),
        fromUser: await pickUserFieldsShort(ctx, d.fromUserId),
      })),
    );

    const approvals = await Promise.all(
      rawApprovals.map(async (a) => ({
        ...a,
        approver: await pickApproverFields(ctx, a.approverId),
      })),
    );

    const history = await Promise.all(
      rawHistory.map(async (h) => {
        const actor = await ctx.db.get(h.actorId);
        return {
          ...h,
          actor: actor ? { _id: actor._id, name: actor.name } : null,
        };
      }),
    );

    // Resolve letterhead logo URL
    const letterheadWithLogo = letterhead
      ? { ...letterhead, logoUrl: letterhead.logoStorageId ? await ctx.storage.getUrl(letterhead.logoStorageId) : null }
      : null;

    return { letter, author, pic, attachments, dispositions, approvals, history, letterhead: letterheadWithLogo,
      fromUser: null,
      toUser: null,
      ccUsers: [],
      physicalDocUrl: null,
      authorSignature: null,
    };
  },
});

// Separate query to get the physical doc URL (needs storage.getUrl which is async)
export const getLetterWithExtras = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<LetterDetail | null> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return null;
    }
    if (await isScopeBlocked(ctx, "letters_documents")) {
      return null;
    }

    const letter = await ctx.db.get(args.letterId);
    if (!letter) return null;

    // Org scope: a super admin without an active grant cannot open org-scoped
    // letters (see getLetter).
    if (letter.organizationId && letter.organizationId !== me.organizationId) {
      return null;
    }

    // Enforce stage-based visibility (same rule as getLetter).
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return null;

    const [author, pic, attachments, rawDispositions, rawApprovals, rawHistory, letterhead] =
      await Promise.all([
        pickUserFields(ctx, letter.authorId),
        pickUserFieldsShort(ctx, letter.picId),
        ctx.db
          .query("letterAttachments")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .collect(),
        ctx.db
          .query("letterDispositions")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .collect(),
        ctx.db
          .query("letterApprovals")
          .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
          .order("asc")
          .collect(),
        ctx.db
          .query("letterHistory")
          .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
          .order("desc")
          .collect(),
        letter.letterheadId ? ctx.db.get(letter.letterheadId) : Promise.resolve(null),
      ]);

    const dispositions = await Promise.all(
      rawDispositions.map(async (d) => ({
        ...d,
        toUser: await pickUserFieldsShort(ctx, d.toUserId),
        fromUser: await pickUserFieldsShort(ctx, d.fromUserId),
      })),
    );

    const approvals = await Promise.all(
      rawApprovals.map(async (a) => ({
        ...a,
        approver: await pickApproverFields(ctx, a.approverId),
      })),
    );

    const history = await Promise.all(
      rawHistory.map(async (h) => {
        const actor = await ctx.db.get(h.actorId);
        return {
          ...h,
          actor: actor ? { _id: actor._id, name: actor.name } : null,
        };
      }),
    );

    // Resolve CC users
    const ccUsers: Array<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department">> = [];
    for (const uid of letter.ccUserIds ?? []) {
      const u = await ctx.db.get(uid);
      if (u) ccUsers.push({ _id: u._id, name: u.name, jobTitle: u.jobTitle, department: u.department });
    }

    // Resolve fromUser and toUser
    const fromUser = await pickSignerFields(ctx, letter.fromUserId);
    const toUser = await pickUserFieldsShort(ctx, letter.toUserId);

    // Physical doc URL
    let physicalDocUrl: string | null = null;
    if (letter.physicalDocStorageId) {
      physicalDocUrl = await ctx.storage.getUrl(letter.physicalDocStorageId);
    }

    // Resolve letterhead logo URL
    const letterheadWithLogo = letterhead
      ? { ...letterhead, logoUrl: letterhead.logoStorageId ? await ctx.storage.getUrl(letterhead.logoStorageId) : null }
      : null;

    // Resolve the SENDER's (pengirim) signature for the official document.
    // The signature block on letters is signed by the sender, not the author/
    // konseptor. Priority: (1) a signature the sender saved specifically for
    // THIS letter, then (2) the sender's saved default signature from their
    // profile. Falls back to the author's letter-specific signature for older
    // letters that predate the sender-based logic.
    const signerUserId = letter.fromUserId ?? letter.authorId;
    let signatureData: string | null = null;
    const senderLetterSig = await ctx.db
      .query("letterSignatures")
      .withIndex("by_letter_and_user", (q) =>
        q.eq("letterId", args.letterId).eq("userId", signerUserId),
      )
      .first();
    if (senderLetterSig) {
      signatureData = senderLetterSig.signatureData;
    } else {
      const senderUser = await ctx.db.get(signerUserId);
      signatureData = senderUser?.defaultSignature ?? null;
    }
    // Fallback for legacy letters: author's letter-specific signature.
    if (!signatureData && signerUserId !== letter.authorId) {
      const authorSig = await ctx.db
        .query("letterSignatures")
        .withIndex("by_letter_and_user", (q) =>
          q.eq("letterId", args.letterId).eq("userId", letter.authorId),
        )
        .first();
      signatureData = authorSig?.signatureData ?? null;
    }

    return { letter, author, pic, attachments, dispositions, approvals, history, letterhead: letterheadWithLogo, ccUsers, physicalDocUrl, authorSignature: signatureData, fromUser, toUser };
  },
});

// Resolve a temporary download URL for a single letter attachment. The URL is
// generated on demand (rather than embedded in the letter detail) so it stays
// fresh and is only produced for users allowed to view the letter.
export const getAttachmentUrl = query({
  args: { attachmentId: v.id("letterAttachments") },
  handler: async (ctx, args): Promise<{ url: string; fileName: string } | null> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return null;
    }

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) return null;

    const letter = await ctx.db.get(attachment.letterId);
    if (!letter) return null;

    // Only users who can view the parent letter may download its attachments.
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return null;

    const url = await ctx.storage.getUrl(attachment.storageId);
    if (!url) return null;

    return { url, fileName: attachment.fileName };
  },
});

export const listDispositions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    if (args.status) {
      return await ctx.db
        .query("letterDispositions")
        .withIndex("by_to_user_and_status", (q) =>
          q.eq("toUserId", me._id).eq("status", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("letterDispositions")
      .withIndex("by_to_user", (q) => q.eq("toUserId", me._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listApprovals = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const myIds = await getMyUserIds(ctx, me);
    const result = await ctx.db
      .query("letterApprovals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.filter((a) => myIds.has(a.approverId)),
    };
  },
});

export const listLetterheads = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"letterheads"> & { logoUrl: string | null }>> => {
    const me = await requireAuth(ctx);
    // Scope kop surat ke organisasi pemanggil. Super admin tanpa grant aktif
    // (organizationId null/undefined) tidak melihat kop surat milik tenant mana pun.
    // Kop surat lama tanpa organizationId diperlakukan sebagai global (kompatibilitas),
    // namun idealnya sudah di-backfill ke organisasinya masing-masing.
    const orgId = me.organizationId;
    if (!orgId) return [];
    const all = await ctx.db.query("letterheads").collect();
    const scoped = all.filter((lh) => !lh.organizationId || lh.organizationId === orgId);
    return await Promise.all(
      scoped.map(async (lh) => ({
        ...lh,
        logoUrl: lh.logoStorageId ? await ctx.storage.getUrl(lh.logoStorageId) : null,
      }))
    );
  },
});

type LetterStats = {
  totalMasuk: number;
  totalKeluar: number;
  draft: number;
  pendingApproval: number;
  disposisiPending: number;
};

export const getLetterStats = query({
  args: {},
  handler: async (ctx): Promise<LetterStats> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return {
        totalMasuk: 0,
        totalKeluar: 0,
        draft: 0,
        pendingApproval: 0,
        disposisiPending: 0,
      };
    }
    // Scope letter counts to the caller's organization (same legacy-doc logic as listLetters).
    const orgId = me.organizationId;

    // Hide test/simulation letters from regular employees (same rule as listLetters).
    const callerIsSuperAdmin = me.role === "super_admin";
    const callerIsTestAccount = me.isTestAccount === true;
    let testAuthorIds = new Set<Id<"users">>();
    if (!callerIsSuperAdmin) {
      const allUsers = await ctx.db.query("users").collect();
      testAuthorIds = new Set(
        allUsers.filter((u) => u.isTestAccount === true).map((u) => u._id),
      );
    }

    const filterLetters = (items: Doc<"letters">[]) => {
      // Sejajarkan dengan listLetters: jika tidak ada organisasi dalam cakupan
      // (mis. super admin tanpa grant aktif), jangan hitung surat apa pun agar
      // statistik konsisten dengan daftar surat di setiap tab.
      if (!orgId) return [];
      let scoped = items.filter(
        (l) => !l.organizationId || l.organizationId === orgId,
      );
      if (!callerIsSuperAdmin) {
        scoped = callerIsTestAccount
          ? scoped.filter((l) => testAuthorIds.has(l.authorId))
          : scoped.filter((l) => !testAuthorIds.has(l.authorId));
      }
      return scoped;
    };

    const [masuk, keluar, drafts, allPendingApprovals, disposisiPending] = await Promise.all([
      ctx.db
        .query("letters")
        .withIndex("by_type", (q) => q.eq("type", "masuk"))
        .collect(),
      ctx.db
        .query("letters")
        .withIndex("by_type", (q) => q.eq("type", "keluar"))
        .collect(),
      ctx.db
        .query("letters")
        .withIndex("by_status", (q) => q.eq("status", "draft"))
        .collect(),
      ctx.db
        .query("letterApprovals")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("letterDispositions")
        .withIndex("by_to_user_and_status", (q) =>
          q.eq("toUserId", me._id).eq("status", "pending"),
        )
        .collect(),
    ]);

    // Match pending approvals to the current person by id or shared email so
    // approvals assigned to imported (placeholder) records still count.
    const myIds = await getMyUserIds(ctx, me);
    const pendingApproval = allPendingApprovals.filter((a) => myIds.has(a.approverId));

    // Apply stage-based visibility so counts only reflect letters the caller is
    // actually entitled to see at their current stage.
    const visibleCount = async (items: Doc<"letters">[]): Promise<number> => {
      const scoped = filterLetters(items);
      let n = 0;
      for (const l of scoped) {
        if (await canViewLetter(ctx, l, me, myIds)) n += 1;
      }
      return n;
    };

    return {
      totalMasuk: await visibleCount(masuk),
      totalKeluar: await visibleCount(keluar),
      draft: await visibleCount(drafts),
      pendingApproval: pendingApproval.length,
      disposisiPending: disposisiPending.length,
    };
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

export const createLetter = mutation({
  args: {
    type: v.string(),
    subject: v.string(),
    place: v.optional(v.string()),
    letterDate: v.string(),
    classification: v.string(),
    fromName: v.string(),
    fromUserId: v.optional(v.id("users")),
    fromOrganization: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    toName: v.string(),
    toUserId: v.optional(v.id("users")),
    toJobTitle: v.optional(v.string()),
    toOrganization: v.optional(v.string()),
    toAddress: v.optional(v.string()),
    content: v.string(),
    category: v.string(),
    letterheadId: v.optional(v.id("letterheads")),
    picId: v.optional(v.id("users")),
    replyToId: v.optional(v.id("letters")),
    retentionDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    agendaNumber: v.optional(v.string()),
    letterNumber: v.optional(v.string()),
    ccUserIds: v.optional(v.array(v.id("users"))),
    ccExternal: v.optional(v.array(v.string())),
    physicalDocStorageId: v.optional(v.id("_storage")),
    physicalDocFileName: v.optional(v.string()),
    isPhysical: v.optional(v.boolean()),
    receivedAt: v.optional(v.string()),
    // Metode tanda tangan: "digital" (default) atau "basah" (manual).
    signatureMethod: v.optional(v.string()),
    // Pengiriman massal (opsional). recipientMode:
    //   "individual" → recipientUserIds berisi daftar userId terpilih
    //   "department" → recipientDepartment berisi nama departemen
    //   "all"        → seluruh karyawan organisasi
    recipientMode: v.optional(v.string()),
    recipientDepartment: v.optional(v.string()),
    recipientUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<Id<"letters">> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    // Pisahkan field pengiriman massal dari field surat.
    const { recipientUserIds, ...letterFields } = args;

    const letterId = await ctx.db.insert("letters", {
      ...letterFields,
      status: "draft",
      authorId: me._id,
      // Tautkan surat ke tenant pembuatnya agar hanya muncul di tenant tersebut.
      organizationId: me.organizationId,
      attachmentCount: 0,
      dispositionCount: 0,
      searchText: buildLetterSearchText({
        subject: letterFields.subject,
        letterNumber: letterFields.letterNumber,
        agendaNumber: letterFields.agendaNumber,
      }),
    });

    // Simpan daftar penerima massal (bila mode diberikan) agar tersimpan di konsep.
    await applyBulkRecipients(ctx, letterId, me, {
      mode: args.recipientMode,
      department: args.recipientDepartment,
      userIds: recipientUserIds,
    });

    await addHistory(ctx, letterId, me._id, "created", `Surat dibuat dengan status draft`);

    return letterId;
  },
});

export const updateLetter = mutation({
  args: {
    letterId: v.id("letters"),
    type: v.optional(v.string()),
    subject: v.optional(v.string()),
    place: v.optional(v.string()),
    letterDate: v.optional(v.string()),
    classification: v.optional(v.string()),
    fromName: v.optional(v.string()),
    fromUserId: v.optional(v.id("users")),
    fromOrganization: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    toName: v.optional(v.string()),
    toUserId: v.optional(v.id("users")),
    toJobTitle: v.optional(v.string()),
    toOrganization: v.optional(v.string()),
    toAddress: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    letterheadId: v.optional(v.id("letterheads")),
    picId: v.optional(v.id("users")),
    retentionDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    agendaNumber: v.optional(v.string()),
    letterNumber: v.optional(v.string()),
    ccUserIds: v.optional(v.array(v.id("users"))),
    ccExternal: v.optional(v.array(v.string())),
    physicalDocStorageId: v.optional(v.id("_storage")),
    physicalDocFileName: v.optional(v.string()),
    receivedAt: v.optional(v.string()),
    // Metode tanda tangan: "digital" (default) atau "basah" (manual).
    signatureMethod: v.optional(v.string()),
    // Pengiriman massal (opsional). Bila recipientMode diberikan, daftar
    // penerima massal surat akan disetel ulang sesuai mode.
    recipientMode: v.optional(v.string()),
    recipientDepartment: v.optional(v.string()),
    recipientUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const {
      letterId,
      recipientMode,
      recipientDepartment,
      recipientUserIds,
      ...fields
    } = args;
    const letter = await ctx.db.get(letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (letter.authorId !== me._id && me.role !== "admin" && me.role !== "super_admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }
    // Prinsip GCG (integritas & non-repudiation): surat yang sudah final
    // (terkirim/disetujui/diarsipkan) dikunci total dan TIDAK dapat diedit oleh
    // peran mana pun, termasuk super_admin. Koreksi harus melalui Surat Ralat baru.
    // Hanya surat berstatus draft/rejected/revision yang boleh diedit.
    if (!["draft", "rejected", "revision"].includes(letter.status)) {
      throw new ConvexError({
        message:
          "Surat yang sudah final tidak dapat diedit. Terbitkan Surat Ralat/Pembetulan untuk melakukan koreksi.",
        code: "BAD_REQUEST",
      });
    }

    // Filter out undefined values so patch only sets provided fields
    const patch: Partial<typeof fields> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) {
        (patch as Record<string, unknown>)[k] = val;
      }
    }

    // Perbarui teks pencarian bila perihal/nomor surat/nomor agenda berubah.
    if (
      fields.subject !== undefined ||
      fields.letterNumber !== undefined ||
      fields.agendaNumber !== undefined
    ) {
      (patch as Record<string, unknown>).searchText = buildLetterSearchText({
        subject: fields.subject ?? letter.subject,
        letterNumber: fields.letterNumber ?? letter.letterNumber,
        agendaNumber: fields.agendaNumber ?? letter.agendaNumber,
      });
    }

    await ctx.db.patch(letterId, patch);

    // Perbarui daftar penerima massal hanya bila mode disertakan dalam permintaan.
    if (recipientMode !== undefined) {
      await applyBulkRecipients(ctx, letterId, me, {
        mode: recipientMode,
        department: recipientDepartment,
        userIds: recipientUserIds,
      });
    }

    await addHistory(ctx, letterId, me._id, "updated", "Isi surat diperbarui");
  },
});

// Save draft approvers (pemeriksa & penyetuju) while letter is still in draft status.
// Replaces any existing approvals for the letter so edits are reflected correctly.
export const saveDraftApprovers = mutation({
  args: {
    letterId: v.id("letters"),
    approverSteps: v.array(v.object({
      userId: v.id("users"),
      role: v.string(),
      label: v.string(),
      order: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    if (letter.authorId !== me._id) {
      throw new ConvexError({ message: "Hanya konseptor yang dapat mengubah rantai persetujuan", code: "FORBIDDEN" });
    }
    if (letter.status !== "draft") {
      throw new ConvexError({ message: "Rantai persetujuan hanya dapat diubah pada surat berstatus draft", code: "BAD_REQUEST" });
    }
    // Delete existing approvals for this letter
    const existing = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .collect();
    for (const a of existing) {
      await ctx.db.delete(a._id);
    }
    // Insert new draft approvals with status "waiting"
    for (const step of args.approverSteps) {
      await ctx.db.insert("letterApprovals", {
        letterId: args.letterId,
        approverId: step.userId,
        order: step.order,
        status: "waiting",
        approvalRole: step.role,
        approvalLabel: step.label,
      });
    }
  },
});

export const submitForApproval = mutation({
  args: {
    letterId: v.id("letters"),
    approverIds: v.array(v.id("users")),
    // Optional: use a template for hierarchical approval with roles/labels
    templateId: v.optional(v.id("letterApprovalTemplates")),
    // When using template, provide resolved approvers with roles
    approverSteps: v.optional(v.array(v.object({
      userId: v.id("users"),
      role: v.string(),
      label: v.string(),
      order: v.number(),
    }))),
    // Tambahan dari dialog ajukan
    urgency: v.optional(v.string()),           // "normal" | "segera" | "sangat_segera"
    approvalDeadline: v.optional(v.string()),  // ISO timestamp
    submissionNote: v.optional(v.string()),    // catatan untuk pemeriksa pertama
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (letter.authorId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }
    if (!["draft", "rejected", "revision"].includes(letter.status)) {
      throw new ConvexError({
        message: "Hanya surat draft/revisi/ditolak yang dapat diajukan",
        code: "BAD_REQUEST",
      });
    }

    // Delete any existing approval rows for a clean re-submission
    const existing = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    // Template-based or inline approval with role hierarchy
    if (args.approverSteps && args.approverSteps.length > 0) {
      // Filter out konseptor (order 1, usually the author) - they don't need to approve
      const approvalSteps = args.approverSteps.filter((s) => s.role !== "konseptor");

      if (approvalSteps.length === 0) {
        throw new ConvexError({
          message: "Minimal satu penyetuju/pemeriksa diperlukan",
          code: "BAD_REQUEST",
        });
      }

      for (let i = 0; i < approvalSteps.length; i++) {
        const step = approvalSteps[i];
        await ctx.db.insert("letterApprovals", {
          letterId: args.letterId,
          approverId: step.userId,
          order: i + 1,
          status: i === 0 ? "pending" : "waiting",
          approvalRole: step.role,
          approvalLabel: step.label,
          templateId: args.templateId,
        });
      }

      await ctx.db.patch(args.letterId, {
        status: "review",
        approvalTemplateId: args.templateId,
        urgency: args.urgency ?? "normal",
        approvalDeadline: args.approvalDeadline,
        submissionNote: args.submissionNote,
      });
    } else {
      // Legacy: manual approver list
      if (args.approverIds.length === 0) {
        throw new ConvexError({
          message: "Minimal satu approver diperlukan",
          code: "BAD_REQUEST",
        });
      }

      for (let i = 0; i < args.approverIds.length; i++) {
        await ctx.db.insert("letterApprovals", {
          letterId: args.letterId,
          approverId: args.approverIds[i],
          order: i + 1,
          status: i === 0 ? "pending" : "waiting",
        });
      }

      await ctx.db.patch(args.letterId, {
        status: "review",
        urgency: args.urgency ?? "normal",
        approvalDeadline: args.approvalDeadline,
        submissionNote: args.submissionNote,
      });
    }

    await addHistory(ctx, args.letterId, me._id, "submitted_for_approval", "Diajukan untuk persetujuan");

    // Notify the first approver (whose turn it now is) that a letter is waiting.
    const firstApproval = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .first();
    if (firstApproval) {
      const urgencyLabel =
        args.urgency === "sangat_segera"
          ? " (SANGAT SEGERA)"
          : args.urgency === "segera"
          ? " (SEGERA)"
          : "";
      await notifyLetterUser(ctx, {
        userId: firstApproval.approverId,
        actorId: me._id,
        letter,
        type: "letter_turn",
        title: `Giliran Anda memeriksa surat${urgencyLabel}`,
        message: `"${letter.subject}" (${letterTypeLabel(letter.type)}) menunggu tindakan Anda dari ${me.name ?? "konseptor"}.`,
      });
    }
  },
});

export const approveLetter = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.optional(v.string()),
    signatureData: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    // Find the pending approval row for this approver (match by id or email)
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }
    if (!myApproval) {
      throw new ConvexError({
        message: "Tidak ada approval pending untuk Anda",
        code: "FORBIDDEN",
      });
    }

    // Use provided signature or fall back to the user's saved signature for this letter
    let signatureData = args.signatureData;
    if (!signatureData) {
      const savedSig = await ctx.db
        .query("letterSignatures")
        .withIndex("by_letter_and_user", (q) =>
          q.eq("letterId", args.letterId).eq("userId", me._id),
        )
        .first();
      if (savedSig) signatureData = savedSig.signatureData;
    }
    // Final fallback: the approver's saved default signature from their profile.
    // Since the sender is always an approver, clicking "Setuju" stamps their
    // default signature onto the letter automatically when none was provided.
    if (!signatureData && me.defaultSignature) {
      signatureData = me.defaultSignature;
    }

    await ctx.db.patch(myApproval._id, {
      status: "approved",
      comment: args.comment,
      actedAt: now,
      signatureData,
    });

    // Check if there's a next approver to activate
    const nextApproval = approvals.find((a) => a.order === myApproval.order + 1);
    const myLabel = myApproval.approvalLabel ?? `Pemeriksa (Langkah ${myApproval.order})`;
    if (nextApproval) {
      await ctx.db.patch(nextApproval._id, { status: "pending" });
      await addHistory(ctx, args.letterId, me._id, "approved", `Disetujui oleh approver ${myApproval.order}`);

      // Tell the konseptor this stage was approved.
      await notifyLetterUser(ctx, {
        userId: letter.authorId,
        actorId: me._id,
        letter,
        type: "letter_approved_step",
        title: "Surat disetujui satu tahap",
        message: `${me.name ?? myLabel} menyetujui "${letter.subject}". Surat diteruskan ke tahap berikutnya.`,
      });
      // Tell the next approver it is now their turn.
      await notifyLetterUser(ctx, {
        userId: nextApproval.approverId,
        actorId: me._id,
        letter,
        type: "letter_turn",
        title: "Giliran Anda memeriksa surat",
        message: `"${letter.subject}" (${letterTypeLabel(letter.type)}) menunggu tindakan Anda.`,
      });
    } else {
      // All approvers approved
      await ctx.db.patch(args.letterId, { status: "approved" });
      await addHistory(ctx, args.letterId, me._id, "fully_approved", "Semua approver telah menyetujui");

      // Broadcast completion to every participant.
      const participants = await collectLetterParticipants(ctx, letter);
      for (const uid of participants) {
        await notifyLetterUser(ctx, {
          userId: uid,
          actorId: me._id,
          letter,
          type: "letter_completed",
          title: "Surat selesai disetujui",
          message: `"${letter.subject}" (${letterTypeLabel(letter.type)}) telah disetujui sepenuhnya.`,
        });
      }
    }
  },
});

export const rejectLetter = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    // Find my pending approval row (match by id or email)
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }

    if (!myApproval) {
      throw new ConvexError({
        message: "Tidak ada approval pending untuk Anda",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.patch(myApproval._id, {
      status: "rejected",
      comment: args.comment,
      actedAt: now,
    });

    await ctx.db.patch(args.letterId, { status: "rejected" });
    await addHistory(ctx, args.letterId, me._id, "rejected", args.comment);

    // Notify the konseptor that the letter was rejected, including the reason.
    const rejectLabel = myApproval.approvalLabel ?? "Pemeriksa/Penyetuju";
    await notifyLetterUser(ctx, {
      userId: letter.authorId,
      actorId: me._id,
      letter,
      type: "letter_rejected",
      title: "Surat Anda ditolak",
      message: `"${letter.subject}" ditolak oleh ${me.name ?? rejectLabel}. Alasan: ${args.comment}`,
    });
  },
});

/**
 * A reviewer/approver returns the letter to the author (konseptor) for revision.
 * Unlike rejection (which halts the letter), the letter goes back to "revision"
 * status so the author can edit and re-submit through the same approval chain.
 * The reviewer's correction note is recorded in history and on the approval row.
 */
export const requestRevision = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    if (!args.comment.trim()) {
      throw new ConvexError({
        message: "Catatan koreksi wajib diisi",
        code: "BAD_REQUEST",
      });
    }

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    // Find my pending approval row (match by id or email)
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }

    if (!myApproval) {
      throw new ConvexError({
        message: "Tidak ada approval pending untuk Anda",
        code: "FORBIDDEN",
      });
    }

    // Reset the whole approval chain back to the starting state so that after the
    // author revises and re-submits, the flow restarts cleanly from the first step.
    for (const a of approvals) {
      await ctx.db.patch(a._id, {
        status: a.order === 1 ? "pending" : "waiting",
        comment: undefined,
        actedAt: undefined,
        signatureData: undefined,
      });
    }

    // Send the letter back to the author for revision.
    await ctx.db.patch(args.letterId, { status: "revision" });

    const label = myApproval.approvalLabel ?? `Pemeriksa (Langkah ${myApproval.order})`;
    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "revision_requested",
      `Dikembalikan untuk revisi oleh ${label}: ${args.comment}`,
    );

    // Notify the konseptor that their letter needs revision.
    await notifyLetterUser(ctx, {
      userId: letter.authorId,
      actorId: me._id,
      letter,
      type: "letter_revision",
      title: "Surat perlu direvisi",
      message: `${me.name ?? label} meminta perbaikan pada "${letter.subject}". Catatan: ${args.comment}`,
    });
  },
});

/**
 * Pemeriksa tambahan (non-utama) can only add a note and forward to the next approver.
 * They cannot send back to konseptor or directly to penyetuju.
 */
export const addReviewerNote = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }
    if (!myApproval) {
      throw new ConvexError({ message: "Tidak ada giliran Anda saat ini", code: "FORBIDDEN" });
    }

    // Ensure this is NOT the head reviewer (pemeriksa_1) — only supporting reviewers use this
    if (myApproval.approvalRole === "pemeriksa_1") {
      throw new ConvexError({
        message: "Pemeriksa utama gunakan tombol Kembalikan untuk Revisi atau Setujui",
        code: "BAD_REQUEST",
      });
    }

    // Mark this step done and activate the next step
    await ctx.db.patch(myApproval._id, {
      status: "approved",
      comment: args.comment,
      actedAt: now,
    });

    const next = approvals.find((a) => a.order === myApproval.order + 1);
    if (next) {
      await ctx.db.patch(next._id, { status: "pending" });
    }

    const label = myApproval.approvalLabel ?? `Pemeriksa (Langkah ${myApproval.order})`;
    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "reviewer_note",
      args.comment ? `Catatan dari ${label}: ${args.comment}` : `Diteruskan oleh ${label}`,
    );

    // Notify the next approver that it is now their turn.
    if (next) {
      await notifyLetterUser(ctx, {
        userId: next.approverId,
        actorId: me._id,
        letter,
        type: "letter_turn",
        title: "Giliran Anda memeriksa surat",
        message: `"${letter.subject}" (${letterTypeLabel(letter.type)}) diteruskan oleh ${me.name ?? label} dan menunggu tindakan Anda.`,
      });
    }
  },
});

/**
 * The final approver (penyetuju) returns the letter to the previous reviewer
 * (pemeriksa) along with a correction note. The letter stays under review, but
 * the turn goes back to the previous step so the pemeriksa can re-check it and
 * (if satisfied) forward it to the penyetuju again. The author (konseptor) is
 * NOT involved in this path.
 */
export const returnToReviewer = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    if (!args.comment.trim()) {
      throw new ConvexError({
        message: "Catatan koreksi wajib diisi",
        code: "BAD_REQUEST",
      });
    }

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }
    if (!myApproval) {
      throw new ConvexError({
        message: "Tidak ada approval pending untuk Anda",
        code: "FORBIDDEN",
      });
    }

    const prev = approvals.find((a) => a.order === myApproval.order - 1);
    if (!prev) {
      throw new ConvexError({
        message: "Tidak ada pemeriksa sebelumnya untuk dikembalikan",
        code: "BAD_REQUEST",
      });
    }

    // Send the turn back to the previous reviewer. Their row becomes pending
    // again and carries the correction note so they know what to re-check.
    await ctx.db.patch(prev._id, {
      status: "pending",
      comment: args.comment,
      actedAt: undefined,
      signatureData: undefined,
    });
    // Reset the current (final) approver's row to waiting.
    await ctx.db.patch(myApproval._id, {
      status: "waiting",
      comment: undefined,
      actedAt: undefined,
      signatureData: undefined,
    });

    // Letter remains under review; ensure status is consistent.
    if (letter.status !== "review") {
      await ctx.db.patch(args.letterId, { status: "review" });
    }

    const myLabel = myApproval.approvalLabel ?? `Penyetuju (Langkah ${myApproval.order})`;
    const prevLabel = prev.approvalLabel ?? `Pemeriksa (Langkah ${prev.order})`;
    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "returned_to_reviewer",
      `Dikembalikan ke ${prevLabel} oleh ${myLabel}: ${args.comment}`,
    );

    // Notify the previous reviewer that the letter is back on their desk.
    await notifyLetterUser(ctx, {
      userId: prev.approverId,
      actorId: me._id,
      letter,
      type: "letter_turn",
      title: "Surat dikembalikan untuk diperiksa ulang",
      message: `${me.name ?? myLabel} mengembalikan "${letter.subject}" kepada Anda. Catatan: ${args.comment}`,
    });
  },
});

/**
 * The final approver (penyetuju) returns the letter all the way back to the
 * author (konseptor). Per policy this CANCELS and FREEZES the letter: it becomes
 * an "arsip mati" (dead archive) that can never be re-submitted. The konseptor
 * must start a brand-new draft. The full journey stays visible in the history.
 */
export const freezeLetter = mutation({
  args: {
    letterId: v.id("letters"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", args.letterId))
      .order("asc")
      .collect();

    let myApproval: Doc<"letterApprovals"> | undefined;
    for (const a of approvals) {
      if (a.status === "pending" && (await approvalBelongsToUser(ctx, a, me))) {
        myApproval = a;
        break;
      }
    }
    if (!myApproval) {
      throw new ConvexError({
        message: "Tidak ada approval pending untuk Anda",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.patch(myApproval._id, {
      status: "rejected",
      comment: args.comment,
      actedAt: now,
    });

    // Freeze the letter — it cannot be re-submitted (see submitForApproval).
    await ctx.db.patch(args.letterId, { status: "frozen" });

    const myLabel = myApproval.approvalLabel ?? `Penyetuju (Langkah ${myApproval.order})`;
    const note = args.comment?.trim() ? `: ${args.comment}` : "";
    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "frozen",
      `Surat dibekukan (arsip mati) oleh ${myLabel} dan dikembalikan ke konseptor${note}. Surat dibatalkan dan tidak dapat diajukan ulang.`,
    );
  },
});

export const sendLetter = mutation({
  args: {
    letterId: v.id("letters"),
    letterNumber: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (!["approved", "draft"].includes(letter.status)) {
      throw new ConvexError({
        message: "Surat harus dalam status approved atau draft untuk dikirim",
        code: "BAD_REQUEST",
      });
    }
    // Konsep yang memiliki rantai persetujuan (surat berjenjang) tidak boleh
    // dikirim langsung — wajib melewati proses persetujuan sampai disetujui.
    if (letter.status === "draft") {
      const existingApprovals = await ctx.db
        .query("letterApprovals")
        .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
        .collect();
      if (existingApprovals.length > 0) {
        throw new ConvexError({
          message:
            "Surat berjenjang harus disetujui terlebih dahulu sebelum dapat dikirim",
          code: "BAD_REQUEST",
        });
      }
    }
    // Pengiriman surat adalah tanggung jawab konseptor (pembuat surat).
    // Penyetuju hanya menyetujui — bukan mengirim. Admin/Super Admin tetap boleh.
    if (letter.authorId !== me._id && me.role !== "admin" && me.role !== "super_admin") {
      throw new ConvexError({
        message: "Hanya pembuat surat (konseptor) yang dapat mengirim surat ini",
        code: "FORBIDDEN",
      });
    }

    const patch: Partial<Doc<"letters">> = { status: "sent", processedAt: now };
    if (args.letterNumber) {
      patch.letterNumber = args.letterNumber;
    } else if (!letter.letterNumber) {
      // Beri nomor surat resmi otomatis saat dikirim bila belum ada nomor,
      // mengikuti format penomoran yang dikonfigurasi untuk jenis surat ini.
      const autoNumber = await generateNextLetterNumber(ctx, letter.type, me._id);
      if (autoNumber) patch.letterNumber = autoNumber;
    }
    // Assign a permanent verification code on first send so the letter can be
    // authenticated later via its QR code.
    if (!letter.verificationCode) {
      patch.verificationCode = await generateUniqueVerificationCode(ctx);
    }

    // Perbarui teks pencarian bila nomor surat baru saja ditetapkan.
    if (patch.letterNumber) {
      patch.searchText = buildLetterSearchText({
        subject: letter.subject,
        letterNumber: patch.letterNumber,
        agendaNumber: letter.agendaNumber,
      });
    }

    await ctx.db.patch(args.letterId, patch);
    const sentNote = patch.letterNumber
      ? `Surat dikirim dengan nomor ${patch.letterNumber}`
      : "Surat dikirim";
    await addHistory(ctx, args.letterId, me._id, "sent", sentNote);

    // Beri tahu penerima bahwa surat telah masuk ke kotak surat mereka.
    // Penerima tunggal (toUserId) + semua penerima massal (letterRecipients).
    const updatedLetter = { ...letter, ...patch } as Doc<"letters">;
    const notified = new Set<Id<"users">>();
    const notifyRecipient = async (userId: Id<"users">) => {
      if (notified.has(userId) || userId === me._id) return;
      notified.add(userId);
      await notifyLetterUser(ctx, {
        userId,
        actorId: me._id,
        letter: updatedLetter,
        type: "letter_received",
        title: `${letterTypeLabel(letter.type)} baru`,
        message: `Anda menerima surat "${letter.subject}"${
          patch.letterNumber ? ` (No. ${patch.letterNumber})` : ""
        } dari ${letter.fromName}.`,
      });
    };

    if (letter.toUserId) await notifyRecipient(letter.toUserId);
    const bulkRecipients = await ctx.db
      .query("letterRecipients")
      .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
      .collect();
    for (const r of bulkRecipients) {
      await notifyRecipient(r.userId);
    }
  },
});

// Mengumpulkan alamat email penerima resmi surat (penerima tunggal + penerima
// massal) untuk fitur "kirim email otomatis saat surat dikirim". Hanya penerima
// yang memiliki alamat email yang dikembalikan; sisanya dihitung agar UI bisa
// memberi tahu pengguna berapa penerima yang dilewati karena tanpa email.
export const getOfficialRecipientEmails = query({
  args: { letterId: v.id("letters") },
  handler: async (
    ctx,
    args,
  ): Promise<{ emails: string[]; withoutEmail: number; totalRecipients: number }> => {
    await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    // Kumpulkan id penerima unik: penerima tunggal + seluruh penerima massal.
    const recipientIds = new Set<Id<"users">>();
    if (letter.toUserId) recipientIds.add(letter.toUserId);
    const bulk = await ctx.db
      .query("letterRecipients")
      .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
      .collect();
    for (const r of bulk) recipientIds.add(r.userId);

    const emails = new Set<string>();
    let withoutEmail = 0;
    for (const uid of recipientIds) {
      const u = await ctx.db.get(uid);
      const email = u?.email?.trim();
      if (email && email.length > 0) {
        emails.add(email.toLowerCase());
      } else {
        withoutEmail += 1;
      }
    }

    return {
      emails: Array.from(emails),
      withoutEmail,
      totalRecipients: recipientIds.size,
    };
  },
});

// --- Arsip PDF permanen ---------------------------------------------------
// PDF surat dibuat di sisi browser (agar tampak persis seperti pratinjau
// cetak: kop, logo, tanda tangan, QR) lalu diunggah ke penyimpanan Convex.
// Alur: (1) minta upload URL, (2) unggah blob, (3) simpan storageId ke surat.

export const generateArchiveUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveLetterArchivePdf = mutation({
  args: {
    letterId: v.id("letters"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    // Hanya pembuat surat atau admin/super_admin yang boleh membekukan arsip.
    if (letter.authorId !== me._id && me.role !== "admin" && me.role !== "super_admin") {
      // Bersihkan blob yang terlanjur diunggah agar tidak menjadi sampah.
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({ message: "Tidak memiliki izin membuat arsip", code: "FORBIDDEN" });
    }
    // Ganti arsip lama bila ada (hapus storage lama untuk mencegah orphan).
    if (letter.archivePdfStorageId) {
      await ctx.storage.delete(letter.archivePdfStorageId);
    }
    await ctx.db.patch(args.letterId, {
      archivePdfStorageId: args.storageId,
      archivePdfName: args.fileName,
      archivePdfGeneratedAt: new Date().toISOString(),
    });
    await addHistory(ctx, args.letterId, me._id, "archive_pdf_saved", "Arsip PDF dibuat");
  },
});

// Returns a stable download URL for the letter's archived PDF, but only to
// users allowed to view the letter (canViewLetter). Returns null otherwise.
export const getLetterArchivePdfUrl = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<{ url: string; fileName: string } | null> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter || !letter.archivePdfStorageId) return null;
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return null;
    const url = await ctx.storage.getUrl(letter.archivePdfStorageId);
    if (!url) return null;
    return { url, fileName: letter.archivePdfName ?? "surat.pdf" };
  },
});

// Mencatat akses (buka/unduh) arsip dokumen final ke jejak audit GCG.
// Dipanggil frontend saat pengguna menekan tombol Unduh/Detail arsip. Hanya
// pengguna yang berhak melihat surat yang aksesnya dicatat (mencegah audit palsu).
export const logArchiveAccess = mutation({
  args: {
    letterId: v.id("letters"),
    action: v.string(), // "view" | "download"
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter || !letter.archivePdfStorageId) return;
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return;
    const action = args.action === "download" ? "download" : "view";
    await ctx.db.insert("letterArchiveAudit", {
      letterId: letter._id,
      actorId: me._id,
      action,
      letterSubject: letter.subject,
      letterNumber: letter.letterNumber,
      occurredAt: new Date().toISOString(),
      organizationId: me.organizationId,
    });
  },
});

// Jejak audit akses arsip untuk admin/super_admin: daftar siapa membuka/mengunduh
// arsip dokumen final, kapan, dan surat mana. Dibatasi lingkup organisasi.
type ArchiveAuditRow = Doc<"letterArchiveAudit"> & {
  actorName: string | null;
  actorRole: string | null;
};

export const listArchiveAudit = query({
  args: {
    paginationOpts: paginationOptsValidator,
    letterId: v.optional(v.id("letters")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: ArchiveAuditRow[];
    isDone: boolean;
    continueCursor: string;
  }> => {
    const me = await requireAuth(ctx);
    // Hanya admin & super_admin yang boleh melihat jejak audit lengkap.
    if (me.role !== "admin" && me.role !== "super_admin") {
      return { page: [], isDone: true, continueCursor: "" };
    }
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const orgId = me.organizationId;

    const enrichPage = async (
      page: Doc<"letterArchiveAudit">[],
    ): Promise<ArchiveAuditRow[]> => {
      // Batasi ke organisasi efektif pemanggil. Super admin tanpa izin akses
      // aktif memiliki orgId null sehingga tidak melihat data apa pun.
      const scoped = orgId
        ? page.filter((r) => !r.organizationId || r.organizationId === orgId)
        : [];
      return Promise.all(
        scoped.map(async (r) => {
          const actor = await ctx.db.get(r.actorId);
          return {
            ...r,
            actorName: actor?.name ?? null,
            actorRole: actor?.role ?? null,
          };
        }),
      );
    };

    if (args.letterId) {
      const results = await ctx.db
        .query("letterArchiveAudit")
        .withIndex("by_letter", (q) => q.eq("letterId", args.letterId!))
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...results, page: await enrichPage(results.page) };
    }

    const results = await ctx.db
      .query("letterArchiveAudit")
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...results, page: await enrichPage(results.page) };
  },
});

export const receiveLetter = mutation({
  args: {
    letterId: v.id("letters"),
    agendaNumber: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (letter.type !== "masuk") {
      throw new ConvexError({ message: "Hanya surat masuk yang dapat diterima", code: "BAD_REQUEST" });
    }

    const patch: Partial<Doc<"letters">> = { status: "received", processedAt: now };
    if (args.agendaNumber) patch.agendaNumber = args.agendaNumber;

    await ctx.db.patch(args.letterId, patch);
    await addHistory(ctx, args.letterId, me._id, "received", "Surat diterima");
  },
});

export const createDisposition = mutation({
  args: {
    letterId: v.id("letters"),
    toUserId: v.id("users"),
    instructions: v.string(),
    dueDate: v.optional(v.string()),
    parentDispositionId: v.optional(v.id("letterDispositions")),
  },
  handler: async (ctx, args): Promise<Id<"letterDispositions">> => {
    const me = await requireAuth(ctx);

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    const dispositionId = await ctx.db.insert("letterDispositions", {
      letterId: args.letterId,
      fromUserId: me._id,
      toUserId: args.toUserId,
      instructions: args.instructions,
      status: "pending",
      dueDate: args.dueDate,
      parentDispositionId: args.parentDispositionId,
    });

    // Increment disposition count on the letter
    await ctx.db.patch(args.letterId, {
      dispositionCount: (letter.dispositionCount ?? 0) + 1,
    });

    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "disposition_created",
      `Disposisi diberikan kepada user`,
    );

    return dispositionId;
  },
});

export const updateDisposition = mutation({
  args: {
    dispositionId: v.id("letterDispositions"),
    markRead: v.optional(v.boolean()),
    markCompleted: v.optional(v.boolean()),
    completionNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const disposition = await ctx.db.get(args.dispositionId);
    if (!disposition) {
      throw new ConvexError({ message: "Disposisi tidak ditemukan", code: "NOT_FOUND" });
    }
    if (disposition.toUserId !== me._id) {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    const patch: Partial<Doc<"letterDispositions">> = {};
    if (args.markRead && !disposition.readAt) patch.readAt = now;
    if (args.markCompleted) {
      patch.status = "completed";
      patch.completedAt = now;
      if (args.completionNote) patch.completionNote = args.completionNote;
    }

    await ctx.db.patch(args.dispositionId, patch);

    if (args.markCompleted) {
      await addHistory(
        ctx,
        disposition.letterId,
        me._id,
        "disposition_completed",
        args.completionNote,
      );
    }
  },
});

export const archiveLetter = mutation({
  args: {
    letterId: v.id("letters"),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (letter.authorId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    // Hanya surat final yang boleh diarsipkan: surat keluar/internal yang sudah
    // "sent", atau surat masuk yang sudah "received". Surat konsep atau yang
    // masih dalam proses persetujuan tidak boleh diarsipkan.
    const isFinalForArchive =
      letter.status === "sent" ||
      (letter.type === "masuk" && letter.status === "received");
    if (!isFinalForArchive) {
      throw new ConvexError({
        message: "Surat hanya dapat diarsipkan setelah final (sudah dikirim/diterima).",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.patch(args.letterId, { status: "archived" });
    await addHistory(ctx, args.letterId, me._id, "archived", "Surat diarsipkan");
  },
});

// Super admin: permanently delete a letter and all its related records
export const deleteLetter = mutation({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });

    // Konseptor hanya bisa hapus surat miliknya sendiri dan hanya saat draft
    // Admin/super_admin bisa hapus surat apapun
    const isSuperAdmin = me.role === "super_admin";
    const isAdmin = me.role === "admin";
    const isAuthor = letter.authorId === me._id;

    if (!isSuperAdmin && !isAdmin && !isAuthor) {
      throw new ConvexError({ message: "Tidak memiliki izin menghapus surat ini", code: "FORBIDDEN" });
    }
    if (!isSuperAdmin && !isAdmin && isAuthor && letter.status !== "draft") {
      throw new ConvexError({ message: "Surat hanya bisa dihapus saat masih berstatus konsep", code: "BAD_REQUEST" });
    }

    // Delete all related records
    const [attachments, dispositions, approvals, history, signatures] = await Promise.all([
      ctx.db.query("letterAttachments").withIndex("by_letter", (q) => q.eq("letterId", args.letterId)).collect(),
      ctx.db.query("letterDispositions").withIndex("by_letter", (q) => q.eq("letterId", args.letterId)).collect(),
      ctx.db.query("letterApprovals").withIndex("by_letter", (q) => q.eq("letterId", args.letterId)).collect(),
      ctx.db.query("letterHistory").withIndex("by_letter", (q) => q.eq("letterId", args.letterId)).collect(),
      ctx.db.query("letterSignatures").withIndex("by_letter", (q) => q.eq("letterId", args.letterId)).collect(),
    ]);

    for (const r of [...attachments, ...dispositions, ...approvals, ...history, ...signatures]) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.letterId);
  },
});

// Bulk archive letters. Skips letters the user cannot archive or that are not
// in a final state; never throws mid-loop.
export const bulkArchiveLetters = mutation({
  args: { letterIds: v.array(v.id("letters")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const me = await requireAuth(ctx);
    if (args.letterIds.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 surat per aksi",
      });
    }
    let count = 0;
    for (const letterId of args.letterIds) {
      const letter = await ctx.db.get(letterId);
      if (!letter) continue;
      if (letter.authorId !== me._id && me.role !== "admin" && me.role !== "super_admin") {
        continue;
      }
      const isFinalForArchive =
        letter.status === "sent" ||
        (letter.type === "masuk" && letter.status === "received");
      if (!isFinalForArchive) continue;
      await ctx.db.patch(letterId, { status: "archived" });
      await addHistory(ctx, letterId, me._id, "archived", "Surat diarsipkan");
      count += 1;
    }
    return { count };
  },
});

// Bulk delete letters and their related records. Applies the same permission
// rules as deleteLetter per item and skips anything not allowed.
export const bulkDeleteLetters = mutation({
  args: { letterIds: v.array(v.id("letters")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const me = await requireAuth(ctx);
    if (args.letterIds.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 surat per aksi",
      });
    }
    const isSuperAdmin = me.role === "super_admin";
    const isAdmin = me.role === "admin";
    let count = 0;
    for (const letterId of args.letterIds) {
      const letter = await ctx.db.get(letterId);
      if (!letter) continue;
      const isAuthor = letter.authorId === me._id;
      if (!isSuperAdmin && !isAdmin && !isAuthor) continue;
      if (!isSuperAdmin && !isAdmin && isAuthor && letter.status !== "draft") {
        continue;
      }
      const [attachments, dispositions, approvals, history, signatures] =
        await Promise.all([
          ctx.db.query("letterAttachments").withIndex("by_letter", (q) => q.eq("letterId", letterId)).collect(),
          ctx.db.query("letterDispositions").withIndex("by_letter", (q) => q.eq("letterId", letterId)).collect(),
          ctx.db.query("letterApprovals").withIndex("by_letter", (q) => q.eq("letterId", letterId)).collect(),
          ctx.db.query("letterHistory").withIndex("by_letter", (q) => q.eq("letterId", letterId)).collect(),
          ctx.db.query("letterSignatures").withIndex("by_letter", (q) => q.eq("letterId", letterId)).collect(),
        ]);
      for (const r of [...attachments, ...dispositions, ...approvals, ...history, ...signatures]) {
        await ctx.db.delete(r._id);
      }
      await ctx.db.delete(letterId);
      count += 1;
    }
    return { count };
  },
});

// ---------------------------------------------------------------------------
// LETTERHEAD MUTATIONS
// ---------------------------------------------------------------------------

export const createLetterhead = mutation({
  args: {
    name: v.string(),
    organizationName: v.string(),
    organizationAddress: v.string(),
    organizationPhone: v.optional(v.string()),
    organizationEmail: v.optional(v.string()),
    organizationWebsite: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showTopLine: v.optional(v.boolean()),
    showBottomLine: v.optional(v.boolean()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"letterheads">> => {
    const me = await requireAuth(ctx);
    const orgId = me.organizationId;
    if (!orgId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak ada organisasi dalam cakupan untuk membuat kop surat",
      });
    }

    // Jika dijadikan default, batalkan default lama HANYA dalam organisasi ini.
    if (args.isDefault) {
      const existing = await ctx.db
        .query("letterheads")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const lh of existing) {
        if (!lh.organizationId || lh.organizationId === orgId) {
          await ctx.db.patch(lh._id, { isDefault: false });
        }
      }
    }

    return await ctx.db.insert("letterheads", { ...args, authorId: me._id, organizationId: orgId });
  },
});

export const updateLetterhead = mutation({
  args: {
    letterheadId: v.id("letterheads"),
    name: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    organizationAddress: v.optional(v.string()),
    organizationPhone: v.optional(v.string()),
    organizationEmail: v.optional(v.string()),
    organizationWebsite: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showTopLine: v.optional(v.boolean()),
    showBottomLine: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const { letterheadId, ...fields } = args;

    const letterhead = await ctx.db.get(letterheadId);
    if (!letterhead) {
      throw new ConvexError({ message: "Kop surat tidak ditemukan", code: "NOT_FOUND" });
    }
    // Isolasi tenant: hanya boleh mengubah kop surat milik organisasi pemanggil
    // (atau kop surat lama tanpa organisasi).
    assertSameTenant(me.organizationId, letterhead.organizationId, "kop surat");
    if (letterhead.authorId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    if (fields.isDefault === true) {
      const existing = await ctx.db
        .query("letterheads")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const lh of existing) {
        const sameOrg = !lh.organizationId || lh.organizationId === letterhead.organizationId;
        if (lh._id !== letterheadId && sameOrg) {
          await ctx.db.patch(lh._id, { isDefault: false });
        }
      }
    }

    const patch: Partial<typeof fields> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) (patch as Record<string, unknown>)[k] = val;
    }
    await ctx.db.patch(letterheadId, patch);
  },
});

export const deleteLetterhead = mutation({
  args: { letterheadId: v.id("letterheads") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    const letterhead = await ctx.db.get(args.letterheadId);
    if (!letterhead) {
      throw new ConvexError({ message: "Kop surat tidak ditemukan", code: "NOT_FOUND" });
    }
    // Isolasi tenant: hanya boleh menghapus kop surat milik organisasi pemanggil.
    assertSameTenant(me.organizationId, letterhead.organizationId, "kop surat");
    if (letterhead.authorId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.letterheadId);
  },
});

// ---------------------------------------------------------------------------
// LETTER NUMBER CONFIG QUERIES & MUTATIONS
// ---------------------------------------------------------------------------

export const listLetterNumberConfigs = query({
  args: {},
  handler: async (ctx): Promise<Doc<"letterNumberConfigs">[]> => {
    await requireAuth(ctx);
    return await ctx.db.query("letterNumberConfigs").collect();
  },
});

export const getLetterNumberConfig = query({
  args: { letterType: v.string() },
  handler: async (ctx, args): Promise<Doc<"letterNumberConfigs"> | null> => {
    await requireAuth(ctx);
    return await ctx.db
      .query("letterNumberConfigs")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();
  },
});

function padSequence(seq: number, length: number): string {
  return String(seq).padStart(length, "0");
}

function applyFormat(format: string, seq: number, prefix: string | undefined, now: Date, prefix2?: string): string {
  const pad3 = padSequence(seq, 3);
  const pad4 = padSequence(seq, 4);
  const year4 = String(now.getFullYear());
  const year2 = year4.slice(2);
  const month2 = String(now.getMonth() + 1).padStart(2, "0");
  const romanMonths = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const monthRoman = romanMonths[now.getMonth()];

  return format
    .replace("{PREFIX}", prefix ?? "")
    .replace("{PREFIX2}", prefix2 ?? "")
    .replace("{SEQ4}", pad4)
    .replace("{SEQ3}", pad3)
    .replace("{SEQ}", pad3)
    .replace("{YYYY}", year4)
    .replace("{YY}", year2)
    .replace("{MM}", month2)
    .replace("{BULAN}", monthRoman);
}

// Menghasilkan nomor surat resmi berikutnya untuk sebuah jenis surat dan
// menaikkan urutannya. Dipakai saat pengiriman untuk memberi nomor otomatis
// pada surat yang belum diberi nomor manual. Mengembalikan null bila tidak ada
// konfigurasi (agar kita tidak memaksakan format bawaan diam-diam).
async function generateNextLetterNumber(
  ctx: MutationCtx,
  letterType: string,
  fallbackUserId: Id<"users">,
): Promise<string | null> {
  const now = new Date();
  let config = await ctx.db
    .query("letterNumberConfigs")
    .withIndex("by_type", (q) => q.eq("letterType", letterType))
    .first();

  // Jika jenis surat ini belum memiliki konfigurasi penomoran, buat konfigurasi
  // default otomatis agar setiap surat yang dikirim tetap mendapat nomor resmi.
  // Format default: {PREFIX}/{SEQ3}/{BULAN}/{YYYY} — mis. INTERNAL/001/VII/2026.
  // Khusus Nota (jenis internal "memo"), gunakan prefix "NOTA" agar nomor keluar
  // rapi (mis. NOTA/001/VII/2026), bukan "MEMO".
  if (!config) {
    const defaultPrefix = letterType === "memo" ? "NOTA" : letterType.toUpperCase();
    const configId = await ctx.db.insert("letterNumberConfigs", {
      letterType,
      format: "{PREFIX}/{SEQ3}/{BULAN}/{YYYY}",
      prefix: defaultPrefix,
      lastSequence: 0,
      resetPeriod: "yearly",
      lastResetAt: now.toISOString(),
      updatedBy: fallbackUserId,
    });
    config = await ctx.db.get(configId);
    if (!config) return null;
  }

  let { lastSequence, lastResetAt } = config;
  const lastReset = new Date(lastResetAt);

  if (config.resetPeriod === "monthly") {
    if (now.getFullYear() !== lastReset.getFullYear() || now.getMonth() !== lastReset.getMonth()) {
      lastSequence = 0;
      await ctx.db.patch(config._id, { lastSequence: 0, lastResetAt: now.toISOString() });
    }
  } else if (config.resetPeriod === "yearly") {
    if (now.getFullYear() !== lastReset.getFullYear()) {
      lastSequence = 0;
      await ctx.db.patch(config._id, { lastSequence: 0, lastResetAt: now.toISOString() });
    }
  }

  const nextSeq = lastSequence + 1;
  await ctx.db.patch(config._id, { lastSequence: nextSeq });

  return applyFormat(config.format, nextSeq, config.prefix, now, config.prefix2);
}

export const generateLetterNumber = mutation({
  args: {
    letterType: v.string(),
    preview: v.optional(v.boolean()), // if true, don't increment sequence
  },
  handler: async (ctx, args): Promise<string> => {
    const me = await requireAuth(ctx);
    const now = new Date();

    const config = await ctx.db
      .query("letterNumberConfigs")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    if (!config) {
      // Return default format if no config set. Untuk Nota (memo), tampilkan
      // prefix "NOTA" agar konsisten dengan nomor yang dihasilkan saat kirim.
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const defaultPrefix = args.letterType === "memo" ? "NOTA" : args.letterType.toUpperCase();
      return `${defaultPrefix}/001/${month}/${year}`;
    }

    // Check if reset is needed
    let { lastSequence, lastResetAt } = config;
    const lastReset = new Date(lastResetAt);

    if (config.resetPeriod === "monthly") {
      if (now.getFullYear() !== lastReset.getFullYear() || now.getMonth() !== lastReset.getMonth()) {
        lastSequence = 0;
        if (!args.preview) {
          await ctx.db.patch(config._id, {
            lastSequence: 0,
            lastResetAt: now.toISOString(),
          });
        }
      }
    } else if (config.resetPeriod === "yearly") {
      if (now.getFullYear() !== lastReset.getFullYear()) {
        lastSequence = 0;
        if (!args.preview) {
          await ctx.db.patch(config._id, {
            lastSequence: 0,
            lastResetAt: now.toISOString(),
          });
        }
      }
    }

    const nextSeq = lastSequence + 1;

    if (!args.preview) {
      await ctx.db.patch(config._id, {
        lastSequence: nextSeq,
        updatedBy: me._id,
      });
    }

    return applyFormat(config.format, args.preview ? lastSequence + 1 : nextSeq, config.prefix, now, config.prefix2);
  },
});

// Generate letter number using a per-prefix sequence (each prefix has its own counter)
export const generateLetterNumberWithPrefix = mutation({
  args: {
    letterType: v.string(),
    prefixOverride: v.string(), // prefix1 (unit/perusahaan) chosen by user
    prefix2Override: v.optional(v.string()), // prefix2 (kategori) chosen by user
    preview: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    await requireAuth(ctx);
    const now = new Date();
    const prefix = args.prefixOverride;
    const prefix2 = args.prefix2Override;

    // Get base config for format & reset period
    const config = await ctx.db
      .query("letterNumberConfigs")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    const format = config?.format ?? "{PREFIX}/{SEQ3}/{MM}/{YYYY}";
    const resetPeriod = config?.resetPeriod ?? "yearly";

    // Get or create per-prefix sequence
    const seqDoc = await ctx.db
      .query("letterPrefixSequences")
      .withIndex("by_type_and_prefix", (q) =>
        q.eq("letterType", args.letterType).eq("prefix", prefix),
      )
      .first();

    let lastSequence = seqDoc?.lastSequence ?? 0;
    const lastResetAt = seqDoc?.lastResetAt ? new Date(seqDoc.lastResetAt) : new Date(0);

    // Check reset
    const needsReset =
      (resetPeriod === "monthly" &&
        (now.getFullYear() !== lastResetAt.getFullYear() ||
          now.getMonth() !== lastResetAt.getMonth())) ||
      (resetPeriod === "yearly" && now.getFullYear() !== lastResetAt.getFullYear());

    if (needsReset) lastSequence = 0;

    const nextSeq = lastSequence + 1;

    if (!args.preview) {
      if (seqDoc) {
        await ctx.db.patch(seqDoc._id, {
          lastSequence: nextSeq,
          lastResetAt: needsReset ? now.toISOString() : seqDoc.lastResetAt,
        });
      } else {
        await ctx.db.insert("letterPrefixSequences", {
          letterType: args.letterType,
          prefix,
          lastSequence: nextSeq,
          lastResetAt: now.toISOString(),
        });
      }
    }

    return applyFormat(format, nextSeq, prefix, now, prefix2 ?? config?.prefix2);
  },
});

// Pratinjau nomor surat berikutnya tanpa efek samping (tidak menaikkan urutan).
// Dipakai form untuk menampilkan contoh nomor otomatis secara langsung saat
// pengguna memilih jenis surat / prefix. Read-only (query) agar aman dipanggil
// berulang tanpa mengubah data.
export const previewNextLetterNumber = query({
  args: {
    letterType: v.string(),
    prefixOverride: v.optional(v.string()),
    prefix2Override: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    await requireAuth(ctx);
    const now = new Date();

    const config = await ctx.db
      .query("letterNumberConfigs")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    // Bila memilih prefix tertentu, gunakan penghitung per-prefix (sama seperti
    // generateLetterNumberWithPrefix) agar pratinjau akurat.
    if (args.prefixOverride) {
      const prefix = args.prefixOverride;
      const format = config?.format ?? "{PREFIX}/{SEQ3}/{MM}/{YYYY}";
      const resetPeriod = config?.resetPeriod ?? "yearly";

      const seqDoc = await ctx.db
        .query("letterPrefixSequences")
        .withIndex("by_type_and_prefix", (q) =>
          q.eq("letterType", args.letterType).eq("prefix", prefix),
        )
        .first();

      let lastSequence = seqDoc?.lastSequence ?? 0;
      const lastResetAt = seqDoc?.lastResetAt ? new Date(seqDoc.lastResetAt) : new Date(0);
      const needsReset =
        (resetPeriod === "monthly" &&
          (now.getFullYear() !== lastResetAt.getFullYear() ||
            now.getMonth() !== lastResetAt.getMonth())) ||
        (resetPeriod === "yearly" && now.getFullYear() !== lastResetAt.getFullYear());
      if (needsReset) lastSequence = 0;

      return applyFormat(
        format,
        lastSequence + 1,
        prefix,
        now,
        args.prefix2Override ?? config?.prefix2,
      );
    }

    // Tanpa prefix: pakai penghitung utama jenis surat.
    if (!config) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      // Untuk Nota (memo) gunakan prefix "NOTA" agar konsisten dengan nomor resmi.
      const defaultPrefix = args.letterType === "memo" ? "NOTA" : args.letterType.toUpperCase();
      return `${defaultPrefix}/001/${month}/${year}`;
    }

    let { lastSequence } = config;
    const lastReset = new Date(config.lastResetAt);
    if (config.resetPeriod === "monthly") {
      if (now.getFullYear() !== lastReset.getFullYear() || now.getMonth() !== lastReset.getMonth()) {
        lastSequence = 0;
      }
    } else if (config.resetPeriod === "yearly") {
      if (now.getFullYear() !== lastReset.getFullYear()) {
        lastSequence = 0;
      }
    }
    return applyFormat(config.format, lastSequence + 1, config.prefix, now, config.prefix2);
  },
});

// Cek apakah nomor surat manual sudah dipakai surat lain.
// Read-only (query) sehingga aman dipanggil langsung dari form untuk peringatan
// nomor ganda. Mengabaikan surat yang sedang diedit (excludeLetterId).
export const checkDuplicateLetterNumber = query({
  args: {
    letterNumber: v.string(),
    excludeLetterId: v.optional(v.id("letters")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ duplicate: boolean; subject?: string; letterDate?: string }> => {
    await requireAuth(ctx);
    const trimmed = args.letterNumber.trim();
    if (!trimmed) return { duplicate: false };

    // Ambil beberapa kecocokan (jarang > 1) memakai index nomor surat.
    const matches = await ctx.db
      .query("letters")
      .withIndex("by_letter_number", (q) => q.eq("letterNumber", trimmed))
      .take(5);

    const other = matches.find((l) => l._id !== args.excludeLetterId);
    if (!other) return { duplicate: false };
    return { duplicate: true, subject: other.subject, letterDate: other.letterDate };
  },
});

// Pratinjau Nomor Agenda berikutnya tanpa efek samping. Read-only sehingga aman
// dipanggil dari form. Reset tahunan; nomor 3 digit (mis. "001").
export const previewNextAgendaNumber = query({
  args: { letterType: v.string() },
  handler: async (ctx, args): Promise<string> => {
    await requireAuth(ctx);
    const now = new Date();
    const seqDoc = await ctx.db
      .query("letterAgendaSequences")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    let lastSequence = seqDoc?.lastSequence ?? 0;
    const lastReset = seqDoc?.lastResetAt ? new Date(seqDoc.lastResetAt) : new Date(0);
    if (now.getFullYear() !== lastReset.getFullYear()) lastSequence = 0;

    return String(lastSequence + 1).padStart(3, "0");
  },
});

// Ambil (dan naikkan) Nomor Agenda berikutnya. Dipakai saat surat disimpan
// dengan mode agenda otomatis. Gunakan preview:true untuk sekadar mengintip.
export const generateAgendaNumber = mutation({
  args: {
    letterType: v.string(),
    preview: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    const me = await requireAuth(ctx);
    const now = new Date();

    const seqDoc = await ctx.db
      .query("letterAgendaSequences")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    let lastSequence = seqDoc?.lastSequence ?? 0;
    const lastReset = seqDoc?.lastResetAt ? new Date(seqDoc.lastResetAt) : new Date(0);
    if (now.getFullYear() !== lastReset.getFullYear()) lastSequence = 0;

    const nextSeq = lastSequence + 1;

    if (!args.preview) {
      if (seqDoc) {
        await ctx.db.patch(seqDoc._id, {
          lastSequence: nextSeq,
          lastResetAt: now.toISOString(),
          organizationId: me.organizationId,
        });
      } else {
        await ctx.db.insert("letterAgendaSequences", {
          letterType: args.letterType,
          lastSequence: nextSeq,
          lastResetAt: now.toISOString(),
          organizationId: me.organizationId,
        });
      }
    }

    return String(nextSeq).padStart(3, "0");
  },
});

export const upsertLetterNumberConfig = mutation({
  args: {
    letterType: v.string(),
    format: v.string(),
    prefix: v.optional(v.string()),
    prefix2: v.optional(v.string()),
    resetPeriod: v.string(),
    lastSequence: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("letterNumberConfigs")
      .withIndex("by_type", (q) => q.eq("letterType", args.letterType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        format: args.format,
        prefix: args.prefix,
        prefix2: args.prefix2,
        resetPeriod: args.resetPeriod,
        lastSequence: args.lastSequence ?? existing.lastSequence,
        updatedBy: me._id,
      });
    } else {
      await ctx.db.insert("letterNumberConfigs", {
        letterType: args.letterType,
        format: args.format,
        prefix: args.prefix,
        prefix2: args.prefix2,
        resetPeriod: args.resetPeriod,
        lastSequence: args.lastSequence ?? 0,
        lastResetAt: now,
        updatedBy: me._id,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// DIGITAL SIGNATURE QUERIES & MUTATIONS
// ---------------------------------------------------------------------------

export const listLetterSignatures = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const sigs = await ctx.db
      .query("letterSignatures")
      .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
      .collect();

    return await Promise.all(
      sigs.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return {
          ...s,
          user: user
            ? { _id: user._id, name: user.name, jobTitle: user.jobTitle, department: user.department }
            : null,
        };
      }),
    );
  },
});

export const saveSignature = mutation({
  args: {
    letterId: v.id("letters"),
    signatureData: v.string(),
    signatureType: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"letterSignatures">> => {
    const me = await requireAuth(ctx);
    const now = new Date().toISOString();

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    // Remove existing signature from this user on same letter
    const existing = await ctx.db
      .query("letterSignatures")
      .withIndex("by_letter_and_user", (q) =>
        q.eq("letterId", args.letterId).eq("userId", me._id),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const sigId = await ctx.db.insert("letterSignatures", {
      letterId: args.letterId,
      userId: me._id,
      signatureData: args.signatureData,
      signatureType: args.signatureType,
      role: args.role,
      signedAt: now,
    });

    await addHistory(ctx, args.letterId, me._id, "signed", `Surat ditandatangani secara digital`);

    return sigId;
  },
});

export const deleteSignature = mutation({
  args: { signatureId: v.id("letterSignatures") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    const sig = await ctx.db.get(args.signatureId);
    if (!sig) {
      throw new ConvexError({ message: "Tanda tangan tidak ditemukan", code: "NOT_FOUND" });
    }
    if (sig.userId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.signatureId);
    await addHistory(ctx, sig.letterId, me._id, "signature_removed", "Tanda tangan dihapus");
  },
});

export const getUserSignature = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<Doc<"letterSignatures"> | null> => {
    const me = await requireAuth(ctx);
    return await ctx.db
      .query("letterSignatures")
      .withIndex("by_letter_and_user", (q) =>
        q.eq("letterId", args.letterId).eq("userId", me._id),
      )
      .first();
  },
});

// ---------------------------------------------------------------------------
// ATTACHMENT MUTATIONS
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Ambil URL publik untuk berkas yang baru diunggah, agar bisa disisipkan
// sebagai gambar ke dalam isi surat (editor). Hanya untuk pengguna terautentikasi.
export const getUploadedFileUrl = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<string | null> => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const saveAttachment = mutation({
  args: {
    letterId: v.id("letters"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"letterAttachments">> => {
    const me = await requireAuth(ctx);

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    const attachmentId = await ctx.db.insert("letterAttachments", {
      letterId: args.letterId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      storageId: args.storageId,
      uploaderId: me._id,
      description: args.description,
    });

    await ctx.db.patch(args.letterId, {
      attachmentCount: (letter.attachmentCount ?? 0) + 1,
    });

    await addHistory(
      ctx,
      args.letterId,
      me._id,
      "attachment_added",
      `Lampiran ditambahkan: ${args.fileName}`,
    );

    return attachmentId;
  },
});

// ---------------------------------------------------------------------------
// DISPOSITION QUERIES (per-user inbox & outbox)
// ---------------------------------------------------------------------------

export const getMyDispositions = query({
  args: {
    direction: v.union(v.literal("masuk"), v.literal("keluar")),
  },
  handler: async (ctx, args): Promise<Array<{
    disposition: {
      _id: string;
      letterId: string;
      fromUserId: string;
      toUserId: string;
      instructions: string;
      status: string;
      dueDate?: string;
      readAt?: string;
      completedAt?: string;
      completionNote?: string;
      _creationTime: number;
    };
    letter: { _id: string; subject: string; letterNumber?: string; type: string; fromName?: string; letterDate: string } | null;
    counterpartName: string;
  }>> => {
    const me = await requireAuth(ctx);

    const index = args.direction === "masuk" ? "by_to_user" : "by_from_user";
    const fieldFilter = args.direction === "masuk" ? me._id : me._id;

    const dispositions = args.direction === "masuk"
      ? await ctx.db.query("letterDispositions").withIndex("by_to_user", (q) => q.eq("toUserId", me._id)).order("desc").take(100)
      : await ctx.db.query("letterDispositions").withIndex("by_from_user", (q) => q.eq("fromUserId", me._id)).order("desc").take(100);

    // Suppress unused variable warning
    void index;
    void fieldFilter;

    return await Promise.all(
      dispositions.map(async (d) => {
        const letter = await ctx.db.get(d.letterId);
        const counterpartId = args.direction === "masuk" ? d.fromUserId : d.toUserId;
        const counterpart = await ctx.db.get(counterpartId);
        return {
          disposition: {
            _id: d._id,
            letterId: d.letterId,
            fromUserId: d.fromUserId,
            toUserId: d.toUserId,
            instructions: d.instructions,
            status: d.status,
            dueDate: d.dueDate,
            readAt: d.readAt,
            completedAt: d.completedAt,
            completionNote: d.completionNote,
            _creationTime: d._creationTime,
          },
          letter: letter ? {
            _id: letter._id,
            subject: letter.subject,
            letterNumber: letter.letterNumber,
            type: letter.type,
            fromName: letter.fromName,
            letterDate: letter.letterDate,
          } : null,
          counterpartName: counterpart?.name ?? "Tidak diketahui",
        };
      })
    );
  },
});

// Count unread (pending+unread) dispositions for badge notification
export const getMyDispositionUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Scope to the caller's EFFECTIVE organization. A super admin without an
    // active access grant has organizationId === null and must see 0.
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (organizationId === null) return 0;

    const pending = await ctx.db
      .query("letterDispositions")
      .withIndex("by_to_user_and_status", (q) => q.eq("toUserId", userId).eq("status", "pending"))
      .collect();

    // Count those not yet read, restricted to letters in the effective org.
    let count = 0;
    for (const d of pending) {
      if (d.readAt) continue;
      const letter = await ctx.db.get(d.letterId);
      if (!letter || letter.organizationId !== organizationId) continue;
      count += 1;
    }
    return count;
  },
});

/**
 * Count of letters currently waiting for the signed-in user's action as an
 * approver (pemeriksa/penyetuju). A letter counts when it is under review and
 * the user owns the approval row whose turn it is (status "pending"). Powers
 * the sidebar "Kelola Surat" turn badge so approvers know work awaits them.
 * Scoped to the caller's organization.
 */
export const getMyPendingApprovalCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Scope to the caller's EFFECTIVE organization. A super admin without an
    // active access grant has organizationId === null and must see 0.
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (organizationId === null) return 0;

    const me = await ctx.db.get(userId);
    if (!me) return 0;

    const myIds = await getMyUserIds(ctx, me);

    // Gather pending approval rows that belong to any of the user's identities.
    // A user may have a placeholder directory record sharing their email, so we
    // union across myIds.
    const pendingRows: Doc<"letterApprovals">[] = [];
    for (const uid of myIds) {
      const rows = await ctx.db
        .query("letterApprovals")
        .withIndex("by_approver_and_status", (q) =>
          q.eq("approverId", uid).eq("status", "pending"),
        )
        .collect();
      pendingRows.push(...rows);
    }

    // Only count those whose letter is still under review and in the user's org.
    const seen = new Set<Id<"letters">>();
    let count = 0;
    for (const row of pendingRows) {
      if (seen.has(row.letterId)) continue;
      seen.add(row.letterId);
      const letter = await ctx.db.get(row.letterId);
      if (!letter) continue;
      if (letter.status !== "review") continue;
      if (letter.organizationId !== organizationId) continue;
      count += 1;
    }
    return count;
  },
});

/**
 * Count of the signed-in user's OWN letters (as author/konseptor) that still
 * need their follow-up action. These are letters whose process is not finished
 * and the ball is in the konseptor's court:
 *  - "draft": belum diajukan/dikirim
 *  - "revision": dikembalikan untuk diperbaiki
 *  - "rejected": ditolak, perlu ditindaklanjuti
 *  - "approved": sudah disetujui tetapi belum dikirim
 * Powers the sidebar "Kelola Surat" follow-up indicator for konseptors.
 * Scoped to the caller's organization.
 */
export const getMyUnfinishedLetterCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Scope to the caller's EFFECTIVE organization. A super admin without an
    // active access grant has organizationId === null and must see 0 (never
    // their own letters attached to some org).
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (organizationId === null) return 0;

    const mine = await ctx.db
      .query("letters")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();

    const needsAction = new Set(["draft", "revision", "rejected", "approved"]);
    let count = 0;
    for (const l of mine) {
      if (l.organizationId !== organizationId) continue;
      if (needsAction.has(l.status)) count += 1;
    }
    return count;
  },
});

/**
 * Count of letters addressed to the current user (as recipient or tembusan/CC)
 * that they have not yet opened. Powers the sidebar "Kelola Surat" arrival
 * badge, mirroring the unread-messages indicator. Covers ALL letter types
 * (masuk, keluar, internal, memo) so any letter sent to the user is flagged.
 * Scoped to the caller's organization.
 */
export const getIncomingLettersBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Scope to the caller's EFFECTIVE organization. A super admin without an
    // active access grant has organizationId === null and must see 0.
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (organizationId === null) return 0;

    const me = await ctx.db.get(userId);
    if (!me) return 0;

    const orgId = organizationId;

    // Letters where the user is the direct recipient.
    const asRecipient = await ctx.db
      .query("letters")
      .withIndex("by_recipient", (q) => q.eq("toUserId", me._id))
      .order("desc")
      .take(200);

    // Letters where the user is a tembusan (CC). CC is stored as an array, so we
    // scan recent letters and match. Bounded to the most recent 200.
    const recent = await ctx.db
      .query("letters")
      .withIndex("by_letter_date")
      .order("desc")
      .take(200);
    const asCc = recent.filter((l) => (l.ccUserIds ?? []).includes(me._id));

    // Merge unique letters, keeping only those the user is currently allowed to
    // see. A recipient/CC is only notified once the letter reaches a stage where
    // it is visible to them (e.g. sent/approved/received) — never while it is
    // still a draft or moving through the approval chain.
    const myIds = await getMyUserIds(ctx, me);
    const byId = new Map<string, Doc<"letters">>();
    for (const l of [...asRecipient, ...asCc]) {
      if (l.authorId === me._id) continue;
      if (l.organizationId !== orgId) continue;
      if (!(await canViewLetter(ctx, l, me, myIds))) continue;
      byId.set(l._id, l);
    }

    // Count only those the user has not yet opened.
    let unread = 0;
    for (const l of byId.values()) {
      const read = await ctx.db
        .query("letterReads")
        .withIndex("by_user_and_letter", (q) =>
          q.eq("userId", me._id).eq("letterId", l._id),
        )
        .unique();
      if (!read) unread += 1;
    }
    return unread;
  },
});

/**
 * Marks the current moment as the point the user last viewed incoming letters,
 * clearing the sidebar arrival badge. Called when the letters page opens.
 */
export const markIncomingLettersSeen = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!me) return;
    await ctx.db.patch(me._id, { lettersLastSeenAt: new Date().toISOString() });
  },
});

/**
 * Marks a specific letter as read by the current user. Called when the user
 * opens a letter's detail view, so the list can render it in normal (not bold)
 * weight afterwards. Idempotent: a letter is only recorded as read once per user.
 */
export const markLetterRead = mutation({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    // Stempel status baca pada baris penerima massal (bila pemanggil termasuk).
    // Ini yang menggerakkan progres "Dibaca X dari Y" untuk pengirim.
    const recipientRow = await ctx.db
      .query("letterRecipients")
      .withIndex("by_user_and_letter", (q) =>
        q.eq("userId", me._id).eq("letterId", args.letterId),
      )
      .unique();
    if (recipientRow && !recipientRow.readAt) {
      await ctx.db.patch(recipientRow._id, { readAt: new Date().toISOString() });
    }

    const existing = await ctx.db
      .query("letterReads")
      .withIndex("by_user_and_letter", (q) =>
        q.eq("userId", me._id).eq("letterId", args.letterId),
      )
      .unique();
    if (existing) return;
    await ctx.db.insert("letterReads", {
      letterId: args.letterId,
      userId: me._id,
      readAt: new Date().toISOString(),
      organizationId: me.organizationId,
    });
  },
});

// Daftar penerima massal sebuah surat beserta status bacanya. Hanya dapat
// diakses oleh orang yang boleh melihat surat (pengirim/konseptor, admin,
// super_admin, atau penerima). Mengembalikan ringkasan progres baca.
export type LetterRecipientsResult = {
  mode: string | null;
  department: string | null;
  total: number;
  readCount: number;
  recipients: Array<{
    userId: Id<"users">;
    name: string;
    jobTitle: string | null;
    department: string | null;
    source: string;
    readAt: string | null;
    deliveredAt: string;
  }>;
};

export const getLetterRecipients = query({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<LetterRecipientsResult | null> => {
    const me = await requireAuth(ctx);
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "letters")) {
      return null;
    }
    const letter = await ctx.db.get(args.letterId);
    if (!letter) return null;
    const myIds = await getMyUserIds(ctx, me);
    if (!(await canViewLetter(ctx, letter, me, myIds))) return null;

    const rows = await ctx.db
      .query("letterRecipients")
      .withIndex("by_letter", (q) => q.eq("letterId", args.letterId))
      .collect();

    const recipients = await Promise.all(
      rows.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return {
          userId: r.userId,
          name: u?.name ?? "Pengguna",
          jobTitle: u?.jobTitle ?? null,
          department: u?.department ?? null,
          source: r.source,
          readAt: r.readAt ?? null,
          deliveredAt: r.deliveredAt,
        };
      }),
    );
    // Urutkan: sudah baca dulu (terbaru di atas per waktu baca), lalu belum baca (abjad).
    recipients.sort((a, b) => {
      if (!!a.readAt !== !!b.readAt) return a.readAt ? -1 : 1;
      return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
    });

    return {
      mode: letter.recipientMode ?? null,
      department: letter.recipientDepartment ?? null,
      total: recipients.length,
      readCount: recipients.filter((r) => r.readAt).length,
      recipients,
    };
  },
});

// ---------------------------------------------------------------------------
// PUBLIC LETTER VERIFICATION (QR code)
// ---------------------------------------------------------------------------

export type LetterVerificationResult =
  | { found: false }
  | {
      found: true;
      subject: string;
      letterNumber: string | null;
      agendaNumber: string | null;
      letterDate: string;
      type: string;
      classification: string;
      status: string;
      isApproved: boolean;
      // Metode tanda tangan surat: "digital" atau "basah" (manual).
      signatureMethod: string;
      sentAt: string | null;
      fromName: string;
      fromOrganization: string | null;
      toName: string;
      authorName: string | null;
      authorJobTitle: string | null;
      organizationName: string | null;
      // Penandatangan utama (pengirim surat) beserta gambar tanda tangannya
      // untuk verifikasi keaslian tanda tangan.
      signer: {
        name: string | null;
        jobTitle: string | null;
        department: string | null;
        nip: string | null;
        signatureImage: string | null;
      } | null;
      signatories: Array<{ name: string; jobTitle: string | null; approvedAt: string | null }>;
    };

/**
 * PUBLIC (no auth) query used by the QR verification page. Given a letter's
 * verification code it returns non-sensitive authenticity metadata so anyone
 * scanning the QR on a printed letter can confirm it was genuinely issued by
 * the organization. The letter body/content is intentionally NOT exposed.
 */
export const verifyByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<LetterVerificationResult> => {
    const normalized = args.code.trim().toUpperCase();
    if (!normalized) return { found: false };

    const letter = await ctx.db
      .query("letters")
      .withIndex("by_verification_code", (q) => q.eq("verificationCode", normalized))
      .first();
    if (!letter) return { found: false };

    const author = letter.authorId ? await ctx.db.get(letter.authorId) : null;

    // Resolve the org display name from the letterhead if present.
    let organizationName: string | null = letter.fromOrganization ?? null;
    if (letter.letterheadId) {
      const lh = await ctx.db.get(letter.letterheadId);
      if (lh?.organizationName) organizationName = lh.organizationName;
    }

    // Signatories = approvers who approved, in order.
    const approvals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_letter_and_order", (q) => q.eq("letterId", letter._id))
      .order("asc")
      .collect();
    const signatories: Array<{ name: string; jobTitle: string | null; approvedAt: string | null }> = [];
    for (const a of approvals) {
      if (a.status !== "approved") continue;
      const approver = a.approverId ? await ctx.db.get(a.approverId) : null;
      signatories.push({
        name: approver?.name ?? "-",
        jobTitle: approver?.jobTitle ?? null,
        approvedAt: a.actedAt ?? null,
      });
    }

    // Penandatangan utama = pengirim surat. Resolusi gambar tanda tangan
    // memakai prioritas yang sama dengan dokumen resmi: (1) tanda tangan
    // penyetuju terakhir bila ada rantai persetujuan, (2) tanda tangan khusus
    // surat ini milik pengirim, (3) tanda tangan default profil pengirim.
    const signerUserId = letter.fromUserId ?? letter.authorId;
    const signerUser = signerUserId ? await ctx.db.get(signerUserId) : null;

    const approvedApprovals = approvals
      .filter((a) => a.status === "approved")
      .sort((a, b) => b.order - a.order);
    let signatureImage: string | null = approvedApprovals[0]?.signatureData ?? null;

    if (!signatureImage && signerUserId) {
      const senderLetterSig = await ctx.db
        .query("letterSignatures")
        .withIndex("by_letter_and_user", (q) =>
          q.eq("letterId", letter._id).eq("userId", signerUserId),
        )
        .first();
      signatureImage =
        senderLetterSig?.signatureData ?? signerUser?.defaultSignature ?? null;
    }

    const isWetSignature = letter.signatureMethod === "basah";
    const signer = {
      name: letter.fromName ?? signerUser?.name ?? null,
      jobTitle: signerUser?.jobTitle ?? null,
      department: signerUser?.department ?? null,
      nip: signerUser?.nip ?? null,
      // Mode basah: gambar TTD tidak ditampilkan karena ditandatangani manual.
      signatureImage: isWetSignature ? null : signatureImage,
    };

    return {
      found: true,
      subject: letter.subject,
      letterNumber: letter.letterNumber ?? null,
      agendaNumber: letter.agendaNumber ?? null,
      letterDate: letter.letterDate,
      type: letter.type,
      classification: letter.classification,
      status: letter.status,
      isApproved: ["approved", "sent", "archived"].includes(letter.status),
      signatureMethod: letter.signatureMethod === "basah" ? "basah" : "digital",
      sentAt: letter.processedAt ?? null,
      fromName: letter.fromName,
      fromOrganization: letter.fromOrganization ?? null,
      toName: letter.toName,
      authorName: author?.name ?? null,
      authorJobTitle: author?.jobTitle ?? null,
      organizationName,
      signer,
      signatories,
    };
  },
});

/**
 * Ensures a letter has a verification code. Useful for letters created before
 * the QR feature existed, or letters that never went through sendLetter but
 * still need a verifiable QR (e.g. viewing the print preview). Auth required.
 */
export const ensureVerificationCode = mutation({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<string> => {
    await requireAuth(ctx);
    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }
    if (letter.verificationCode) return letter.verificationCode;
    const code = await generateUniqueVerificationCode(ctx);
    await ctx.db.patch(args.letterId, { verificationCode: code });
    return code;
  },
});

export const deleteAttachment = mutation({
  args: { attachmentId: v.id("letterAttachments") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new ConvexError({ message: "Lampiran tidak ditemukan", code: "NOT_FOUND" });
    }

    const letter = await ctx.db.get(attachment.letterId);
    if (!letter) {
      throw new ConvexError({ message: "Surat tidak ditemukan", code: "NOT_FOUND" });
    }

    if (attachment.uploaderId !== me._id && me.role !== "admin") {
      throw new ConvexError({ message: "Tidak memiliki izin", code: "FORBIDDEN" });
    }

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);

    await ctx.db.patch(attachment.letterId, {
      attachmentCount: Math.max((letter.attachmentCount ?? 1) - 1, 0),
    });

    await addHistory(
      ctx,
      attachment.letterId,
      me._id,
      "attachment_deleted",
      `Lampiran dihapus: ${attachment.fileName}`,
    );
  },
});

// ─── Company Prefixes ─────────────────────────────────────────────────────────

export const listCompanyPrefixes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("letterCompanyPrefixes").collect();
  },
});

export const seedBuiltInPrefixes = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const me = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!me) throw new ConvexError({ message: "User tidak ditemukan", code: "NOT_FOUND" });
    const builtIns = [
      "SEKR","HRD","DIR","FIN","OPS","IT","MKT","LEG","UMUM",
      "KEU","SDM","TU","ADM","BID","DIV","DEPT","KA","SKT","SKL","SPT",
    ];
    for (const code of builtIns) {
      const existing = await ctx.db.query("letterCompanyPrefixes").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (!existing) {
        await ctx.db.insert("letterCompanyPrefixes", { code, isBuiltIn: true, createdBy: me._id });
      }
    }
  },
});

export const addCompanyPrefix = mutation({
  args: {
    code: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const me = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!me) throw new ConvexError({ message: "User tidak ditemukan", code: "NOT_FOUND" });
    const code = args.code.trim().toUpperCase();
    if (!code) throw new ConvexError({ message: "Kode tidak boleh kosong", code: "BAD_REQUEST" });
    const existing = await ctx.db.query("letterCompanyPrefixes").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (existing) throw new ConvexError({ message: "Kode sudah ada", code: "CONFLICT" });
    await ctx.db.insert("letterCompanyPrefixes", { code, label: args.label, createdBy: me._id });
  },
});

export const deleteCompanyPrefix = mutation({
  args: { prefixId: v.id("letterCompanyPrefixes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    await ctx.db.delete(args.prefixId);
  },
});

export const updateCompanyPrefix = mutation({
  args: {
    prefixId: v.id("letterCompanyPrefixes"),
    code: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const code = args.code.trim().toUpperCase();
    await ctx.db.patch(args.prefixId, { code, label: args.label });
  },
});

// ─── Category Prefix (PREFIX2) CRUD ──────────────────────────────────────────

export const listCategoryPrefixes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("letterCategoryPrefixes").collect();
  },
});

export const seedBuiltInCategoryPrefixes = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const me = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!me) throw new ConvexError({ message: "User tidak ditemukan", code: "NOT_FOUND" });
    const builtIns = [
      { code: "UND",  label: "Undangan" },
      { code: "PMH",  label: "Permohonan" },
      { code: "PBT",  label: "Pemberitahuan" },
      { code: "BLS",  label: "Balasan" },
      { code: "KPT",  label: "Keputusan" },
      { code: "EDR",  label: "Surat Edaran" },
      { code: "MEM",  label: "Nota" },
      { code: "REF",  label: "Referensi" },
      { code: "SKT",  label: "Surat Keterangan" },
      { code: "SKL",  label: "Surat Keluar" },
      { code: "SPT",  label: "Surat Perintah Tugas" },
    ];
    for (const item of builtIns) {
      const existing = await ctx.db.query("letterCategoryPrefixes").withIndex("by_code", (q) => q.eq("code", item.code)).unique();
      if (!existing) {
        await ctx.db.insert("letterCategoryPrefixes", { code: item.code, label: item.label, isBuiltIn: true, createdBy: me._id });
      }
    }
  },
});

export const addCategoryPrefix = mutation({
  args: {
    code: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const me = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!me) throw new ConvexError({ message: "User tidak ditemukan", code: "NOT_FOUND" });
    const code = args.code.trim().toUpperCase();
    if (!code) throw new ConvexError({ message: "Kode tidak boleh kosong", code: "BAD_REQUEST" });
    const existing = await ctx.db.query("letterCategoryPrefixes").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (existing) throw new ConvexError({ message: "Kode sudah ada", code: "CONFLICT" });
    await ctx.db.insert("letterCategoryPrefixes", { code, label: args.label, createdBy: me._id });
  },
});

export const deleteCategoryPrefix = mutation({
  args: { prefixId: v.id("letterCategoryPrefixes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    await ctx.db.delete(args.prefixId);
  },
});

export const updateCategoryPrefix = mutation({
  args: {
    prefixId: v.id("letterCategoryPrefixes"),
    code: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Tidak terautentikasi", code: "UNAUTHENTICATED" });
    const code = args.code.trim().toUpperCase();
    await ctx.db.patch(args.prefixId, { code, label: args.label });
  },
});
