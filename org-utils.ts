import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

export type PositionLevelInfo = {
  code: string;
  name: string;
  rank: number;
  color: string;
};

export type PositionLevelMap = Record<string, PositionLevelInfo>;

export type OrgNode = {
  user: Doc<"users">;
  children: Array<OrgNode>;
  depth: number;
  positionLevel?: PositionLevelInfo;
};

// Build forest of employees: root nodes are users with no manager (or whose
// manager isn't found). Returns all root nodes sorted by name.
export function buildOrgTree(
  users: Array<Doc<"users">>,
  positionLevelMap?: PositionLevelMap,
): Array<OrgNode> {
  const usersById = new Map<Id<"users">, Doc<"users">>();
  for (const u of users) {
    usersById.set(u._id, u);
  }

  const childrenByParent = new Map<Id<"users">, Array<Doc<"users">>>();
  const roots: Array<Doc<"users">> = [];

  for (const u of users) {
    if (u.managerId && usersById.has(u.managerId)) {
      const list = childrenByParent.get(u.managerId) ?? [];
      list.push(u);
      childrenByParent.set(u.managerId, list);
    } else {
      roots.push(u);
    }
  }

  const sortByName = (a: Doc<"users">, b: Doc<"users">) =>
    (a.name ?? "").localeCompare(b.name ?? "", "id", { sensitivity: "base" });

  const toNode = (user: Doc<"users">, depth: number): OrgNode => {
    const kids = (childrenByParent.get(user._id) ?? []).slice().sort(sortByName);
    return {
      user,
      depth,
      children: kids.map((c) => toNode(c, depth + 1)),
      positionLevel: positionLevelMap?.[user._id],
    };
  };

  return roots.slice().sort(sortByName).map((u) => toNode(u, 0));
}

export type DepartmentGroup = {
  department: string;
  members: Array<Doc<"users">>;
};

export function groupByDepartment(
  users: Array<Doc<"users">>,
): Array<DepartmentGroup> {
  const map = new Map<string, Array<Doc<"users">>>();
  for (const u of users) {
    const key = u.department?.trim() ?? "";
    const bucket = map.get(key) ?? [];
    bucket.push(u);
    map.set(key, bucket);
  }
  const groups: Array<DepartmentGroup> = [];
  for (const [key, members] of map.entries()) {
    groups.push({
      department: key.length > 0 ? key : "Tanpa Departemen",
      members: members.slice().sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "id", {
          sensitivity: "base",
        }),
      ),
    });
  }
  groups.sort((a, b) => {
    // "Tanpa Departemen" goes last
    if (a.department === "Tanpa Departemen") return 1;
    if (b.department === "Tanpa Departemen") return -1;
    return a.department.localeCompare(b.department, "id", {
      sensitivity: "base",
    });
  });
  return groups;
}

export function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function countDirectReports(
  userId: Id<"users">,
  users: Array<Doc<"users">>,
): number {
  let count = 0;
  for (const u of users) {
    if (u.managerId === userId) count += 1;
  }
  return count;
}

// ----- Color tokens used for departments & teams -----
export const COLOR_TOKENS = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "sky",
  "teal",
  "orange",
  "pink",
  "indigo",
  "lime",
  "fuchsia",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export function colorClasses(token: string): {
  bg: string;
  text: string;
  border: string;
  bgSolid: string;
  ring: string;
} {
  switch (token) {
    case "emerald":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
        bgSolid: "bg-emerald-500",
        ring: "ring-emerald-500/30",
      };
    case "violet":
      return {
        bg: "bg-violet-500/10",
        text: "text-violet-600 dark:text-violet-400",
        border: "border-violet-500/30",
        bgSolid: "bg-violet-500",
        ring: "ring-violet-500/30",
      };
    case "amber":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
        bgSolid: "bg-amber-500",
        ring: "ring-amber-500/30",
      };
    case "rose":
      return {
        bg: "bg-rose-500/10",
        text: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/30",
        bgSolid: "bg-rose-500",
        ring: "ring-rose-500/30",
      };
    case "red":
      return {
        bg: "bg-red-500/10",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-500/30",
        bgSolid: "bg-red-500",
        ring: "ring-red-500/30",
      };
    case "sky":
      return {
        bg: "bg-sky-500/10",
        text: "text-sky-600 dark:text-sky-400",
        border: "border-sky-500/30",
        bgSolid: "bg-sky-500",
        ring: "ring-sky-500/30",
      };
    case "teal":
      return {
        bg: "bg-teal-500/10",
        text: "text-teal-600 dark:text-teal-400",
        border: "border-teal-500/30",
        bgSolid: "bg-teal-500",
        ring: "ring-teal-500/30",
      };
    case "orange":
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/30",
        bgSolid: "bg-orange-500",
        ring: "ring-orange-500/30",
      };
    case "pink":
      return {
        bg: "bg-pink-500/10",
        text: "text-pink-600 dark:text-pink-400",
        border: "border-pink-500/30",
        bgSolid: "bg-pink-500",
        ring: "ring-pink-500/30",
      };
    case "indigo":
      return {
        bg: "bg-indigo-500/10",
        text: "text-indigo-600 dark:text-indigo-400",
        border: "border-indigo-500/30",
        bgSolid: "bg-indigo-500",
        ring: "ring-indigo-500/30",
      };
    case "lime":
      return {
        bg: "bg-lime-500/10",
        text: "text-lime-600 dark:text-lime-400",
        border: "border-lime-500/30",
        bgSolid: "bg-lime-500",
        ring: "ring-lime-500/30",
      };
    case "fuchsia":
      return {
        bg: "bg-fuchsia-500/10",
        text: "text-fuchsia-600 dark:text-fuchsia-400",
        border: "border-fuchsia-500/30",
        bgSolid: "bg-fuchsia-500",
        ring: "ring-fuchsia-500/30",
      };
    case "yellow":
      return {
        bg: "bg-yellow-500/10",
        text: "text-yellow-600 dark:text-yellow-400",
        border: "border-yellow-500/30",
        bgSolid: "bg-yellow-500",
        ring: "ring-yellow-500/30",
      };
    case "green":
      return {
        bg: "bg-green-500/10",
        text: "text-green-600 dark:text-green-400",
        border: "border-green-500/30",
        bgSolid: "bg-green-500",
        ring: "ring-green-500/30",
      };
    case "gray":
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-600 dark:text-gray-400",
        border: "border-gray-500/30",
        bgSolid: "bg-gray-500",
        ring: "ring-gray-500/30",
      };
    case "blue":
    default:
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30",
        bgSolid: "bg-blue-500",
        ring: "ring-blue-500/30",
      };
  }
}
