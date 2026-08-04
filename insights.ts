import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireTenant } from "../lib/tenant";

// Severity levels for insight cards.
// "critical" = needs immediate action
// "warning"  = should be addressed soon
// "info"     = suggestion / informational
// "positive" = organization is doing well in this area
export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export type InsightCategory =
  | "span"
  | "succession"
  | "skills"
  | "hierarchy"
  | "leadership"
  | "growth"
  | "department";

export type Insight = {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  category: InsightCategory;
  // Optional actionable recommendation
  recommendation?: string;
  // Optional related user ids for navigation
  relatedUserIds?: Array<Id<"users">>;
  // Optional metric value to show as a headline number
  metric?: string;
};

export type OrgInsightsSummary = {
  generatedAt: string;
  healthScore: number; // 0..100
  totalInsights: number;
  criticalCount: number;
  warningCount: number;
  positiveCount: number;
  insights: Array<Insight>;
  categories: Array<{
    category: InsightCategory;
    label: string;
    count: number;
  }>;
};

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  span: "Rentang Kendali",
  succession: "Suksesi",
  skills: "Keahlian",
  hierarchy: "Hierarki",
  leadership: "Kepemimpinan",
  growth: "Pertumbuhan",
  department: "Departemen",
};

/**
 * Rule-based AI-style org insights.
 * Generates actionable insights from the current org structure by analyzing
 * managerial spans, vacant leadership, succession gaps, skills concentration,
 * hierarchy depth, and more. No external AI model required — runs fully in
 * Convex and is deterministic.
 */
export const getOrgInsights = query({
  args: {},
  handler: async (ctx): Promise<OrgInsightsSummary> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Scope every dataset to the caller's organization so insights are
    // generated per-organization. A super admin without an active grant has
    // organizationId === null and therefore sees no data at all.
    const inOrg = <T extends { organizationId?: Id<"organizations"> }>(
      rows: Array<T>,
    ): Array<T> => rows.filter((r) => r.organizationId === organizationId);

    // Super admin accounts manage the platform and should never be counted as
    // employees in any organization's insights.
    const users = (await ctx.db.query("users").collect())
      .filter((u) => u.role !== "super_admin")
      .filter((u) => u.organizationId === organizationId);
    const userIdSet = new Set<Id<"users">>(users.map((u) => u._id));

    const departments = inOrg(await ctx.db.query("departments").collect());
    const teams = inOrg(await ctx.db.query("teams").collect());
    // Child tables are keyed by user; scope them by the org's user set.
    const successionPlans = (
      await ctx.db.query("successionPlans").collect()
    ).filter((p) => userIdSet.has(p.incumbentId));
    const skills = (await ctx.db.query("employeeSkills").collect()).filter((s) =>
      userIdSet.has(s.userId),
    );
    const positions = inOrg(await ctx.db.query("headcountPositions").collect());
    const dottedLines = (
      await ctx.db.query("dottedLineReports").collect()
    ).filter((d) => userIdSet.has(d.userId));

    const userById = new Map<Id<"users">, Doc<"users">>();
    const childrenOf = new Map<Id<"users">, Array<Doc<"users">>>();
    for (const u of users) userById.set(u._id, u);
    for (const u of users) {
      if (u.managerId) {
        const list = childrenOf.get(u.managerId) ?? [];
        list.push(u);
        childrenOf.set(u.managerId, list);
      }
    }

    const managerIds = new Set<Id<"users">>();
    for (const [mid, kids] of childrenOf.entries()) {
      if (kids.length > 0) managerIds.add(mid);
    }

    const insights: Array<Insight> = [];

    // --- Span of control insights ---
    const stretchedManagers: Array<{ user: Doc<"users">; count: number }> = [];
    const underusedManagers: Array<{ user: Doc<"users">; count: number }> = [];
    for (const mid of managerIds) {
      const m = userById.get(mid);
      if (!m) continue;
      const count = (childrenOf.get(mid) ?? []).length;
      if (count > 10) stretchedManagers.push({ user: m, count });
      else if (count === 1) underusedManagers.push({ user: m, count });
    }

    if (stretchedManagers.length > 0) {
      stretchedManagers.sort((a, b) => b.count - a.count);
      const top = stretchedManagers.slice(0, 3);
      insights.push({
        id: "span-stretched",
        title: `${stretchedManagers.length} atasan kelebihan beban`,
        description: `Beberapa atasan memiliki lebih dari 10 bawahan langsung, rentang ideal adalah 5–8 orang. Contoh: ${top
          .map((t) => `${t.user.name ?? "—"} (${t.count})`)
          .join(", ")}.`,
        severity: stretchedManagers.length >= 3 ? "critical" : "warning",
        category: "span",
        recommendation:
          "Pertimbangkan memecah tim besar, menambah jalur supervisor, atau mendelegasikan sebagian bawahan ke atasan lain.",
        relatedUserIds: top.map((t) => t.user._id),
        metric: `${stretchedManagers.length}`,
      });
    }

    if (underusedManagers.length > 2) {
      insights.push({
        id: "span-underused",
        title: `${underusedManagers.length} atasan dengan hanya 1 bawahan`,
        description:
          "Rentang kendali yang terlalu kecil menciptakan lapisan manajerial berlebih dan memperlambat pengambilan keputusan.",
        severity: "warning",
        category: "span",
        recommendation:
          "Gabungkan tim kecil atau ubah posisi supervisor menjadi kontributor individu (IC).",
        relatedUserIds: underusedManagers.slice(0, 5).map((u) => u.user._id),
        metric: `${underusedManagers.length}`,
      });
    }

    // --- Orphan ICs (no manager + not a manager) ---
    const orphans = users.filter(
      (u) => !u.managerId && !managerIds.has(u._id),
    );
    if (orphans.length > 0) {
      insights.push({
        id: "hierarchy-orphans",
        title: `${orphans.length} karyawan tanpa atasan`,
        description:
          "Karyawan ini belum memiliki jalur pelaporan langsung sehingga tidak muncul di bagan utama.",
        severity: orphans.length >= 5 ? "warning" : "info",
        category: "hierarchy",
        recommendation:
          "Tetapkan atasan langsung untuk setiap karyawan agar bagan organisasi lengkap.",
        relatedUserIds: orphans.slice(0, 5).map((u) => u._id),
        metric: `${orphans.length}`,
      });
    }

    // --- Hierarchy depth ---
    const subtreeDepth = (root: Id<"users">): number => {
      let depth = 0;
      let frontier: Array<Id<"users">> = [root];
      const visited = new Set<Id<"users">>();
      while (frontier.length > 0) {
        const next: Array<Id<"users">> = [];
        for (const id of frontier) {
          if (visited.has(id)) continue;
          visited.add(id);
          const kids = childrenOf.get(id) ?? [];
          for (const k of kids) next.push(k._id);
        }
        if (next.length === 0) break;
        depth += 1;
        frontier = next;
      }
      return depth;
    };
    let maxDepth = 0;
    for (const u of users) {
      if (!u.managerId) {
        const d = subtreeDepth(u._id);
        if (d > maxDepth) maxDepth = d;
      }
    }
    if (maxDepth >= 5) {
      insights.push({
        id: "hierarchy-deep",
        title: `Hierarki cukup dalam (${maxDepth} lapis)`,
        description:
          "Organisasi dengan lebih dari 4 lapis manajerial cenderung lambat dan birokratis.",
        severity: maxDepth >= 6 ? "warning" : "info",
        category: "hierarchy",
        recommendation:
          "Pertimbangkan mendatarkan struktur dan memperbesar rentang kendali manajer.",
        metric: `${maxDepth} lapis`,
      });
    }

    // --- Departments without official head ---
    const deptsByName = new Map<string, Doc<"departments">>();
    for (const d of departments) deptsByName.set(d.name, d);
    const deptsWithoutHead = departments.filter((d) => !d.headId);
    if (deptsWithoutHead.length > 0) {
      insights.push({
        id: "dept-no-head",
        title: `${deptsWithoutHead.length} departemen tanpa kepala`,
        description: `Departemen ini belum memiliki kepala resmi: ${deptsWithoutHead
          .slice(0, 4)
          .map((d) => d.name)
          .join(", ")}${deptsWithoutHead.length > 4 ? "…" : ""}.`,
        severity: "warning",
        category: "leadership",
        recommendation:
          "Tetapkan kepala departemen di tab Departemen agar jalur eskalasi jelas.",
        metric: `${deptsWithoutHead.length}`,
      });
    }

    // --- Undocumented departments (users have dept but no official record) ---
    const userDeptNames = new Set<string>();
    for (const u of users) {
      if (u.department && u.department.trim().length > 0) {
        userDeptNames.add(u.department.trim());
      }
    }
    const undocumented: Array<string> = [];
    for (const name of userDeptNames) {
      if (!deptsByName.has(name)) undocumented.push(name);
    }
    if (undocumented.length > 0) {
      insights.push({
        id: "dept-undocumented",
        title: `${undocumented.length} departemen belum terdaftar resmi`,
        description: `Karyawan tercatat di ${undocumented
          .slice(0, 4)
          .join(", ")}${undocumented.length > 4 ? "…" : ""}, tapi departemennya belum dibuat resmi.`,
        severity: "info",
        category: "department",
        recommendation:
          "Buat catatan departemen resmi agar memiliki warna, kepala, dan metadata yang konsisten.",
        metric: `${undocumented.length}`,
      });
    }

    // --- Teams without lead ---
    const teamsWithoutLead = teams.filter((t) => !t.leadId);
    if (teamsWithoutLead.length > 0) {
      insights.push({
        id: "team-no-lead",
        title: `${teamsWithoutLead.length} tim tanpa pemimpin`,
        description: "Tim lintas fungsi akan lebih efektif jika memiliki team lead yang jelas.",
        severity: "info",
        category: "leadership",
        recommendation: "Tetapkan team lead untuk tim yang belum memilikinya.",
        metric: `${teamsWithoutLead.length}`,
      });
    }

    // --- Succession gaps: key positions without plans ---
    const incumbentsWithPlans = new Set<Id<"users">>();
    for (const p of successionPlans) {
      incumbentsWithPlans.add(p.incumbentId);
    }
    const keyPositions: Array<Doc<"users">> = [];
    for (const mid of managerIds) {
      const m = userById.get(mid);
      if (!m) continue;
      const subtree = (childrenOf.get(mid) ?? []).length;
      // Key position = has at least 3 direct reports OR is an admin role
      if (subtree >= 3 || m.role === "admin" || m.role === "super_admin") {
        keyPositions.push(m);
      }
    }
    const withoutSuccession = keyPositions.filter(
      (u) => !incumbentsWithPlans.has(u._id),
    );
    if (withoutSuccession.length > 0) {
      insights.push({
        id: "succession-gap",
        title: `${withoutSuccession.length} posisi kunci tanpa rencana suksesi`,
        description: `Jika posisi ini kosong mendadak, perusahaan tidak siap. Contoh: ${withoutSuccession
          .slice(0, 3)
          .map((u) => `${u.name ?? "—"} (${u.jobTitle ?? "—"})`)
          .join(", ")}.`,
        severity: withoutSuccession.length >= 5 ? "critical" : "warning",
        category: "succession",
        recommendation:
          "Buat rencana suksesi minimal 1–2 kandidat per posisi kunci di tab Suksesi.",
        relatedUserIds: withoutSuccession.slice(0, 5).map((u) => u._id),
        metric: `${withoutSuccession.length}`,
      });
    }

    const emergencyReadyCount = successionPlans.filter(
      (p) => p.readiness === "ready_now",
    ).length;
    if (keyPositions.length > 0 && emergencyReadyCount >= keyPositions.length * 0.5) {
      insights.push({
        id: "succession-strong",
        title: "Pipeline suksesi cukup kuat",
        description: `${emergencyReadyCount} kandidat sudah "ready now" untuk posisi kunci, melindungi kelangsungan organisasi.`,
        severity: "positive",
        category: "succession",
        metric: `${emergencyReadyCount} kandidat`,
      });
    }

    // --- Skills coverage ---
    const userSkillCount = new Map<Id<"users">, number>();
    for (const s of skills) {
      userSkillCount.set(s.userId, (userSkillCount.get(s.userId) ?? 0) + 1);
    }
    const usersWithoutSkills = users.filter((u) => !userSkillCount.has(u._id));
    if (users.length > 0 && usersWithoutSkills.length / users.length > 0.5) {
      insights.push({
        id: "skills-missing",
        title: `${usersWithoutSkills.length} karyawan belum mengisi keahlian`,
        description:
          "Lebih dari separuh karyawan belum memiliki catatan keahlian. Data ini penting untuk analisis kesenjangan dan pengembangan.",
        severity: "warning",
        category: "skills",
        recommendation:
          "Ajak karyawan mengisi matriks keahlian di tab Keahlian atau profil pribadi.",
        metric: `${usersWithoutSkills.length}`,
      });
    }

    // Skill concentration - single point of failure
    const skillToUsers = new Map<string, Array<Id<"users">>>();
    for (const s of skills) {
      if (s.level >= 3) {
        // Only count meaningful levels
        const key = `${s.skill.toLowerCase()}|${s.category}`;
        const arr = skillToUsers.get(key) ?? [];
        arr.push(s.userId);
        skillToUsers.set(key, arr);
      }
    }
    const singletonSkills: Array<{ skill: string; holder: Doc<"users"> | null }> = [];
    for (const [key, uids] of skillToUsers.entries()) {
      if (uids.length === 1) {
        const skillName = key.split("|")[0];
        const holder = userById.get(uids[0]) ?? null;
        if (holder && skillName) {
          singletonSkills.push({ skill: skillName, holder });
        }
      }
    }
    if (singletonSkills.length >= 3) {
      insights.push({
        id: "skills-bus-factor",
        title: `${singletonSkills.length} keahlian hanya dipegang 1 orang`,
        description: `Risiko "bus factor" — jika karyawan ini pergi, keahlian hilang. Contoh: ${singletonSkills
          .slice(0, 3)
          .map((s) => `${s.skill} (${s.holder?.name ?? "—"})`)
          .join(", ")}.`,
        severity: "warning",
        category: "skills",
        recommendation:
          "Latih karyawan lain atau dokumentasikan knowledge untuk mengurangi ketergantungan.",
        relatedUserIds: singletonSkills
          .slice(0, 5)
          .map((s) => s.holder?._id)
          .filter((id): id is Id<"users"> => Boolean(id)),
        metric: `${singletonSkills.length}`,
      });
    }

    // --- Growth: open positions ---
    const openPositions = positions.filter(
      (p) => p.status === "planned" || p.status === "approved" || p.status === "posted",
    );
    if (openPositions.length > 0) {
      insights.push({
        id: "growth-open",
        title: `${openPositions.length} posisi terbuka direncanakan`,
        description: `Organisasi berencana menambah ${openPositions.length} karyawan baru. ${
          openPositions.filter((p) => p.status === "posted").length
        } sudah dibuka untuk rekrutmen.`,
        severity: "info",
        category: "growth",
        recommendation:
          "Pastikan timeline rekrutmen selaras dengan tanggal mulai yang direncanakan.",
        metric: `${openPositions.length}`,
      });
    }

    // --- Department size imbalance ---
    const deptSizes = new Map<string, number>();
    for (const u of users) {
      const d = (u.department ?? "Tanpa Departemen").trim() || "Tanpa Departemen";
      deptSizes.set(d, (deptSizes.get(d) ?? 0) + 1);
    }
    if (deptSizes.size >= 2) {
      const sizes = Array.from(deptSizes.entries()).sort((a, b) => b[1] - a[1]);
      const biggest = sizes[0];
      const smallest = sizes[sizes.length - 1];
      if (biggest[1] >= smallest[1] * 5 && biggest[1] >= 10) {
        insights.push({
          id: "dept-imbalance",
          title: "Ketimpangan ukuran departemen",
          description: `Departemen "${biggest[0]}" memiliki ${biggest[1]} orang, sementara "${smallest[0]}" hanya ${smallest[1]} orang.`,
          severity: "info",
          category: "department",
          recommendation:
            "Evaluasi apakah ukuran departemen sudah sesuai dengan kebutuhan bisnis atau perlu dirombak.",
          metric: `${biggest[1]} vs ${smallest[1]}`,
        });
      }
    }

    // --- Dotted line usage (positive) ---
    if (dottedLines.length >= 3) {
      insights.push({
        id: "dotted-rich",
        title: `${dottedLines.length} jalur pelaporan sekunder aktif`,
        description:
          "Organisasi sudah memanfaatkan jalur pelaporan matriks untuk kolaborasi lintas tim.",
        severity: "positive",
        category: "hierarchy",
        metric: `${dottedLines.length}`,
      });
    }

    // --- Computed health score ---
    const criticalCount = insights.filter((i) => i.severity === "critical").length;
    const warningCount = insights.filter((i) => i.severity === "warning").length;
    const positiveCount = insights.filter((i) => i.severity === "positive").length;
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        100 - criticalCount * 20 - warningCount * 8 + positiveCount * 5,
      ),
    );

    // Sort: critical > warning > info > positive
    const severityOrder: Record<InsightSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      positive: 3,
    };
    insights.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );

    const categoryCounts = new Map<InsightCategory, number>();
    for (const i of insights) {
      categoryCounts.set(i.category, (categoryCounts.get(i.category) ?? 0) + 1);
    }
    const categories = Array.from(categoryCounts.entries()).map(
      ([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category],
        count,
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      healthScore,
      totalInsights: insights.length,
      criticalCount,
      warningCount,
      positiveCount,
      insights,
      categories,
    };
  },
});
