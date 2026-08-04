import type { Doc } from "../_generated/dataModel.d.ts";

/**
 * Shared rule for deciding whether a user counts as a real employee of an
 * organization. Two kinds of accounts are EXCLUDED from every employee count
 * and listing so real headcount stays accurate:
 *
 *  - Test/simulation accounts (`isTestAccount === true`), used by the platform
 *    owner to try features inside any organization without inflating numbers.
 *  - super_admin accounts, which manage the whole platform and are never a
 *    member of any single organization's workforce.
 *
 * Every place that counts or lists employees (directory, dashboards, HR
 * analytics, plan/seat usage, billing) should filter with this helper.
 */
export function isCountableEmployee(user: Doc<"users">): boolean {
  if (user.isTestAccount === true) return false;
  if (user.role === "super_admin") return false;
  return true;
}

/** Convenience: filter an array of users down to real, countable employees. */
export function filterCountableEmployees(
  users: Array<Doc<"users">>,
): Array<Doc<"users">> {
  return users.filter(isCountableEmployee);
}
