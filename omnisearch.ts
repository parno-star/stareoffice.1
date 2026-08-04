import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { normalizeRole, DEFAULT_ROLE_MENUS, type MenuKey } from "./roles";
import { requireTenant } from "./lib/tenant";

// Result entity kinds surfaced in the omnisearch.
export type SearchResultKind =
  | "person"
  | "announcement"
  | "document"
  | "policy"
  | "wiki"
  | "course"
  | "forum"
  | "job"
  | "position"
  | "asset"
  | "recruitment_job"
  | "candidate"
  | "objective";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  meta?: string;
  link: string;
  // Menu key this result belongs to, so we can hide groups a user can't access
  menuKey?: MenuKey;
};

const RESULT_LIMIT_PER_KIND = 6;
const MIN_QUERY_LEN = 2;

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<ReadonlyArray<SearchResult>> => {
    const q = args.query.trim();
    if (q.length < MIN_QUERY_LEN) return [];

    // Resolve current user + allowed menus for filtering results.
    const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const user = await ctx.db.get(userId);
    if (!user) return [];

    const role = normalizeRole(user.role);
    const override = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (idx) => idx.eq("role", role))
      .unique();
    const allowedArray = override?.allowedMenus ?? DEFAULT_ROLE_MENUS[role];
    const allowed = new Set<MenuKey>(allowedArray as ReadonlyArray<MenuKey>);

    const results: Array<SearchResult> = [];
    const qLower = q.toLowerCase();

    // --- People ---------------------------------------------------------
    if (allowed.has("directory")) {
      const people = await ctx.db
        .query("users")
        .withSearchIndex("search_name", (idx) => idx.search("name", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const p of people) {
        if (!p.name) continue;
        const parts: Array<string> = [];
        if (p.jobTitle) parts.push(p.jobTitle);
        if (p.department) parts.push(p.department);
        results.push({
          kind: "person",
          id: p._id,
          title: p.name,
          subtitle: parts.join(" · "),
          description: p.email,
          link: `/directory/${p._id}`,
          menuKey: "directory",
        });
      }
    }

    // --- News / Announcements ------------------------------------------
    if (allowed.has("news")) {
      const announcements = await ctx.db
        .query("announcements")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const a of announcements) {
        if (a.status === "draft") continue;
        results.push({
          kind: "announcement",
          id: a._id,
          title: a.title,
          subtitle: a.category ?? "Pengumuman",
          description: a.summary,
          meta: a.priority === "urgent" ? "Urgent" : undefined,
          link: `/news/${a._id}`,
          menuKey: "news",
        });
      }
    }

    // --- Documents ------------------------------------------------------
    if (allowed.has("documents")) {
      const docs = await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const d of docs) {
        results.push({
          kind: "document",
          id: d._id,
          title: d.title,
          subtitle: d.category,
          description: d.description,
          meta: d.fileName,
          link: `/documents`,
          menuKey: "documents",
        });
      }
    }

    // --- Policies -------------------------------------------------------
    if (allowed.has("policies")) {
      const policies = await ctx.db
        .query("policies")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const p of policies) {
        if (p.status === "draft" || p.status === "archived") continue;
        results.push({
          kind: "policy",
          id: p._id,
          title: p.title,
          subtitle: `Kebijakan · ${p.category}`,
          description: p.summary,
          meta: `v${p.version}`,
          link: `/policies/${p._id}`,
          menuKey: "policies",
        });
      }
    }

    // --- Wiki articles --------------------------------------------------
    if (allowed.has("wiki")) {
      const articles = await ctx.db
        .query("wikiArticles")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const a of articles) {
        if (a.status === "draft") continue;
        results.push({
          kind: "wiki",
          id: a._id,
          title: a.title,
          subtitle: "Wiki",
          description: a.summary,
          link: `/wiki/article/${a._id}`,
          menuKey: "wiki",
        });
      }
    }

    // --- Courses --------------------------------------------------------
    if (allowed.has("training")) {
      const courses = await ctx.db
        .query("courses")
        .withSearchIndex("search_title", (idx) =>
          idx.search("title", q).eq("isPublished", true),
        )
        .take(RESULT_LIMIT_PER_KIND);
      for (const c of courses) {
        results.push({
          kind: "course",
          id: c._id,
          title: c.title,
          subtitle: `Pelatihan · ${c.category}`,
          description: c.description,
          meta: `${c.durationMinutes} menit`,
          link: `/training/${c._id}`,
          menuKey: "training",
        });
      }
    }

    // --- Forum threads --------------------------------------------------
    if (allowed.has("forum")) {
      const threads = await ctx.db
        .query("forumThreads")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const t of threads) {
        results.push({
          kind: "forum",
          id: t._id,
          title: t.title,
          subtitle: `Forum · ${t.category}`,
          meta: `${t.replyCount} balasan`,
          link: `/forum/${t._id}`,
          menuKey: "forum",
        });
      }
    }

    // --- Internal job postings -----------------------------------------
    if (allowed.has("jobs")) {
      const jobs = await ctx.db
        .query("jobPostings")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const j of jobs) {
        if (j.status !== "open") continue;
        results.push({
          kind: "job",
          id: j._id,
          title: j.title,
          subtitle: `Lowongan · ${j.department}`,
          description: j.location,
          meta: j.employmentType,
          link: `/jobs/${j._id}`,
          menuKey: "jobs",
        });
      }
    }

    // --- Assets ---------------------------------------------------------
    if (allowed.has("assets")) {
      const assets = await ctx.db
        .query("assets")
        .withSearchIndex("search_name", (idx) => idx.search("name", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const a of assets) {
        results.push({
          kind: "asset",
          id: a._id,
          title: a.name,
          subtitle: `Aset · ${a.category}`,
          description: a.assetTag,
          meta: a.status,
          link: `/assets/${a._id}`,
          menuKey: "assets",
        });
      }
    }

    // --- Grading Positions ---------------------------------------------
    if (allowed.has("grading")) {
      const positions = await ctx.db
        .query("ggsPositions")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const p of positions) {
        if (p.status !== "active") continue;
        results.push({
          kind: "position",
          id: p._id,
          title: p.title,
          subtitle: `Jabatan · ${p.department}`,
          description: p.summary,
          meta:
            p.currentGrade !== undefined ? `Grade ${p.currentGrade}` : undefined,
          link: `/grading/${p._id}`,
          menuKey: "grading",
        });
      }
    }

    // --- Recruitment Jobs ---------------------------------------------
    if (allowed.has("recruitment")) {
      const jobs = await ctx.db
        .query("recruitmentJobs")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const j of jobs) {
        results.push({
          kind: "recruitment_job",
          id: j._id,
          title: j.title,
          subtitle: `Rekrutmen · ${j.department}`,
          description: j.location,
          meta: j.status,
          link: `/recruitment`,
          menuKey: "recruitment",
        });
      }

      // Candidates
      const candidates = await ctx.db
        .query("candidates")
        .withSearchIndex("search_name", (idx) => idx.search("firstName", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const c of candidates) {
        const name = `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`;
        results.push({
          kind: "candidate",
          id: c._id,
          title: name,
          subtitle: c.currentTitle
            ? `Kandidat · ${c.currentTitle}`
            : "Kandidat",
          description: c.currentCompany,
          meta: c.email,
          link: `/recruitment`,
          menuKey: "recruitment",
        });
      }
    }

    // --- OKR Objectives ------------------------------------------------
    if (allowed.has("okr")) {
      const objectives = await ctx.db
        .query("objectives")
        .withSearchIndex("search_title", (idx) => idx.search("title", q))
        .take(RESULT_LIMIT_PER_KIND);
      for (const o of objectives) {
        results.push({
          kind: "objective",
          id: o._id,
          title: o.title,
          subtitle: `OKR · ${o.periodLabel}`,
          description: o.description,
          meta: `${Math.round(o.progress)}% • ${o.health}`,
          link: `/okr`,
          menuKey: "okr",
        });
      }
    }

    // Rank boost: exact (case-insensitive) title matches first.
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === qLower ? 0 : 1;
      const bExact = b.title.toLowerCase() === qLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.title.toLowerCase().startsWith(qLower) ? 0 : 1;
      const bStarts = b.title.toLowerCase().startsWith(qLower) ? 0 : 1;
      return aStarts - bStarts;
    });

    return results;
  },
});
