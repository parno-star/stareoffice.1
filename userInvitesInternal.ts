import { ConvexError, v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";
import { normalizeEmail } from "./lib/email";

const ALERT_KEY = "plan_alerts";

export type InviteContext = {
  orgName: string;
  senderEmail: string;
  senderName: string;
  // The admin's own email — used as reply-to so replies reach them directly.
  adminEmail: string;
  // The subset of requested recipient emails that actually belong to an
  // employee in the caller's directory. Only these are allowed to be invited.
  validEmails: Array<string>;
};

/**
 * Internal: resolves everything the invite email action needs — the caller's
 * organization name, the verified sender address, and the admin's display name.
 * It ALSO validates the requested recipients against the employee directory:
 * only emails that already belong to an employee record in the caller's
 * organization are returned in `validEmails`. This enforces the rule that
 * invitations can only be sent to people the admin has already added to the
 * directory (no manually typed / external addresses), so the invited person is
 * auto-linked and activated on first login without re-registration or approval.
 *
 * Throws FORBIDDEN for non-admins so the action fails loudly.
 */
export const getInviteContext = internalQuery({
  args: { recipients: v.array(v.string()) },
  handler: async (ctx, args): Promise<InviteContext> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organisasi belum ditentukan",
      });
    }

    const me = await ctx.db.get(userId);
    if (!me || !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengirim undangan",
      });
    }

    const org = await ctx.db.get(organizationId);
    if (!org) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Organisasi tidak ditemukan",
      });
    }

    // Build the set of employee emails that exist in THIS organization's
    // directory. Invitations may only target these addresses.
    const requested = new Set(
      args.recipients.map((e) => normalizeEmail(e)).filter((e) => e.length > 0),
    );
    const validEmails: Array<string> = [];
    if (requested.size > 0) {
      const seen = new Set<string>();
      for await (const u of ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )) {
        if (u.role === "super_admin") continue;
        const email = u.email ? normalizeEmail(u.email) : "";
        if (!email || seen.has(email)) continue;
        if (requested.has(email)) {
          seen.add(email);
          validEmails.push(email);
        }
      }
    }

    // Reuse the verified sender configured for system emails.
    const settings = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", ALERT_KEY))
      .unique();
    const senderEmail =
      settings?.emailEnabled && settings.senderEmail ? settings.senderEmail : "";

    return {
      orgName: org.name,
      senderEmail,
      senderName: me.name ?? "Administrator",
      adminEmail: me.email ?? "",
      validEmails,
    };
  },
});
